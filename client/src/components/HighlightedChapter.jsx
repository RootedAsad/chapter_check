import { useMemo } from 'react';
import { buildHighlightSegments } from '../lib/readability.js';

export default function HighlightedChapter({ text, sentences }) {
  const segments = useMemo(() => buildHighlightSegments(text, sentences), [text, sentences]);

  return (
    <section className="card" aria-labelledby="highlight-heading">
      <h3 id="highlight-heading" className="text-lg font-semibold text-stone-900">
        Your chapter, highlighted
      </h3>
      <p className="mt-1 text-sm text-stone-600">
        The hardest sentences are marked and numbered by rank (1 is hardest). Your text is shown exactly as you pasted it.
      </p>
      <div
        tabIndex={0}
        role="region"
        aria-label="Chapter text with hardest sentences highlighted"
        data-testid="highlighted-chapter"
        className="mt-4 max-h-[36rem] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-stone-200 bg-stone-50 p-4 font-serif text-lg leading-8 text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
      >
        {segments.map((seg, i) =>
          seg.rank ? (
            <mark
              key={i}
              id={seg.first ? `hardest-${seg.rank}` : undefined}
              data-rank={seg.rank}
              className="scroll-mt-24 rounded bg-amber-200 px-0.5 text-stone-900 before:mr-1 before:rounded before:bg-amber-800 before:px-1 before:align-super before:font-sans before:text-[0.65rem] before:font-bold before:text-white before:content-[attr(data-rank)]"
            >
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
      </div>
    </section>
  );
}
