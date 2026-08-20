# Submission notes — Spice Garden → Atithie

## Live links

- **App:** https://spice-garden-oms.vercel.app  
- **Floor Ops:** https://spice-garden-oms.vercel.app/floor  
- **API:** https://spice-garden-api.onrender.com  
- **Repo:** https://github.com/areycruzer/spice-garden-oms  

No special credentials — demo uses public seed data. If the API is cold, wait ~30–60s after the first request.

## 90-second pitch (for Gayathri / Annashri)

> Most take-homes stop at CRUD. I treated Spice Garden as the kitchen substrate under an AI host OS.
>
> The required order contract is complete: Hono + Zod, transactional totals, status machine, tests, live deploy.
>
> On top of that I shipped Floor Ops: every status change records dwell, we quote a deterministic ready time from item count, and the floor page suggests the best-fit free table — but the host keeps one-tap override. That’s Atithie’s “governed by your team” philosophy in a working demo.
>
> If I joined next week, I’d connect course-phase signals into the quote model and push live floor sync so every captain sees the same plan.

## Loom outline (3–5 minutes)

Record against the live Vercel URL (wake the API first via `/health`).

1. **0:00–0:30** — Open Orders; mention contract + live deploy. Open one CONFIRMED order; show **Kitchen ops insight** (phase, dwell, quoted ready, suggested action) and status timeline.
2. **0:30–1:30** — Advance status CONFIRMED → PREPARING → READY; show events appending and quote shrinking.
3. **1:30–3:30** — Go to **Floor Ops**. Pick an unseated order → **Suggest** (ringed table) → Accept AI, or tap a different free table as **host override**. Show occupied table metadata (`AI` vs `HOST`).
4. **3:30–4:30** — Complete the order from Order Ops (or Clear on the floor); show table returns to Free.
5. **4:30–5:00** — Close on tradeoff: heuristic not ML; week-1 plan = course phases + realtime floor.

## Checklist before you send

- [ ] Hit https://spice-garden-api.onrender.com/health (wake)
- [ ] Floor Ops shows 12 tables and an unseated queue
- [ ] One order detail shows `opsInsight` + timeline
- [ ] README live links match current Vercel / Render URLs
- [ ] Optional: attach Loom link in the email to Gayathri
