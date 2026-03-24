# OpenClaw Deployment Guide

## Product Split

### 1. OpenClaw Local Console

Purpose:

- private local control plane
- local data / assets / SOP execution
- local community package import and install

Read:

- `apps/mission-control/DEPLOYMENT.md`

### 2. OpenClaw Web Platform

Purpose:

- product website
- downloads
- official library
- community submissions
- review/admin workflows

Read:

- `apps/openclaw-web-platform/DEPLOYMENT.md`

## Recommended Rollout Order

1. Deploy `OpenClaw Web Platform` behind CDN/WAF
2. Bootstrap super-admin + 2FA
3. Publish official packages exported from the local console
4. Package and distribute `OpenClaw Local Console`
5. Let users download packages from the web and import them locally

## Explicit Safety Rule

Do **not** expose the local `mission-control` broker directly to the public internet.
