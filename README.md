![Jinsei](docs/banner.png)

Personal life-tracking app — workouts, nutrition, habits, sleep and weight in one place. Built as a mobile-first PWA.

## Features

- **Workouts** — training log pulled from Hevy with one sync button; no manual entry
- **Habits** — daily habit tracking with streaks
- **Nutrition** — daily totals for calories and macros, plus water and coffee with quick-add chips
- **Sleep** — time in bed, actual sleep and Sleep Cycle's quality percentage, with efficiency
- **Weight** — daily logging with trend chart
- **Weekly review** — week over week across all of the above

## Screenshots

| Workouts | Session | Analytics |
|----------|---------|-----------|
| ![Workouts](docs/screenshots/workouts.png) | ![Session](docs/screenshots/session.png) | ![Analytics](docs/screenshots/analytics.png) |

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS |
| Backend | ASP.NET Core 10 (minimal hosting, controllers) |
| Database | PostgreSQL via Entity Framework Core |
| Auth | ASP.NET Core Identity + cookie auth |
| PWA | vite-plugin-pwa (Workbox) |
| Container | Docker Compose (dev + prod) |

## Dev Setup

**Prerequisites:** Docker, .NET 10 SDK, Node 20+

```bash
./dev.sh
```

Starts Postgres (port 5431), backend (`http://localhost:5132`) and frontend (`http://localhost:5173`) together. Ctrl+C tears everything down.

### Individual components

```bash
# Backend only
cd backend && dotnet watch run

# Frontend only
cd frontend && npm run dev

# Postgres only
docker compose -f docker/docker-compose.dev.yml up -d
```

### Frontend tooling

```bash
cd frontend
npm run build   # tsc + vite build
npm run lint    # ESLint
```

## Import from Hevy

On the Workouts page, tap **Import** and paste the share text from Hevy:

```
Push
Donnerstag, Apr 30, 2026 um 5:54pm

Bankdrücken
Set 1: 80 kg x 8
Set 2: 75 kg x 9
```

Exercises are matched by name (case-insensitive) or created automatically if not found.

## Hevy sync

The workout log is read-only and filled by the sync button in its header. It pulls
recent sessions from `GET /v1/workouts` and keys rows by the provider's id, so
running it again updates what is already there rather than duplicating it. Warmup
sets are dropped, and the calendar day is resolved in `Hevy__TimeZone` because the
API reports UTC.

```bash
HEVY_API_KEY=<Hevy Pro -> Settings -> Developer>
TZ=Europe/Vienna
```

Without a key the sync button reports itself as unconfigured and nothing else changes.

## Importing from gym-log

`scripts/import-gymlog.py` copies gym-log's `day_logs` rows into jinsei. It goes
through the API rather than the database, so imported rows pass the same
validation as hand-entered ones, and every endpoint upserts on the date, so
re-running it is harmless.

```bash
EMAIL=… PASSWORD=… python3 scripts/import-gymlog.py           # dry run
EMAIL=… PASSWORD=… python3 scripts/import-gymlog.py --apply
```

Workouts are skipped on purpose: jinsei pulls those from Hevy directly, and
gym-log's copies of the same sessions carry no provider id to match them on.

## Production

```bash
cp .env.example .env
# fill in POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB

docker compose -f docker/docker-compose.yml up -d
```

Frontend nginx serves the SPA and reverse-proxies `/api/` to the backend container. The
stack is bound to `127.0.0.1:8092` only — nothing is published to the LAN or the internet.

`./deploy.sh` pulls main and rebuilds the stack in place.

### Upgrading a database older than `53eef16`

Run once, on the host, **before** the first deploy that carries that commit:

```bash
./scripts/mark-weightandsleep-applied.sh
```

`AddWeightAndSleep` used to be invisible to EF — no `[Migration]` attribute, so it was
never applied and never recorded, though `weight_entries` and `sleep_entries` were
created anyway and have been in use ever since. The commit gives it its attribute, which
is what lets the chain run from an empty database; on a database that predates it, the
same change makes EF think the migration is pending and try to create tables that hold
live data, and the backend crash-loops. The script writes the history row that should
always have been there. It is idempotent and does nothing on a fresh database.

### Exposure via Tailscale

Access is Tailscale-only; TLS is terminated by `tailscale serve` using the tailnet cert.

```bash
sudo tailscale serve --bg --https 9443 http://127.0.0.1:8092
```

Reachable at `https://<host>.<tailnet>.ts.net:9443` from any device in the tailnet.
Remove with `sudo tailscale serve --https 9443 off`.

Registration is disabled in prod via `Auth__AllowRegistration=false` in the compose
file. Set it to `true`, restart the backend, create the account, then set it back.

## Project structure

```
backend/          ASP.NET Core Web API
  Controllers/    REST endpoints
  Data/
    Entities/     EF Core models
    Migrations/   DB migrations
frontend/
  src/
    features/     API clients + React Query hooks
    pages/        Route-level components
    components/   Shared UI
docker/
  docker-compose.dev.yml   Postgres only (dev)
  docker-compose.yml       Full prod stack (loopback-bound, Tailscale-exposed)
```
