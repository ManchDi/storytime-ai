import React, { useState } from 'react';
import { KeyIcon, XMarkIcon, PhotoIcon, SpeakerWaveIcon, BookOpenIcon } from '@heroicons/react/24/solid';
import { QuotaService } from '../services/geminiService';

interface ApiKeyBannerProps {
  service: QuotaService;
  onKeySubmit: (key: string) => void;
  onDismiss: () => void;
}

const SERVICE_CONFIG: Record<QuotaService, {
  icon: React.ReactNode;
  title: string;
  description: string;
  showKeyInput: boolean;
}> = {
  story: {
    icon: <BookOpenIcon className="w-5 h-5" />,
    title: 'Story generation quota reached',
    description: 'Add your free Gemini API key to keep generating stories.',
    showKeyInput: true,
  },
  theme: {
    icon: <BookOpenIcon className="w-5 h-5" />,
    title: 'Theme generation quota reached',
    description: 'Add your free Gemini API key to keep generating story ideas.',
    showKeyInput: true,
  },
  speech: {
    icon: <SpeakerWaveIcon className="w-5 h-5" />,
    title: 'Read aloud quota reached',
    description: 'Add your free Gemini API key to keep using Read Aloud.',
    showKeyInput: true,
  },
  image: {
    icon: <PhotoIcon className="w-5 h-5" />,
    title: 'Image generation quota reached',
    description: 'Illustrations are temporarily unavailable. The story will continue without images. Try again later.',
    showKeyInput: false,
  },
  unknown: {
    icon: <KeyIcon className="w-5 h-5" />,
    title: 'Free demo quota reached',
    description: 'Add your free Gemini API key to keep going.',
    showKeyInput: true,
  },
};

const ApiKeyBanner: React.FC<ApiKeyBannerProps> = ({ service, onKeySubmit, onDismiss }) => {
  const [input, setInput] = useState('');
  const config = SERVICE_CONFIG[service] ?? SERVICE_CONFIG.unknown;

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onKeySubmit(trimmed);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-50 dark:bg-amber-900/40 border-b-2 border-amber-300 dark:border-amber-700 px-4 py-3 shadow-md">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3">

        {/* Icon + title */}
        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 shrink-0">
          {config.icon}
          <span className="font-semibold text-sm">{config.title}</span>
        </div>

        {/* Description */}
        <p className="text-amber-700 dark:text-amber-300 text-sm flex-1">
          {config.showKeyInput ? (
            <>
              Add your free{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium hover:text-amber-900 dark:hover:text-amber-100"
              >
                Gemini API key
              </a>{' '}
              to keep going. It stays in your browser and is never stored.
            </>
          ) : (
            config.description
          )}
        </p>

        {/* Key input (Gemini services only) */}
        {config.showKeyInput && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="password"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="AIza..."
              className="flex-1 sm:w-56 px-3 py-1.5 text-sm border border-amber-300 dark:border-amber-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-500"
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
            >
              Save
            </button>
          </div>
        )}

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 shrink-0"
          aria-label="Dismiss"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default ApiKeyBanner;