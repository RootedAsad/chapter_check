import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { analyzeChapter, validateChapterText } from './analysis/readability.js';
import { loadConfig } from './config.js';

function sendError(res, status, code, message) {
  res.status(status).json({ error: { code, message } });
}

/**
 * Build the Express app. Stateless by design: chapter text is analyzed in memory and
 * never stored, cached or logged (no database, no body logging, Cache-Control: no-store).
 */
export function createApp(config = loadConfig()) {
  const app = express();
  app.set('trust proxy', config.trustProxy);

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => callback(null, !origin || config.clientOrigins.includes(origin)),
      methods: ['GET', 'POST'],
      maxAge: 600,
    }),
  );

  if (config.logRequests) {
    app.use((req, res, next) => {
      const started = Date.now();
      res.on('finish', () => console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - started}ms`));
      next();
    });
  }

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()), timestamp: new Date().toISOString() });
  });

  const analyzeLimiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    limit: config.rateLimitMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) =>
      sendError(res, 429, 'RATE_LIMITED', 'Too many requests. Please wait a few minutes and try again.'),
  });

  app.post('/api/analyze', analyzeLimiter, express.json({ limit: config.bodyLimit }), (req, res) => {
    const text = req.body?.text;
    const check = validateChapterText(text);
    if (!check.ok) {
      return sendError(res, check.code === 'TEXT_TOO_LONG' ? 413 : 400, check.code, check.message);
    }
    res.set('Cache-Control', 'no-store');
    res.json({ data: analyzeChapter(text) });
  });

  app.use((req, res) => sendError(res, 404, 'NOT_FOUND', 'Route not found.'));

  // Error messages from body parsing can quote the request body, so fixed messages only.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err?.type === 'entity.too.large') {
      return sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'The request is too large. Analyze a shorter chapter.');
    }
    if (err?.type === 'entity.parse.failed') {
      return sendError(res, 400, 'INVALID_JSON', 'Request body must be valid JSON.');
    }
    if (err?.status >= 400 && err?.status < 500) {
      return sendError(res, err.status, 'BAD_REQUEST', 'The request could not be processed.');
    }
    console.error(`Unhandled error (${err?.name ?? 'Error'})`);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Something went wrong on the server. Please try again.');
  });

  return app;
}
