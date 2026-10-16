# ChapterCheck

Paste an English chapter and get a Flesch Reading Ease score, writing statistics, your five hardest sentences highlighted in context, and suggestions for improving readability. ChapterCheck never rewrites your text.

- **Frontend:** React + Vite + Tailwind CSS v4 (deploy to Vercel)
- **Backend:** Node.js + Express 5 (deploy to Render)
- **Privacy:** by default the chapter is analyzed **in the browser** and never leaves the device. The API is stateless: it does not store, cache or log chapter text.

## Project structure

```
chaptercheck/
  client/                      React app
    src/lib/readability.js     Analysis engine (canonical copy, pure JS, no dependencies)
    src/services/              api.js (HTTP client), analyzer.js (local vs server mode)
    src/components/            ChapterInput, ScoreGauge, StatsGrid, HardestSentences, ...
    src/data/sample-chapter.txt  Sample chapter used by "Try Sample"
    src/test/                  Vitest tests (engine, UI, frontend-backend integration)
  server/                      Express API
    src/app.js                 Routes, validation, rate limiting, CORS, error handling
    src/analysis/readability.js  Copy of the client engine (kept in sync by a script)
    test/                      node:test API tests
  scripts/sync-analysis.mjs    Copies the engine from client to server
  render.yaml                  Render blueprint for the API
```

## Local setup

Requires Node.js 20 or newer.

```bash
npm run install:all          # installs server and client dependencies

# Terminal 1 (optional unless you use server mode)
cp server/.env.example server/.env
npm run dev:server           # http://localhost:5000

# Terminal 2
cp client/.env.example client/.env.local
npm run dev:client           # http://localhost:5173
```

The app works with only the client running. The server is used when `VITE_ANALYSIS_MODE=server` (see below). In dev, Vite proxies `/api` to `localhost:5000`.

### Analysis modes

| `VITE_ANALYSIS_MODE` | Behavior |
| --- | --- |
| `local` (default) | Analysis runs in the browser. Nothing is sent anywhere. |
| `server` | The chapter is sent to `POST /api/analyze` (`VITE_API_URL`, or the Vite proxy locally). |

## API

`GET /api/health` returns `{ "status": "ok", "uptimeSeconds": 12, "timestamp": "..." }`.

`POST /api/analyze` with `{ "text": "..." }` returns `{ "data": { readability, stats, hardestSentences, suggestions } }`. The response contains character offsets (`start`, `end`) for each hard sentence, so the client can highlight them in the text it already has; the chapter itself is not echoed back.

Errors always use one shape: `{ "error": { "code": "EMPTY_TEXT", "message": "..." } }`.

| Status | Codes |
| --- | --- |
| 400 | `EMPTY_TEXT`, `INVALID_TEXT`, `TEXT_TOO_SHORT`, `INVALID_JSON`, `BAD_REQUEST` |
| 404 | `NOT_FOUND` |
| 413 | `TEXT_TOO_LONG` (over 100,000 characters), `PAYLOAD_TOO_LARGE` |
| 429 | `RATE_LIMITED` (default 60 analyses per 15 minutes per IP) |
| 500 | `INTERNAL_ERROR` |

Limits and rules live in `readability.js` (`MIN_WORDS = 10`, `MAX_CHARACTERS = 100000`) and `server/.env.example`.

## Testing

```bash
npm test               # sync check + server tests + client tests
npm --prefix server test
npm --prefix client test
npm run build          # production build of the client
```

What is covered: the Flesch formula against hand-calculated values; level boundaries; empty, whitespace-only, punctuation-only and non-string input; one sentence; long sentences; abbreviations, initials, decimals, ellipses, quoted dialogue; multiple paragraphs; fewer than five sentences; duplicate sentences; highlight offsets matching the original text (including CRLF, padding and Unicode); the UI flow (validation, loading, results, stale notice, clear, error and retry); the real API client against the real Express app (success, validation errors, rate limiting, unreachable server); and that request logs and error messages never contain chapter text.

## How the analysis works

**Flesch Reading Ease** = `206.835 - 1.015 x (words / sentences) - 84.6 x (syllables / words)`. The displayed score is clamped to 0-100 (the raw value is also returned, since very simple or very dense text can fall outside that range).

| Score | Level |
| --- | --- |
| 90-100 | Very Easy |
| 80-89 | Easy |
| 70-79 | Fairly Easy |
| 60-69 | Standard |
| 50-59 | Fairly Difficult |
| 30-49 | Difficult |
| 0-29 | Very Difficult |

Reading time uses 200 words per minute. Paragraphs are separated by blank lines (if the text has no blank lines at all, each line counts as a paragraph).

**Hardest sentences.** Each sentence gets a 0-100 difficulty score:

| Factor | Points | Full marks at |
| --- | --- | --- |
| Sentence length | 40 | 40+ words |
| Complex words (3+ syllables) | 25 | 30% of words |
| Average syllables per word | 20 | 2.0 or more |
| Average word length | 15 | 7+ letters |

The three per-word factors are scaled down for sentences under 12 words, since one long word in a four-word sentence says little. The top five distinct sentences are shown in descending order; if a sentence repeats, it is listed once and every exact occurrence is highlighted. Labels: 70+ Very high, 50-69 High, 30-49 Moderate, below 30 Low.

This ranking is a transparent heuristic for finding places worth a second look. It is **not** a scientific or definitive measure, and a hard sentence is not necessarily a bad one.

### Limitations

- **Syllable counts are estimated** with rules for English plus a short exception list. Irregular words are sometimes off by one.
- **Flesch was designed for continuous prose.** Dialogue-heavy chapters, headings, lists, poetry and very short samples (under about 100 words) can skew the score.
- **Sentence splitting is heuristic.** It handles common abbreviations (Mr., Dr., p.m., U.S., e.g.), initials, decimals, ellipses and quoted dialogue, but not every edge case. Blank lines always end a sentence, so a heading becomes its own short sentence.
- **English only.** Other languages will give meaningless scores.
- **Complex words** are counted by syllables alone, so proper names and common suffixed words (e.g. "wonderful") can count as complex.

### Keeping the engine in sync

The engine is plain JavaScript shared by both apps. `client/src/lib/readability.js` is canonical; after editing it run `npm run sync` to refresh `server/src/analysis/readability.js`. A server test (and `npm test`) fails if the two copies differ. Both folders therefore deploy independently.

## Why there is no MongoDB

ChapterCheck needs no database: analysis is stateless and the chapter must not be stored. Adding Mongoose and an Atlas cluster would add cost, a failure point and a privacy surface for no benefit, so it is deliberately left out. If you later add something that needs persistence (for example saved reports, with explicit user consent), add Mongoose to `server/` then and keep chapter text out of it.

## Deployment

### Backend on Render

1. Push the repo to GitHub.
2. In Render choose **New > Blueprint** and select the repo (it reads `render.yaml`), or create a **Web Service** manually: root directory `server`, build command `npm install`, start command `npm start`, health check path `/api/health`.
3. Set `CLIENT_ORIGIN` to your Vercel URL (no trailing slash), for example `https://chaptercheck.vercel.app`. `NODE_ENV=production` is set by the blueprint.
4. Deploy, then open `https://<your-service>.onrender.com/api/health`.

Free Render services sleep when idle, so the first server-mode request can take up to a minute. The client waits up to 45 seconds before showing a message.

### Frontend on Vercel

1. In Vercel choose **Add New > Project** and import the repo.
2. Set **Root Directory** to `client`. The Vite preset detects `npm run build` and the `dist` output.
3. Optional environment variables: `VITE_ANALYSIS_MODE=server` and `VITE_API_URL=https://<your-service>.onrender.com` to use the API. Leave both unset to analyze entirely in the browser.
4. Deploy. If you change a `VITE_*` variable, redeploy (they are baked in at build time).

No secrets are used anywhere, and Vite exposes only `VITE_*` variables to the browser. Do not put credentials in them.

### After deploying

- [ ] `GET /api/health` returns `ok`
- [ ] With server mode on, analyzing the sample works from the Vercel URL (no CORS error in the console)
- [ ] `CLIENT_ORIGIN` matches the exact Vercel URL, and any custom domain you add (comma-separated)

## 3D UI and animation

Built with the free [`motion`](https://motion.dev) package (the library formerly called Framer Motion; import from `motion/react`). The effects are decorative and kept small:

- `Hero3D.jsx`: a CSS-3D page stack in the header that follows the pointer and floats gently.
- `Tilt.jsx`: subtle pointer-driven 3D tilt on the score card and sentence cards (mouse only, not touch).
- Count-up score, sliding score marker, growing difficulty bars, staggered sentence cards, bouncing loading dots.

`<MotionConfig reducedMotion="user">` plus `useReducedMotion()` turn off movement for people who prefer reduced motion, and the 3D layer is `aria-hidden`. The bundle is about 129 KB gzipped, largely from `motion`.

## Accessibility

Semantic landmarks and headings, a labelled textarea with live counts, `role="alert"` validation messages, score and difficulty meters with text values, results heading focused after analysis, keyboard-reachable highlight links and scroll region, visible focus rings, `prefers-reduced-motion` respected, and highlight badges that do not rely on color alone.
