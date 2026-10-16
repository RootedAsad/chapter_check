import { motion } from 'motion/react';
import Tilt from './Tilt.jsx';

function DifficultyBar({ value, label, delay }) {
  return (
    <div className="flex items-center gap-3">
      <div
        role="meter"
        aria-label="Difficulty score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${value} out of 100, ${label}`}
        className="h-2 w-28 shrink-0 overflow-hidden rounded-full bg-stone-200 sm:w-40"
      >
        <motion.div
          className="h-full rounded-full bg-amber-600"
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ delay, duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <p className="text-sm font-semibold text-stone-900">
        {value}/100 <span className="font-normal text-stone-600">· {label}</span>
      </p>
    </div>
  );
}

const list = { hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } } };
const item = {
  hidden: { opacity: 0, y: 24, rotateX: -12 },
  show: { opacity: 1, y: 0, rotateX: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export default function HardestSentences({ sentences }) {
  if (!sentences.length) return null;

  return (
    <section className="card" aria-labelledby="hardest-heading">
      <h3 id="hardest-heading" className="text-lg font-semibold text-stone-900">
        {sentences.length === 1 ? 'Hardest sentence' : `${sentences.length} hardest sentences`}
      </h3>
      <p className="mt-1 text-sm text-stone-600">
        Ranked by a simple difficulty score that combines sentence length, syllables per word, complex words (3+
        syllables) and word length. It is a guide for where to look, not a scientific verdict.
        {sentences.length < 5 && ` Only ${sentences.length} sentence${sentences.length === 1 ? ' was' : 's were'} found.`}
      </p>
      <motion.ol className="mt-4 space-y-4" variants={list} initial="hidden" animate="show" style={{ perspective: 1000 }}>
        {sentences.map((s, i) => (
          <motion.li key={s.rank} variants={item}>
            <Tilt max={2} className="rounded-lg border border-stone-200 bg-stone-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-7 items-center justify-center rounded-full bg-amber-800 text-sm font-bold text-white"
                  >
                    {s.rank}
                  </span>
                  <span className="sr-only">Rank {s.rank}.</span>
                  <DifficultyBar value={s.difficulty} label={s.difficultyLabel} delay={0.3 + i * 0.12} />
                </div>
                <a
                  href={`#hardest-${s.rank}`}
                  className="text-sm font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
                >
                  Jump to highlight<span className="sr-only"> for sentence {s.rank}</span>
                </a>
              </div>
              <blockquote className="mt-3 break-words font-serif text-base leading-7 text-stone-900">{s.text}</blockquote>
              <p className="mt-2 text-sm text-stone-700">{s.explanation}</p>
              <p className="mt-1 text-xs text-stone-600">
                {s.wordCount} words · {s.avgSyllables} syllables per word · {s.complexWords} complex word
                {s.complexWords === 1 ? '' : 's'}
                {s.occurrences > 1 && ` · appears ${s.occurrences} times (all highlighted)`}
              </p>
            </Tilt>
          </motion.li>
        ))}
      </motion.ol>
    </section>
  );
}
