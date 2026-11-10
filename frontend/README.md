# FitTrack web app (Next.js)

Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + Recharts + Lucide icons.
All data comes from the Express API in `../backend` (default `http://localhost:5000/api`).

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000 (development)
npm run build    # production build
npm start        # serve the production build on http://localhost:3000
npm run lint     # oxlint
```

## How it is organised

| Path | What it is |
|---|---|
| `src/app/layout.jsx` | Root layout: page `<html>`, font, global CSS, page titles (`metadata`) |
| `src/app/providers.jsx` | Client-side providers: signed-in user (`AuthContext`) and toasts |
| `src/app/login/page.jsx`, `src/app/signup/page.jsx` | Public pages |
| `src/app/(app)/layout.jsx` | Layout for every signed-in page: sidebar + header (`AppShell`); signed-out visitors go to `/login` |
| `src/app/(app)/**/page.jsx` | One route per screen: `/`, `/plans`, `/history`, `/goals`, `/routine`, `/journal`, `/analytics`, `/reports`, `/gallery`, `/profile`, `/admin` |
| `src/app/not-found.jsx` | Unknown addresses go back to the overview |
| `src/views/` | The screen components each `page.jsx` renders (client components) |
| `src/components/`, `src/context/`, `src/hooks/`, `src/utils/` | Shared UI, state, data fetching and helpers |
| `src/api.js` | Axios client: base URL, attaches the JWT, sends you to sign in when it expires |

`(app)` is a Next.js *route group*: it shares a layout between pages without adding `/app` to the URL.

## Notes

* **API URL:** `NEXT_PUBLIC_API_URL` (see `.env.example`). `NEXT_PUBLIC_` values are visible in the browser, so no secrets go here;
  database credentials stay in the backend's `.env`.
* **Sign-in state:** the JWT is kept in the browser's localStorage. Next.js renders pages on the server first, where localStorage
  does not exist, so `AuthContext` reads it after the page loads and exposes `ready`; pages only redirect once `ready` is true.
* **Styling:** `src/app/globals.css` holds the Tailwind v4 import and the design tokens (`@theme`). Tailwind runs through
  `@tailwindcss/postcss` (`postcss.config.mjs`); v4 needs no `tailwind.config.js`.
* **Port:** 3000, so it does not clash with other Vite projects on 5173. The backend allows requests from any local port.
