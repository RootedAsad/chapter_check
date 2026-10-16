import { motion } from 'motion/react';
import ScoreGauge from './ScoreGauge.jsx';
import StatsGrid from './StatsGrid.jsx';
import HardestSentences from './HardestSentences.jsx';
import HighlightedChapter from './HighlightedChapter.jsx';
import Suggestions from './Suggestions.jsx';

const rise = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: 'easeOut' },
};

export default function ResultsDashboard({ result, analyzedText, stale, headingRef }) {
  const { readability, stats, hardestSentences, suggestions } = result;

  return (
    <div className="space-y-6">
      <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-stone-900 focus:outline-none">
        Results
      </h2>
      {stale && (
        <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          You have edited the chapter since this analysis. Press Analyze to refresh the results.
        </p>
      )}
      {readability.score === null ? (
        <p className="card text-stone-700">No readable sentences were found in this text.</p>
      ) : (
        <>
          <motion.div {...rise} className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <ScoreGauge score={readability.score} level={readability.level} description={readability.levelDescription} />
            <StatsGrid stats={stats} />
          </motion.div>
          <HardestSentences sentences={hardestSentences} />
          <motion.div {...rise} transition={{ ...rise.transition, delay: 0.3 }}>
            <HighlightedChapter text={analyzedText} sentences={hardestSentences} />
          </motion.div>
          <motion.div {...rise} transition={{ ...rise.transition, delay: 0.4 }}>
            <Suggestions suggestions={suggestions} />
          </motion.div>
        </>
      )}
    </div>
  );
}
