import React, { useState, useCallback, useRef } from 'react';
import { AppScreen, StoryConfig, StoryPage } from './types';
import {
  generateStoryPage, generateImage, generateSpeech, QuotaError
} from './services/geminiService';
import HomeScreen from './components/HomeScreen';
import LoadingScreen from './components/LoadingScreen';
import StoryViewer from './components/StoryViewer';
import Controls from './components/Controls';
import ApiKeyBanner from './components/ApiKeyBanner';
import { SparklesIcon } from '@heroicons/react/24/solid';
import { generateStoryPDF } from './services/pdfService';
import DownloadModal from './components/DownloadModal';

const App: React.FC = () => {
  // ── Screen management ──────────────────────────────────────────────────────
  const [screen, setScreen] = useState<AppScreen>('home');
  const [storyConfig, setStoryConfig] = useState<StoryConfig | null>(null);

  // ── Story state ────────────────────────────────────────────────────────────
  const [storyPages, setStoryPages] = useState<StoryPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isLoadingTTS, setIsLoadingTTS] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState(0);

  // ── API key / quota ────────────────────────────────────────────────────────
  const [userApiKey, setUserApiKey] = useState<string | undefined>(undefined);
  const [showApiKeyBanner, setShowApiKeyBanner] = useState(false);

  // ── Audio refs ─────────────────────────────────────────────────────────────
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const userAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const handleQuotaError = useCallback((error: unknown) => {
    if (error instanceof QuotaError) {
      setShowApiKeyBanner(true);
      return true;
    }
    return false;
  }, []);

  const stopReading = useCallback(() => {
    audioSourceRef.current?.stop();
    audioSourceRef.current = null;
    if (userAudioRef.current) {
      userAudioRef.current.pause();
      userAudioRef.current.currentTime = 0;
      userAudioRef.current = null;
    }
    setIsReading(false);
  }, []);

  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  // ── Story generation (must come before prefetchPages) ─────────────────────
  const loadImageForPage = useCallback(async (pageIndex: number, pages: StoryPage[]) => {
    if (pages[pageIndex]?.imageUrl) return;
    setIsLoadingImage(true);
    try {
      const imageUrl = await generateImage(pages[pageIndex].imagePrompt);
      setStoryPages(prev => {
        const updated = [...prev];
        updated[pageIndex] = { ...updated[pageIndex], imageUrl };
        return updated;
      });
    } catch (error) {
      if (!handleQuotaError(error)) console.error('Image generation failed:', error);
    } finally {
      setIsLoadingImage(false);
    }
  }, [handleQuotaError]);

  const generateNextPage = useCallback(async (
    config: StoryConfig,
    pageIndex: number,
    existingPages: StoryPage[]
  ): Promise<StoryPage | null> => {
    try {
      const previousTexts = existingPages.slice(0, pageIndex).map(p => p.text);
      const { text, imagePrompt } = await generateStoryPage(config, pageIndex, previousTexts);
      return { id: pageIndex + 1, text, imagePrompt };
    } catch (error) {
      handleQuotaError(error);
      return null;
    }
  }, [handleQuotaError]);

  // ── Prefetch next 2 pages in background (after generateNextPage) ──────────
  const prefetchPages = useCallback(async (
    config: StoryConfig,
    currentIndex: number,
    pages: StoryPage[]
  ) => {
    const targets = [currentIndex + 1, currentIndex + 2].filter(
      i => i < config.pageCount && !pages[i]
    );

    for (const targetIndex of targets) {
      setStoryPages(prev => {
        if (prev[targetIndex]) return prev;
        const updated = [...prev];
        updated[targetIndex] = { id: targetIndex + 1, text: '', imagePrompt: '', isGenerating: true };
        return updated;
      });

      try {
        const previousPages = pages.slice(0, targetIndex);
        const newPage = await generateNextPage(config, targetIndex, previousPages);
        if (!newPage) continue;

        setStoryPages(prev => {
          const updated = [...prev];
          updated[targetIndex] = newPage;
          return updated;
        });

        generateImage(newPage.imagePrompt).then(imageUrl => {
          setStoryPages(prev => {
            const updated = [...prev];
            if (updated[targetIndex]) {
              updated[targetIndex] = { ...updated[targetIndex], imageUrl };
            }
            return updated;
          });
        }).catch(err => console.error('Background image prefetch failed:', err));

      } catch (error) {
        console.error(`Prefetch failed for page ${targetIndex}:`, error);
      }
    }
  }, [generateNextPage]);

  // ── Handle "Generate Story" click ─────────────────────────────────────────
  const handleGenerate = useCallback(async (config: StoryConfig) => {
    setStoryConfig(config);
    setScreen('loading');
    setStoryPages([]);
    setCurrentPageIndex(0);

    const firstPage = await generateNextPage(config, 0, []);
    if (!firstPage) {
      setScreen('home');
      return;
    }

    const initialPages: StoryPage[] = [firstPage];
    setStoryPages(initialPages);
    setScreen('story');

    await loadImageForPage(0, initialPages);
    prefetchPages(config, 0, initialPages);
  }, [generateNextPage, loadImageForPage, prefetchPages]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const handleNextPage = useCallback(async () => {
    if (!storyConfig) return;
    const nextIndex = currentPageIndex + 1;
    if (nextIndex >= storyConfig.pageCount) return;

    stopReading();
    handleStopRecording();

    if (!storyPages[nextIndex] || storyPages[nextIndex].isGenerating) {
      setStoryPages(prev => {
        const updated = [...prev];
        if (!updated[nextIndex]) {
          updated[nextIndex] = { id: nextIndex + 1, text: '', imagePrompt: '', isGenerating: true };
        }
        return updated;
      });
      setCurrentPageIndex(nextIndex);

      const newPage = await generateNextPage(storyConfig, nextIndex, storyPages);
      if (!newPage) return;

      setStoryPages(prev => {
        const updated = [...prev];
        updated[nextIndex] = newPage;
        return updated;
      });

      const pagesWithNew = [...storyPages.slice(0, nextIndex), newPage];
      await loadImageForPage(nextIndex, pagesWithNew);
      prefetchPages(storyConfig, nextIndex, pagesWithNew);
    } else {
      setCurrentPageIndex(nextIndex);
      await loadImageForPage(nextIndex, storyPages);
      prefetchPages(storyConfig, nextIndex, storyPages);
    }
  }, [currentPageIndex, storyConfig, storyPages, stopReading, handleStopRecording, generateNextPage, loadImageForPage, prefetchPages]);

  const handlePrevPage = useCallback(() => {
    if (currentPageIndex <= 0) return;
    stopReading();
    handleStopRecording();
    setCurrentPageIndex(prev => prev - 1);
  }, [currentPageIndex, stopReading, handleStopRecording]);

  const handleGoHome = useCallback(() => {
    stopReading();
    handleStopRecording();
    setScreen('home');
    setStoryPages([]);
    setCurrentPageIndex(0);
  }, [stopReading, handleStopRecording]);

  // ── Read aloud ─────────────────────────────────────────────────────────────
  const handleReadAloud = useCallback(async () => {
    if (isReading) { stopReading(); return; }

    const currentPage = storyPages[currentPageIndex];
    if (!currentPage?.text) return;

    if (currentPage.userRecordingUrl) {
      setIsReading(true);
      const audio = new Audio(currentPage.userRecordingUrl);
      userAudioRef.current = audio;
      audio.play().catch(() => setIsReading(false));
      audio.onended = () => { setIsReading(false); userAudioRef.current = null; };
      return;
    }

    setIsLoadingTTS(true);
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const audioBuffer = await generateSpeech(currentPage.text, userApiKey);
      setIsLoadingTTS(false);
      setIsReading(true);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setIsReading(false);
      source.start();
      audioSourceRef.current = source;
    } catch (error) {
      setIsLoadingTTS(false);
      if (!handleQuotaError(error)) console.error('TTS failed:', error);
    }
  }, [isReading, storyPages, currentPageIndex, userApiKey, stopReading, handleQuotaError]);

  // ── Recording ──────────────────────────────────────────────────────────────
  const handleStartRecording = useCallback(async () => {
    const currentUrl = storyPages[currentPageIndex]?.userRecordingUrl;
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
      setStoryPages(prev => {
        const pages = [...prev];
        delete pages[currentPageIndex].userRecordingUrl;
        return pages;
      });
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = e => audioChunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        const url = URL.createObjectURL(new Blob(audioChunksRef.current, { type: 'audio/webm' }));
        setStoryPages(prev => {
          const pages = [...prev];
          pages[currentPageIndex] = { ...pages[currentPageIndex], userRecordingUrl: url };
          return pages;
        });
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch {
      alert('Could not access microphone. Please allow microphone access in your browser.');
    }
  }, [storyPages, currentPageIndex]);

  const handleToggleRecording = useCallback(() => {
    isRecording ? handleStopRecording() : handleStartRecording();
  }, [isRecording, handleStopRecording, handleStartRecording]);

  const handleDeleteRecording = useCallback(() => {
    const url = storyPages[currentPageIndex]?.userRecordingUrl;
    if (url) {
      URL.revokeObjectURL(url);
      setStoryPages(prev => {
        const pages = [...prev];
        delete pages[currentPageIndex].userRecordingUrl;
        return pages;
      });
    }
  }, [storyPages, currentPageIndex]);

  // ── Save as PDF ────────────────────────────────────────────────────────────
  const handleSavePDF = useCallback(() => {
    setShowDownloadModal(true);
  }, []);

  const handleDownloadNow = useCallback(async () => {
    if (!storyConfig) return;
    try {
      await generateStoryPDF(storyPages, storyConfig);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Sorry, PDF generation failed. Please try again.');
    } finally {
      setShowDownloadModal(false);
    }
  }, [storyPages, storyConfig]);

  const handleGenerateAllAndDownload = useCallback(async () => {
    if (!storyConfig) return;
    setIsGeneratingAll(true);

    // Build complete pages list, generating any missing ones
    let allPages = [...storyPages];
    setGeneratingProgress(allPages.filter(p => p.text && !p.isGenerating).length);

    for (let i = 0; i < storyConfig.pageCount; i++) {
      if (allPages[i]?.text && !allPages[i]?.isGenerating) {
        // Already ready
        continue;
      }
      try {
        const previousTexts = allPages.slice(0, i).map(p => p.text).filter(Boolean);
        const { text, imagePrompt } = await generateStoryPage(storyConfig, i, previousTexts);

        // Generate image too
        let imageUrl: string | undefined;
        try {
          imageUrl = await generateImage(imagePrompt);
        } catch {
          // Continue without image if it fails
        }

        const newPage = { id: i + 1, text, imagePrompt, imageUrl };
        allPages = [...allPages.slice(0, i), newPage, ...allPages.slice(i + 1)];

        // Update visible story pages too
        setStoryPages(prev => {
          const updated = [...prev];
          updated[i] = newPage;
          return updated;
        });

        setGeneratingProgress(i + 1);
      } catch (error) {
        console.error(`Failed to generate page ${i + 1}:`, error);
      }
    }

    // Now generate the PDF
    try {
      await generateStoryPDF(allPages, storyConfig);
    } catch (error) {
      console.error('PDF generation failed:', error);
      alert('Sorry, PDF generation failed. Please try again.');
    } finally {
      setIsGeneratingAll(false);
      setShowDownloadModal(false);
      setGeneratingProgress(0);
    }
  }, [storyPages, storyConfig]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (screen === 'home') {
    return <HomeScreen onGenerate={handleGenerate} />;
  }

  if (screen === 'loading' && storyConfig) {
    return <LoadingScreen config={storyConfig} />;
  }

  const currentPage = storyPages[currentPageIndex];
  const hasNext = storyConfig ? currentPageIndex < storyConfig.pageCount - 1 : false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 text-gray-800 p-4 sm:p-6 md:p-8 flex flex-col items-center">
      {showApiKeyBanner && (
        <ApiKeyBanner
          onKeySubmit={(key) => { setUserApiKey(key); setShowApiKeyBanner(false); }}
          onDismiss={() => setShowApiKeyBanner(false)}
        />
      )}

      <header className="w-full max-w-5xl mb-6 text-center">
        <h1 className="text-4xl sm:text-5xl text-purple-600 font-fredoka flex items-center justify-center gap-3">
          <SparklesIcon className="w-8 h-8 text-yellow-400" />
          Pagekin
          <SparklesIcon className="w-8 h-8 text-yellow-400" />
        </h1>
        {storyConfig?.childName && (
          <p className="text-purple-400 mt-1">
            {storyConfig.includeChild ? `${storyConfig.childName}'s adventure` : storyConfig.theme}
          </p>
        )}
      </header>

      <main className="w-full max-w-5xl flex-grow">
        {currentPage && (
          <StoryViewer
            page={currentPage}
            isLoadingImage={isLoadingImage}
            pageIndex={currentPageIndex}
            pageCount={storyConfig?.pageCount ?? 5}
          />
        )}
      </main>

      <footer className="w-full max-w-5xl mt-6">
        <Controls
          onNext={handleNextPage}
          onPrev={handlePrevPage}
          onReadAloud={handleReadAloud}
          onToggleRecording={handleToggleRecording}
          onDeleteRecording={handleDeleteRecording}
          onGoHome={handleGoHome}
          onSavePDF={handleSavePDF}
          isReading={isReading}
          isLoadingTTS={isLoadingTTS}
          isRecording={isRecording}
          hasRecording={!!currentPage?.userRecordingUrl}
          hasPrev={currentPageIndex > 0}
          hasNext={hasNext}
          isImageLoading={isLoadingImage}
          isPageGenerating={!!currentPage?.isGenerating}
          isSavingPDF={isGeneratingAll || showDownloadModal}
        />
      </footer>
      {showDownloadModal && storyConfig && (
        <DownloadModal
          readyCount={storyPages.filter(p => p.text && p.imageUrl && !p.isGenerating).length}
          totalCount={storyConfig.pageCount}
          isGeneratingAll={isGeneratingAll}
          generatingProgress={generatingProgress}
          onDownloadNow={handleDownloadNow}
          onGenerateAll={handleGenerateAllAndDownload}
          onClose={() => setShowDownloadModal(false)}
        />
      )}
    </div>
  );
};

export default App;