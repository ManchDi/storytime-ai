import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  MicrophoneIcon, StopIcon, ChevronRightIcon, ChevronLeftIcon,
  CheckCircleIcon, XMarkIcon, SparklesIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/solid';
import { StoryPage, StoryConfig } from '../types';

interface RecordAllModalProps {
  pages: StoryPage[];
  config: StoryConfig;
  startPageIndex: number;
  onRecordingsSaved: (recordings: Record<number, string>) => void;
  onClose: () => void;
  onGeneratePage: (pageIndex: number, existingPages: StoryPage[]) => Promise<StoryPage | null>;
  onPageGenerated: (pageIndex: number, page: StoryPage) => void; // push generated pages back to App
}

type RecordState = 'idle' | 'recording' | 'done';

const RecordAllModal: React.FC<RecordAllModalProps> = ({
  pages: initialPages,
  config,
  startPageIndex,
  onRecordingsSaved,
  onClose,
  onGeneratePage,
  onPageGenerated,
}) => {
  const totalPages = config.pageCount;

  const [modalPageIdx, setModalPageIdx] = useState(startPageIndex);
  const [recordState, setRecordState] = useState<RecordState>('idle');
  const [localPages, setLocalPages] = useState<StoryPage[]>(initialPages);
  const [recordings, setRecordings] = useState<Record<number, string>>({});
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localPagesRef = useRef<StoryPage[]>(initialPages);

  useEffect(() => { localPagesRef.current = localPages; }, [localPages]);

  // Ensure current page has text generated
  useEffect(() => {
    const page = localPages[modalPageIdx];
    if (!page?.text && !page?.isGenerating && !isGenerating) {
      setIsGenerating(true);
      setLocalPages(prev => {
        const updated = [...prev];
        if (!updated[modalPageIdx]) {
          updated[modalPageIdx] = { id: modalPageIdx + 1, text: '', imagePrompt: '', isGenerating: true };
        }
        return updated;
      });
      onGeneratePage(modalPageIdx, localPagesRef.current).then(newPage => {
        if (newPage) {
          setLocalPages(prev => {
            const updated = [...prev];
            updated[modalPageIdx] = newPage;
            return updated;
          });
          onPageGenerated(modalPageIdx, newPage); // sync back to App
        }
        setIsGenerating(false);
      });
    }
  }, [modalPageIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const startTimer = () => {
    setRecordingTime(0);
    timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
  };
  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };
  useEffect(() => () => stopTimer(), []);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const handleStartRecording = useCallback(async () => {
    const prev = recordings[modalPageIdx];
    if (prev) URL.revokeObjectURL(prev);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = e => audioChunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = () => {
        const url = URL.createObjectURL(new Blob(audioChunksRef.current, { type: 'audio/webm' }));
        setRecordings(r => ({ ...r, [modalPageIdx]: url }));
        setSkipped(s => { const next = new Set(s); next.delete(modalPageIdx); return next; });
        stream.getTracks().forEach(t => t.stop());
        setRecordState('done');
        stopTimer();
      };
      mediaRecorderRef.current.start();
      setRecordState('recording');
      startTimer();
    } catch {
      alert('Could not access microphone. Please allow microphone access in your browser.');
    }
  }, [modalPageIdx, recordings]);

  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    stopTimer();
  }, []);

  const handleNext = useCallback(() => {
    if (recordState === 'recording') handleStopRecording();

    if (!recordings[modalPageIdx]) {
      setSkipped(s => new Set(s).add(modalPageIdx));
    }

    if (modalPageIdx >= totalPages - 1) {
      // Last page — save whatever we have and close immediately
      onRecordingsSaved(recordings);
      onClose();
      return;
    }
    setRecordState(recordings[modalPageIdx + 1] ? 'done' : 'idle');
    setModalPageIdx(i => i + 1);
    setRecordingTime(0);
  }, [modalPageIdx, totalPages, recordState, recordings, handleStopRecording, onRecordingsSaved, onClose]);

  const handlePrev = useCallback(() => {
    if (recordState === 'recording') handleStopRecording();
    if (modalPageIdx <= 0) return;
    setRecordState(recordings[modalPageIdx - 1] ? 'done' : 'idle');
    setModalPageIdx(i => i - 1);
    setRecordingTime(0);
  }, [modalPageIdx, recordState, recordings, handleStopRecording]);

  const currentPage = localPages[modalPageIdx];
  const recordedCount = Object.keys(recordings).length;
  const skippedCount = skipped.size;
  const showDots = totalPages <= 20;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden"
           style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-purple-100">
          <div>
            <h2 className="text-lg font-bold text-purple-700 flex items-center gap-2">
              <MicrophoneIcon className="w-5 h-5 text-purple-400" />
              Record your story
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {recordedCount} of {totalPages} pages recorded
              {skippedCount > 0 && <span className="text-amber-500 ml-2">· {skippedCount} skipped</span>}
            </p>
          </div>
          <button
            onClick={() => { if (recordState === 'recording') handleStopRecording(); onClose(); }}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <>
            {/* Progress tracker */}
            <div className="px-6 pt-4">
              {showDots ? (
                <div className="flex items-center gap-1 flex-wrap justify-center mb-3">
                  {Array.from({ length: totalPages }, (_, i) => {
                    const isActive = i === modalPageIdx;
                    const isRecorded = !!recordings[i];
                    const isSkippedPage = skipped.has(i);
                    return (
                      <div
                        key={i}
                        title={`Page ${i + 1}`}
                        className={`rounded-full transition-all duration-200 ${
                          isActive
                            ? 'w-5 h-5 bg-purple-500 ring-2 ring-purple-300'
                            : isRecorded
                            ? 'w-3 h-3 bg-green-400'
                            : isSkippedPage
                            ? 'w-3 h-3 bg-amber-300'
                            : 'w-3 h-3 bg-gray-200'
                        }`}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Page {modalPageIdx + 1} of {totalPages}</span>
                    <span>{Math.round((recordedCount / totalPages) * 100)}% recorded</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full transition-all duration-500"
                      style={{ width: `${(recordedCount / totalPages) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Page text */}
            <div className="flex-1 overflow-y-auto px-6 py-2">
              <div className="bg-purple-50 rounded-2xl p-5 min-h-[120px] flex items-center justify-center">
                {isGenerating || currentPage?.isGenerating ? (
                  <div className="flex flex-col items-center gap-2 text-purple-300">
                    <SparklesIcon className="w-6 h-6 animate-pulse" />
                    <p className="text-sm">Writing page {modalPageIdx + 1}…</p>
                  </div>
                ) : (
                  <p className="text-gray-700 text-lg leading-relaxed text-center">
                    {currentPage?.text || ''}
                  </p>
                )}
              </div>

              {skipped.has(modalPageIdx) && !recordings[modalPageIdx] && (
                <div className="mt-3 flex items-center gap-2 text-amber-600 bg-amber-50 rounded-xl px-4 py-2.5 text-sm">
                  <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
                  This page was skipped — AI voice will be used.
                </div>
              )}

              {recordings[modalPageIdx] && recordState !== 'recording' && (
                <div className="mt-3 flex items-center gap-2 text-green-600 bg-green-50 rounded-xl px-4 py-2.5 text-sm">
                  <CheckCircleIcon className="w-4 h-4 flex-shrink-0" />
                  Page recorded! Press Record to re-record.
                </div>
              )}
            </div>

            {/* Recording controls */}
            <div className="px-6 pb-6 pt-4 border-t border-purple-100">
              {recordState === 'recording' && (
                <div className="flex items-center justify-center gap-2 mb-3 text-red-500">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="font-mono font-semibold text-sm">{formatTime(recordingTime)}</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={handlePrev}
                  disabled={modalPageIdx === 0}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-gray-100 text-gray-600 font-semibold text-sm hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeftIcon className="w-4 h-4" /> Prev
                </button>

                <div className="flex-1 flex items-center gap-2">
                  {recordState === 'recording' ? (
                    <button
                      onClick={handleStopRecording}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-full shadow-md transition-colors"
                    >
                      <StopIcon className="w-5 h-5" />
                      Stop
                    </button>
                  ) : (
                    <button
                      onClick={handleStartRecording}
                      disabled={isGenerating || !!currentPage?.isGenerating}
                      className={`flex-1 flex items-center justify-center gap-2 py-3 font-bold rounded-full shadow-md transition-all
                        ${recordings[modalPageIdx]
                          ? 'bg-orange-500 hover:bg-orange-600 text-white'
                          : 'bg-purple-500 hover:bg-purple-600 text-white hover:scale-105 transform'
                        } disabled:bg-gray-300 disabled:cursor-not-allowed disabled:scale-100`}
                    >
                      <MicrophoneIcon className="w-5 h-5" />
                      {recordings[modalPageIdx] ? 'Re-record' : 'Record'}
                    </button>
                  )}

                  {/* Save button — always visible, disabled while recording or nothing recorded yet */}
                  <button
                    onClick={() => { onRecordingsSaved(recordings); onClose(); }}
                    disabled={recordedCount === 0 || recordState === 'recording'}
                    title={recordedCount === 0 ? 'Record at least one page first' : `Save ${recordedCount} recording${recordedCount !== 1 ? 's' : ''} and close`}
                    className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-full bg-green-500 hover:bg-green-600 text-white font-semibold text-sm transition-colors shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    <CheckCircleIcon className="w-5 h-5" />
                    Save
                  </button>
                </div>

                {modalPageIdx < totalPages - 1 ? (
                  <button
                    onClick={handleNext}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-gray-100 text-gray-600 font-semibold text-sm hover:bg-gray-200 transition-colors"
                  >
                    Next <ChevronRightIcon className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-green-500 text-white font-semibold text-sm hover:bg-green-600 transition-colors"
                  >
                    Finish <CheckCircleIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </>
      </div>
    </div>
  );
};

export default RecordAllModal;