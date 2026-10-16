# AGENTS.md

Instructions for any AI coding agent working in this project
(Claude Code, Cursor, Codex, Copilot). Read this whole file before doing anything.

## 01 Purpose

استوديو أوركست (Orchest Studio) is the luxury web platform for GCC zaffat, sheilat, and customized audio production requests, featuring persistent audio playback, high-conversion WhatsApp funneling, SEO-optimized metadata, and admin media analytics.
Your job is to extend it without breaking what exists, in the style already
established. When in doubt, match what is there.

## 02 Before you start

Do these in order, every session:

1. Read docs/PRD.md for what we are building and what is out of scope (no card payments, no user auth for listeners).
2. Read docs/DESIGN_SYSTEM.md for every visual decision. Use its design tokens (`--color-bg`, `--color-primary`, `--color-whatsapp`, etc.).
3. Read docs/ARCHITECTURE.md for where code lives, system layers, and intentional architectural boundaries.
4. Check existing UI components in `src/components/ui/` and `src/components/player/` before creating new ones.
5. Look at the open issues or task list before proposing new work.
6. Restate the task in one or two sentences and list the files you expect
   to touch. Wait for a go-ahead if that list is longer than five files.

## 03 General rules

- Follow the design system. If a color, spacing, or radius value is not in `DESIGN_SYSTEM.md`, ask. Do not invent raw hex codes or inline styles.
- Keep responsibilities where `ARCHITECTURE.md` puts them:
  - Audio playback state must stay in root `AudioContext` and never reset during Next.js route transitions.
  - No business or database logic in page components (`src/app/`).
  - WhatsApp outbound links must use the direct client `wa.me` generator (`src/lib/utils/whatsapp.ts`) fetching the active number from settings.
- Reuse before creating. Search `src/lib/utils/` and `src/components/` for an existing helper or component first.
- Small, focused changes. One task, one branch, one clear diff.
- Do not add dependencies, database tables, environment variables, or third-party services without asking.
- Do not delete or rewrite working audio player or waveform code unless explicitly requested.
- Never "improve" anything listed under intentional decisions in `ARCHITECTURE.md` (e.g., guest checkouts, WhatsApp direct redirect).
- Leave the project runnable and verified after every change.

## 04 Code guidelines

- TypeScript strict: No `any`. No `@ts-ignore` without an explicit comment explaining the technical limitation.
- React components: Functional components with hooks and named exports (`export function ComponentName`).
- Validate every external input (forms, route handlers, WhatsApp lead modals) with Zod schemas before it reaches domain services.
- Name things by what they do: `generateWhatsAppOrderUrl`, `fetchSimilarTracksByCategory`, not `handleAction2`.
- Comments explain why, not what. Never leave commented-out dead code.
- Every data-driven view handles loading skeleton, empty state (with CTA), and error fallback.
- UI copy follows the tone rules in `DESIGN_SYSTEM.md`: luxurious GCC phrasing, clear, concise, no exclamation marks.
- Test critical paths: WhatsApp order URL formatting, SEO metadata generation, and CSV/JSON backup export integrity.
- Formatting is the formatter's job. Run Prettier/ESLint. Do not argue with it.

## 05 Security and best practices

- Secrets (`GEMINI_API_KEY`, `R2_SECRET_KEY`, `DATABASE_URL`) live strictly in server environment variables and are read on the server only. Never prefix backend secrets with `NEXT_PUBLIC_`.
- Authorization is checked on every `/api/admin/*` and `/admin/*` route entry point.
- Escape and sanitize all track descriptions, vocalist names, and custom input strings before rendering or injecting into schema markup (`JSON-LD`).
- Rate-limit public API endpoints (`/api/analytics/event`, `/api/ai/*`) to prevent spam and cost overruns.
- Never trust client-supplied track prices or admin authorization flags.
- Backups exported via `/api/admin/backup` must require active admin session verification.

## 06 Useful commands

```bash
npm install          # install dependencies
npm run dev          # start the local Next.js development server
npm run build        # production build (must pass cleanly before any PR)
npm run lint         # lint and TypeScript type checking
npm run test         # run Vitest unit tests (services and utilities)
npm run test:e2e     # run Playwright end-to-end tests (audio player and WhatsApp modal)
