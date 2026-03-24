# OpenClaw Local Console Deployment

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
