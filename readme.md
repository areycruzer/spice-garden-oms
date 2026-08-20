# Spice Garden — Restaurant Order Management System

Internal ops dashboard and API for the fictional Indian restaurant chain **Spice Garden**. Manage customers and kitchen orders end to end.

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

## Quick start

```bash
# 1. Install dependencies
pnpm install

# 2. Start PostgreSQL
docker compose up -d

# 3. Migrate & seed
pnpm db:migrate
pnpm db:seed

# 4. Run API + UI
pnpm dev
```

- API: http://localhost:3000  
- UI: http://localhost:5173  

## Folder structure

```
restro-os/
  frontend/          React + Vite + TanStack Query/Table + Tailwind
  backend/           Hono + Zod + Vitest API
  database/          Drizzle schema, migrations, seed
  docker-compose.yml Postgres 16
  questions.md       Contract assumptions as clarifying questions
  readme.md
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start backend + frontend |
| `pnpm db:migrate` | Apply Drizzle migrations |
| `pnpm db:seed` | Seed Spice Garden demo data |
| `pnpm test` | Run backend Vitest suite |
| `pnpm --filter backend start` | API only |
| `bash backend/curl-examples.sh` | REST examples (requires `jq`) |

## API overview

Base URL: `http://localhost:3000`

| Method | Path | Notes |
|--------|------|-------|
| GET | `/customers` | `search`, `page`, `size` + pagination meta |
| POST | `/customers` | 201 |
| PATCH | `/customers/:id` | |
| DELETE | `/customers/:id` | 204 |
| GET | `/orders` | `search`, `status`, `customerId`, pagination |
| GET | `/orders/:order_id` | Full `OrderDetails` |
| POST | `/orders` | Creates/attaches customer + items in a transaction |
| PATCH | `/orders/:order_id/status` | State-machine guarded |
| POST | `/orders/:order_id/items` | 201, recomputes totals |
| DELETE | `/orders/:order_id/items/:item_id` | 200, recomputes totals |

List responses: `{ data, meta: { pagination: { page, size, total, totalPages } } }`  
Single-resource responses: `{ data }`  
Errors: `{ error: { code, message } }`

Error codes: `VALIDATION_FAILED` (400), `INVALID_FILTER` (400), `RESOURCE_NOT_FOUND` (404), `RESOURCE_ALREADY_EXISTS` (409), `INVALID_STATUS_TRANSITION` (409).

## SQLite fallback (local / offline)

The primary dialect is **PostgreSQL**. For a SQLite fallback path with Drizzle:

1. Add `better-sqlite3` to the `database` package.
2. Point `DATABASE_URL` at a file, e.g. `file:./dev.db`.
3. Switch Drizzle config `dialect` to `sqlite` and use `drizzle-orm/better-sqlite3`.
4. Replace Postgres-only features in schema/SQL:
   - `timestamptz` → integer/text timestamps
   - `gen_random_uuid()` → application-side UUIDs
   - `ILIKE` → `LIKE` (case-sensitivity differs)
   - `order_number_seq` → a SQLite counter table or app-side sequence
5. Generate and run SQLite migrations separately from the Postgres ones under `database/drizzle/`.

This repo ships the Postgres path as the default production-quality setup.

## Seed data

`pnpm db:seed` loads:

- Indian menu items (Paneer Butter Masala, Chicken Biryani, Masala Dosa, …) with INR prices
- 8 customers (Aarav Sharma, Priya Nair, …)
- 16 orders spanning all five statuses across multiple dates (paginates past page 1 at `size=10`)

## Testing

```bash
pnpm test
```

Integration tests hit the real Postgres instance configured by `DATABASE_URL` and reset tables between cases. Re-seed afterwards if you need demo data in the UI:

```bash
pnpm db:seed
```

Curl examples: [`backend/curl-examples.sh`](backend/curl-examples.sh).

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `connection refused` to Postgres | `docker compose up -d` and wait for healthy |
| Migrations fail | Ensure `DATABASE_URL` matches compose credentials |
| Frontend empty / CORS | Confirm API on `:3000` and `VITE_API_BASE_URL` |
| Stale seed after tests | `pnpm db:seed` |
| Port in use | Set `PORT` / change Vite `server.port`. If `:3000` is taken (e.g. another local app), run `PORT=3001 pnpm --filter backend start` and set `VITE_API_BASE_URL=http://localhost:3001` |

## Deployment

Recommended split (best fit):

| Piece | Platform | Why |
|-------|----------|-----|
| Frontend (Vite SPA) | **Vercel** | Static hosting + SPA rewrites |
| Backend (Hono API) | **Render** | Long-running Node web service |
| PostgreSQL | **Render** | Same region as API, free tier available |

### Render (API + DB)

1. Push this repo to GitHub.
2. In Render Dashboard → **New → Blueprint** and select `render.yaml`, **or** create a free Postgres + Web Service manually:
   - **Build**: `corepack enable && pnpm install --frozen-lockfile`
   - **Start**: `pnpm start:api`
   - **Env**: `DATABASE_URL` (from Render Postgres), `PORT=3000`, `FRONTEND_ORIGIN=https://<your-vercel-app>.vercel.app`
3. After the API is live, seed once (Render shell or one-off):
   ```bash
   DATABASE_URL=... pnpm db:seed
   ```

### Vercel (frontend)

From `frontend/`:

```bash
npx vercel --prod
```

Set env var:

- `VITE_API_BASE_URL=https://<your-render-api>.onrender.com`

Root directory: `frontend`. Framework preset: Vite. Output: `dist`.

## License

Take-home / educational use.
