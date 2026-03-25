# SoloCore Console Deployment

## Deployment Rule

- SoloCore local products should be developed locally and versioned in GitHub first.
- Package release bundles locally.
- Publish those bundles and manifests to tracked GitHub history.
- Treat the server as a deployment target only.

## What This Deploys

- local broker server
- local mission-control UI
- local resident agent
- local community package import/install workflow

## Prerequisites

- Node.js 20+
- Python 3.11+
- local OpenClaw workspace available

## Install

```bash
cd /Users/liumobei/.openclaw/workspace/apps/mission-control
npm install
```

## Run In Development

```bash
npm run dev
```

In another terminal:

```bash
python3 openclaw_agent.py
```

Or use the combined launcher:

```bash
python3 start_app.py
```

## Run As A Local Production Console

```bash
npm run build
NODE_ENV=production npm run start
```

Preferred production approach:

- build locally so `dist/` and `dist-server/` are generated first
- deploy those prebuilt artifacts to the server
- on the server only install dependencies and restart the service
- run the service with `node dist-server/server.js`, not `tsx server.ts`
- set `OPENCLAW_DISABLE_AGENT_AUTOSTART=1` by default for small cloud instances
- keep a memory ceiling on the service via `NODE_OPTIONS=--max-old-space-size=384` and `MemoryMax`

## Run As A Cloud Console Behind SoloCore Hub

Set these environment variables on the server deployment:

- `SOLOCORE_CONSOLE_ACCESS_SECRET`
- `SOLOCORE_CLOUD_CONSOLE_INTERNAL_TOKEN`
- `SOLOCORE_CLOUD_CONSOLE_PUBLIC_URL`
- `OPENCLAW_WEB_BASE_URL` or `SOLOCORE_HUB_BASE_URL`

This keeps the Console as a separate app while still requiring a Hub-issued access grant before users can enter it.

## Build A Shareable Local Bundle

```bash
npm run package
```

This writes:

- `releases/release-v<version>-<date>/`
- `releases/release-v<version>-<date>.zip`

## Community Package Flow

1. Export a package:

```bash
python3 scripts/export_sop_bundle.py --node-id <node-id>
```

2. Inspect a downloaded package:

```bash
python3 scripts/local_package_registry.py inspect --package-path /absolute/path/to/package.zip
```

3. Install it locally:

```bash
python3 scripts/local_package_registry.py install --package-path /absolute/path/to/package.zip
```

4. List installed packages:

```bash
python3 scripts/local_package_registry.py list
```

## Notes

- This console stays local-first and should not be exposed to the public internet.
- The local broker keeps high-privilege file and execution APIs that are intentionally not part of the public web platform.
