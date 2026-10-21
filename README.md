# LocalPulse

[![CI](https://github.com/dipak5501/localpulse/actions/workflows/ci.yml/badge.svg)](https://github.com/dipak5501/localpulse/actions/workflows/ci.yml)
[![Deploy](https://github.com/dipak5501/localpulse/actions/workflows/deploy.yml/badge.svg)](https://github.com/dipak5501/localpulse/actions/workflows/deploy.yml)

**A live map of what's trending around you.** LocalPulse finds your location and shows nearby events, food spots, music, sports and alerts, ranked by a location-aware trending algorithm and visualised as markers or a heatmap.

**[Live demo →](https://dipak5501.github.io/localpulse/)** (allow location access, or it defaults to Long Beach, CA)

| Pulses | Heatmap |
| ------ | ------- |
| ![Pulses view](docs/screenshot.jpg) | ![Heatmap view](docs/heatmap.jpg) |

## Features

- **Live geolocation** via `watchPosition`, with a graceful fallback when access is denied or unavailable
- **Radius search** (1 to 15 km) using great-circle (haversine) distance locally, or PostGIS `ST_DWithin` when connected to Supabase
- **Location-aware trending ranking** that balances upvotes, recency and proximity
- **Two map views:** scored markers (size = trending score) or a custom canvas **heatmap** of hotspots
- **Post, upvote and filter by category**; offline mode persists in `localStorage`, live mode uses anonymous Supabase Auth + Realtime
- **Responsive and accessible:** works on mobile, labelled controls, `aria-pressed` / `radiogroup` semantics

## How trending works

Each pulse gets a score inspired by Hacker News ranking, weighted by distance:

```
score = (upvotes + 1) / (ageHours + 2) ^ 1.5  ×  (1 − 0.5 × min(distance / radius, 1))
```

- **Time decay:** older posts sink unless they keep getting votes. The gravity value `1.5` controls how quickly.
- **Proximity:** a post at the edge of your radius scores half as much as an identical one next to you.

Implementation: [`src/lib/trending.ts`](src/lib/trending.ts), covered by unit tests.

## Architecture

```mermaid
flowchart LR
  GPS[Browser Geolocation API] --> Hook[useGeolocation]
  Hook --> App[LocalPulseApp]
  Env{Supabase env?}
  Env -->|yes| Remote[useRemotePulses + anon auth]
  Env -->|no| Store[(localStorage + demo seed)]
  Remote --> SB[(Supabase PostGIS + Realtime)]
  Store --> App
  Remote --> App
  App --> Rank[rankPulses]
  Rank --> Feed[Trending feed]
  Rank --> Map[Leaflet map]
```

- **`src/lib`** holds pure, framework-free logic (geo math, ranking, heatmap colouring, storage validation). It has no React imports, so it's fast to unit test and could run on a server unchanged.
- **Dual backend:** when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, the app signs in anonymously, calls `nearby_pulses` / `create_pulse`, writes votes, and subscribes to Realtime. When they are missing (e.g. the current GitHub Pages build), it falls back to seeded demo data + `localStorage` so the static demo keeps working.
- **The heatmap is hand-written** rather than a plugin: each point stamps a pre-blurred circle onto a canvas at its weight as opacity, then the alpha channel is recoloured through a 256-entry palette ([`HeatLayer.tsx`](src/components/HeatLayer.tsx), [`heatmap.ts`](src/lib/heatmap.ts)).

## Database (Supabase + PostGIS)

Schema and RPCs live in [`supabase/migrations`](supabase/migrations):

- `pulses` stores a PostGIS `geography(point)` with a **GiST index**, so radius queries use `ST_DWithin` on the index instead of scanning every row.
- `nearby_pulses(origin_lat, origin_lng, radius_km)` returns pulses in range with distance.
- `create_pulse(...)` inserts a geography point safely from the browser (no raw WKT).
- `pulse_votes` has a composite primary key (**one vote per user**) and a trigger that keeps a denormalised `upvotes` counter in sync.
- **Row-level security:** anyone can read; signed-in users can only post, vote and delete as themselves, and can't seed fake upvotes.
- Inserts/updates are broadcast over **Supabase Realtime**.

Migrations are tested against Postgres + PostGIS in-process via [PGlite](https://pglite.dev) ([`supabase/tests`](supabase/tests/migration.test.ts)).

### Connect your Supabase project

1. Create a free project at [supabase.com](https://supabase.com) (GitHub sign-in is fine).
2. **Enable Anonymous sign-ins:** Authentication → Providers → Anonymous → Enable.
3. Copy **Project URL** and **anon public** key from Project Settings → API into `.env.local` (see [`.env.example`](.env.example)).
4. Apply migrations (pick one):

```bash
# Option A — Supabase CLI (recommended)
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push

# Option B — SQL editor
# Paste and run every file in supabase/migrations/ in order.
```

5. Restart `npm run dev`. The header should show **live** once anonymous auth succeeds.

### Live demo on GitHub Pages

The Pages deploy stays in **offline demo mode** until you add repository secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Then re-run the Deploy workflow (or push to `main`). The anon key is safe to expose in a static site; never put the **service role** key in the frontend or in Pages secrets.

## Testing

| Layer | Tooling | What's covered |
| ----- | ------- | -------------- |
| Unit | Vitest | Geo math, trending, heatmap palette, storage validation, formatting, Supabase config gate |
| Database | Vitest + PGlite/PostGIS | Radius search, age filter, vote trigger, RLS policies, `create_pulse` RPC |
| End-to-end | Playwright (desktop + mobile) | Live location, fallback, radius, filters, posting + reload, upvotes, heatmap |

CI runs lint, type-check, unit/database tests, a production build and the Playwright suite on every push. Merges to `main` deploy a static build to GitHub Pages.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Leaflet / react-leaflet · Supabase (Postgres + PostGIS + Auth + Realtime) · Vitest · Playwright · GitHub Actions

## Getting started

```bash
npm install
cp .env.example .env.local   # optional — omit for offline demo mode
npm run dev                  # http://localhost:3000
npm test                     # unit + database tests
npm run test:e2e             # Playwright (starts the dev server if needed)
npm run lint
npm run typecheck
npm run build
```

## Roadmap

- [x] Map, geolocation, radius search, location-aware trending ranking
- [x] Heatmap view, local persistence, end-to-end tests, live demo
- [x] Supabase schema with PostGIS, RLS and tested migrations
- [x] Connect the app to Supabase with anonymous sign-in
- [x] Realtime updates so new pulses appear for everyone instantly
- [ ] Photo attachments via Supabase Storage
