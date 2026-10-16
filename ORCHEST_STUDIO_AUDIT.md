# Orchest Studio — Full Audit and Remediation Plan

**Audit date:** 2026-10-16  
**Repository:** `r7-yn/orchest-studio`  
**Reviewed revision:** `3d13325` (`main`)  
**Review scope:** architecture, product/design compliance, code quality, security, performance, documentation, release readiness, and testability.

## 1. Executive assessment

The repository is a polished **frontend prototype**, not the production architecture described by `ARCHITECTURE.md`, `PRD.md`, and `AGENTS.md`. It currently runs as a Vite + React + Express single-process application with mock data and browser-local state. The required documents describe a Next.js App Router application with authenticated admin routes, Supabase/PostgreSQL persistence, Drizzle, Cloudflare R2 storage, server-side AI integrations, ISR/SEO pages, and durable analytics. Those capabilities are not implemented yet.

The visual prototype is a useful foundation, but it is **not production-ready** for the stated product requirements. The highest risks are:

1. **Admin access is not protected.** The dashboard is a client-side view reachable by anyone.
2. **All business data is ephemeral.** Tracks, categories, orders, KPIs, and WhatsApp settings are held in React state; most changes disappear on refresh.
3. **The advertised audio flow is not implemented.** `audioUrl` is ignored; playback synthesizes tones through Web Audio instead of playing uploaded/catalog audio.
4. **AI endpoints are publicly callable, unbounded, and trust client-supplied catalog data.** This creates abuse, cost, prompt-injection, and data-integrity risks.
5. **The test contract is broken.** `npm run test` is documented but no `test` script exists.
6. **The design system is not enforced.** Raw colors are hardcoded throughout JSX/CSS, and many values diverge from the documented tokens.
7. **The architecture documents are stale relative to the implementation.** The files must either be updated to describe a deliberate prototype phase or the application must be migrated toward the documented target.

**Release verdict:** `BLOCKED` for production release. A static prototype/demo release is possible only if it is explicitly labeled as such and all admin/AI claims are removed or gated.

---

## 2. Required documents reviewed first

### `ARCHITECTURE.md`

Defines Next.js App Router, API route handlers/server actions, Supabase PostgreSQL + Drizzle, Cloudflare R2, server-only Gemini, authenticated admin operations, persistent root audio context, and durable analytics. The current repository instead contains Vite, React, Express, mock data, localStorage, and no database/storage/auth layer.

### `DESIGN_SYSTEM.md`

Defines semantic color tokens, Arabic-first typography, 4px spacing scale, component dimensions, touch targets, reduced-motion behavior, and no raw hex values. The current implementation uses extensive raw hex/Tailwind color literals and inline body colors.

### `PRD.md`

Defines the MVP as a real catalog with persistent listening, WhatsApp conversion logging, semantic search, admin media management, settings/backup, analytics, and guest listener access. The current implementation visually simulates most of these features but does not provide durable server-side behavior.

### `AGENTS.md`

Requires strict TypeScript/no `any`, Zod validation for external input, authentication for admin routes, rate limiting for public AI/analytics endpoints, server-side backups, design-token adherence, tests for critical paths, and successful lint/build/test verification. Several of these requirements are currently violated.

---

## 3. Validation evidence

| Check | Result | Evidence |
|---|---|---|
| Initial `npm install` | Failed | Vite 8 requires `esbuild ^0.27 || ^0.28`; package declares `^0.25.0`. |
| Install with `--legacy-peer-deps` | Passed | 182 packages installed, but this bypasses the dependency contract and should not be the final fix. |
| TypeScript check (`npm run lint`) | Passed | `tsc --noEmit` completed successfully. The script is misnamed: it is not ESLint. |
| Production build | Passed with warning | Vite build succeeded; config warns that `__dirname` is incompatible with future native config loading. |
| Bundle | Warning | `dist/assets/index-DnqMUr1m.js`: 395.78 KB raw / 108.31 KB gzip. CSS: 73.07 KB raw / 11.04 KB gzip. |
| Test command | Failed | `npm error Missing script: "test"`. |
| Dependency audit | No production vulnerabilities reported | `npm audit --omit=dev` returned zero known vulnerabilities at audit time. |
| Runtime HTTP smoke test | Passed | Homepage returned HTTP 200; invalid SEO payload returned HTTP 400. |

Performance results are **static/build evidence**, not Core Web Vitals. A browser trace could not be recorded because the connected browser route was unavailable. Production LCP/INP/CLS remain unmeasured.

---

## 4. Critical issues — fix before production

### C1. Public admin dashboard and unauthenticated mutations

**Evidence**

- `src/App.tsx:642-658` renders `AdminDashboard` solely from `currentView === 'admin'`.
- `src/components/Header.tsx` exposes a normal navigation item for the dashboard.
- There is no auth provider, session check, protected route, server authorization, or admin API.
- WhatsApp settings, categories, tracks, and trend flags are mutable from the client.

**Impact**

Any visitor can open the dashboard and change the WhatsApp destination or catalog state in their own browser. In a future server implementation, copying this pattern would expose destructive admin actions.

**Fix**

- Create a real `/admin` route protected by server-side session verification.
- Use Supabase Auth or the explicitly selected admin session strategy.
- Check authorization at every admin page and mutation endpoint; never trust a client `isAdmin` flag.
- Remove admin navigation from public guest flows unless a valid session exists.
- Add tests for unauthenticated `401`, authenticated non-admin `403`, and authorized admin success.

### C2. No durable persistence or server-side backups

**Evidence**

- `src/App.tsx` owns all tracks, categories, orders, KPIs, and WhatsApp settings in React state.
- `localStorage` is used only for theme, categories, artists, WhatsApp number, favorites, and last-backup display metadata.
- `AdminDashboard.tsx:94-141` exports the current browser state as a download; it does not back up a database.
- No database, migrations, storage integration, or server backup route exists.

**Impact**

A refresh, second device, browser cleanup, or another visitor loses or fails to see changes. The PRD's analytics, order log, settings, and backup claims are false in the current build.

**Fix**

Implement the target persistence boundary:

- PostgreSQL/Supabase schema for `tracks`, `categories`, `artists`, `order_logs`, `analytics_events`, and `site_settings`.
- Drizzle migrations and typed service functions under `src/lib/services/`.
- Server-side backup endpoint requiring admin authorization.
- Stream/upload media through R2 or the selected storage provider; do not store image/audio data URLs in React state.
- Add retention, pagination, indexes, and an explicit restore procedure.

### C3. Audio implementation does not play catalog audio

**Evidence**

- `Track.audioUrl` exists in `src/types/index.ts:17`, but `App.tsx` passes only `track.id`, `duration`, and `audioFreq` to `audioEngine.play()`.
- `audioEngine.ts` creates oscillators and a synthetic drum interval instead of loading an audio URL.
- There is no media element, `AudioBuffer`, streaming, CORS strategy, loading state, decode error state, or real waveform source.

**Impact**

The core product promise—previewing actual zaffat/sheilat recordings—is not fulfilled. The current audio is a demo synthesizer and could mislead users.

**Fix**

- Define a real playback adapter accepting a validated `audioUrl`.
- Use one persistent `<audio>` element or a single Web Audio media source in the root provider.
- Keep player state in a provider/context as documented; preserve playback across client navigation.
- Expose `loading`, `error`, `buffered`, and `duration` states.
- Use the actual audio source for waveform rendering or explicitly label synthetic demo mode.
- Add tests for play, pause, seek, source failure, track replacement, ended state, and route transitions.

### C4. Public, unbounded AI endpoints

**Evidence**

- `server.ts:146-231`, `234-311`, and `314-391` expose AI endpoints without authentication or rate limiting.
- Request bodies accept arbitrary `tracks` arrays from the client and include them in prompts.
- `express.json({ limit: '10mb' })` permits large requests.
- No schema validation exists for request bodies.
- Errors are logged with broad server-side objects and the AI fallback has no request budget.

**Impact**

Attackers can spend Gemini quota, submit huge payloads, influence model context with arbitrary catalog text, and cause CPU/memory pressure. Admin SEO generation is especially inappropriate as a public endpoint.

**Fix**

- Move catalog retrieval server-side; accept only a bounded query/message and optional safe identifiers.
- Validate with Zod: maximum lengths, allowed fields, array sizes, and normalized text.
- Add IP/session rate limiting and request timeouts.
- Require admin authorization for SEO generation.
- Add cost controls, model fallback policy, structured output validation, and observability without logging sensitive text.
- Return stable sanitized error envelopes and appropriate HTTP statuses.
- Do not expose the full catalog in every request; retrieve only fields needed for matching.

### C5. WhatsApp redirect can be blocked and lead logging is not reliable

**Evidence**

- `OrderModal.tsx:78-83` waits 900 ms and then calls `window.open()`.
- The delayed call is no longer guaranteed to be within the original user gesture and can be blocked by popup protection.
- The order is recorded only in React state before navigation; there is no durable API call or retry/outbox.

**Impact**

The main conversion action can fail silently, and a lead can disappear on refresh or if the tab closes before state is retained.

**Fix**

- Build the WhatsApp URL synchronously on submit.
- Open a blank window synchronously from the click/submit gesture, then assign the validated URL after the local/server log attempt; or use a direct anchor with `target="_blank"` where appropriate.
- POST a validated order intent to the server with an idempotency key before/alongside navigation.
- Show explicit fallback: “تعذر فتح واتساب؟ افتح الرابط يدوياً”.
- Do not claim “حفظ الطلب” until the server confirms it.

### C6. Input validation and type-safety requirements are violated

**Evidence**

- `server.ts` uses `any` repeatedly for request data and caught errors.
- `trackLogic.ts:191-197` uses `any` for backup data.
- `AiConciergeModal.tsx:111` uses an `any` type guard.
- Forms accept arbitrary text without length limits, date constraints, phone validation, or schema parsing.
- The documented requirement explicitly says “No `any`” and “Validate every external input with Zod”.

**Fix**

- Add domain types for API inputs/outputs and generated SEO responses.
- Use `unknown` in catch blocks and parse external data before use.
- Add Zod schemas shared between request handlers and form adapters.
- Normalize Arabic/Unicode whitespace, trim and cap strings, validate ISO dates and international phone numbers.
- Add tests for malformed, oversized, empty, and adversarial inputs.

---

## 5. Major issues — should fix in the next implementation phase

### M1. Architecture documentation and repository structure disagree

`ARCHITECTURE.md` describes `src/app`, `src/lib`, `src/context`, database migrations, and integrations that do not exist. `AGENTS.md` refers to `docs/PRD.md`, but the files are at repository root. This causes agents and maintainers to make incorrect changes.

**Decision required:** choose one of two honest paths:

- **Prototype path:** rewrite architecture/PRD/agent instructions to describe the Vite prototype and clearly mark unimplemented production capabilities; or
- **Production path:** migrate incrementally to the documented Next.js architecture.

Given the PRD, the production path is the correct long-term choice; do not disguise a migration as a small refactor.

### M2. `package.json` is not release-grade

- Package name is `react-example`, version is `0.0.0`.
- `npm install` fails without `--legacy-peer-deps` because Vite and esbuild ranges conflict.
- `lint` runs TypeScript only; there is no ESLint or Prettier script despite `AGENTS.md` requiring them.
- `test` and `test:e2e` scripts are missing.
- Runtime dependencies include `express`, `dotenv`, and `@google/genai`, but the target architecture says Next.js route handlers.
- `__dirname` in `vite.config.ts` triggers a future compatibility warning.

**Fix**

Align versions, add a committed lockfile, rename the package, add scripts for `typecheck`, `lint`, `format:check`, `test`, `test:e2e`, and `build`, and decide whether Express is temporary or part of the final architecture.

### M3. The create-track form creates incorrect metadata

`AdminDashboard.tsx:194-218` hardcodes `durationSec = 270` regardless of the `newDuration` input. This causes playback and displayed duration to disagree. It also sets `playsCount` and `likesCount` to `1` for a new track without an explicit product reason.

**Fix**

Parse `MM:SS` safely into seconds, reject invalid duration input, and initialize analytics counters to zero unless the domain model requires imported counts.

### M4. Images are stored as data URLs and not uploaded

`ImageUploader.tsx:44-55` reads files into base64 data URLs. This increases memory and bundle/state size, is not durable, and can make backup JSON enormous. MIME validation based only on `file.type` is not a security boundary.

**Fix**

Upload through a server-authorized presigned R2/S3 flow, validate size and content server-side, create responsive derivatives, store only stable URLs, and revoke object URLs when used for previews.

### M5. Semantic search and concierge send too much data on every request

The full catalog is posted from the browser on every AI query. This increases payload, latency, privacy exposure, and cost. Search also creates a new request after debounce without aborting the previous fetch, so stale responses can overwrite newer results.

**Fix**

Use `AbortController`, request sequence protection, bounded server-side catalog retrieval, and deterministic local search before AI fallback. Cache normalized catalog metadata where appropriate.

### M6. Error and loading states are incomplete

The code frequently uses `alert()` for form failures and silently falls back to generic AI recommendations. Data-driven views are not consistently modeled with loading, empty, and error states as required by `AGENTS.md`.

**Fix**

Introduce a reusable toast/notice pattern, inline field errors, retry actions, skeletons, empty-state CTAs, and explicit “AI unavailable; showing standard results” messaging.

### M7. Direct design-system violations are widespread

Examples include:

- Raw hex literals in most components and `index.html`.
- Inline `document.body.style` colors in `App.tsx:129-134`.
- Unlisted gradients, shadows, radii, and spacing values.
- `rounded-3xl`, arbitrary widths, and arbitrary shadow values that do not map to documented tokens.
- Body uses Alexandria globally although the system specifies Alexandria for headings and Cairo for body/UI.
- Several components hardcode white/black borders and text instead of semantic tokens.

**Fix**

Create a single token layer in CSS, map Tailwind utilities to semantic variables, and replace literals systematically. This should be one focused design-system migration, not piecemeal styling changes.

### M8. Accessibility and interaction gaps

Likely issues requiring an accessibility pass:

- Modal dialogs do not show focus trapping, `role="dialog"`, `aria-modal`, or Escape-key handling.
- Search results are clickable `<div>` elements instead of keyboard-accessible buttons/links.
- The upload dropzone is a clickable `<div>` rather than a semantic button/label.
- Several buttons lack visible focus styles.
- Global `select-none` on the body harms text selection and usability.
- Images from external URLs do not consistently define dimensions or loading strategy.

**Fix**

Run axe/keyboard testing, add focus management, semantic controls, focus-visible styles, Escape handling, proper dialog labels, and reduced-motion handling.

### M9. Audio timer is not clock-accurate

`audioEngine.ts:144-154` advances playback by a fixed `0.5` seconds per interval. Timer drift, throttled background tabs, suspend/resume, and seeking can desynchronize the displayed position from actual playback.

**Fix**

Derive current time from `HTMLAudioElement.currentTime` or `AudioContext.currentTime` using `requestAnimationFrame` while visible, with visibility-aware updates.

### M10. Missing SEO/product infrastructure

The current SPA has one static HTML title/description. The PRD and architecture promise indexable track/category pages, schema markup, and ISR/SSR.

**Fix**

On the production path, use route-level metadata, canonical URLs, Open Graph image generation, JSON-LD with escaped values, sitemap, robots policy, and server-rendered track/category pages.

---

## 6. Performance findings

### Measured/build evidence

- JavaScript: **395.78 KB raw / 108.31 KB gzip**.
- CSS: **73.07 KB raw / 11.04 KB gzip**.
- Homepage HTML response: **1,840 bytes**, HTTP 200, `Cache-Control: no-cache` in development.
- No production Core Web Vitals are available.

### Source-code hypotheses to verify with a browser trace

1. Every homepage section and modal is included in the initial client bundle because the application is one large `App.tsx` tree; route/component code splitting is absent.
2. Google Fonts are render-critical external requests and use two families with many weights.
3. Images are mostly remote Unsplash URLs without `loading="lazy"`, `width`, `height`, `srcset`, or modern format guarantees.
4. AI requests send the entire track catalog and can add significant request latency.
5. Heavy blur, gradients, animated waveform/synth state, and multiple fixed surfaces may increase mobile paint cost.
6. `window.scrollTo({ behavior: 'smooth' })` and global smooth scrolling may conflict with reduced-motion preferences.

### Recommended performance budget

Adopt and enforce an initial mobile budget:

- JavaScript: <300 KB compressed per critical route.
- CSS: <100 KB compressed.
- Above-fold images: <500 KB total.
- Fonts: <100 KB critical transfer.
- Third-party transfer: <200 KB.
- LCP, INP, CLS: measure on real mobile conditions; do not treat local bundle size as a Core Web Vital.

### Verification procedure after fixes

1. Run three cold-cache mobile navigations at a fixed viewport/network/CPU profile.
2. Record median and range for LCP, FCP, CLS, TBT, and total transfer.
3. Record the largest contentful element and render-blocking resources.
4. Repeat after each performance phase.
5. Add CI bundle-size checks and a performance smoke test.

---

## 7. Testing strategy

### Unit tests

Add tests for:

- `formatDuration`: NaN, decimals, large values, invalid formats.
- WhatsApp phone normalization: Yemen/Saudi formats, extension/punctuation, too-long input.
- URL generation: encoded Arabic, hostile characters, missing phone, leading plus.
- Order schema: required names, max lengths, date in the past, notes limits.
- CSV: quotes, commas, newlines, BOM, empty records, formula-injection prefixes.
- Backup serialization: stable schema, no secrets, version marker.
- Semantic fallback ranking and empty catalog behavior.
- Duration parsing and metadata consistency.

### Component/integration tests

- Order submit opens WhatsApp without popup blocking and records success/failure correctly.
- Modal keyboard navigation and Escape close.
- Theme persistence and system preference fallback.
- Player persists through navigation and handles source failures.
- AI loading, abort, timeout, invalid response, and fallback states.

### End-to-end tests

- Guest: browse → play actual audio → navigate → audio continues.
- Guest: search/filter → open track → order modal → validated WhatsApp URL.
- Guest: no access to admin mutation actions.
- Admin: login → create/edit/delete track → upload media → persist after refresh.
- Admin: export server backup and CSV only with authorization.

---

## 8. Recommended implementation order

### Phase 0 — Clarify the product stage

Choose prototype or production path. Update the four required documents so they match reality. Do not build more features on contradictory contracts.

### Phase 1 — Safety and correctness foundation

Limit this first patch to no more than five files:

1. `package.json` — fix dependency ranges/scripts/name.
2. `src/utils/trackLogic.ts` — remove `any`, add schemas/helpers, fix CSV and URL validation.
3. `src/utils/trackLogic.test.ts` — add missing regression tests.
4. `src/components/OrderModal.tsx` — validate fields and make redirect synchronous/reliable.
5. `server.ts` — bounded validation, error types, rate-limit seam, and remove unsafe `any`.

This phase can make the prototype safer without pretending it is a production backend.

### Phase 2 — Authentication and persistence

Introduce the chosen database/auth/storage layer and migrate the admin surface. This is a substantial architectural change and should be reviewed as a separate branch/PR.

### Phase 3 — Real media playback

Replace the synthesizer demo with persistent real audio playback and waveform state. Preserve the root-level playback boundary.

### Phase 4 — SEO and route architecture

Migrate public catalog/detail/category pages to server-rendered routes and implement metadata/schema/sitemap.

### Phase 5 — Design-system and accessibility migration

Replace raw tokens, normalize typography/spacing/radii, add accessible dialogs and keyboard navigation, and verify RTL behavior.

### Phase 6 — Performance and observability

Split routes/features, optimize image/font delivery, measure traces, add Web Vitals/RUM, and enforce budgets in CI.

---

## 9. Release review outcome

The `final-release-review` skill is designed for release comparison of the `openai-agents-python` project and does not directly fit this TypeScript/Vite repository. For this repository, the equivalent release gate is still clear:

- No release tags or release candidate metadata exists.
- The current commit is documentation-only on top of a prototype history.
- Build succeeds only after bypassing a dependency peer conflict.
- The documented production contract is materially unimplemented.
- Critical security, persistence, audio, and test gaps remain.

**Decision: BLOCKED for production.**

A future green release requires, at minimum:

1. authenticated admin boundaries;
2. durable database-backed catalog/order/settings/analytics;
3. real audio URL playback;
4. validated and rate-limited AI endpoints;
5. reliable WhatsApp lead logging and redirect;
6. committed dependency/test/lint contracts;
7. updated architecture documents matching the shipped system;
8. evidence from unit, integration, E2E, accessibility, and performance verification.

---

## 10. Positive findings

- The UI has a clear Arabic-first product direction and a coherent luxury visual concept.
- The root-level audio engine singleton is aligned with the intended “persistent player” idea, even though the current source is synthetic.
- The WhatsApp message builder and CSV export are isolated into utilities, which is a good testable boundary.
- The build output is currently small enough to optimize without an emergency rewrite.
- The fallback semantic matching logic provides useful degraded behavior when AI is unavailable.
- The repository includes useful product, architecture, design, and agent documents; they now need to be kept synchronized with implementation.

## 11. Next action

Per `AGENTS.md`, applying the first safety/correctness patch would touch more than five concerns/files across the full solution. The recommended next step is to approve **Phase 1 only** as a focused patch, then review the resulting diff before starting the authentication/persistence migration.
