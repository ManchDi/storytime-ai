import React, { useState } from 'react';
import { StoryConfig, StoryMode, AgeRange, SavedSession } from '../types';
import { generateTheme } from '../services/geminiService';
import { SparklesIcon, BookOpenIcon, ArrowPathIcon, ArrowRightIcon, ArrowDownTrayIcon, TrashIcon } from '@heroicons/react/24/solid';

interface HomeScreenProps {
  onGenerate: (config: StoryConfig) => void;
  savedSessions: SavedSession[];
  onContinueSession: (session: SavedSession) => void;
  onDeleteSession: (savedAt: number) => void;
  onDownloadSessionPDF: (session: SavedSession, visitedOnly: boolean) => void;
  onClearSession: () => void;
}

const MAX_THEME_ATTEMPTS = 3;

const AGE_OPTIONS: { value: AgeRange; label: string; description: string }[] = [
  { value: '2-4', label: '2–4', description: 'Toddler' },
  { value: '5-7', label: '5–7', description: 'Early reader' },
  { value: '8-10', label: '8–10', description: 'Confident reader' },
];

const Toggle: React.FC<{ value: boolean; onChange: (v: boolean) => void; label: string; sub?: string }> = ({ value, onChange, label, sub }) => (
  <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 rounded-xl px-4 py-3">
    <div>
      <span className="text-sm font-medium text-purple-700 dark:text-purple-300">{label}</span>
      {sub && <p className="text-xs text-purple-400 dark:text-purple-500 mt-0.5">{sub}</p>}
    </div>
    <button
      onClick={() => onChange(!value)}
      className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none ${value ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}`}
    >
      <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  </div>
);

// Mini PDF download picker shown inline per saved story card
const SessionPDFMenu: React.FC<{
  session: SavedSession;
  onVisitedOnly: () => void;
  onGenerateAll: () => void;
  onClose: () => void;
}> = ({ session, onVisitedOnly, onGenerateAll, onClose }) => {
  const visitedCount = session.pages.filter(p => p.text && !p.isGenerating).length;
  const total = session.config.pageCount;
  const allReady = visitedCount === total;
  return (
    <div className="mt-2 bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-700 rounded-xl shadow-lg overflow-hidden text-sm z-10">
      <div className="px-4 py-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 font-semibold text-xs uppercase tracking-wide">
        Download PDF
      </div>
      <button
        onClick={() => { onVisitedOnly(); onClose(); }}
        className="w-full text-left px-4 py-2.5 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-700 dark:text-gray-300 transition-colors flex items-center gap-2"
      >
        <ArrowDownTrayIcon className="w-4 h-4 text-purple-400 flex-shrink-0" />
        <div>
          <div className="font-medium">Download visited pages</div>
          <div className="text-xs text-gray-400 dark:text-gray-500">{visitedCount} page{visitedCount !== 1 ? 's' : ''} ready</div>
        </div>
      </button>
      {!allReady && (
        <button
          onClick={() => { onGenerateAll(); onClose(); }}
          className="w-full text-left px-4 py-2.5 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-700 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700 transition-colors flex items-center gap-2"
        >
          <SparklesIcon className="w-4 h-4 text-pink-400 flex-shrink-0" />
          <div>
            <div className="font-medium">Generate all & download</div>
            <div className="text-xs text-gray-400 dark:text-gray-500">Complete all {total} pages first</div>
          </div>
        </button>
      )}
    </div>
  );
};

const SavedSessionCard: React.FC<{
  session: SavedSession;
  onContinue: () => void;
  onDelete: () => void;
  onDownloadVisited: () => void;
  onDownloadAll: () => void;
}> = ({ session, onContinue, onDelete, onDownloadVisited, onDownloadAll }) => {
  const [showPDFMenu, setShowPDFMenu] = useState(false);
  const visitedCount = session.pages.filter(p => p.text && !p.isGenerating).length;
  const title = session.config.childName
    ? `${session.config.childName}'s Story`
    : 'Your Story';
  const savedDate = new Date(session.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl border-2 border-purple-200 dark:border-purple-800 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-700 dark:text-gray-200 truncate">{title}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">"{session.config.theme}"</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {visitedCount} of {session.config.pageCount} pages · saved {savedDate}
          </p>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={onContinue}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-500 text-white text-xs font-semibold rounded-xl hover:bg-purple-600 transition-colors"
          >
            Continue <ArrowRightIcon className="w-3 h-3" />
          </button>
          <div className="flex gap-1.5">
            <button
              onClick={() => setShowPDFMenu(v => !v)}
              title="Download PDF"
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs text-purple-500 dark:text-purple-400 border border-purple-200 dark:border-purple-700 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
            >
              <ArrowDownTrayIcon className="w-3 h-3" /> PDF
            </button>
            <button
              onClick={onDelete}
              title="Delete"
              className="flex items-center justify-center px-2 py-1.5 text-xs text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-400 hover:border-red-200 transition-colors"
            >
              <TrashIcon className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
      {showPDFMenu && (
        <SessionPDFMenu
          session={session}
          onVisitedOnly={onDownloadVisited}
          onGenerateAll={onDownloadAll}
          onClose={() => setShowPDFMenu(false)}
        />
      )}
    </div>
  );
};

const HomeScreen: React.FC<HomeScreenProps> = ({ onGenerate, savedSessions, onContinueSession, onDeleteSession, onDownloadSessionPDF, onClearSession }) => {
  const [childName, setChildName] = useState('');
  const [theme, setTheme] = useState('');
  const [pageCount, setPageCount] = useState<5 | 10 | 15 | 20>(5);
  const [includeChild, setIncludeChild] = useState(true);
  const [mode, setMode] = useState<StoryMode>('linear');
  const [ageRange, setAgeRange] = useState<AgeRange>('5-7');
  const [generateImages, setGenerateImages] = useState(true);

  const [isGeneratingTheme, setIsGeneratingTheme] = useState(false);
  const [themeAttempts, setThemeAttempts] = useState(0);
  const [previousThemes, setPreviousThemes] = useState<string[]>([]);
  const [suggestedTheme, setSuggestedTheme] = useState<string | null>(null);

  const handleGenerateTheme = async () => {
    setIsGeneratingTheme(true);
    try {
      const newTheme = await generateTheme(childName, previousThemes);
      setSuggestedTheme(newTheme);
      setPreviousThemes(prev => [...prev, newTheme]);
      setThemeAttempts(prev => prev + 1);
    } catch (error) {
      console.error('Theme generation failed:', error);
    } finally {
      setIsGeneratingTheme(false);
    }
  };

  const handleAcceptTheme = () => {
    if (suggestedTheme) {
      setTheme(suggestedTheme);
      setSuggestedTheme(null);
    }
  };

  const handleSubmit = () => {
    if (!theme.trim()) return;
    onGenerate({ childName: childName.trim(), theme: theme.trim(), pageCount, includeChild, mode, ageRange, generateImages });
  };

  const isValid = theme.trim().length > 0;
  const canGenerateMore = themeAttempts < MAX_THEME_ATTEMPTS;


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 dark:from-gray-950 dark:to-purple-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl text-purple-600 dark:text-purple-300 font-fredoka flex items-center justify-center gap-3 mb-2">
            <SparklesIcon className="w-10 h-10 text-yellow-400" />
            Pagekin
            <SparklesIcon className="w-10 h-10 text-yellow-400" />
          </h1>
          <p className="text-lg text-purple-500 dark:text-purple-400">Every child deserves their own story</p>
        </div>

        {/* Saved sessions */}
        {savedSessions.length > 0 && (
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-semibold text-purple-400 dark:text-purple-500 uppercase tracking-wide">Continue a story</p>
              {savedSessions.length > 1 && (
                <button onClick={onClearSession} className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                  Clear all
                </button>
              )}
            </div>
            {savedSessions.map(session => (
              <SavedSessionCard
                key={session.savedAt}
                session={session}
                onContinue={() => onContinueSession(session)}
                onDelete={() => onDeleteSession(session.savedAt)}
                onDownloadVisited={() => onDownloadSessionPDF(session, true)}
                onDownloadAll={() => onDownloadSessionPDF(session, false)}
              />
            ))}
          </div>
        )}

        {/* Form */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-3xl shadow-lg border border-purple-200 dark:border-purple-800 p-4 sm:p-6 space-y-5">

          {/* Child's name */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">
              Child's name <span className="text-gray-400 dark:text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={childName}
              onChange={e => setChildName(e.target.value)}
              placeholder="e.g. Sofia, Leo, Maya..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 dark:placeholder-gray-500"
            />
          </div>

          {/* Include child toggle */}
          {childName.trim() && (
            <Toggle
              value={includeChild}
              onChange={setIncludeChild}
              label={`Make ${childName} the main character`}
            />
          )}

          {/* Age range */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Child's age</label>
            <div className="grid grid-cols-3 gap-2">
              {AGE_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => setAgeRange(option.value)}
                  className={`py-3 px-2 rounded-xl text-center transition-colors ${ageRange === option.value ? 'bg-purple-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-purple-100 dark:hover:bg-purple-900/30'}`}
                >
                  <div className="text-sm font-bold">{option.label}</div>
                  <div className={`text-xs font-normal mt-0.5 ${ageRange === option.value ? 'text-purple-100' : 'text-gray-400 dark:text-gray-500'}`}>
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Story theme */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300">
                Story theme <span className="text-red-400">*</span>
              </label>
              {canGenerateMore ? (
                <button
                  onClick={handleGenerateTheme}
                  disabled={isGeneratingTheme}
                  className="flex items-center gap-1 text-xs font-semibold text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 disabled:opacity-50 transition-colors"
                >
                  {isGeneratingTheme ? (
                    <span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin inline-block" />
                  ) : (
                    <SparklesIcon className="w-3 h-3" />
                  )}
                  {themeAttempts === 0 ? 'Surprise me!' : 'Try another'}
                </button>
              ) : (
                <span className="text-xs text-gray-400 dark:text-gray-500">Write your own below</span>
              )}
            </div>

            {suggestedTheme && (
              <div className="mb-2 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl">
                <p className="text-sm text-purple-700 dark:text-purple-300 mb-2">{suggestedTheme}</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleAcceptTheme}
                    className="flex-1 py-1.5 bg-purple-500 text-white text-xs font-semibold rounded-lg hover:bg-purple-600 transition-colors"
                  >
                    Use this theme
                  </button>
                  {canGenerateMore && (
                    <button
                      onClick={handleGenerateTheme}
                      disabled={isGeneratingTheme}
                      className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      <ArrowPathIcon className="w-3 h-3" />
                      {isGeneratingTheme ? '...' : 'Another'}
                    </button>
                  )}
                </div>
              </div>
            )}

            <textarea
              value={theme}
              onChange={e => setTheme(e.target.value)}
              placeholder="e.g. A dragon who is afraid of fire, a rabbit who wants to reach the moon..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 dark:placeholder-gray-500 resize-none h-24"
            />
          </div>

          {/* Page count */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Story length</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([5, 10, 15, 20] as const).map(count => (
                <button
                  key={count}
                  onClick={() => setPageCount(count)}
                  className={`py-2 rounded-xl text-sm font-semibold transition-colors ${pageCount === count ? 'bg-purple-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-purple-100 dark:hover:bg-purple-900/30'}`}
                >
                  {count} pages
                </button>
              ))}
            </div>
          </div>

          {/* Story mode */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Story mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode('linear')}
                className={`py-3 px-4 rounded-xl text-sm font-semibold transition-colors text-left ${mode === 'linear' ? 'bg-purple-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-purple-100 dark:hover:bg-purple-900/30'}`}
              >
                <BookOpenIcon className="w-4 h-4 mb-1" />
                <div>Linear</div>
                <div className={`text-xs font-normal ${mode === 'linear' ? 'text-purple-100' : 'text-gray-400 dark:text-gray-500'}`}>Read straight through</div>
              </button>
              <button
                className="py-3 px-4 rounded-xl text-sm font-semibold text-left relative bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                disabled
              >
                <SparklesIcon className="w-4 h-4 mb-1" />
                <div>Interactive</div>
                <div className="text-xs font-normal text-gray-400 dark:text-gray-500">Choose what happens next</div>
                <span className="absolute top-2 right-2 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 font-bold px-2 py-0.5 rounded-full">
                  Soon
                </span>
              </button>
            </div>
          </div>

          {/* Illustrations toggle */}
          <Toggle
            value={generateImages}
            onChange={setGenerateImages}
            label="Generate illustrations"
            sub={generateImages ? 'AI watercolor art for each page' : 'Text only, saves quota'}
          />

          {/* Generate button */}
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-lg font-bold rounded-xl shadow-md hover:scale-105 transform transition-transform duration-200 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <SparklesIcon className="w-5 h-5" />
            Generate Story
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;