# Mission Control

Mission Control is a Next.js + Convex app with three pages:

- Operations: reads live monitoring data from `http://127.0.0.1:8000`
- Memory: searchable/filterable memory records from Convex
- Team: `中枢` plus grouped subagents from Convex data

## Prerequisites

- Node.js 18+
- Running monitoring backend at `http://127.0.0.1:8000`
- Convex account/project (for persistent Memory/Team data)

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Configure env:

```bash
cp .env.example .env.local
```

Set:

- `NEXT_PUBLIC_CONVEX_URL` to your Convex deployment URL
- `NEXT_PUBLIC_MONITORING_API_URL` (default `http://127.0.0.1:8000`)
- `MONITORING_PANEL_URL` (optional external panel link)

3. Start Convex (first time and local development):

```bash
npx convex dev
```

4. Seed demo data (optional but recommended once):

```bash
npx convex run seed:bootstrap
```

5. Run the app:

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Build and checks

```bash
npm run lint
npm run build
```

## Notes

- If `NEXT_PUBLIC_CONVEX_URL` is empty, Memory/Team pages still render with local fallback seed records.
- Mission Control only reads from the monitoring backend and does not change files in `agents/monitoring-self`.
