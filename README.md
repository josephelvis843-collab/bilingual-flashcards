# Bilingual Vocab Flashcards

English/Spanish vocabulary flashcards with a multiple-choice quiz and progress tracking.
React + Vite frontend, Node.js + Express API.

**Live demo:** https://josephelvis843-collab.github.io/bilingual-flashcards/
(static site — runs in offline mode, saving progress in your browser)

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

Progress is stored in `server/data/progress.json` (git-ignored).

If the API can't be reached, the app falls back to the bundled word list and
`localStorage`, which is how the GitHub Pages build works.

## Scripts

- `npm run dev` — frontend + API with hot reload
- `npm run server` — API only, restarts on file changes
- `npm start` — API only, production
- `npm run build` — build the frontend to `dist/`
- `npm run lint` — run oxlint
