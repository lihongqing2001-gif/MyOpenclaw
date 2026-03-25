# OpenClaw Deployment Guide

## Product Split

### 1. SoloCore Console

Purpose:

- private local control plane
- local data / assets / SOP execution
- local community package import and install

Read:

- `apps/mission-control/DEPLOYMENT.md`

### 2. SoloCore Hub

Purpose:

- product website
- downloads
- official library
- community submissions
- review/admin workflows

Read:

- `apps/openclaw-web-platform/DEPLOYMENT.md`

### 3. OpenClaw GitHub Pages Surface

Purpose:

- public landing page
- GitHub Releases jump-off page
- GitHub Discussions and docs entry

Read:

- `apps/openclaw-github-pages/README.md`
- `GITHUB_HANGOFF_GUIDE.md`

## Recommended Rollout Order

1. Develop and validate locally
2. Commit and version in git/GitHub
3. Build release artifacts
4. Deploy the chosen version to the server
5. Bootstrap super-admin + 2FA if needed
6. Publish official packages exported from the local console
7. Let users download packages from the web and import them locally

## Release Discipline

- The server is not the primary development surface.
- Prefer deploying a versioned git ref or release artifact.
- Keep release history in GitHub tree, tags, and release manifests.
- If the product family is renamed to `SoloCore`, do that from local source first and deploy it as a versioned change.

Read:

- `docs/deployment/LOCAL_FIRST_RELEASE_FLOW.md`
- `scripts/deploy/README.md`

## Release Readiness Checks

For local and pre-push validation:

```bash
/Users/liumobei/.openclaw/workspace/scripts/deploy_check_openclaw.sh
```

For strict public publish validation, including GitHub Pages placeholder checks:

```bash
/Users/liumobei/.openclaw/workspace/scripts/deploy_check_openclaw.sh --strict-public
```

## Explicit Safety Rule

Do **not** expose the local `mission-control` broker directly to the public internet.
