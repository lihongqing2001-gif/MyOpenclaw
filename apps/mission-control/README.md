# SoloCore Console

SoloCore Console is the operator console for a resident OpenClaw runtime. It can run locally during development and can also be deployed server-side as a cloud OpenClaw control plane, so long as the broker stays on a server-local interface and is only exposed through an authenticated panel.

## What Runs Where

### Broker runtime
- Serves the React UI and the SSE stream at `GET /api/v1/stream`
- Accepts drawer execution requests at `POST /api/v1/node-execute`
- Serves control-plane state at `GET /api/v1/control-plane/state`
- Saves the primary asset root at `POST /api/v1/control-plane/asset-root`
- Queues archive/index intake runs at `POST /api/v1/control-plane/asset-intake`
- Queues commands for a resident agent
- Exposes agent polling at `POST /api/v1/agent/poll`
- Accepts task lifecycle updates at `POST /api/v1/agent/task-update`
- Serves local knowledge documents at `GET /api/v1/doc`
- Serves qmd-backed documents at `GET /api/v1/qmd-doc`
- Exports portable SOP bundles at `POST /api/v1/bundles/export`

### Resident OpenClaw agent
- Lives in `openclaw_agent.py`
- Sends heartbeats to `POST /api/v1/heartbeat`
- Polls the broker for queued node commands
- Reports `running`, `completed`, and `failed` task states
- Pushes knowledge artifacts back into the UI after execution
- Writes runtime cases and lessons into `agents/knowledge/`
- Triggers `qmd update` after new knowledge is written
- In cloud-console mode, sends `x-solocore-internal-token` from `SOLOCORE_CLOUD_CONSOLE_INTERNAL_TOKEN` (fallbacks: `OPENCLAW_CLOUD_CONSOLE_INTERNAL_TOKEN`, `SOLOCORE_INTERNAL_TOKEN`)

## Local Development

### 1. Install dependencies

```bash
cd /Users/liumobei/.openclaw/workspace/apps/mission-control
npm install
```

### 2. Start the local broker

```bash
npm run dev
```

Open the panel at [http://127.0.0.1:3000](http://127.0.0.1:3000).

### 3. Start the resident OpenClaw agent

In a second terminal:

```bash
cd /Users/liumobei/.openclaw/workspace/apps/mission-control
python3 openclaw_agent.py
```

Or use:

```bash
npm run agent
```

When the agent is online, the Lobby HUD will switch from `WAITING FOR AGENT` to `AGENT LINKED`.

### 4. One-command launch

```bash
python3 start_app.py
```

This starts both:

- the broker
- the resident agent

and opens SoloCore Console automatically.

## Cloud OpenClaw Deployment

`mission-control` can also run as the server-side OpenClaw runtime behind `SoloCore Hub`.

Rules:

- bind the broker to `127.0.0.1`
- do not expose the broker directly on a public port
- reach it only through the authenticated admin surface in `SoloCore Hub`
- deploy from local source / GitHub-tracked versions, not by hand-editing the server copy
- when internal access checks are enabled, configure the same internal token for broker and resident agent so `/api/v1/heartbeat`, `/api/v1/agent/poll`, and `/api/v1/agent/task-update` stay reachable

## Packaging a Release Bundle

```bash
npm run package
```

The helper at `scripts/package_release.py` rebuilds `dist/`, copies the core docs (`README.md` and `USER_MANUAL.md`), and writes everything into `releases/release-v<version>-<YYYYMMDD>` plus a zipped copy (`.zip`). These artifacts can be shared as the official local bundle and already include the production UI plus the documentation people need to get started.

## Handshake Smoke Test

1. Start the web broker.
2. Start `openclaw_agent.py`.
3. Open the UI and enter the skill tree.
4. Click any level-3 node and fill required inputs.
5. Press `Execute SOP`.
6. Watch the lobby HUD show the queued and running task.
7. Watch the node return to `idle` or `error`.
8. Check `Recent` and search for the runtime case in global knowledge search.

## Knowledge System

The console now uses a multi-source knowledge layer:

- seed/runtime knowledge
- scanned workspace docs
- `agents/knowledge/**/*.md`
- `qmd` search results

Runtime execution writes knowledge back into:

- `agents/knowledge/cases/`
- `agents/knowledge/runtime-lessons/`

and then runs:

```bash
qmd update
```

to keep the index fresh.

Global skills are now indexed automatically from:

- `~/.openclaw/workspace/skills`
- `~/.agents/skills`
- `~/.codex/skills`

Those skills are merged into:

- skill dependency resolution
- SOP explicit-skill matching
- global knowledge search

The evidence view now distinguishes:

- `declared` references
- `runtime` evidence from real execution
- `confirmed` patterns promoted after validation

The dashboard also exposes:

- a single asset-root control surface for long-term assets
- an intake panel for archive/index runs
- a decision queue for blockers, stale evidence, and follow-up actions

## Portable SOP Bundles

Every level-3 SOP can now be exported as a portable OpenClaw capability package.

### From the UI

1. Open the skill tree.
2. Click a level-3 SOP.
3. In the drawer footer, click `Export Bundle`.
4. Download the generated zip from the drawer.

### From the CLI

Export one SOP:

```bash
python3 scripts/export_sop_bundle.py --node-id sop-content-schedule-planning
```

Export all level-3 SOP bundles and generate an index:

```bash
python3 scripts/export_sop_bundle.py --all
```

Generated artifacts are written to:

- `exports/bundles/*.zip`
- `exports/bundles/index.json`

Each bundle contains:

- `capability-manifest.json`
- `dependency-hints.json`
- `README.md`
- `OPENCLAW.md`
- `install.py`
- `healthcheck.py`
- packaged `sops/`
- packaged `skills/` when local skill assets exist
- packaged `knowledge/` and `scripts/` when available

### Installing On A New OpenClaw

1. Unzip the exported bundle.
2. Run `python3 install.py`.
3. If dependencies are missing, install them one by one according to `dependency-hints.json`.
4. Run `python3 healthcheck.py`.
5. Start the resident OpenClaw agent on the new machine.

## Notes

- Prefer `http://127.0.0.1:3000` over `localhost` for local access stability.
- Some descriptive SOPs still need deeper execution adapters.
- The strongest currently-working file SOPs are:
  - `自动整理归档`
  - `资料清单化与索引`

## Long-Term Library

The long-term asset and knowledge library now lives at:

- `/Volumes/For Win/01_Projects/AI`

Human entry:

- `/Volumes/For Win/01_Projects/AI/README.md`

AI entry:

- `/Volumes/For Win/01_Projects/AI/AI_INSTRUCTIONS.md`

Mission Control is still the runtime control plane. The long-term library is the persistent storage plane.

## Tech Stack

- React 19
- Vite
- TypeScript
- Tailwind CSS
- React Flow (`@xyflow/react`)
- Framer Motion
- Spline (`@splinetool/react-spline`)
- Express broker + SSE
