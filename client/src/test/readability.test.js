import { describe, it, expect } from 'vitest';
import sample from '../data/sample-chapter.txt?raw';
import {
  analyzeChapter,
  buildHighlightSegments,
  countSyllables,
  countWords,
  fleschReadingEase,
  formatReadingTime,
  getReadingLevel,
  scoreSentenceDifficulty,
  splitParagraphs,
  splitSentences,
  validateChapterText,
  MAX_CHARACTERS,
} from '../lib/readability.js';

const sentenceTexts = (t) => splitSentences(t).map((s) => s.text);

describe('Flesch Reading Ease formula', () => {
  it('matches hand-calculated values', () => {
    // 206.835 - 1.015 * (100/5) - 84.6 * (130/100)
    expect(fleschReadingEase(100, 5, 130)).toBeCloseTo(76.555, 3);
    // 206.835 - 20.3 - 152.28
    expect(fleschReadingEase(100, 5, 180)).toBeCloseTo(34.255, 3);
  });

  it('returns null instead of dividing by zero', () => {
    expect(fleschReadingEase(0, 0, 0)).toBeNull();
    expect(fleschReadingEase(10, 0, 15)).toBeNull();
    expect(fleschReadingEase(0, 3, 0)).toBeNull();
  });

  it('scores a known two-sentence text', () => {
    // 14 words, 2 sentences, 17 syllables -> 206.835 - 7.105 - 102.7286 = 97.0
    const a = analyzeChapter('The quick brown fox jumps over the lazy dog. It was a sunny day.');
    expect(a.stats).toMatchObject({ words: 14, sentences: 2, syllables: 17 });
    expect(a.readability.score).toBe(97);
    expect(a.readability.level).toBe('Very Easy');
  });

  it('clamps the displayed score to 0-100 but keeps the raw value', () => {
    const easy = analyzeChapter('The cat sat on the mat.');
    expect(easy.readability.rawScore).toBeCloseTo(116.1, 1);
    expect(easy.readability.score).toBe(100);
    const hard = analyzeChapter(
      'Notwithstanding the unprecedented organizational transformations, institutional representatives ' +
        'characteristically underestimated administrative responsibilities.',
    );
    expect(hard.readability.rawScore).toBeLessThan(0);
    expect(hard.readability.score).toBe(0);
    expect(hard.readability.level).toBe('Very Difficult');
  });
});

describe('reading levels', () => {
  it.each([
    [100, 'Very Easy'], [90, 'Very Easy'], [89.9, 'Easy'], [80, 'Easy'], [79.9, 'Fairly Easy'],
    [70, 'Fairly Easy'], [69.9, 'Standard'], [60, 'Standard'], [59.9, 'Fairly Difficult'],
    [50, 'Fairly Difficult'], [49.9, 'Difficult'], [30, 'Difficult'], [29.9, 'Very Difficult'], [0, 'Very Difficult'],
  ])('score %s is %s', (score, label) => {
    expect(getReadingLevel(score).label).toBe(label);
  });
});

describe('syllable estimation', () => {
  it.each([
    ['the', 1], ['cat', 1], ['water', 2], ['table', 2], ['whale', 1], ['jumped', 1], ['wanted', 2],
    ['played', 1], ['makes', 1], ['boxes', 2], ['people', 2], ['beautiful', 3], ['beyond', 2],
    ['understanding', 4], ['extraordinary', 5], ['atmospheric', 4], ["didn't", 2], ["they're", 1],
    ['well-known', 2], ['1999', 1], ['created', 3],
  ])('%s has %i syllables', (word, expected) => {
    expect(countSyllables(word)).toBe(expected);
  });
});

describe('empty and degenerate input', () => {
  it.each([[''], ['   \n\n  '], ['!!! ... ???'], ['*** --- ***'], [null], [undefined], [42]])(
    'analyzes %j without throwing',
    (input) => {
      const a = analyzeChapter(input);
      expect(a.readability.score).toBeNull();
      expect(a.readability.level).toBeNull();
      expect(a.stats.words).toBe(0);
      expect(a.stats.sentences).toBe(0);
      expect(a.stats.avgWordsPerSentence).toBe(0);
      expect(a.hardestSentences).toEqual([]);
    },
  );
});

describe('statistics', () => {
  it('handles one short sentence', () => {
    const a = analyzeChapter('The cat sat on the mat.');
    expect(a.stats).toMatchObject({ words: 6, sentences: 1, paragraphs: 1, characters: 23, charactersNoSpaces: 18 });
    expect(a.stats.avgWordsPerSentence).toBe(6);
    expect(a.stats.avgSyllablesPerWord).toBe(1);
    expect(a.hardestSentences).toHaveLength(1);
  });

  it('estimates reading time at 200 words per minute', () => {
    const a = analyzeChapter('word '.repeat(400));
    expect(a.stats.words).toBe(400);
    expect(a.stats.readingTimeMinutes).toBe(2);
    expect(a.stats.readingTimeSeconds).toBe(120);
    expect(formatReadingTime(120)).toBe('2 min');
    expect(formatReadingTime(130)).toBe('2 min 10 sec');
    expect(formatReadingTime(45)).toBe('45 sec');
  });

  it('counts paragraphs by blank lines, or by lines when there are no blank lines', () => {
    expect(splitParagraphs('One here.\n\nTwo here.\n\n\n\nThree here.')).toHaveLength(3);
    expect(splitParagraphs('Wrapped line one\nwrapped line two.\n\nSecond paragraph.')).toHaveLength(2);
    expect(splitParagraphs('Line one.\nLine two.\nLine three.')).toHaveLength(3);
    expect(splitParagraphs('\r\nOne.\r\n\r\nTwo.\r\n')).toHaveLength(2);
  });

  it('treats a heading without punctuation as its own sentence', () => {
    expect(sentenceTexts('Chapter One\n\nIt was a dark night. The rain fell.')).toEqual([
      'Chapter One',
      'It was a dark night.',
      'The rain fell.',
    ]);
  });

  it('counts live words the same way the analysis does', () => {
    expect(countWords('Hello, world! It’s a well-known fact.')).toBe(6);
    expect(countWords('')).toBe(0);
    expect(countWords(sample)).toBe(analyzeChapter(sample).stats.words);
  });
});

describe('sentence splitting', () => {
  it('keeps abbreviations together', () => {
    expect(sentenceTexts('Dr. Smith met Mr. Jones at 5 p.m. They talked. U.S. policy changed.')).toEqual([
      'Dr. Smith met Mr. Jones at 5 p.m.',
      'They talked.',
      'U.S. policy changed.',
    ]);
  });

  it('handles decimals, initials and e.g.', () => {
    expect(sentenceTexts('Pi is about 3.14 today. It is fine.')).toHaveLength(2);
    expect(sentenceTexts('J. R. R. Tolkien wrote it. He was good.')).toHaveLength(2);
    expect(sentenceTexts('Use fruit, e.g. apples, for this. Then stop.')).toHaveLength(2);
  });

  it('handles ellipses, repeated punctuation, parentheses and dashes', () => {
    expect(sentenceTexts('Wait... what happened? Nobody knew.')).toEqual(['Wait... what happened?', 'Nobody knew.']);
    expect(sentenceTexts('He yelled (loudly!) at them. Really?! Yes!!! Then silence.')).toHaveLength(4);
    expect(sentenceTexts('It was late — far too late — and she knew it. He did not.')).toHaveLength(2);
  });

  it('keeps dialogue tags with their quote', () => {
    expect(sentenceTexts('"Stop!" she cried. "Why?" he asked. "Because," she said.')).toEqual([
      '"Stop!" she cried.',
      '"Why?" he asked.',
      '"Because," she said.',
    ]);
    expect(sentenceTexts('“I left.” She nodded.')).toEqual(['“I left.”', 'She nodded.']);
  });

  it('returns offsets that slice back to the exact original sentence', () => {
    const text = '  First one.  \r\n\r\n  Second “one” here… Third!  ';
    for (const s of splitSentences(text)) expect(text.slice(s.start, s.end)).toBe(s.text);
  });
});

describe('hardest sentences', () => {
  const easy = 'The dog ran. The cat sat. The sun is up. We had tea.';
  const hard =
    'Notwithstanding the considerable organizational difficulties, the administrative representatives ' +
    'unquestionably demonstrated extraordinary communicative capabilities throughout the investigation.';

  it('ranks the hardest sentence first, in descending difficulty order', () => {
    const a = analyzeChapter(`${easy} ${hard} Then we left.`);
    const list = a.hardestSentences;
    expect(list[0].text).toBe(hard);
    expect(list[0].rank).toBe(1);
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1].difficulty).toBeGreaterThanOrEqual(list[i].difficulty);
      expect(list[i].rank).toBe(i + 1);
    }
    expect(list[0].explanation).toMatch(/long|complex/);
  });

  it('returns at most five sentences', () => {
    expect(analyzeChapter(Array.from({ length: 12 }, (_, i) => `Sentence number ${i} is here.`).join(' ')).hardestSentences).toHaveLength(5);
  });

  it('returns only what exists when there are fewer than five', () => {
    expect(analyzeChapter('One short sentence here. And a second short one follows it.').hardestSentences).toHaveLength(2);
    expect(analyzeChapter('Just a single sentence of text.').hardestSentences).toHaveLength(1);
  });

  it('avoids duplicate results but highlights every exact occurrence', () => {
    const text = `${hard}\n\nSomething else happened.\n\n${hard}\n\n${hard.toUpperCase()}`;
    const a = analyzeChapter(text);
    const matches = a.hardestSentences.filter((h) => h.text.toLowerCase() === hard.toLowerCase());
    expect(matches).toHaveLength(1);
    expect(matches[0].occurrences).toBe(3);
    for (const r of matches[0].ranges) expect(text.slice(r.start, r.end).toLowerCase()).toBe(hard.toLowerCase());
    const marked = buildHighlightSegments(text, a.hardestSentences).filter((s) => s.rank === matches[0].rank);
    expect(marked).toHaveLength(3);
  });

  it('keeps difficulty scores within 0-100 and damps very short sentences', () => {
    expect(scoreSentenceDifficulty({ wordCount: 0, complexWords: 0, avgSyllables: 0, avgWordLength: 0 })).toBe(0);
    expect(scoreSentenceDifficulty({ wordCount: 60, complexWords: 40, avgSyllables: 3, avgWordLength: 9 })).toBe(100);
    const shortOne = scoreSentenceDifficulty({ wordCount: 3, complexWords: 3, avgSyllables: 3, avgWordLength: 9 });
    expect(shortOne).toBeLessThan(40);
  });

  it('suggests splitting when sentences are long, without rewriting anything', () => {
    const long = `${hard.slice(0, -1)}, and ${hard[0].toLowerCase()}${hard.slice(1)}`; // 32 words
    const a = analyzeChapter(long);
    expect(a.suggestions.some((s) => s.id === 'sentence-length')).toBe(true);
    expect(analyzeChapter('The dog ran home. The cat sat down. We had tea. It rained.').suggestions.some((s) => s.id === 'sentence-length')).toBe(false);
    expect(JSON.stringify(a.suggestions)).not.toMatch(/rewrite[ds]? as/i);
  });
});

describe('highlights match the original text', () => {
  const variants = {
    sample,
    'CRLF line endings': sample.replace(/\n/g, '\r\n'),
    'padded with whitespace': `\n\n   ${sample}   \n\n`,
    'unicode quotes and dashes': '“Wait—” she said. Café naïve résumé … and then it ended. ' + sample,
  };

  for (const [name, text] of Object.entries(variants)) {
    it(`segments rebuild the input exactly (${name})`, () => {
      const a = analyzeChapter(text);
      const segments = buildHighlightSegments(text, a.hardestSentences);
      expect(segments.map((s) => s.text).join('')).toBe(text);
      for (const h of a.hardestSentences) {
        expect(text.slice(h.start, h.end)).toBe(h.text);
        const marked = segments.filter((s) => s.rank === h.rank);
        expect(marked.length).toBe(h.occurrences);
        expect(marked[0].text).toBe(h.text);
      }
    });
  }

  it('skips out-of-range or overlapping ranges safely', () => {
    const text = 'Hello there friend.';
    const segs = buildHighlightSegments(text, [{ rank: 1, ranges: [{ start: 0, end: 5 }, { start: 3, end: 9 }, { start: 5, end: 500 }] }]);
    expect(segs.map((s) => s.text).join('')).toBe(text);
  });
});

describe('sample chapter', () => {
  it('produces a sensible analysis', () => {
    const a = analyzeChapter(sample);
    expect(a.readability.score).toBeGreaterThan(0);
    expect(a.readability.score).toBeLessThanOrEqual(100);
    expect(a.hardestSentences).toHaveLength(5);
    expect(a.hardestSentences[0].text).toContain('barometric');
    expect(a.hardestSentences.slice(0, 2).some((h) => h.text.includes('three decades'))).toBe(true);
    expect(a.stats.paragraphs).toBeGreaterThan(5);
  });
});

describe('validateChapterText', () => {
  it('accepts normal text and rejects unusable text with specific codes', () => {
    expect(validateChapterText(sample).ok).toBe(true);
    expect(validateChapterText('').code).toBe('EMPTY_TEXT');
    expect(validateChapterText('  \n ').code).toBe('EMPTY_TEXT');
    expect(validateChapterText('Too short to judge.').code).toBe('TEXT_TOO_SHORT');
    expect(validateChapterText(null).code).toBe('INVALID_TEXT');
    expect(validateChapterText('a '.repeat(MAX_CHARACTERS)).code).toBe('TEXT_TOO_LONG');
  });
});
