import React from 'react';
import { ArrowDownTrayIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/24/solid';

interface DownloadModalProps {
  readyCount: number;
  totalCount: number;
  isGeneratingAll: boolean;
  generatingProgress: number; // 0–totalCount
  onDownloadNow: () => void;
  onGenerateAll: () => void;
  onClose: () => void;
}

const DownloadModal: React.FC<DownloadModalProps> = ({
  readyCount,
  totalCount,
  isGeneratingAll,
  generatingProgress,
  onDownloadNow,
  onGenerateAll,
  onClose,
}) => {
  const allReady = readyCount === totalCount;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-sm p-6 relative">

        {/* Close button */}
        {!isGeneratingAll && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}

        <h2 className="text-xl font-bold text-purple-600 dark:text-purple-300 mb-1">Save as PDF</h2>

        {isGeneratingAll ? (
          /* Generating all pages progress state */
          <div className="mt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Generating remaining pages... {generatingProgress} / {totalCount}
            </p>
            <div className="w-full bg-purple-100 dark:bg-purple-900/40 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-2.5 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full transition-all duration-500"
                style={{ width: `${(generatingProgress / totalCount) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center">
              Your PDF will download automatically when ready
            </p>
          </div>
        ) : allReady ? (
          /* All pages already ready */
          <div className="mt-3">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              All {totalCount} pages are ready. Your PDF will include the cover page and all illustrations.
            </p>
            <button
              onClick={onDownloadNow}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:scale-105 transform transition-transform"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              Download PDF
            </button>
          </div>
        ) : (
          /* Some pages still pending */
          <div className="mt-3 space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-purple-600 dark:text-purple-300">{readyCount} of {totalCount} pages</span> have been generated so far.
            </p>

            {/* Option 1: Download now */}
            <button
              onClick={onDownloadNow}
              className="w-full py-3 px-4 border-2 border-purple-300 dark:border-purple-600 text-purple-600 dark:text-purple-300 font-semibold rounded-xl flex items-center gap-3 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors text-left"
            >
              <ArrowDownTrayIcon className="w-5 h-5 flex-shrink-0" />
              <div>
                <div className="text-sm font-bold">Download now</div>
                <div className="text-xs text-gray-400 dark:text-gray-500 font-normal">Save {readyCount} pages as PDF</div>
              </div>
            </button>

            {/* Option 2: Generate all then download */}
            <button
              onClick={onGenerateAll}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl flex items-center gap-3 hover:scale-105 transform transition-transform text-left"
            >
              <SparklesIcon className="w-5 h-5 flex-shrink-0" />
              <div>
                <div className="text-sm font-bold">Complete & download</div>
                <div className="text-xs text-purple-100 font-normal">Generate all {totalCount} pages first</div>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DownloadModal;