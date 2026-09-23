# Bilingual Vocab Flashcards

English/Spanish vocabulary flashcards with a multiple-choice quiz and progress tracking.
React + Vite frontend, Node.js + Express API.

**Live demo:** https://josephelvis843-collab.github.io/bilingual-flashcards/

## Architecture

- **Frontend:** React + Vite, hosted on GitHub Pages (`.github/workflows/deploy.yml`)
- **API:** Node.js + Express, hosted on Render's free tier (`render.yaml`) —
  https://bilingual-flashcards-api.onrender.com/api/health
- **Database:** Postgres on Neon, one row per (anonymous user, known word)

Each browser gets a random anonymous ID (no login), sent as an `X-User-Id`
header, so every visitor has their own progress. The free Render server sleeps
when idle; the app shows cards immediately and syncs progress once it wakes.

## Running locally

```
npm install
npm run dev
```

This starts both servers:
- Frontend (Vite): http://localhost:5173
- API (Express): http://localhost:3001 — Vite proxies `/api/*` to it in dev

## API

| Method | Route           | Description                                        |
|--------|-----------------|----------------------------------------------------|
| GET    | `/api/health`   | Health check                                       |
| GET    | `/api/words`    | The word list                                      |
| GET    | `/api/progress` | `{ known: [...] }` — word keys marked as known     |
| PUT    | `/api/progress` | Replace progress; body `{ known: [...] }`          |

`/api/progress` requires an `X-User-Id` header containing a UUID.

Storage: if `DATABASE_URL` is set (in `.env` locally, or in Render's dashboard)
progress goes to Postgres; otherwise to `server/data/progress.json`. Both are
git-ignored. To use the database locally, create `.env` with:

```
DATABASE_URL=postgresql://user:password@host/neondb?sslmode=verify-full
```

If the API can't be reached, the app falls back to the bundled word list and
`localStorage`.

## Scripts

- `npm run dev` — frontend + API with hot reload
- `npm run server` — API only, restarts on file changes
- `npm start` — API only, production
- `npm run build` — build the frontend to `dist/`
- `npm run lint` — run oxlint
