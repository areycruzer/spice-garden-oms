# Spice Garden OMS — Take-home submission

**Live demo**

| Surface | URL |
|---------|-----|
| Frontend | https://spice-garden-oms.vercel.app |
| API | https://spice-garden-api.onrender.com |
| Health | https://spice-garden-api.onrender.com/health |
| Repo | https://github.com/areycruzer/spice-garden-oms |

> Free Render spins down after idle; first API request may take ~30–60s to wake.

## Why this submission (Atithie bridge)

Atithie is building the **AI host for the dining room** — dynamic turn times, accurate quoted waits, a live floor plan, and AI suggestions that hosts can override in one tap.

This take-home delivers the required **Spice Garden order + customer contract**, then adds an explicit **kitchen + Floor Ops layer** on top: status dwell, deterministic quoted-ready estimates, and AI table suggest with first-class host override. The OMS is the kitchen substrate; Floor Ops is the product thesis Atithie sells.

See [SUBMISSION.md](SUBMISSION.md) for a 90-second pitch and Loom outline.

## What the assignment required vs what I added

| Required (contract) | Additive (standout) |
|---------------------|---------------------|
| Customers + orders CRUD, status machine, pagination, INR UI | `opsInsight` (phase, dwell, quoted ready, suggested action) |
| Hono + Zod + Drizzle + Postgres; React + TanStack + Tailwind | `order_status_events` timeline on every transition |
| Tests + clarifying questions | `/ops/floor` — live tables, suggest, assign (`AI` \| `HOST`), clear |
| | Auto-clear seating when an order hits `COMPLETED` / `CANCELLED` |

Contract routes under `/customers` and `/orders` are unchanged in behavior. Floor Ops lives under `/ops`.

### Quoted-ready heuristic (not ML)

Documented so reviewers can audit the product judgment:

- **CONFIRMED (queued):** `ceil(2 + 0.5 × itemCount)` minutes in queue, then cooking
- **PREPARING (cooking):** `ceil(max(3, 1.5 × itemCount))` minutes to plated
- **ETA to READY:** sum of remaining phases; **READY:** `0`; terminal: `null`

### Floor seating rule

Prefer the **smallest free table** with `capacity >= partySize` (minimize waste). Hosts can accept the highlight (`source: AI`) or tap any other free table (`source: HOST`).

## Tradeoffs & time

- Shipped production seams on the assignment (validation, state machine, transactional totals, tests) before Floor Ops polish.
- No real ML, no reservation ingest, no multi-tenant restaurants — scoped so the demo stays debriefable.
- Approx. focused build time: assignment core + Option C standout layer (status events, Floor Ops, packaging).

**Week 1 at Atithie I'd ship next:** wire course-phase signals (appetizer → dessert) into the quote model, and sync floor state over websocket so every host device sees the same plan without polling.

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) 9+
- Docker & Docker Compose (for PostgreSQL)

## Environment variables

Copy [`.env.example`](.env.example) to `.env` at the repo root (and optionally `frontend/.env`):

| Variable | Default | Used by |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://spice:spice@localhost:5432/spice_garden` | database, backend |
| `PORT` | `3000` | backend |
| `VITE_API_BASE_URL` | `http://localhost:3000` | frontend |
| `FRONTEND_ORIGIN` | (unset locally) | backend CORS in production |

## Quick start

```bash
pnpm install
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- API: http://localhost:3000  
- UI: http://localhost:5173 → **Order Ops**, **Floor Ops**, **Customers**

## Folder structure

```
restro-os/
  frontend/          React + Vite + TanStack Query + Tailwind
  backend/           Hono + Zod + Vitest API (+ /ops)
  database/          Drizzle schema, migrations, seed
  questions.md       Contract + Atithie-aware clarifying questions
  SUBMISSION.md      Pitch + Loom checklist
  readme.md
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start backend + frontend |
| `pnpm db:migrate` | Apply Drizzle migrations |
| `pnpm db:seed` | Seed customers, orders, 12 tables |
| `pnpm test` | Backend Vitest suite |
| `bash backend/curl-examples.sh` | REST examples including `/ops` |

## API overview

### Assignment contract

| Method | Path | Notes |
|--------|------|-------|
| GET/POST/PATCH/DELETE | `/customers` | search + pagination |
| GET/POST | `/orders` | optional `partySize` on create |
| GET | `/orders/:id` | includes `opsInsight`, `statusEvents` |
| PATCH | `/orders/:id/status` | writes status event; clears seating on terminal |
| POST/DELETE | `/orders/:id/items`… | mutable in CONFIRMED / PREPARING |

### Floor Ops (additive)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/ops/floor` | Tables + active assignments + unseated open orders |
| POST | `/ops/floor/suggest` | Best-fit free table for `orderId` |
| POST | `/ops/floor/assign` | Seat (`source: AI \| HOST`) |
| POST | `/ops/floor/clear` | Free table for an order |

## Seed data

- 8 customers, 16 orders across all statuses (INR menu)
- 12 dining tables (T1–T12); a few seeded AI/HOST assignments so Floor Ops is demo-ready

## Testing

```bash
pnpm test
```

22 tests covering contract flows, opsInsight heuristics, status events, floor suggest / host override, and auto-clear on COMPLETED. Re-seed after tests: `pnpm db:seed`.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Postgres refused | `docker compose up -d` |
| Frontend CORS | Set `FRONTEND_ORIGIN` to the Vercel URL on Render |
| Cold start | Hit `/health` once; wait for Render wake |
| Port 3000 busy | `PORT=3001 pnpm --filter backend start` |

## Deployment

| Piece | Platform |
|-------|----------|
| Frontend | Vercel (`frontend/`, `VITE_API_BASE_URL`) |
| API + Postgres | Render (`render.yaml` / `pnpm start:api`) |

## License

Take-home / educational use.
