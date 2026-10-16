/**
 * ChapterCheck readability engine (pure JavaScript, no dependencies).
 *
 * CANONICAL COPY: client/src/lib/readability.js
 * The server uses an identical copy (server/src/analysis/readability.js).
 * Run `npm run sync` from the repo root after editing; a server test fails if they drift.
 *
 * Known limitations (also in the README):
 *  - Syllables are estimated with a rule-based heuristic (English only). Expect small
 *    errors on irregular words (e.g. "business", "maybe"). A few common cases are patched.
 *  - Flesch Reading Ease was designed for running prose. Dialogue-heavy text, headings,
 *    lists and very short samples (< ~100 words) can skew the score.
 *  - Sentence splitting is heuristic: it understands common abbreviations, initials,
 *    decimals, ellipses and quoted dialogue, but not every edge case.
 *  - Blank lines always end a paragraph AND a sentence (so headings are separate sentences).
 *  - If the text has no blank lines at all, each line is treated as one paragraph.
 *  - The "hardest sentence" ranking is a transparent heuristic, not a scientific measure.
 */

export const MIN_WORDS = 10;
export const MAX_CHARACTERS = 100000;
export const WORDS_PER_MINUTE = 200;
export const LONG_SENTENCE_WORDS = 30;

/** Sentence difficulty: weights sum to 100. See scoreSentenceDifficulty(). */
export const DIFFICULTY_WEIGHTS = Object.freeze({
  length: 40, // 40+ words = full marks
  complexWords: 25, // 30%+ of words with 3+ syllables = full marks
  syllables: 20, // avg 1.0 -> 0, avg 2.0+ -> full marks
  wordLength: 15, // avg 3.5 letters -> 0, avg 7+ letters -> full marks
});

const WORD_RE = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
const TERMINATORS = '.!?…';
const CLOSERS = '"\'”’)]}»';
const WHITESPACE_RE = /\s/;

/* ----------------------------- syllables ----------------------------- */

const SYLLABLE_EXCEPTIONS = {
  being: 2, doing: 2, going: 2, seeing: 2, create: 2, created: 3, creating: 3,
  idea: 3, ideas: 3, area: 3, areas: 3, quiet: 2, science: 2, poem: 2, poet: 2,
  lion: 2, diet: 2, riot: 2, trial: 2, dial: 2, maybe: 2, business: 2, every: 2,
  different: 3, evening: 2, family: 3, camera: 3, chocolate: 3, interesting: 3,
  something: 2, somethings: 2,
};

function syllablesInPart(part) {
  if (!/[a-z]/.test(part)) return 1; // numbers and non-English letters: count as one
  if (Object.hasOwn(SYLLABLE_EXCEPTIONS, part)) return SYLLABLE_EXCEPTIONS[part];
  let w = part.replace(/[^a-z]/g, '');
  // "didn't" -> "didnt": the contraction adds a syllable (did + nt)
  if (/[ds]nt$/.test(w)) return syllablesInPart(w.slice(0, -2)) + 1;
  if (w.length <= 3) return 1;
  // Silent endings. A syllabic "-le" after a consonant (table, little) is kept.
  if (!/[^aeiouy]le$/.test(w)) {
    w = w.replace(/(?:[^aeiouysxzcghj]es|[^tdaeiouy]ed|[aeiou]yed|[^aeiouy]e)$/, '');
  }
  w = w.replace(/^y/, '');
  const nuclei = w.match(/[aeiou]+y?|y+/g);
  return Math.max(1, nuclei ? nuclei.length : 1);
}

/** Estimate the syllable count of one English word (always >= 1). */
export function countSyllables(word) {
  const cleaned = String(word)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '');
  const parts = cleaned.split('-').filter(Boolean);
  let total = 0;
  for (const part of parts) total += syllablesInPart(part);
  return Math.max(1, total);
}

/* ------------------------------ counting ------------------------------ */

/** Number of word tokens in a string (cheap; used for the live counter). */
export function countWords(text) {
  const m = String(text ?? '').match(WORD_RE);
  return m ? m.length : 0;
}

/** Collapse a sentence to a comparable key (case, punctuation and spacing ignored). */
function normalizeKey(s) {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function trimRange(text, start, end) {
  while (start < end && WHITESPACE_RE.test(text[start])) start++;
  while (end > start && WHITESPACE_RE.test(text[end - 1])) end--;
  return { start, end };
}

/**
 * Paragraph ranges. Blank lines separate paragraphs. If the text has no blank
 * line at all, every non-empty line counts as its own paragraph.
 */
export function splitParagraphs(text) {
  const hasBlankLine = /\n[ \t\r]*\n/.test(text);
  const paragraphs = [];
  let groupStart = -1;
  let groupEnd = -1;
  let pos = 0;
  const flush = () => {
    if (groupStart >= 0) paragraphs.push(trimRange(text, groupStart, groupEnd));
    groupStart = -1;
  };
  while (pos <= text.length) {
    let lineEnd = text.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = text.length;
    const line = text.slice(pos, lineEnd);
    if (line.trim() === '') {
      flush();
    } else {
      if (groupStart < 0) groupStart = pos;
      groupEnd = lineEnd;
      if (!hasBlankLine) flush();
    }
    pos = lineEnd + 1;
  }
  flush();
  return paragraphs.filter((p) => p.end > p.start);
}

/* --------------------------- sentence splitting --------------------------- */

// Always followed by more of the same sentence ("Mr. Hale", "e.g. this").
const HARD_ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'mt', 'vs', 'gen', 'col', 'capt',
  'sgt', 'lt', 'rev', 'hon', 'gov', 'sen', 'rep', 'messrs', 'mme', 'fig', 'e.g', 'i.e',
]);
// Can end a sentence: a boundary only when an uppercase letter follows.
const SOFT_ABBREVIATIONS = new Set(['etc', 'inc', 'ltd', 'a.m', 'p.m', 'u.s', 'u.k']);

function isBoundary(text, periodIndex, run, nextIndex) {
  const next = text[nextIndex];
  if (run === '.') {
    const before = text.slice(Math.max(0, periodIndex - 12), periodIndex);
    const prev = (before.match(/[A-Za-z](?:[A-Za-z.]*[A-Za-z])?$/) || [''])[0];
    const lower = prev.toLowerCase();
    if (SOFT_ABBREVIATIONS.has(lower)) return /\p{Lu}/u.test(next);
    if (HARD_ABBREVIATIONS.has(lower)) return false;
    if (/^[B-HJ-Z]$/.test(prev)) return false; // single initial: "J. Smith"
    if (/^(?:[A-Z]\.)+[A-Z]$/.test(prev)) return false; // "J.R.R. Tolkien"
  }
  return !/\p{Ll}/u.test(next); // lowercase continuation ("...", "?" before "she asked")
}

function splitParagraphIntoSentences(text, pStart, pEnd, out) {
  let sentStart = pStart;
  let i = pStart;
  while (i < pEnd) {
    if (!TERMINATORS.includes(text[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j < pEnd && TERMINATORS.includes(text[j])) j++;
    const run = text.slice(i, j);
    let k = j;
    while (k < pEnd && CLOSERS.includes(text[k])) k++;
    if (k >= pEnd) {
      out.push({ start: sentStart, end: k });
      return;
    }
    if (!WHITESPACE_RE.test(text[k])) {
      i = k; // "3.5", "e.g.,", "U.S.A": not a boundary
      continue;
    }
    let n = k;
    while (n < pEnd && WHITESPACE_RE.test(text[n])) n++;
    if (isBoundary(text, i, run, n)) {
      out.push({ start: sentStart, end: k });
      sentStart = n;
    }
    i = n;
  }
  if (sentStart < pEnd) out.push({ start: sentStart, end: pEnd });
}

/**
 * Split text into sentences with exact offsets into the ORIGINAL string, so a
 * highlight can be located with text.slice(start, end). Ranges with no words
 * (e.g. "***") are dropped.
 */
export function splitSentences(text) {
  const raw = [];
  for (const p of splitParagraphs(text)) splitParagraphIntoSentences(text, p.start, p.end, raw);
  const sentences = [];
  for (const range of raw) {
    const { start, end } = trimRange(text, range.start, range.end);
    if (end <= start) continue;
    const sentenceText = text.slice(start, end);
    const tokens = sentenceText.match(WORD_RE);
    if (!tokens) continue;
    sentences.push({ start, end, text: sentenceText, tokens });
  }
  return sentences;
}

/* ------------------------------- formulas ------------------------------- */

/** Standard Flesch Reading Ease (unrounded, unclamped). Returns null if inputs are unusable. */
export function fleschReadingEase(words, sentences, syllables) {
  if (!(words > 0) || !(sentences > 0)) return null;
  return 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
}

export const READING_LEVELS = Object.freeze([
  { min: 90, label: 'Very Easy', description: 'Easily understood by an average 11-year-old.' },
  { min: 80, label: 'Easy', description: 'Conversational English; easy for most readers.' },
  { min: 70, label: 'Fairly Easy', description: 'Plain English; easy for most adults.' },
  { min: 60, label: 'Standard', description: 'Plain English; clear to most teenagers and adults.' },
  { min: 50, label: 'Fairly Difficult', description: 'Needs some concentration; around high-school level.' },
  { min: 30, label: 'Difficult', description: 'College-level reading; dense for general audiences.' },
  { min: 0, label: 'Very Difficult', description: 'Graduate-level reading; very dense.' },
]);

export function getReadingLevel(score) {
  const clamped = Math.min(100, Math.max(0, score));
  return READING_LEVELS.find((l) => clamped >= l.min) ?? READING_LEVELS[READING_LEVELS.length - 1];
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

/**
 * Heuristic 0-100 difficulty for one sentence (not a scientific measure):
 *   length       40 pts  words / 40
 *   complex      25 pts  share of words with 3+ syllables / 0.30
 *   syllables    20 pts  (avg syllables per word - 1.0) / 1.0
 *   word length  15 pts  (avg letters per word - 3.5) / 3.5
 * The three per-word measures are scaled down for sentences under 12 words, because one
 * long word in a four-word sentence says little about how hard it is to read.
 */
export function scoreSentenceDifficulty({ wordCount, complexWords, avgSyllables, avgWordLength }) {
  if (!wordCount) return 0;
  const w = DIFFICULTY_WEIGHTS;
  const confidence = Math.min(1, wordCount / 12);
  const perWord =
    clamp01(complexWords / wordCount / 0.3) * w.complexWords +
    clamp01(avgSyllables - 1) * w.syllables +
    clamp01((avgWordLength - 3.5) / 3.5) * w.wordLength;
  return Math.round(clamp01(wordCount / 40) * w.length + perWord * confidence);
}

export function getDifficultyLabel(score) {
  if (score >= 70) return 'Very high';
  if (score >= 50) return 'High';
  if (score >= 30) return 'Moderate';
  return 'Low';
}

function measureSentence(sentence) {
  const syllableCounts = sentence.tokens.map(countSyllables);
  const syllables = syllableCounts.reduce((a, b) => a + b, 0);
  const wordCount = sentence.tokens.length;
  const letters = sentence.tokens.reduce((a, t) => a + t.replace(/[^\p{L}\p{N}]/gu, '').length, 0);
  const complex = [];
  syllableCounts.forEach((c, idx) => {
    if (c >= 3) complex.push(sentence.tokens[idx]);
  });
  return {
    wordCount,
    syllables,
    avgSyllables: syllables / wordCount,
    avgWordLength: letters / wordCount,
    complexWords: complex.length,
    complexExamples: [...new Set(complex.map((w) => w.toLowerCase()))].slice(0, 3),
  };
}

function joinList(items) {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function explainSentence(m) {
  const reasons = [];
  if (m.wordCount >= 25) reasons.push(`it is long (${m.wordCount} words)`);
  if (m.complexWords >= 3 || (m.complexWords >= 1 && m.complexWords / m.wordCount >= 0.2)) {
    const eg = m.complexExamples.map((w) => `“${w}”`);
    reasons.push(
      `it uses ${m.complexWords} complex word${m.complexWords === 1 ? '' : 's'} (3+ syllables, e.g. ${joinList(eg)})`,
    );
  }
  if (m.avgWordLength >= 5.5) reasons.push(`its words are long on average (${m.avgWordLength.toFixed(1)} letters)`);
  if (m.avgSyllables >= 1.7) reasons.push(`it has a high syllable load (${m.avgSyllables.toFixed(2)} per word)`);
  if (!reasons.length) return 'No single factor stands out; it scores moderately on length and word choice.';
  return `Mainly because ${joinList(reasons)}.`;
}

/* ------------------------------ analysis ------------------------------ */

/** Validate chapter text. Shared by the UI and the API. */
export function validateChapterText(text) {
  if (typeof text !== 'string') {
    return { ok: false, code: 'INVALID_TEXT', message: 'Chapter text must be a string.' };
  }
  if (text.trim() === '') {
    return { ok: false, code: 'EMPTY_TEXT', message: 'Paste a chapter to analyze.' };
  }
  if (text.length > MAX_CHARACTERS) {
    return {
      ok: false,
      code: 'TEXT_TOO_LONG',
      message: `Chapter is too long. The limit is ${MAX_CHARACTERS.toLocaleString('en-US')} characters; analyze it in parts.`,
    };
  }
  if (countWords(text) < MIN_WORDS) {
    return {
      ok: false,
      code: 'TEXT_TOO_SHORT',
      message: `Add a little more text: at least ${MIN_WORDS} words are needed for a meaningful result.`,
    };
  }
  return { ok: true };
}

function buildHardestSentences(text, sentences) {
  const scored = sentences.map((s) => {
    const m = measureSentence(s);
    const difficulty = scoreSentenceDifficulty(m);
    return { s, m, difficulty, key: normalizeKey(s.text) };
  });

  const occurrences = new Map();
  for (const item of scored) {
    if (!occurrences.has(item.key)) occurrences.set(item.key, []);
    occurrences.get(item.key).push({ start: item.s.start, end: item.s.end });
  }

  // Keep the first occurrence of each distinct sentence, then rank.
  const seen = new Set();
  const unique = scored.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
  unique.sort(
    (a, b) => b.difficulty - a.difficulty || b.m.wordCount - a.m.wordCount || a.s.start - b.s.start,
  );

  return unique.slice(0, 5).map(({ s, m, difficulty, key }, idx) => {
    const ranges = occurrences.get(key);
    return {
      rank: idx + 1,
      text: text.slice(s.start, s.end),
      start: s.start,
      end: s.end,
      ranges,
      occurrences: ranges.length,
      difficulty,
      difficultyLabel: getDifficultyLabel(difficulty),
      wordCount: m.wordCount,
      avgSyllables: round(m.avgSyllables, 2),
      avgWordLength: round(m.avgWordLength, 1),
      complexWords: m.complexWords,
      explanation: explainSentence(m),
    };
  });
}

function stdDev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
}

function buildSuggestions({ stats, readability, sentences, complexWordCount }) {
  const out = [];
  if (!stats.words) return out;
  const longSentences = sentences.filter((s) => s.tokens.length >= LONG_SENTENCE_WORDS).length;
  const complexShare = complexWordCount / stats.words;

  if (stats.words < 100) {
    out.push({
      id: 'short-sample',
      title: 'Short sample',
      detail: 'Readability scores are less reliable under about 100 words. Try a longer passage for a steadier reading.',
    });
  }
  if (stats.avgWordsPerSentence > 20 || longSentences > 0) {
    const parts = [`Your average sentence is ${stats.avgWordsPerSentence} words`];
    if (longSentences) parts.push(`${longSentences} sentence${longSentences === 1 ? ' runs' : 's run'} ${LONG_SENTENCE_WORDS}+ words`);
    out.push({
      id: 'sentence-length',
      title: 'Look at your longest sentences',
      detail: `${parts.join(' and ')}. Consider whether the longest ones could be split at a natural pause, starting with the highlighted sentences. Keep the long ones that earn their length.`,
    });
  }
  if (stats.avgSyllablesPerWord > 1.6 || complexShare > 0.12) {
    out.push({
      id: 'word-choice',
      title: 'Check word choice',
      detail: `About ${Math.round(complexShare * 100)}% of your words have three or more syllables. Where a shorter word means the same thing, it may read faster; keep the specialist terms your story needs.`,
    });
  }
  if (sentences.length >= 8 && stdDev(sentences.map((s) => s.tokens.length)) < 5) {
    out.push({
      id: 'rhythm',
      title: 'Vary your sentence rhythm',
      detail: 'Your sentences are fairly similar in length. Mixing short and long sentences can give the prose a more natural rhythm.',
    });
  }
  if (stats.paragraphs > 0 && stats.words / stats.paragraphs > 150) {
    out.push({
      id: 'paragraph-length',
      title: 'Consider paragraph breaks',
      detail: `Paragraphs average ${Math.round(stats.words / stats.paragraphs)} words. Breaking at shifts in time, place, speaker or topic can give readers a place to rest.`,
    });
  }
  if (!out.length || (out.length === 1 && out[0].id === 'short-sample')) {
    out.push({
      id: 'on-track',
      title: 'Reads comfortably',
      detail: `This text scores "${readability.level}". Check that this level suits your genre and audience; there is no single right score.`,
    });
  }
  return out;
}

/** Zeroed result so callers never need to special-case empty input. */
function emptyAnalysis(text) {
  const characters = text.length;
  return {
    readability: { score: null, rawScore: null, level: null, levelDescription: null },
    stats: {
      words: 0,
      sentences: 0,
      characters,
      charactersNoSpaces: text.replace(/\s/g, '').length,
      paragraphs: 0,
      syllables: 0,
      avgWordsPerSentence: 0,
      avgSyllablesPerWord: 0,
      readingTimeMinutes: 0,
      readingTimeSeconds: 0,
    },
    hardestSentences: [],
    suggestions: [],
  };
}

/**
 * Analyze chapter text. Never throws on odd input; returns zeros / null score when
 * there is nothing to measure. The input string is never modified, and all offsets
 * refer to it exactly as given.
 */
export function analyzeChapter(input) {
  const text = typeof input === 'string' ? input : '';
  const sentences = splitSentences(text);
  if (!sentences.length) return emptyAnalysis(text);

  const measures = sentences.map(measureSentence);
  const words = measures.reduce((a, m) => a + m.wordCount, 0);
  const syllables = measures.reduce((a, m) => a + m.syllables, 0);
  const complexWordCount = measures.reduce((a, m) => a + m.complexWords, 0);
  const rawScore = fleschReadingEase(words, sentences.length, syllables);
  const score = round(Math.min(100, Math.max(0, rawScore)), 1);
  const level = getReadingLevel(score);

  const stats = {
    words,
    sentences: sentences.length,
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, '').length,
    paragraphs: splitParagraphs(text).length,
    syllables,
    avgWordsPerSentence: round(words / sentences.length, 1),
    avgSyllablesPerWord: round(syllables / words, 2),
    readingTimeMinutes: round(words / WORDS_PER_MINUTE, 1),
    readingTimeSeconds: Math.round((words / WORDS_PER_MINUTE) * 60),
  };
  const readability = {
    score,
    rawScore: round(rawScore, 1),
    level: level.label,
    levelDescription: level.description,
  };

  return {
    readability,
    stats,
    hardestSentences: buildHardestSentences(text, sentences),
    suggestions: buildSuggestions({ stats, readability, sentences, complexWordCount }),
  };
}

/**
 * Split the original text into consecutive segments for rendering. Joining every
 * segment's `text` reproduces the input exactly. Highlighted segments carry `rank`.
 */
export function buildHighlightSegments(text, hardestSentences) {
  const ranges = [];
  for (const h of hardestSentences ?? []) {
    for (const r of h.ranges ?? [{ start: h.start, end: h.end }]) {
      ranges.push({ start: r.start, end: r.end, rank: h.rank });
    }
  }
  ranges.sort((a, b) => a.start - b.start);
  const segments = [];
  let cursor = 0;
  const seenRanks = new Set();
  for (const r of ranges) {
    if (r.start < cursor || r.end > text.length) continue; // overlap / out of bounds: skip safely
    if (r.start > cursor) segments.push({ text: text.slice(cursor, r.start), rank: null });
    segments.push({ text: text.slice(r.start, r.end), rank: r.rank, first: !seenRanks.has(r.rank) });
    seenRanks.add(r.rank);
    cursor = r.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), rank: null });
  return segments;
}

export function formatReadingTime(seconds) {
  if (!seconds) return '0 sec';
  if (seconds < 60) return `${seconds} sec`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} min ${s} sec` : `${m} min`;
}
