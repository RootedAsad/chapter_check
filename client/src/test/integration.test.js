// Frontend <-> backend integration: the real API client against the real Express app.
// Skipped automatically if the server's dependencies are not installed.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sample from '../data/sample-chapter.txt?raw';
import { analyzeChapter } from '../lib/readability.js';
import { ApiError, createApiClient } from '../services/api.js';
import { runAnalysis } from '../services/analyzer.js';

const serverDir = fileURLToPath(new URL('../../../server/', import.meta.url));
const hasServer = existsSync(`${serverDir}node_modules/express`);

describe.skipIf(!hasServer)('API client against the real server', () => {
  let servers = [];
  let client;
  let limitedClient;

  const start = async (overrides = {}) => {
    const { createApp } = await import('../../../server/src/app.js');
    const { loadConfig } = await import('../../../server/src/config.js');
    return new Promise((resolve) => {
      const server = createApp({ ...loadConfig({ NODE_ENV: 'test' }), ...overrides }).listen(0, () => {
        servers.push(server);
        resolve(`http://127.0.0.1:${server.address().port}`);
      });
    });
  };

  beforeAll(async () => {
    client = createApiClient(await start());
    limitedClient = createApiClient(await start({ rateLimitMax: 1 }));
  });
  afterAll(() => servers.forEach((s) => s.close()));

  it('health check works', async () => {
    expect((await client.health()).status).toBe('ok');
  });

  it('returns the same analysis as the in-browser engine', async () => {
    expect(await client.analyze(sample)).toEqual(analyzeChapter(sample));
    expect(await runAnalysis(sample, 'server', client)).toEqual(analyzeChapter(sample));
  });

  it('surfaces validation errors as ApiError with the server message', async () => {
    for (const [text, code, status] of [['   ', 'EMPTY_TEXT', 400], ['Too short.', 'TEXT_TOO_SHORT', 400], ['word '.repeat(30000), 'TEXT_TOO_LONG', 413]]) {
      const err = await client.analyze(text).catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.code).toBe(code);
      expect(err.status).toBe(status);
      expect(err.message.length).toBeGreaterThan(10);
    }
  });

  it('surfaces rate limiting as a readable error', async () => {
    await limitedClient.analyze(sample);
    const err = await limitedClient.analyze(sample).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.status).toBe(429);
  });

  it('reports an unreachable server clearly', async () => {
    const err = await createApiClient('http://127.0.0.1:1').analyze(sample).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('NETWORK_ERROR');
    expect(err.message).toMatch(/could not reach/i);
  });
});
