# Mission Control App Handoff

## Purpose

This branch isolates the `apps/mission-control` application work from the rest of the OpenClaw workspace.

## Included

- Frontend dashboard, skill tree, drawer, feedback modal
- Broker server and resident agent updates
- Playwright configuration and e2e regression tests
- Packaging flow and release bundle support
- App-local documentation:
  - `README.md`
  - `USER_MANUAL.md`
  - `OPENCLAW_INSTRUCTIONS.md`

## Verified Commands

Run from `apps/mission-control/`:

```bash
npm run lint
npm run test:e2e
npm run build
npm run package
```

All four commands passed before this handoff was written.

## Release Artifacts

Latest local release output:

- `releases/release-v0.0.0-20260320/`
- `releases/release-v0.0.0-20260320.zip`

These are local build artifacts and are not intended to be committed.

## Important Changes

- Dashboard control surface tightened and partially localized
- Skill tree lazy-loaded into its own bundle
- Core dashboard/skill-tree/drawer/feedback flows covered by Playwright
- Packaging script added for local distributable release output

## Not Included

- External long-term AI library contents under `/Volumes/For Win/01_Projects/AI`
- Global workspace migration manifests outside the app directory
- Unrelated workspace runtime/history/auth state

## Merge Notes

- Merge only this branch for app code and app-local docs
- Do not expect external AI library files to appear through this branch
- After merge, restart the local service so the latest built assets are served
