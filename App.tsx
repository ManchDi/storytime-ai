import React, { useState, useCallback, useRef, useEffect } from 'react';
import { AppScreen, StoryConfig, StoryPage, SavedSession } from './types';
import {
  generateStoryPage, generateImage, generateSpeech, QuotaError, QuotaService
} from './services/geminiService';
import HomeScreen from './components/HomeScreen';
import LoadingScreen from './components/LoadingScreen';
import StoryViewer from './components/StoryViewer';
import Controls from './components/Controls';
import ApiKeyBanner from './components/ApiKeyBanner';
import StoryModeBanner from './components/StoryModeBanner';
import { SparklesIcon, SpeakerWaveIcon } from '@heroicons/react/24/solid';
import { generateStoryPDF } from './services/pdfService';
import DownloadModal from './components/DownloadModal';
import RecordAllModal from './components/RecordAllModal';

const SESSIONS_KEY = 'pagekin_sessions';
const MAX_SAVED_SESSIONS = 5;

function loadAllSessions(): SavedSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSession(config: StoryConfig, pages: StoryPage[], currentPageIndex: number) {
  try {
    const safePages = pages.map(p => ({ ...p, userRecordingUrl: undefined }));
    const newSession: SavedSession = { config, pages: safePages, currentPageIndex, savedAt: Date.now() };

    // Remove any existing session with the same theme+childName (de-duplicate), then prepend
    const existing = loadAllSessions().filter(
      s => !(s.config.theme === config.theme && s.config.childName === config.childName)
    );
    const updated = [newSession, ...existing].slice(0, MAX_SAVED_SESSIONS);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
}

function loadSession(): SavedSession | null {
  // Returns the most recent session (for backward compat)
  const sessions = loadAllSessions();
  return sessions[0] ?? null;
}

function removeSession(savedAt: number) {
  try {
    const updated = loadAllSessions().filter(s => s.savedAt !== savedAt);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
}

function clearSession() {
  localStorage.removeItem(SESSIONS_KEY);
}

const App: React.FC = () => {
  // ── Screen management ──────────────────────────────────────────────────────
  const [screen, setScreen] = useState<AppScreen>('home');
  const [storyConfig, setStoryConfig] = useState<StoryConfig | null>(null);
  const [savedSession, setSavedSession] = useState<SavedSession | null>(loadSession);
  const [allSavedSessions, setAllSavedSessions] = useState<SavedSession[]>(loadAllSessions);

  // ── Story state ────────────────────────────────────────────────────────────
  const [storyPages, setStoryPages] = useState<StoryPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isLoadingImage, setIsLoadingImage] = useState(false);
  const [isLoadingTTS, setIsLoadingTTS] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [isRecordingAll, setIsRecordingAll] = useState(false);
  const [showRecordAllModal, setShowRecordAllModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState(0);
  const [showTTSTransitionBanner, setShowTTSTransitionBanner] = useState(false);

  // ── API key / quota ────────────────────────────────────────────────────────
  const [userApiKey, setUserApiKey] = useState<string | undefined>(undefined);
  const [showApiKeyBanner, setShowApiKeyBanner] = useState(false);
  const [quotaService, setQuotaService] = useState<QuotaService>('unknown');

  // ── Refs ───────────────────────────────────────────────────────────────────
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const userAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const playAllStopRef = useRef(false);
  const recordAllStopRef = useRef(false);
  const storyPagesRef = useRef<StoryPage[]>([]);
  const currentPageIndexRef = useRef(0);

  // Keep refs in sync so async callbacks always see latest values
  useEffect(() => { storyPagesRef.current = storyPages; }, [storyPages]);
  useEffect(() => { currentPageIndexRef.current = currentPageIndex; }, [currentPageIndex]);

  // ── Session persistence ────────────────────────────────────────────────────
  useEffect(() => {
    if (screen === 'story' && storyConfig && storyPages.length > 0) {
      saveSession(storyConfig, storyPages, currentPageIndex);
    }
  }, [storyPages, currentPageIndex, screen, storyConfig]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const handleQuotaError = useCallback((error: unknown) => {
    if (error instanceof QuotaError) {
      setQuotaService(error.service);
      setShowApiKeyBanner(true);
      return true;
    }
    return false;
  }, []);

  const stopReading = useCallback(() => {
    playAllStopRef.current = true;
    audioSourceRef.current?.stop();
    audioSourceRef.current = null;
    if (userAudioRef.current) {
      userAudioRef.current.pause();
      userAudioRef.current.currentTime = 0;
      userAudioRef.current = null;
    }
    setIsReading(false);
    setIsPlayingAll(false);
  }, []);

  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    recordAllStopRef.current = true;
    setIsRecording(false);
    setIsRecordingAll(false);
  }, []);

  // ── Story generation ───────────────────────────────────────────────────────
  const loadImageForPage = useCallback(async (pageIndex: number, pages: StoryPage[]) => {
    if (!pages[pageIndex]?.imagePrompt) return;
    if (pages[pageIndex]?.imageUrl) return;
    setIsLoadingImage(true);
    try {
      const imageUrl = await generateImage(pages[pageIndex].imagePrompt);
      setStoryPages(prev => {
        const updated = [...prev];
        if (updated[pageIndex]) updated[pageIndex] = { ...updated[pageIndex], imageUrl };
        return updated;
      });
    } catch (error) {
      if (!handleQuotaError(error)) console.error('Image generation failed:', error);
    } finally {
      setIsLoadingImage(false);
    }
  }, [handleQuotaError]);

  const generateNextPage = useCallback(async (
    config: StoryConfig, pageIndex: number, existingPages: StoryPage[]
  ): Promise<StoryPage | null> => {
    try {
      const previousTexts = existingPages.slice(0, pageIndex).map(p => p.text).filter(Boolean);
      const { text, imagePrompt } = await generateStoryPage(config, pageIndex, previousTexts);
      return { id: pageIndex + 1, text, imagePrompt };
    } catch (error) {
      handleQuotaError(error);
      return null;
    }
  }, [handleQuotaError]);

  const prefetchPages = useCallback(async (
    config: StoryConfig, currentIndex: number, pages: StoryPage[]
  ) => {
    if (!config.generateImages) return; // no prefetch needed if text-only
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
        const newPage = await generateNextPage(config, targetIndex, pages);
        if (!newPage) continue;
        setStoryPages(prev => {
          const updated = [...prev];
          updated[targetIndex] = newPage;
          return updated;
        });
        generateImage(newPage.imagePrompt).then(imageUrl => {
          setStoryPages(prev => {
            const updated = [...prev];
            if (updated[targetIndex]) updated[targetIndex] = { ...updated[targetIndex], imageUrl };
            return updated;
          });
        }).catch(err => console.error('Background image prefetch failed:', err));
      } catch (error) {
        console.error(`Prefetch failed for page ${targetIndex}:`, error);
      }
    }
  }, [generateNextPage]);

  // ── Handle "Generate Story" ────────────────────────────────────────────────
  const handleGenerate = useCallback(async (config: StoryConfig) => {
    setSavedSession(null);
    setStoryConfig(config);
    setScreen('loading');
    setStoryPages([]);
    setCurrentPageIndex(0);

    const firstPage = await generateNextPage(config, 0, []);
    if (!firstPage) { setScreen('home'); return; }

    const initialPages: StoryPage[] = [firstPage];
    setStoryPages(initialPages);
    setScreen('story');

    if (config.generateImages) {
      await loadImageForPage(0, initialPages);
      prefetchPages(config, 0, initialPages);
    }
  }, [generateNextPage, loadImageForPage, prefetchPages]);

  // ── Continue saved session ─────────────────────────────────────────────────
  const handleContinueSession = useCallback((session?: SavedSession) => {
    const target = session ?? savedSession;
    if (!target) return;
    setStoryConfig(target.config);
    setStoryPages(target.pages);
    setCurrentPageIndex(target.currentPageIndex);
    setScreen('story');
    if (target.config.generateImages) {
      const pages = target.pages;
      const idx = target.currentPageIndex;
      if (pages[idx] && !pages[idx].imageUrl) loadImageForPage(idx, pages);
    }
  }, [savedSession, loadImageForPage]);

  const handleDeleteSession = useCallback((savedAt: number) => {
    removeSession(savedAt);
    const refreshed = loadAllSessions();
    setSavedSession(refreshed[0] ?? null);
    setAllSavedSessions(refreshed);
  }, []);

  const handleDownloadSessionPDF = useCallback(async (session: SavedSession, visitedOnly: boolean) => {
    if (visitedOnly) {
      const pagesToDownload = session.pages.filter(p => p.text && !p.isGenerating);
      try {
        await generateStoryPDF(pagesToDownload, session.config);
      } catch (error) {
        console.error('PDF generation failed:', error);
        alert('Sorry, PDF generation failed. Please try again.');
      }
    } else {
      // Navigate to story screen so the user sees progress, then generate directly
      setStoryConfig(session.config);
      setStoryPages(session.pages);
      setCurrentPageIndex(session.currentPageIndex);
      setScreen('story');
      // Pass session data directly — avoids stale closure race condition
      await handleGenerateAllAndDownload(session.pages, session.config);
    }
  }, [handleGenerateAllAndDownload]);

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
      if (storyConfig.generateImages) {
        const pagesWithNew = [...storyPages.slice(0, nextIndex), newPage];
        await loadImageForPage(nextIndex, pagesWithNew);
        prefetchPages(storyConfig, nextIndex, pagesWithNew);
      }
    } else {
      setCurrentPageIndex(nextIndex);
      if (storyConfig.generateImages) {
        await loadImageForPage(nextIndex, storyPages);
        prefetchPages(storyConfig, nextIndex, storyPages);
      }
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
  if (storyConfig && storyPages.length > 0) {
    saveSession(storyConfig, storyPages, currentPageIndex);
    const refreshed = loadAllSessions();
    setSavedSession(refreshed[0] ?? null);
    setAllSavedSessions(refreshed);
  }
  setScreen('home');
}, [stopReading, handleStopRecording, storyConfig, storyPages, currentPageIndex]);

  // ── Read aloud (single page) ───────────────────────────────────────────────
  const playSinglePage = useCallback(async (pageIndex: number): Promise<void> => {
    const pages = storyPagesRef.current;
    const page = pages[pageIndex];
    if (!page?.text) return;

    if (page.userRecordingUrl) {
      return new Promise(resolve => {
        setIsReading(true);
        const audio = new Audio(page.userRecordingUrl);
        userAudioRef.current = audio;
        audio.play().catch(() => { setIsReading(false); resolve(); });
        audio.onended = () => {
          setIsReading(false);
          userAudioRef.current = null;
          resolve();
        };
      });
    }

    setIsLoadingTTS(true);
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const audioBuffer = await generateSpeech(page.text, userApiKey);
      setIsLoadingTTS(false);
      if (playAllStopRef.current) return;

      // Resume AudioContext if it was auto-suspended by the browser
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      return new Promise(resolve => {
        setIsReading(true);
        const source = audioContextRef.current!.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current!.destination);
        source.onended = () => {
          setIsReading(false);
          audioSourceRef.current = null;
          resolve();
        };
        source.start();
        audioSourceRef.current = source;
      });
    } catch (error) {
      setIsLoadingTTS(false);
      if (!handleQuotaError(error)) console.error('TTS failed:', error);
    }
  }, [userApiKey, handleQuotaError]);

  const handleReadAloud = useCallback(async () => {
    if (isReading || isPlayingAll) { stopReading(); return; }
    playAllStopRef.current = false;
    await playSinglePage(currentPageIndex);
  }, [isReading, isPlayingAll, currentPageIndex, playSinglePage, stopReading]);

  // ── Play full story ────────────────────────────────────────────────────────
  const handleReadAll = useCallback(async () => {
    if (isPlayingAll || isReading) { stopReading(); return; }
    if (!storyConfig) return;

    playAllStopRef.current = false;
    setIsPlayingAll(true);

    let pageIdx = currentPageIndexRef.current;

    while (pageIdx < storyConfig.pageCount && !playAllStopRef.current) {
      const pages = storyPagesRef.current;

      // Generate text for this page if missing
      if (!pages[pageIdx]?.text || pages[pageIdx].isGenerating) {
        setStoryPages(prev => {
          const updated = [...prev];
          if (!updated[pageIdx]) {
            updated[pageIdx] = { id: pageIdx + 1, text: '', imagePrompt: '', isGenerating: true };
          }
          return updated;
        });
        const newPage = await generateNextPage(storyConfig, pageIdx, storyPagesRef.current);
        if (!newPage || playAllStopRef.current) break;
        setStoryPages(prev => {
          const updated = [...prev];
          updated[pageIdx] = newPage;
          return updated;
        });
      }

      setCurrentPageIndex(pageIdx);

      // Kick off image generation in background if needed (don't await — fire and forget)
      if (storyConfig.generateImages) {
        const currentPages = storyPagesRef.current;
        if (currentPages[pageIdx] && !currentPages[pageIdx].imageUrl) {
          loadImageForPage(pageIdx, currentPages);
        }
        // Also pre-fetch next page image
        const nextIdx = pageIdx + 1;
        if (nextIdx < storyConfig.pageCount) {
          const nextPage = currentPages[nextIdx];
          if (nextPage?.imagePrompt && !nextPage.imageUrl) {
            loadImageForPage(nextIdx, currentPages);
          }
        }
      }

      // Brief grace period to let image start loading before reading begins
      await new Promise(resolve => setTimeout(resolve, 2500));
      if (playAllStopRef.current) break;

      // Detect transition from user recording to TTS — notify user
      const pageForPlay = storyPagesRef.current[pageIdx];
      const prevPageHadRecording = pageIdx > currentPageIndexRef.current &&
        storyPagesRef.current[pageIdx - 1]?.userRecordingUrl &&
        !pageForPlay?.userRecordingUrl;
      if (prevPageHadRecording) {
        setShowTTSTransitionBanner(true);
        setTimeout(() => setShowTTSTransitionBanner(false), 4000);
      }
      if (playAllStopRef.current) break;

      // 200ms pause between pages then advance
      await new Promise(resolve => setTimeout(resolve, 200));
      if (playAllStopRef.current) break;

      pageIdx++;
    }

    setIsPlayingAll(false);
  }, [isPlayingAll, isReading, storyConfig, stopReading, generateNextPage, playSinglePage, loadImageForPage, setShowTTSTransitionBanner]);

  // ── Recording (single page) ────────────────────────────────────────────────
  const startRecordingPage = useCallback(async (pageIndex: number): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      // Clear existing recording for this page
      const currentUrl = storyPagesRef.current[pageIndex]?.userRecordingUrl;
      if (currentUrl) URL.revokeObjectURL(currentUrl);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        mediaRecorderRef.current.ondataavailable = e => audioChunksRef.current.push(e.data);
        mediaRecorderRef.current.onstop = () => {
          const url = URL.createObjectURL(new Blob(audioChunksRef.current, { type: 'audio/webm' }));
          setStoryPages(prev => {
            const pages = [...prev];
            if (pages[pageIndex]) pages[pageIndex] = { ...pages[pageIndex], userRecordingUrl: url };
            return pages;
          });
          stream.getTracks().forEach(t => t.stop());
          resolve(url);
        };
        mediaRecorderRef.current.start();
      } catch (err) {
        reject(err);
      }
    });
  }, []);

  const handleStartRecording = useCallback(async () => {
    try {
      setIsRecording(true);
      await startRecordingPage(currentPageIndex);
    } catch {
      alert('Could not access microphone. Please allow microphone access in your browser.');
      setIsRecording(false);
    }
  }, [currentPageIndex, startRecordingPage]);

  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  }, [isRecording, handleStopRecording, handleStartRecording]);

  // ── Record full story — opens the RecordAllModal ───────────────────────────
  const handleRecordAll = useCallback(() => {
    if (!storyConfig) return;
    stopReading();
    setShowRecordAllModal(true);
    setIsRecordingAll(true);
  }, [storyConfig, stopReading]);

  const handleRecordingsSaved = useCallback((recordings: Record<number, string>) => {
    setStoryPages(prev => {
      const updated = [...prev];
      for (const [idxStr, url] of Object.entries(recordings)) {
        const idx = Number(idxStr);
        if (updated[idx]) {
          // Page exists — just attach the recording
          if (updated[idx].userRecordingUrl) URL.revokeObjectURL(updated[idx].userRecordingUrl!);
          updated[idx] = { ...updated[idx], userRecordingUrl: url };
        }
        // If page doesn't exist here, onPageGenerated should have already synced it —
        // but if somehow it didn't, we skip rather than crash.
      }
      return updated;
    });
    setShowRecordAllModal(false);
    setIsRecordingAll(false);
  }, []);

  const handleCloseRecordAllModal = useCallback(() => {
    setShowRecordAllModal(false);
    setIsRecordingAll(false);
  }, []);

  const handleDeleteRecording = useCallback(() => {
    const url = storyPages[currentPageIndex]?.userRecordingUrl;
    if (url) {
      URL.revokeObjectURL(url);
      setStoryPages(prev => {
        const pages = [...prev];
        if (pages[currentPageIndex]) delete pages[currentPageIndex].userRecordingUrl;
        return pages;
      });
    }
  }, [storyPages, currentPageIndex]);

  // ── Save as PDF ────────────────────────────────────────────────────────────
  const handleSavePDF = useCallback(() => setShowDownloadModal(true), []);

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

  const handleGenerateAllAndDownload = useCallback(async (
    overridePages?: StoryPage[],
    overrideConfig?: StoryConfig
  ) => {
    const config = overrideConfig ?? storyConfig;
    if (!config) return;
    setIsGeneratingAll(true);
    let allPages = [...(overridePages ?? storyPages)];
    setGeneratingProgress(allPages.filter(p => p.text && !p.isGenerating).length);

    for (let i = 0; i < config.pageCount; i++) {
      if (allPages[i]?.text && !allPages[i]?.isGenerating) continue;
      try {
        const previousTexts = allPages.slice(0, i).map(p => p.text).filter(Boolean);
        const { text, imagePrompt } = await generateStoryPage(config, i, previousTexts);
        let imageUrl: string | undefined;
        if (config.generateImages) {
          try { imageUrl = await generateImage(imagePrompt); } catch { /* skip */ }
        }
        const newPage = { id: i + 1, text, imagePrompt, imageUrl };
        allPages = [...allPages.slice(0, i), newPage, ...allPages.slice(i + 1)];
        setStoryPages(prev => { const u = [...prev]; u[i] = newPage; return u; });
        setGeneratingProgress(i + 1);
      } catch (error) {
        console.error(`Failed to generate page ${i + 1}:`, error);
      }
    }

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
    return (
      <HomeScreen
        onGenerate={handleGenerate}
        savedSessions={allSavedSessions}
        onContinueSession={handleContinueSession}
        onDeleteSession={handleDeleteSession}
        onDownloadSessionPDF={handleDownloadSessionPDF}
        onClearSession={() => { clearSession(); setSavedSession(null); setAllSavedSessions([]); }}
      />
    );
  }

  if (screen === 'loading' && storyConfig) {
    return <LoadingScreen config={storyConfig} />;
  }

  const currentPage = storyPages[currentPageIndex];
  const hasNext = storyConfig ? currentPageIndex < storyConfig.pageCount - 1 : false;
  const isAnyRecordMode = isRecording || isRecordingAll;
  const isAnyPlayMode = isReading || isPlayingAll;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 text-gray-800 p-4 sm:p-6 md:p-8 flex flex-col items-center">

      {/* Quota banner */}
      {showApiKeyBanner && (
        <ApiKeyBanner
          service={quotaService}
          onKeySubmit={(key) => { setUserApiKey(key); setShowApiKeyBanner(false); }}
          onDismiss={() => setShowApiKeyBanner(false)}
        />
      )}

      {/* Playing all banner */}
      {isPlayingAll && storyConfig && (
        <StoryModeBanner
          mode="playing"
          currentPage={currentPageIndex + 1}
          totalPages={storyConfig.pageCount}
          onStop={stopReading}
        />
      )}

      {/* Recording → TTS transition notification */}
      {showTTSTransitionBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-3 px-4 pointer-events-none">
          <div className="bg-purple-600 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
            <SpeakerWaveIcon className="w-4 h-4" />
            Your recordings are done — continuing with AI voice
          </div>
        </div>
      )}

      <header className={`w-full max-w-5xl mb-6 text-center ${isPlayingAll ? 'mt-12' : ''}`}>
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
            generateImages={storyConfig?.generateImages ?? true}
          />
        )}
      </main>

      <footer className="w-full max-w-5xl mt-6">
        <Controls
          onNext={handleNextPage}
          onPrev={handlePrevPage}
          onReadAloud={handleReadAloud}
          onReadAll={handleReadAll}
          onToggleRecording={handleToggleRecording}
          onRecordAll={handleRecordAll}
          onDeleteRecording={handleDeleteRecording}
          onGoHome={handleGoHome}
          onSavePDF={handleSavePDF}
          isReading={isReading}
          isPlayingAll={isPlayingAll}
          isLoadingTTS={isLoadingTTS}
          isRecording={isRecording}
          isRecordingAll={isRecordingAll}
          hasRecording={!!currentPage?.userRecordingUrl}
          hasPrev={currentPageIndex > 0}
          hasNext={hasNext}
          isImageLoading={isLoadingImage}
          isPageGenerating={!!currentPage?.isGenerating}
          isSavingPDF={isGeneratingAll || showDownloadModal}
        />
      </footer>

      {showRecordAllModal && storyConfig && (
        <RecordAllModal
          pages={storyPages}
          config={storyConfig}
          startPageIndex={currentPageIndex}
          onRecordingsSaved={handleRecordingsSaved}
          onClose={handleCloseRecordAllModal}
          onGeneratePage={(pageIndex, existingPages) =>
            generateNextPage(storyConfig, pageIndex, existingPages)
          }
          onPageGenerated={(pageIndex, page) => {
            setStoryPages(prev => {
              const updated = [...prev];
              updated[pageIndex] = page;
              return updated;
            });
          }}
        />
      )}

      {showDownloadModal && storyConfig && (
        <DownloadModal
          readyCount={storyPages.filter(p => p.text && (storyConfig.generateImages ? p.imageUrl : true) && !p.isGenerating).length}
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