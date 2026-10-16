import { analyzeChapter } from '../lib/readability.js';
import api from './api.js';

/** "local" (default) analyzes in the browser; "server" uses POST /api/analyze. */
export const ANALYSIS_MODE = import.meta.env?.VITE_ANALYSIS_MODE === 'server' ? 'server' : 'local';

export async function runAnalysis(text, mode = ANALYSIS_MODE, client = api) {
  if (mode === 'server') return client.analyze(text);
  // Yield once so the loading state can paint before a long chapter is processed.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return analyzeChapter(text);
}
