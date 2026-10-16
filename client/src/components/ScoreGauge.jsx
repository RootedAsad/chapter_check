import { motion } from 'motion/react';
import AnimatedNumber from './AnimatedNumber.jsx';
import Tilt from './Tilt.jsx';

const BANDS = [
  { label: 'Very Difficult', from: 0, to: 30 },
  { label: 'Difficult', from: 30, to: 50 },
  { label: 'Fairly Difficult', from: 50, to: 60 },
  { label: 'Standard', from: 60, to: 70 },
  { label: 'Fairly Easy', from: 70, to: 80 },
  { label: 'Easy', from: 80, to: 90 },
  { label: 'Very Easy', from: 90, to: 100 },
];

export default function ScoreGauge({ score, level, description }) {
  const activeIndex = BANDS.findIndex((b) => score >= b.from && (score < b.to || b.to === 100));

  return (
    <Tilt className="card h-full">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Flesch Reading Ease</h3>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="text-5xl font-bold tabular-nums text-stone-900" aria-label={`${score.toFixed(1)} out of 100`}>
          <span aria-hidden="true">
            <AnimatedNumber value={score} />
          </span>
          <span aria-hidden="true" className="ml-1 text-xl font-medium text-stone-600">/ 100</span>
        </p>
        <p className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">{level}</p>
      </div>
      <p className="mt-2 text-sm text-stone-700">{description}</p>

      <div
        role="meter"
        aria-label="Flesch Reading Ease score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        aria-valuetext={`${score.toFixed(1)} out of 100, ${level}`}
        className="relative mt-6"
      >
        <div className="flex gap-0.5" aria-hidden="true">
          {BANDS.map((b, i) => (
            <div
              key={b.label}
              title={`${b.label} (${b.from}-${b.to})`}
              style={{ flex: `${b.to - b.from} 1 0%` }}
              className={`h-3 rounded-sm ${i === activeIndex ? 'bg-amber-600' : 'bg-stone-200'}`}
            />
          ))}
        </div>
        <motion.div
          aria-hidden="true"
          initial={{ left: '0%' }}
          animate={{ left: `${Math.min(100, Math.max(0, score))}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="absolute -bottom-1 -top-1 w-1 -translate-x-1/2 rounded bg-stone-900 ring-2 ring-white"
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-stone-600" aria-hidden="true">
        <span>0 · Harder to read</span>
        <span>Easier to read · 100</span>
      </div>
    </Tilt>
  );
}
