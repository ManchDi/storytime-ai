import React, { useState } from 'react';
import { StoryConfig, StoryMode } from '../types';
import { generateTheme } from '../services/geminiService';
import { SparklesIcon, BookOpenIcon, ArrowPathIcon } from '@heroicons/react/24/solid';

interface HomeScreenProps {
  onGenerate: (config: StoryConfig) => void;
}

const MAX_THEME_ATTEMPTS = 3;

const HomeScreen: React.FC<HomeScreenProps> = ({ onGenerate }) => {
  const [childName, setChildName] = useState('');
  const [theme, setTheme] = useState('');
  const [pageCount, setPageCount] = useState<5 | 10 | 15 | 20>(5);
  const [includeChild, setIncludeChild] = useState(true);
  const [mode, setMode] = useState<StoryMode>('linear');

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
    onGenerate({ childName: childName.trim(), theme: theme.trim(), pageCount, includeChild, mode });
  };

  const isValid = theme.trim().length > 0;
  const canGenerateMore = themeAttempts < MAX_THEME_ATTEMPTS;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl text-purple-600 font-fredoka flex items-center justify-center gap-3 mb-2">
            <SparklesIcon className="w-10 h-10 text-yellow-400" />
            Pagekin
            <SparklesIcon className="w-10 h-10 text-yellow-400" />
          </h1>
          <p className="text-lg text-purple-500">Every child deserves their own story</p>
        </div>

        {/* Form */}
        <div className="bg-white/70 backdrop-blur-sm rounded-3xl shadow-lg border border-purple-200 p-6 space-y-5">

          {/* Child's name */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">
              Child's name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={childName}
              onChange={e => setChildName(e.target.value)}
              placeholder="e.g. Sofia, Leo, Maya..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-700"
            />
          </div>

          {/* Include child toggle */}
          {childName.trim() && (
            <div className="flex items-center justify-between bg-purple-50 rounded-xl px-4 py-3">
              <span className="text-sm font-medium text-purple-700">
                Make {childName} the main character
              </span>
              <button
                onClick={() => setIncludeChild(!includeChild)}
                className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none ${includeChild ? 'bg-purple-500' : 'bg-gray-300'}`}
              >
                <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${includeChild ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}

          {/* Story theme */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-semibold text-gray-600">
                Story theme <span className="text-red-400">*</span>
              </label>
              {canGenerateMore ? (
                <button
                  onClick={handleGenerateTheme}
                  disabled={isGeneratingTheme}
                  className="flex items-center gap-1 text-xs font-semibold text-purple-500 hover:text-purple-700 disabled:opacity-50 transition-colors"
                >
                  {isGeneratingTheme ? (
                    <span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin inline-block" />
                  ) : (
                    <SparklesIcon className="w-3 h-3" />
                  )}
                  {themeAttempts === 0 ? 'Surprise me!' : 'Try another'}
                </button>
              ) : (
                <span className="text-xs text-gray-400">Write your own below</span>
              )}
            </div>

            {/* Suggested theme card */}
            {suggestedTheme && (
              <div className="mb-2 p-3 bg-purple-50 border border-purple-200 rounded-xl">
                <p className="text-sm text-purple-700 mb-2">{suggestedTheme}</p>
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
                      className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1 disabled:opacity-50"
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
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-700 resize-none h-24"
            />
          </div>

          {/* Page count */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-2">Story length</label>
            <div className="grid grid-cols-4 gap-2">
              {([5, 10, 15, 20] as const).map(count => (
                <button
                  key={count}
                  onClick={() => setPageCount(count)}
                  className={`py-2 rounded-xl text-sm font-semibold transition-colors ${pageCount === count ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-purple-100'}`}
                >
                  {count} pages
                </button>
              ))}
            </div>
          </div>

          {/* Story mode */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-2">Story mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode('linear')}
                className={`py-3 px-4 rounded-xl text-sm font-semibold transition-colors text-left ${mode === 'linear' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-purple-100'}`}
              >
                <BookOpenIcon className="w-4 h-4 mb-1" />
                <div>Linear</div>
                <div className={`text-xs font-normal ${mode === 'linear' ? 'text-purple-100' : 'text-gray-400'}`}>Read straight through</div>
              </button>
              <button
                onClick={() => setMode('interactive')}
                className={`py-3 px-4 rounded-xl text-sm font-semibold transition-colors text-left relative bg-gray-100 text-gray-400 cursor-not-allowed`}
              >
                <SparklesIcon className="w-4 h-4 mb-1" />
                <div>Interactive</div>
                <div className="text-xs font-normal text-gray-400">Choose what happens next</div>
                <span className="absolute top-2 right-2 text-xs bg-yellow-100 text-yellow-600 font-bold px-2 py-0.5 rounded-full">
                  Soon
                </span>
              </button>
            </div>
          </div>

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

interface HomeScreenProps {
  onGenerate: (config: StoryConfig) => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onGenerate }) => {
  const [childName, setChildName] = useState('');
  const [theme, setTheme] = useState('');
  const [pageCount, setPageCount] = useState<5 | 10 | 15 | 20>(5);
  const [includeChild, setIncludeChild] = useState(true);
  const [mode, setMode] = useState<StoryMode>('linear');

  const handleSubmit = () => {
    if (!theme.trim()) return;
    onGenerate({ childName: childName.trim(), theme: theme.trim(), pageCount, includeChild, mode });
  };

  const isValid = theme.trim().length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl text-purple-600 font-fredoka flex items-center justify-center gap-3 mb-2">
            <SparklesIcon className="w-10 h-10 text-yellow-400" />
            Pagekin
            <SparklesIcon className="w-10 h-10 text-yellow-400" />
          </h1>
          <p className="text-lg text-purple-500">Every child deserves their own story</p>
        </div>

        {/* Form */}
        <div className="bg-white/70 backdrop-blur-sm rounded-3xl shadow-lg border border-purple-200 p-6 space-y-5">

          {/* Child's name */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">
              Child's name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={childName}
              onChange={e => setChildName(e.target.value)}
              placeholder="e.g. Sofia, Leo, Maya..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-700"
            />
          </div>

          {/* Include child toggle */}
          {childName.trim() && (
            <div className="flex items-center justify-between bg-purple-50 rounded-xl px-4 py-3">
              <span className="text-sm font-medium text-purple-700">
                Make {childName} the main character
              </span>
              <button
                onClick={() => setIncludeChild(!includeChild)}
                className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none ${includeChild ? 'bg-purple-500' : 'bg-gray-300'}`}
              >
                <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${includeChild ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}

          {/* Story theme */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">
              Story theme <span className="text-red-400">*</span>
            </label>
            <textarea
              value={theme}
              onChange={e => setTheme(e.target.value)}
              placeholder="e.g. A dragon who is afraid of fire, a rabbit who wants to reach the moon, a little girl who discovers a secret garden..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-700 resize-none h-24"
            />
          </div>

          {/* Page count */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-2">Story length</label>
            <div className="grid grid-cols-4 gap-2">
              {([5, 10, 15, 20] as const).map(count => (
                <button
                  key={count}
                  onClick={() => setPageCount(count)}
                  className={`py-2 rounded-xl text-sm font-semibold transition-colors ${pageCount === count ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-purple-100'}`}
                >
                  {count} pages
                </button>
              ))}
            </div>
          </div>

          {/* Story mode */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-2">Story mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode('linear')}
                className={`py-3 px-4 rounded-xl text-sm font-semibold transition-colors text-left ${mode === 'linear' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-purple-100'}`}
              >
                <BookOpenIcon className="w-4 h-4 mb-1" />
                <div>Linear</div>
                <div className={`text-xs font-normal ${mode === 'linear' ? 'text-purple-100' : 'text-gray-400'}`}>Read straight through</div>
              </button>
              <button
                onClick={() => setMode('interactive')}
                className={`py-3 px-4 rounded-xl text-sm font-semibold transition-colors text-left ${mode === 'interactive' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-purple-100'}`}
              >
                <SparklesIcon className="w-4 h-4 mb-1" />
                <div>Interactive</div>
                <div className={`text-xs font-normal ${mode === 'interactive' ? 'text-purple-100' : 'text-gray-400'}`}>Choose what happens next</div>
              </button>
            </div>
          </div>

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