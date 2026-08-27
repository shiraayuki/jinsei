# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

`./dev.sh` (from repo root) is the canonical dev workflow. It:
1. Brings up Postgres via `docker/docker-compose.dev.yml` (exposed on host port **5431**, not 5432).
2. Runs the backend with `dotnet watch run` from `backend/`.
3. Runs the frontend with `npm run dev` from `frontend/`.
4. Traps Ctrl+C and tears all three down together.

Running components individually:

- Backend: `cd backend && dotnet watch run` — listens on `http://localhost:5132` (HTTPS profile also binds `7016`, see `backend/Properties/launchSettings.json`).
- Frontend: `cd frontend && npm run dev` — Vite default `http://localhost:5173`.
- Postgres only: `docker compose -f docker/docker-compose.dev.yml up -d`.

Frontend tooling (run from `frontend/`):
- `npm run build` — runs `tsc -b` then `vite build`.
- `npm run lint` — flat-config ESLint over `**/*.{ts,tsx}`.
- `npm run preview` — preview the production build.

Backend tests live in `backend.Tests/` (xunit + WebApplicationFactory against the in-memory provider). Run them with `dotnet test` from the repo root.

## Architecture

Three components, two compose files:

- `backend/` — ASP.NET Core Web API targeting **net10.0**, minimal hosting with `AddControllers()` / `MapControllers()`. DB connection comes from `ConnectionStrings:Default` (compose in prod, `appsettings.Development.json` in dev, pointing at port 5431).
- `frontend/` — React 19 + TypeScript + Vite + Tailwind, feature folders under `src/features` and route components under `src/pages`.
- `docker/` — two compose files:
  - `docker-compose.dev.yml`: Postgres only, port-mapped `5431:5432`, hardcoded creds (`jinsei/jinsei/jinsei`).
  - `docker-compose.yml`: full prod stack — Postgres + backend + frontend; reads creds from a root `.env` file (`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`, see `.env.example`).

### Production request path (important)

In prod, the frontend container is an nginx serving the built SPA on port 80, published on the host as `127.0.0.1:8092` only. `frontend/nginx.conf` reverse-proxies `/api/` to `http://backend:8080` — **no trailing slash**, so the `/api` prefix is preserved. Controller routes therefore include it (`[Route("api/weight")]`).

TLS and exposure are handled outside the stack by `tailscale serve` on the host (`--https 9443 http://127.0.0.1:8092`); the app is reachable only from the tailnet. There is no Caddy, no public domain, no ACME.

The backend container exposes 8080 internally only (no host port mapping), so it is reachable from the frontend container by service name `backend` but not from the host.

### Dev vs. prod divergence to watch for

- **Dev Postgres port is 5431**, prod is the in-network default 5432 (service name `postgres`).
- Dev creds are hardcoded in `docker-compose.dev.yml`; prod creds come from `.env`.
- Dev backend connection string is **not** configured in `appsettings.Development.json` — anything DB-related needs to be added.
- The `/api` rewrite only exists in prod nginx. In dev, the frontend talks to the backend directly; if you add backend calls, configure a Vite dev proxy or use absolute URLs to `http://localhost:5132`.

## Domain notes

- **Workouts are read-only.** They are pulled from Hevy by `POST /api/workouts/sync` and identified by `(user_id, source, external_id)`, so a repeat sync updates rather than duplicates. The pull has a floor and a slot: `Hevy:SyncFrom` (2026-08-17) is the oldest day ever fetched — Hevy pages newest first, so the walk stops at the first session below the floor instead of reading pages it would throw away — and `HevySyncScheduler` pulls once on startup and then daily at `Hevy:SyncAtLocal` (19:30, in `Hevy:TimeZone`, recomputed against the wall clock so a container that was down over the slot does not drift). The floor governs loading, not deleting: sessions already in the log from before it stay. There is no exercise library, no routines and no live session tracking — those were removed deliberately; do not reintroduce a manual create path without being asked.
- **Sleep** is stored as durations — `time_in_bed_minutes`, `actual_sleep_minutes`, `quality` as the 0–100 percentage Sleep Cycle reports — plus the optional clock times `bed_time` and `wake_time` as `TimeOnly`, which is what the regularity metric needs. Sending both times without a duration fills the duration in (wrapping over midnight); a duration that was sent explicitly always wins. Efficiency is derived, never stored. Clock arithmetic on the client runs on a noon-anchored axis (`clockToNightAxis` in `lib/stats.ts`) so 23:50 and 00:10 are twenty minutes apart, and regularity is the spread of the sleep midpoint.
- **Nutrition** is one row per day (calories, protein, carbs, fat, water, coffee, time of the last coffee), entered by hand or posted by the ingest endpoint. There is no food database and no external nutrition source. Fibre was tracked and then dropped — the column `fiber_g` still exists on the table and on `NutritionEntry`, but nothing reads or writes it; do not put it back into a form without being asked.
- Sleep and nutrition are unique per `(user_id, date)` and written through upserts keyed on the date.
- **Charts and metrics.** There is one chart component (`frontend/src/components/charts/Chart.tsx`) covering lines, bars, the goal line and the trailing-average overlay; `Sparkline`, `StatTile`, `BarRow` and `MacroSplit` sit next to it. All the arithmetic — moving averages, regression slope, correlation, sleep debt, adherence, weekly buckets — lives in `frontend/src/lib/stats.ts` and is unit tested; components do not calculate. Series colours are the module colours from `lib/modules.ts`, never the accent. `MetricsPage` is a tab per area (`pages/metrics/sections/*`), the range switch is `RangeTabs` + `useRange` and is stored per key in localStorage.
- **Training analytics** come from `GET /api/workouts/analytics?days=` (`WorkoutAnalyticsService`), which parses `WorkoutLog.PayloadJson`: weekly load, sets per muscle group against the previous four weeks, and per-exercise progression with an Epley 1RM estimate (sets over 12 reps are ignored) plus a stagnation flag — a best older than four weeks on a lift still being trained. Muscle groups come from Hevy's exercise-template catalogue, cached for a day; sessions synced before that fall back to a coarse name match.
- **Habits across all habits** come from `GET /api/habits/overview?days=`: due vs. done per day and completion per weekday, which the per-habit streaks cannot answer.
- **Energy needs** are measured, never modelled (`frontend/src/lib/energy.ts`): mean intake against the weight-trend slope, which carries every cost a formula would have to guess at. It stays blank until 14 logged calorie days and 8 weigh-ins exist, and the card counts down to that instead of showing a bare dash. A Mifflin-St Jeor path with an activity factor was built and then removed — two numbers for one question left the reader deciding which to believe. `AppUser.birth_date`, `height_cm`, `sex` and `activity_level` survive from it, unused; do not wire them back into an estimate without being asked.
- **The week's calorie target** is derived, not typed: `weekly_rate_percent` on `AppUser` (0.35 gentle / 0.6 standard / 0.9 fast, chosen under Profile → Pace) times the **anchor weight** — the 7-day trend weight frozen at the current week's Monday (`anchorWeight` in `lib/energy.ts`). A raw weigh-in would swing the target by ~60 kcal overnight; the anchor holds still for seven days and steps down on its own. The target is shown under Metrics → Body with a button that writes it into `kcal_goal`; nothing is written automatically.
- **Ingest token**: the ingest endpoints take an `X-Ingest-Token` (or `Bearer`) header, check it *before* reading the body, and are split per source so one broken sync cannot take the others down. `POST /api/ingest/activity` takes `{entries:[{date,steps}]}` and upserts step counts only — it never touches the hand-entered cardio answer. It shares the day's `ActivityEntries` row with the evening Hevy sync, which fills the cardio answer at the same hour: both read the day, and both retry the whole read once when the unique index on (user, date) rejects an insert that lost the race, so the loser updates instead of failing. `POST /api/ingest/nutrition` takes `{entries:[{date,kcal,proteinG,carbsG,fatG,waterL}]}` and writes only the fields that are present: a null means "no reading", not zero, so water, coffee, the last-coffee time and the notes survive a sync that only carries calories. An implausible reading is dropped field by field rather than failing the request. The token is issued at `POST /api/auth/ingest-token`, stored as a SHA-256 hash (`IngestTokens`), shown once, and replaceable but not recoverable. It exists so an iOS Shortcut can post Apple Health steps nightly.
- **Goals** live on `AppUser` (kcal, protein, water, steps, sleep minutes, target weight, weekly sessions and sets) and are edited under Profile. A goal that is set appears as the dashed line in the matching chart; an empty goal draws nothing.
- **Dashboard widgets** are chosen and ordered in the browser (`lib/dashboardWidgets.ts`, localStorage) — deliberately not synced through the API.
- **Screenshot import** (`POST /api/import/screenshot`) reads a Sleep Cycle screenshot with the Gemini API (`GeminiClient`, free-tier Flash model) and returns a *draft* — it never writes. The client fills the normal form with it and the night still goes through the sleep upsert on confirm. The endpoint still understands `kind: "nutrition"` and FatSecret, but the nutrition form no longer offers it — four numbers are typed faster than they are photographed. Needs `Gemini:ApiKey`; without it `GET /api/import/status` reports `configured: false` and the frontend hides the button.
