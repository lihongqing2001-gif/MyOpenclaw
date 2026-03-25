# SoloCore Hub Deployment

## Deployment Rule

- Build and validate locally first.
- Keep version history in git and GitHub.
- Deploy the server from a versioned git ref or release artifact.
- Avoid editing application source directly on the server outside emergency triage.
- If SoloCore Console is deployed on the same server, keep it bound to `127.0.0.1` and reach it only through admin-authenticated Hub routes.

## What This Deploys

- official website
- download page
- community package registry
- submission API
- review/admin API
- signed package downloads

## Prerequisites

- Node.js 20+
- reverse proxy or edge platform
- CDN/WAF in front of the service
- domain name
- email provider for login delivery

## Environment

Start from:

```bash
cp .env.example .env
```

Required before production:

- `OPENCLAW_WEB_SESSION_SECRET`
- `OPENCLAW_WEB_DOWNLOAD_SECRET`
- `OPENCLAW_WEB_BASE_URL`
- SMTP credentials

## Install

```bash
cd /Users/liumobei/.openclaw/workspace/apps/openclaw-web-platform
npm install
```

## Verify

```bash
npm run typecheck
```

## Bootstrap A Super Admin

```bash
npm run bootstrap-admin -- admin@example.com
```

Save the returned TOTP secret in your authenticator app.

## Run In Development

```bash
npm run dev
```

Default port:

- `3400`

## Run In Production

```bash
npm run build
NODE_ENV=production npm run start
```

Put the service behind:

- Cloudflare or another CDN/WAF
- HTTPS termination
- a reverse proxy that forwards to the Node process

Preferred production approach:

- build locally so `dist/` and `dist-server/` are generated first
- deploy those prebuilt artifacts to the server
- on the server only run dependency install and service restart
- run the server with `node dist-server/server.js`, not `tsx server.ts`
- keep a memory ceiling on the service via `NODE_OPTIONS=--max-old-space-size=256` and `MemoryMax`

## Docker Compose

```bash
cp .env.production.example .env
docker compose up -d --build
```

The included files are:

- `Dockerfile`
- `docker-compose.yml`
- `deploy/nginx/openclaw-web-platform.conf`
- `deploy/nginx/openclaw-web-platform.ssl.conf`
- `deploy/systemd/openclaw-web-platform.service`

## Publish An Official Package

Use a community package zip exported from the local console:

```bash
npm run publish-package -- /absolute/path/to/package.zip official
```

## Security Checklist

- enable CDN/WAF
- enforce HTTPS
- configure SMTP for real email delivery
- keep `OPENCLAW_WEB_SESSION_SECRET` and `OPENCLAW_WEB_DOWNLOAD_SECRET` out of git
- bootstrap a dedicated super-admin account
- require admin 2FA before giving backend access
- do not expose local mission-control broker APIs to the public web
