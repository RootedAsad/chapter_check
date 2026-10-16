export class ApiError extends Error {
  constructor(message, { status = 0, code = 'UNKNOWN' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const TIMEOUT_MS = 45000; // free hosting can take a while to wake up

/** Small fetch wrapper for the ChapterCheck API. Errors are always ApiError with a readable message. */
export function createApiClient(baseUrl = '') {
  const root = String(baseUrl).replace(/\/$/, '');

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(`${root}${path}`, {
        ...options,
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...options.headers },
      });
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw new ApiError(
          'The server took too long to respond. If it was idle it may need a minute to wake up; please try again.',
          { code: 'TIMEOUT' },
        );
      }
      throw new ApiError('Could not reach the analysis server. Check your connection and try again.', {
        code: 'NETWORK_ERROR',
      });
    } finally {
      clearTimeout(timer);
    }

    let body = null;
    try {
      body = await res.json();
    } catch {
      /* non-JSON response */
    }
    if (!res.ok) {
      throw new ApiError(body?.error?.message || `The server returned an error (${res.status}).`, {
        status: res.status,
        code: body?.error?.code || 'HTTP_ERROR',
      });
    }
    if (!body) throw new ApiError('The server sent an unreadable response.', { status: res.status, code: 'BAD_RESPONSE' });
    return body;
  }

  return {
    health: () => request('/api/health'),
    analyze: async (text) => (await request('/api/analyze', { method: 'POST', body: JSON.stringify({ text }) })).data,
  };
}

export default createApiClient(import.meta.env?.VITE_API_URL ?? '');
