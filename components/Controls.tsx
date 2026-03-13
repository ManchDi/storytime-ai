import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronLeftIcon, ChevronRightIcon, PlayIcon, StopIcon,
  MicrophoneIcon, ArrowPathIcon, TrashIcon, HomeIcon,
  ArrowDownTrayIcon, ChevronDownIcon,
} from '@heroicons/react/24/solid';

interface ControlsProps {
  onPrev: () => void;
  onNext: () => void;
  onReadAloud: () => void;
  onReadAll: () => void;
  onToggleRecording: () => void;
  onRecordAll: () => void;
  onDeleteRecording: () => void;
  onGoHome: () => void;
  onSavePDF: () => void;
  isReading: boolean;
  isPlayingAll: boolean;
  isLoadingTTS: boolean;
  isRecording: boolean;
  isRecordingAll: boolean;
  hasRecording: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  isImageLoading: boolean;
  isPageGenerating: boolean;
  isSavingPDF: boolean;
}

const ControlButton: React.FC<{
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
  className?: string;
  title?: string;
}> = ({ onClick, disabled, children, className = '', title }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`px-4 py-3 rounded-full text-white font-bold shadow-md transform transition-transform duration-200 flex items-center gap-2 focus:outline-none focus:ring-4 focus:ring-opacity-50 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none disabled:scale-100 ${className}`}
  >
    {children}
  </button>
);

// Split button: main action + chevron dropdown with 2 options
const SplitButton: React.FC<{
  mainLabel: React.ReactNode;
  mainColor: string;
  mainDisabled: boolean;
  onMain: () => void;
  option1Label: string;
  option2Label: string;
  onOption1: () => void;
  onOption2: () => void;
  dropdownDisabled: boolean;
  width?: string;
}> = ({
  mainLabel, mainColor, mainDisabled, onMain,
  option1Label, option2Label, onOption1, onOption2,
  dropdownDisabled, width = 'w-36',
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative flex" ref={ref}>
      {/* Main button */}
      <button
        onClick={onMain}
        disabled={mainDisabled}
        className={`${width} justify-center px-4 py-3 rounded-l-full text-white font-bold shadow-md flex items-center gap-2 focus:outline-none focus:ring-4 focus:ring-opacity-50 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors ${mainColor}`}
      >
        {mainLabel}
      </button>

      {/* Chevron */}
      <button
        onClick={() => setOpen(o => !o)}
        disabled={dropdownDisabled}
        className={`px-2 py-3 rounded-r-full text-white font-bold shadow-md border-l border-white/30 flex items-center focus:outline-none disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors ${mainColor}`}
      >
        <ChevronDownIcon className="w-4 h-4" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute bottom-full mb-2 left-0 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-20 min-w-[160px]">
          <button
            onClick={() => { onOption1(); setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-600 dark:hover:text-purple-300 transition-colors"
          >
            {option1Label}
          </button>
          <button
            onClick={() => { onOption2(); setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-600 dark:hover:text-purple-300 border-t border-gray-100 dark:border-gray-700 transition-colors"
          >
            {option2Label}
          </button>
        </div>
      )}
    </div>
  );
};

const Controls: React.FC<ControlsProps> = ({
  onPrev, onNext, onReadAloud, onReadAll,
  onToggleRecording, onRecordAll, onDeleteRecording,
  onGoHome, onSavePDF,
  isReading, isPlayingAll, isLoadingTTS,
  isRecording, isRecordingAll,
  hasRecording, hasPrev, hasNext,
  isImageLoading, isPageGenerating, isSavingPDF,
}) => {
  const isBusy = isImageLoading || isPageGenerating;
  const isAnyActive = isReading || isPlayingAll || isRecording || isRecordingAll;

  // ── Read / Stop button ──────────────────────────────────────────────────
  const getReadMainLabel = () => {
    if (isLoadingTTS) return <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Loading...</>;
    if (isReading || isPlayingAll) return <><StopIcon className="h-5 w-5" /> Stop</>;
    return <><PlayIcon className="h-5 w-5" /> Read</>;
  };
  const readColor = (isReading || isPlayingAll)
    ? 'bg-red-500 hover:bg-red-600 focus:ring-red-300'
    : 'bg-green-500 hover:bg-green-600 focus:ring-green-300';

  // ── Record button ───────────────────────────────────────────────────────
  const getRecordMainLabel = () => {
    if (isRecording || isRecordingAll) return <><StopIcon className="h-5 w-5" /> Stop</>;
    if (hasRecording) return <><ArrowPathIcon className="h-5 w-5" /> Re-record</>;
    return <><MicrophoneIcon className="h-5 w-5" /> Record</>;
  };
  const recordColor = (isRecording || isRecordingAll)
    ? 'bg-red-500 hover:bg-red-600 focus:ring-red-300'
    : hasRecording
      ? 'bg-orange-500 hover:bg-orange-600 focus:ring-orange-300'
      : 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-300';

  const handleReadMain = () => {
    if (isPlayingAll || isReading) {
      onReadAloud(); // stop
    } else {
      onReadAloud(); // play this page
    }
  };

  const handleRecordMain = () => {
    if (isRecording || isRecordingAll) {
      onToggleRecording(); // stop
    } else {
      onToggleRecording(); // record this page
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Main controls row */}
      <div className="flex justify-center items-center gap-2 sm:gap-3 flex-wrap">

        {/* Home */}
        <ControlButton
          onClick={onGoHome}
          disabled={isRecording || isRecordingAll}
          className="bg-gray-400 hover:bg-gray-500 focus:ring-gray-300"
          title="Go home"
        >
          <HomeIcon className="h-5 w-5" />
        </ControlButton>

        {/* Prev */}
        <ControlButton
          onClick={onPrev}
          disabled={!hasPrev || isBusy || isAnyActive}
          className="bg-pink-500 hover:bg-pink-600 focus:ring-pink-300"
        >
          <ChevronLeftIcon className="h-5 w-5" /> <span className="hidden sm:inline">Prev</span>
        </ControlButton>

        {/* Read — split button */}
        <SplitButton
          mainLabel={getReadMainLabel()}
          mainColor={readColor}
          mainDisabled={isBusy || isRecording || isRecordingAll || (isLoadingTTS && !isReading && !isPlayingAll)}
          onMain={handleReadMain}
          option1Label="▶ Play this page"
          option2Label="▶▶ Play full story"
          onOption1={onReadAloud}
          onOption2={onReadAll}
          dropdownDisabled={isBusy || isRecording || isRecordingAll || isReading || isPlayingAll}
          width="w-24 sm:w-32"
        />

        {/* Record — split button + delete */}
        <div className="flex items-center gap-2">
          <SplitButton
            mainLabel={getRecordMainLabel()}
            mainColor={recordColor}
            mainDisabled={isBusy || isReading || isPlayingAll || isLoadingTTS}
            onMain={handleRecordMain}
            option1Label="🎙 This page"
            option2Label="📖 Full story"
            onOption1={onToggleRecording}
            onOption2={onRecordAll}
            dropdownDisabled={isBusy || isReading || isPlayingAll || isLoadingTTS || isRecording || isRecordingAll}
            width="w-28 sm:w-36"
          />
          {hasRecording && !isRecording && !isRecordingAll && (
            <button
              onClick={onDeleteRecording}
              disabled={isBusy || isReading || isPlayingAll}
              className="p-3 rounded-full bg-gray-400 hover:bg-gray-500 text-white shadow-md transition-colors focus:outline-none focus:ring-4 focus:ring-gray-300 disabled:opacity-50"
              aria-label="Delete recording"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Next */}
        <ControlButton
          onClick={onNext}
          disabled={!hasNext || isBusy || isAnyActive}
          className="bg-pink-500 hover:bg-pink-600 focus:ring-pink-300"
        >
          <span className="hidden sm:inline">Next</span> <ChevronRightIcon className="h-5 w-5" />
        </ControlButton>
      </div>

      {/* Save PDF row */}
      <button
        onClick={onSavePDF}
        disabled={isSavingPDF || isRecording || isRecordingAll || isBusy}
        className="flex items-center gap-2 px-5 py-2 bg-white dark:bg-gray-800 border-2 border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-300 font-semibold rounded-full shadow-sm hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:border-purple-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
      >
        {isSavingPDF ? (
          <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin inline-block" />
        ) : (
          <ArrowDownTrayIcon className="h-4 w-4" />
        )}
        {isSavingPDF ? 'Preparing PDF...' : 'Save as PDF'}
      </button>
    </div>
  );
};

export default Controls;