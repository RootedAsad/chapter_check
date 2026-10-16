import { formatReadingTime } from '../lib/readability.js';

const fmt = (n) => n.toLocaleString('en-US');

export default function StatsGrid({ stats }) {
  const items = [
    { label: 'Words', value: fmt(stats.words) },
    { label: 'Sentences', value: fmt(stats.sentences) },
    { label: 'Paragraphs', value: fmt(stats.paragraphs) },
    { label: 'Characters', value: fmt(stats.characters), note: `${fmt(stats.charactersNoSpaces)} without spaces` },
    { label: 'Avg. words per sentence', value: stats.avgWordsPerSentence },
    { label: 'Avg. syllables per word', value: stats.avgSyllablesPerWord },
    { label: 'Reading time', value: formatReadingTime(stats.readingTimeSeconds), note: 'at 200 words per minute' },
  ];

  return (
    <div className="card">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Writing statistics</h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-2">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-xs text-stone-600">{item.label}</dt>
            <dd className="text-xl font-semibold tabular-nums text-stone-900">{item.value}</dd>
            {item.note && <dd className="text-xs text-stone-600">{item.note}</dd>}
          </div>
        ))}
      </dl>
    </div>
  );
}
