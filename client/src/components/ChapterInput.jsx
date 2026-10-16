import { MAX_CHARACTERS } from '../lib/readability.js';

export default function ChapterInput({
  text,
  words,
  onChange,
  onAnalyze,
  onClear,
  onSample,
  loading,
  error,
  canClear,
  textareaRef,
}) {
  const overLimit = text.length > MAX_CHARACTERS;

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onAnalyze();
    }
  };

  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        onAnalyze();
      }}
    >
      <label htmlFor="chapter-text" className="block text-base font-semibold text-stone-900">
        Your chapter
      </label>
      <p id="chapter-hint" className="mt-1 text-sm text-stone-600">
        Paste English prose. Separate paragraphs with a blank line. Press Ctrl/Cmd + Enter to analyze.
      </p>
      <textarea
        id="chapter-text"
        ref={textareaRef}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={14}
        spellCheck={false}
        placeholder="Paste your chapter here..."
        aria-invalid={Boolean(error) || overLimit}
        aria-describedby={`chapter-hint chapter-counts${error ? ' chapter-error' : ''}`}
        className="mt-3 block w-full resize-y rounded-lg border border-stone-300 bg-stone-50 p-4 font-serif text-base leading-7 text-stone-900 placeholder:text-stone-500 focus:border-amber-700 focus:bg-white focus:outline-2 focus:outline-offset-0 focus:outline-amber-700"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p id="chapter-counts" className={`text-sm ${overLimit ? 'font-semibold text-red-700' : 'text-stone-600'}`}>
          <span className="font-semibold text-stone-900">{words.toLocaleString('en-US')}</span> words
          {' · '}
          <span className="font-semibold text-stone-900">{text.length.toLocaleString('en-US')}</span> /{' '}
          {MAX_CHARACTERS.toLocaleString('en-US')} characters
        </p>
      </div>
      {error && (
        <p id="chapter-error" role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading && (
            <span
              aria-hidden="true"
              className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            />
          )}
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onSample} disabled={loading}>
          Try Sample
        </button>
        <button type="button" className="btn btn-secondary" onClick={onClear} disabled={loading || !canClear}>
          Clear
        </button>
      </div>
    </form>
  );
}
