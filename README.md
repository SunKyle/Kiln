# Kiln

Kiln — a **local-first personal workspace**. Tasks, notes, an aggregation dashboard, and a tool launcher, all running in your browser with no accounts and no server-side data.

Built on the Kairo stack: Vue 3 + TypeScript + Vite + vue-router + Vitest + vue-tsc + ESLint.

## Modules

- 仪表盘 `/` — aggregates the other three plus (future) external feeds.
- 任务待办 `/tasks` — todo list, priority-sorted, localStorage.
- 笔记知识库 `/notes` — notes with long bodies, IndexedDB.
- 工具导航 `/tools` — editable launcher grid, localStorage.

## Local-first & backups

Data lives on the device: small collections in `localStorage`, note bodies in `IndexedDB`. The header **导出 / 导入** packs everything into one JSON file. Because local-first storage is bound to the origin, **export before moving to a new domain**, then import on the new one.

## Stack decisions vs Kairo

Kairo ships a self-built hash router (5 flat pages). Kiln keeps the Vue 3 + Vite + Vitest core but **adds `vue-router`** (nested IA across four modules earns it) and replaces full Express with a **single Vercel serverless function** (`api/index.js`) used only to proxy CORS-blocked public feeds. No Pinia — state is plain composables over storage.

## Commands

```bash
npm install
npm run dev        # http://localhost:5190
npm run build      # typecheck + production build (dist/)
npm run preview    # preview the build
npm run typecheck  # vue-tsc
npm run lint       # eslint
npm run test       # vitest
```

## Deploy (Vercel)

`vercel.json` builds `dist/`, SPA rewrites to `index.html` (excluding `/api`), and registers `api/index.js` as a function. Set `PROXY_ALLOWED_HOSTS` (comma-separated) to widen the feed allowlist.
