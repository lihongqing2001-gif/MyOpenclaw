# Mission Control Handoff

## Product Role

`mission-control` is the local-first OpenClaw product line.

It owns:

- local broker server
- local UI
- resident agent integration
- asset intake
- short-video workflows
- community package inspect/install/enable/disable/rollback

## Key Runtime Assumptions

- repo root is defined by `workspace-topology.json`
- runtime data root is `~/.openclaw/runtime`
- external standalone projects are outside the repo at `~/.openclaw/external-projects`

## Current Status

- local package registry is implemented
- Community Packages workspace is mounted in the dashboard
- short-video factory is active
- local exports produce `community-package.json`

## Important Paths

- topology: `/Users/liumobei/.openclaw/workspace/workspace-topology.json`
- runtime root: `/Users/liumobei/.openclaw/runtime`
- local package registry data: `/Users/liumobei/.openclaw/runtime/agent/community-package-registry.json`

## Run

```bash
cd /Users/liumobei/.openclaw/workspace/apps/mission-control
npm run dev
```

## Verify

```bash
npm run lint
npm run build
npm run test:e2e
```
