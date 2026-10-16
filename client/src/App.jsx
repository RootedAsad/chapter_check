import { useEffect, useMemo, useRef, useState } from 'react';
import { MotionConfig, motion } from 'motion/react';
import Hero3D from './components/Hero3D.jsx';
import ChapterInput from './components/ChapterInput.jsx';
import ResultsDashboard from './components/ResultsDashboard.jsx';
import { countWords, validateChapterText } from './lib/readability.js';
import { ANALYSIS_MODE, runAnalysis } from './services/analyzer.js';
import sampleChapter from './data/sample-chapter.txt?raw';

export default function App() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [result, setResult] = useState(null);
  const [analyzedText, setAnalyzedText] = useState('');
  const [validationError, setValidationError] = useState('');
  const [apiError, setApiError] = useState('');
  const textareaRef = useRef(null);
  const resultsHeadingRef = useRef(null);

  const words = useMemo(() => countWords(text), [text]);

  useEffect(() => {
    if (status === 'success') resultsHeadingRef.current?.focus();
  }, [status]);

  const reset = () => {
    setResult(null);
    setAnalyzedText('');
    setStatus('idle');
    setValidationError('');
    setApiError('');
  };

  const handleAnalyze = async () => {
    if (status === 'loading') return;
    const check = validateChapterText(text);
    setApiError('');
    if (!check.ok) {
      setValidationError(check.message);
      textareaRef.current?.focus();
      return;
    }
    setValidationError('');
    setStatus('loading');
    const snapshot = text;
    try {
      const data = await runAnalysis(snapshot);
      setResult(data);
      setAnalyzedText(snapshot);
      setStatus('success');
    } catch (err) {
      setApiError(err?.message || 'Something went wrong while analyzing. Please try again.');
      setStatus('error');
    }
  };

  const handleClear = () => {
    setText('');
    reset();
    textareaRef.current?.focus();
  };

  const handleSample = () => {
    setText(sampleChapter.trim());
    reset();
    textareaRef.current?.focus();
  };

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <header className="overflow-hidden border-b border-stone-200 bg-gradient-to-b from-amber-50 to-white">
        <div className="mx-auto grid max-w-5xl items-center gap-4 px-4 py-6 sm:px-6 md:grid-cols-[1.2fr_1fr]">
          <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
            <div className="flex items-center gap-3">
              <svg aria-hidden="true" viewBox="0 0 32 32" className="size-9 shrink-0">
                <rect width="32" height="32" rx="7" fill="#b45309" />
                <path d="M8 16.5l5.5 5.5L24 10.5" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h1 className="text-2xl font-bold leading-tight sm:text-3xl">ChapterCheck</h1>
            </div>
            <p className="mt-3 max-w-md text-base text-stone-700">
              Paste a chapter. See its readability score and the five sentences most likely to make readers stumble,
              highlighted in your own text. Free, no sign-up.
            </p>
          </motion.div>
          <Hero3D />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
        <ChapterInput
          text={text}
          words={words}
          onChange={(value) => {
            setText(value);
            if (validationError) setValidationError('');
          }}
          onAnalyze={handleAnalyze}
          onClear={handleClear}
          onSample={handleSample}
          loading={status === 'loading'}
          error={validationError}
          canClear={text.length > 0 || status !== 'idle'}
          textareaRef={textareaRef}
        />

        <section aria-label="Analysis results" aria-busy={status === 'loading'}>
          {status === 'idle' && (
            <div className="card text-center">
              <h2 className="text-lg font-semibold">Your results will appear here</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-stone-700">
                Paste a chapter above and press <strong>Analyze</strong> to see a Flesch Reading Ease score, writing
                statistics, your five hardest sentences highlighted in context, and suggestions. No chapter handy? Try
                the sample.
              </p>
            </div>
          )}
          {status === 'loading' && (
            <div role="status" className="card flex items-center justify-center gap-3 text-stone-700">
              <span aria-hidden="true" className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="size-2.5 rounded-full bg-amber-600"
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12 }}
                  />
                ))}
              </span>
              Analyzing your chapter...
            </div>
          )}
          {status === 'error' && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-900">
              <h2 className="font-semibold">We couldn't analyze your chapter</h2>
              <p className="mt-1 text-sm">{apiError}</p>
              <button type="button" className="btn btn-secondary mt-3" onClick={handleAnalyze}>
                Try again
              </button>
            </div>
          )}
          {status === 'success' && result && (
            <ResultsDashboard
              result={result}
              analyzedText={analyzedText}
              stale={text !== analyzedText}
              headingRef={resultsHeadingRef}
            />
          )}
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-10 text-sm text-stone-600 sm:px-6">
        <p>
          {ANALYSIS_MODE === 'server'
            ? 'Your chapter is sent to the ChapterCheck server for analysis and is never stored or logged.'
            : 'Your chapter is analyzed in your browser and never leaves your device.'}{' '}
          Readability scores are estimates, and the right level depends on your genre and readers.
        </p>
      </footer>
    </div>
    </MotionConfig>
  );
}
