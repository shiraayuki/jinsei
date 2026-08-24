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

- **Workouts are read-only.** They are pulled from Hevy by `POST /api/workouts/sync` and identified by `(user_id, source, external_id)`, so a repeat sync updates rather than duplicates. There is no exercise library, no routines and no live session tracking — those were removed deliberately; do not reintroduce a manual create path without being asked.
- **Sleep** is stored as durations, not clock times: `time_in_bed_minutes`, `actual_sleep_minutes`, and `quality` as the 0–100 percentage Sleep Cycle reports. Efficiency is derived, never stored.
- **Nutrition** is one hand-entered row per day (calories, macros, water, coffee, time of the last coffee). There is no food database and no external nutrition source.
- Sleep and nutrition are unique per `(user_id, date)` and written through upserts keyed on the date.
- **Screenshot import** (`POST /api/import/screenshot`) reads a Sleep Cycle or FatSecret screenshot with the Claude API and returns a *draft* — it never writes. The client fills the normal form with it and the day still goes through the sleep/nutrition upserts on confirm. Needs `Anthropic:ApiKey`; without it `GET /api/import/status` reports `configured: false` and the frontend hides the button.
