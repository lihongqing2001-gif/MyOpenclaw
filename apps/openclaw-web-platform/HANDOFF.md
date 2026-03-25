# SoloCore Hub Handoff

## Product Role

`openclaw-web-platform` powers SoloCore Hub, the cloud-facing product line.

It owns:

- public website
- downloads
- community submissions
- review/admin workflows
- signed download URLs
- GitHub hangoff integration points

## Current Status

- local file-backed MVP backend is running
- HTML pages exist for home, downloads, package detail, login, submit, my submissions, review queue, admin 2FA
- GitHub OAuth and GitHub release sync hooks are scaffolded
- SMTP mailer fallback is implemented

## Important Paths

- topology config: `/Users/liumobei/.openclaw/workspace/workspace-topology.json`
- runtime data root: `/Users/liumobei/.openclaw/runtime/artifacts/openclaw-web-platform/data`

## Run

```bash
cd /Users/liumobei/.openclaw/workspace/apps/openclaw-web-platform
npm run dev
```

## Verify

```bash
npm run typecheck
curl http://127.0.0.1:3400/health
```
