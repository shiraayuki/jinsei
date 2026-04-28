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

Backend has no test project yet; there are no `dotnet test` targets.

## Architecture

Three components, two compose files:

- `backend/` — ASP.NET Core Web API targeting **net10.0**. `Program.cs` uses the minimal hosting model with `AddControllers()` / `MapControllers()`; controllers are not yet present. DB connection is read from `ConnectionStrings:Default` (configured in `docker/docker-compose.yml` for prod; not yet wired in dev `appsettings.*.json`).
- `frontend/` — React 19 + TypeScript + Vite. Default scaffold under `src/` (`App.tsx`, `main.tsx`).
- `docker/` — two compose files:
  - `docker-compose.dev.yml`: Postgres only, port-mapped `5431:5432`, hardcoded creds (`jinsei/jinsei/jinsei`).
  - `docker-compose.yml`: full prod stack — Postgres + backend + frontend; reads creds from a root `.env` file (`POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`, see `.env.example`).

### Production request path (important)

In prod, the frontend container is an nginx serving the built SPA on ports 80/443. `frontend/nginx.conf` reverse-proxies `/api/` to `http://backend:8080/` — note the **trailing slash on the upstream**, which strips the `/api` prefix before forwarding. So a frontend call to `/api/foo` reaches the backend as `/foo`. Keep backend route definitions un-prefixed; the prefix lives in nginx.

The backend container exposes 8080 internally only (no host port mapping), so it is reachable from the frontend container by service name `backend` but not from the host.

### Dev vs. prod divergence to watch for

- **Dev Postgres port is 5431**, prod is the in-network default 5432 (service name `postgres`).
- Dev creds are hardcoded in `docker-compose.dev.yml`; prod creds come from `.env`.
- Dev backend connection string is **not** configured in `appsettings.Development.json` — anything DB-related needs to be added.
- The `/api` rewrite only exists in prod nginx. In dev, the frontend talks to the backend directly; if you add backend calls, configure a Vite dev proxy or use absolute URLs to `http://localhost:5132`.
