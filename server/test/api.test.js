import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const SAMPLE =
  'The old house stood at the end of the lane. Nobody had lived there for years. ' +
  'Dr. Reyes, however, walked up the path at 5 p.m. and knocked twice.\n\n' +
  '"Is anyone home?" she asked. The wind answered instead.';

function start(overrides = {}) {
  const config = { ...loadConfig({ NODE_ENV: 'test' }), ...overrides };
  return new Promise((resolve) => {
    const server = createApp(config).listen(0, () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

const post = (url, body, headers = {}) =>
  fetch(`${url}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

let ctx;
before(async () => {
  ctx = await start();
});
after(() => ctx.server.close());

test('GET /api/health returns ok', async () => {
  const res = await fetch(`${ctx.url}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
});

test('POST /api/analyze returns analysis and never echoes the full chapter', async () => {
  const res = await post(ctx.url, { text: SAMPLE });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const { data } = await res.json();
  assert.equal(data.stats.paragraphs, 2);
  assert.ok(data.readability.score >= 0 && data.readability.score <= 100);
  assert.ok(data.hardestSentences.length <= 5);
  for (const h of data.hardestSentences) assert.equal(SAMPLE.slice(h.start, h.end), h.text);
  assert.ok(!JSON.stringify(data).includes(SAMPLE));
});

test('rejects empty, missing, non-string, too short and too long text with consistent JSON errors', async () => {
  const cases = [
    [{ text: '   ' }, 400, 'EMPTY_TEXT'],
    [{}, 400, 'INVALID_TEXT'],
    [{ text: 42 }, 400, 'INVALID_TEXT'],
    [{ text: 'Too short.' }, 400, 'TEXT_TOO_SHORT'],
    [{ text: 'word '.repeat(30000) }, 413, 'TEXT_TOO_LONG'],
  ];
  for (const [body, status, code] of cases) {
    const res = await post(ctx.url, body);
    assert.equal(res.status, status, code);
    const json = await res.json();
    assert.equal(json.error.code, code);
    assert.equal(typeof json.error.message, 'string');
  }
});

test('invalid JSON gets a fixed message that does not quote the body', async () => {
  const secret = 'SECRET-CHAPTER-TEXT';
  const res = await post(ctx.url, `{"text": "${secret}`);
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.error.code, 'INVALID_JSON');
  assert.ok(!JSON.stringify(json).includes(secret));
});

test('unknown routes return a JSON 404', async () => {
  const res = await fetch(`${ctx.url}/api/nope`);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error.code, 'NOT_FOUND');
});

test('oversized request bodies return 413 PAYLOAD_TOO_LARGE', async () => {
  const small = await start({ bodyLimit: '1kb' });
  try {
    const res = await post(small.url, { text: 'word '.repeat(1000) });
    assert.equal(res.status, 413);
    assert.equal((await res.json()).error.code, 'PAYLOAD_TOO_LARGE');
  } finally {
    small.server.close();
  }
});

test('rate limiting returns 429 after the limit, but health is exempt', async () => {
  const limited = await start({ rateLimitMax: 2 });
  try {
    assert.equal((await post(limited.url, { text: SAMPLE })).status, 200);
    assert.equal((await post(limited.url, { text: SAMPLE })).status, 200);
    const res = await post(limited.url, { text: SAMPLE });
    assert.equal(res.status, 429);
    assert.equal((await res.json()).error.code, 'RATE_LIMITED');
    assert.equal((await fetch(`${limited.url}/api/health`)).status, 200);
  } finally {
    limited.server.close();
  }
});

test('CORS allows the configured origin only', async () => {
  const allowed = await fetch(`${ctx.url}/api/health`, { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const blocked = await fetch(`${ctx.url}/api/health`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(blocked.headers.get('access-control-allow-origin'), null);
});

test('request logs never contain chapter text', async () => {
  const logged = [];
  const original = console.log;
  console.log = (...args) => logged.push(args.join(' '));
  const logging = await start({ logRequests: true });
  try {
    await post(logging.url, { text: SAMPLE });
    await new Promise((r) => setTimeout(r, 20));
  } finally {
    console.log = original;
    logging.server.close();
  }
  assert.ok(logged.length > 0);
  assert.ok(logged.every((line) => !line.includes('old house')));
  assert.ok(logged.some((line) => line.startsWith('POST /api/analyze 200')));
});

test('server analysis module is identical to the client copy', () => {
  const client = readFileSync(new URL('../../client/src/lib/readability.js', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../src/analysis/readability.js', import.meta.url), 'utf8');
  assert.equal(server, client, 'Run `npm run sync` from the repo root');
});
