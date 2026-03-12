import React, { useState, useCallback, useRef } from 'react';
import { AppScreen, StoryConfig, StoryPage, ChatMessage } from './types';
import {
  generateStoryPage, generateImage, generateSpeech,
  getChatResponse, QuotaError
} from './services/geminiService';
import HomeScreen from './components/HomeScreen';
import LoadingScreen from './components/LoadingScreen';
import StoryViewer from './components/StoryViewer';
import Controls from './components/Controls';
import Chatbot from './components/Chatbot';
import ApiKeyBanner from './components/ApiKeyBanner';
import { SparklesIcon, ChatBubbleBottomCenterTextIcon } from '@heroicons/react/24/solid';

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

  // ── API key / quota ────────────────────────────────────────────────────────
  const [userApiKey, setUserApiKey] = useState<string | undefined>(undefined);
  const [showApiKeyBanner, setShowApiKeyBanner] = useState(false);

  // ── Chat ───────────────────────────────────────────────────────────────────
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatProcessing, setIsChatProcessing] = useState(false);

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

  // ── Prefetch next 2 pages in background ───────────────────────────────────
  const prefetchPages = useCallback(async (
    config: StoryConfig,
    currentIndex: number,
    pages: StoryPage[]
  ) => {
    const targets = [currentIndex + 1, currentIndex + 2].filter(
      i => i < config.pageCount && !pages[i]
    );

    for (const targetIndex of targets) {
      // Mark as generating
      setStoryPages(prev => {
        if (prev[targetIndex]) return prev;
        const updated = [...prev];
        updated[targetIndex] = { id: targetIndex + 1, text: '', imagePrompt: '', isGenerating: true };
        return updated;
      });

      try {
        const currentPages = storyPages.slice(0, targetIndex);
        const previousTexts = currentPages.map(p => p.text).filter(Boolean);
        const newPage = await generateNextPage(config, targetIndex, currentPages);
        if (!newPage) continue;

        setStoryPages(prev => {
          const updated = [...prev];
          updated[targetIndex] = newPage;
          return updated;
        });

        // Also prefetch the image in background
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
  }, [storyPages, generateNextPage]);

  // ── Story generation ───────────────────────────────────────────────────────
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

  // ── Handle "Generate Story" click ─────────────────────────────────────────
  const handleGenerate = useCallback(async (config: StoryConfig) => {
    setStoryConfig(config);
    setScreen('loading');
    setStoryPages([]);
    setCurrentPageIndex(0);
    setChatHistory([]);

    // Generate first page text
    const firstPage = await generateNextPage(config, 0, []);
    if (!firstPage) {
      setScreen('home');
      return;
    }

    const initialPages: StoryPage[] = [firstPage];
    setStoryPages(initialPages);
    setScreen('story');

    // Load first page image then prefetch page 2
    await loadImageForPage(0, initialPages);
    prefetchPages(config, 0, initialPages);
  }, [generateNextPage, loadImageForPage]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const handleNextPage = useCallback(async () => {
    if (!storyConfig) return;
    const nextIndex = currentPageIndex + 1;
    if (nextIndex >= storyConfig.pageCount) return;

    stopReading();
    handleStopRecording();

    // If next page doesn't exist yet, generate it
    if (!storyPages[nextIndex]) {
      setStoryPages(prev => {
        const updated = [...prev];
        updated[nextIndex] = { id: nextIndex + 1, text: '', imagePrompt: '', isGenerating: true };
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

      await loadImageForPage(nextIndex, [...storyPages.slice(0, nextIndex), newPage]);
      prefetchPages(storyConfig, nextIndex, [...storyPages.slice(0, nextIndex), newPage]);
    } else {
      setCurrentPageIndex(nextIndex);
      await loadImageForPage(nextIndex, storyPages);
      prefetchPages(storyConfig, nextIndex, storyPages);
    }
  }, [currentPageIndex, storyConfig, storyPages, stopReading, handleStopRecording, generateNextPage, loadImageForPage]);

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

  // ── Chat ───────────────────────────────────────────────────────────────────
  const handleSendMessage = useCallback(async (message: string) => {
    setIsChatProcessing(true);
    const updated: ChatMessage[] = [...chatHistory, { role: 'user', content: message }];
    setChatHistory(updated);
    try {
      const response = await getChatResponse(updated, userApiKey);
      setChatHistory(prev => [...prev, { role: 'model', content: response }]);
    } catch (error) {
      if (!handleQuotaError(error)) {
        setChatHistory(prev => [...prev, { role: 'model', content: "Oops! I had a little trouble thinking. Please try again." }]);
      }
    } finally {
      setIsChatProcessing(false);
    }
  }, [chatHistory, userApiKey, handleQuotaError]);

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
          isReading={isReading}
          isLoadingTTS={isLoadingTTS}
          isRecording={isRecording}
          hasRecording={!!currentPage?.userRecordingUrl}
          hasPrev={currentPageIndex > 0}
          hasNext={hasNext}
          isImageLoading={isLoadingImage}
          isPageGenerating={!!currentPage?.isGenerating}
        />
      </footer>

      {/* Chatbot */}
      <button
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-6 right-6 bg-orange-400 hover:bg-orange-500 text-white p-4 rounded-full shadow-lg transform hover:scale-110 transition-transform duration-200 z-50"
        aria-label="Open chatbot"
      >
        <ChatBubbleBottomCenterTextIcon className="w-8 h-8" />
      </button>

      <Chatbot
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={chatHistory}
        onSendMessage={handleSendMessage}
        isProcessing={isChatProcessing}
      />
    </div>
  );
};

export default App;