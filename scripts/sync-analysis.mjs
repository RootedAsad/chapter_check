// Copies the canonical readability module (client) into the server so both
// deploy independently. Usage: node scripts/sync-analysis.mjs [--check]
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'client/src/lib/readability.js');
const target = resolve(root, 'server/src/analysis/readability.js');

if (process.argv.includes('--check')) {
  let same = false;
  try {
    same = readFileSync(source, 'utf8') === readFileSync(target, 'utf8');
  } catch {
    same = false;
  }
  if (!same) {
    console.error('server/src/analysis/readability.js is out of sync. Run: npm run sync');
    process.exit(1);
  }
  console.log('readability module is in sync.');
} else {
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  console.log('Synced client readability module -> server/src/analysis/readability.js');
}
