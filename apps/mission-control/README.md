# Mission Control

Phase-1 scaffold for a new Mission Control app using Next.js App Router and Convex.

## What is included

- Operations page with migration note and link to existing monitoring panel
- Memory page with search UI backed by Convex query (`memories:list`)
- Team page with `中枢` plus grouped subagents from Convex query (`team:list`)
- Convex schema with `memories`, `teamMembers`, `tasks`, and `events`
- Convex seed mutation (`seed:bootstrap`) for starter records

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env file and set values:

```bash
cp .env.example .env.local
```

- `NEXT_PUBLIC_CONVEX_URL` should point to your Convex deployment URL.
- `MONITORING_PANEL_URL` should point to the current monitoring panel.

3. Start Next.js:

```bash
npm run dev
```

4. Optional Convex bootstrap after deployment:

```bash
npx convex deploy
npx convex run seed:bootstrap
```

## Notes

- If `NEXT_PUBLIC_CONVEX_URL` is not set, the app still renders using local fallback seeded content.
- This app is isolated under `apps/mission-control` and does not modify monitoring code in `agents/monitoring-self`.
