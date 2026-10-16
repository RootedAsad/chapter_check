const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export function loadConfig(env = process.env) {
  const isProduction = env.NODE_ENV === 'production';
  const trustProxy = env.TRUST_PROXY ?? (isProduction ? '1' : '');
  return {
    port: num(env.PORT, 5000),
    // Comma-separated list of allowed browser origins (your Vercel URL in production).
    clientOrigins: (env.CLIENT_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim().replace(/\/$/, ''))
      .filter(Boolean),
    rateLimitWindowMs: num(env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    rateLimitMax: num(env.RATE_LIMIT_MAX, 60),
    // 100k characters of text fits comfortably; this also caps raw request size.
    bodyLimit: env.BODY_LIMIT || '400kb',
    // Render (and most hosts) sit behind one proxy; needed for correct per-client rate limiting.
    trustProxy: trustProxy === '' ? false : Number.isNaN(Number(trustProxy)) ? trustProxy : Number(trustProxy),
    // Request logs contain method, path, status and duration only; never bodies.
    logRequests: env.NODE_ENV !== 'test',
  };
}
