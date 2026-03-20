# Mission Control Delivery Summary

## Current Branches

- App branch:
  - `codex/mission-control-app`
  - latest commit: `c25fc74`
- Docs/library branch:
  - `codex/mission-control-library-docs`
  - latest commit: `37ab93a`

## What Landed In Each Branch

### `codex/mission-control-app`

This branch contains the working Mission Control application under:

- `apps/mission-control/`

Main areas included:

- dashboard control surface
- skill tree + drawer
- resident agent + broker
- Playwright e2e coverage
- packaging flow and release bundle support

Validation already run in the app worktree:

```bash
npm run lint
npm run test:e2e
npm run build
npm run package
```

All four passed before this summary was written.

Latest local release artifact from the app worktree:

- `apps/mission-control/releases/release-v0.0.0-20260320.zip`

### `codex/mission-control-library-docs`

This branch contains repo-level documentation and the mirrored AI library structure docs:

- `AGENTS.md`
- `AI/README.md`
- `AI/AI_INSTRUCTIONS.md`
- `AI/LIBRARY_MANIFEST.json`
- `AI/assets/*`
- `AI/knowledge/*`
- `AI/mappings/*`

Important:

- The repository copy of `AI/` is a **documentation + manifest mirror**
- The external storage-plane source of truth remains:
  - `/Volumes/For Win/01_Projects/AI`

## External AI Library Note

The external AI library is still the operational long-term library:

- assets live there
- knowledge lives there
- mappings live there

The repo mirror exists so the structure, manifests, and entry docs can be reviewed and merged through GitHub.

It does **not** mean large asset originals or runtime-generated storage should now be committed into git.

## Recommended Merge Order

1. Merge `codex/mission-control-app`
2. Merge `codex/mission-control-library-docs`

Reason:

- app code is self-contained and already verified
- docs/library mirror can then follow as the structural explanation layer

## Human Entry Points

- App runtime entry:
  - `apps/mission-control/README.md`
- Library root entry:
  - `AI/README.md`

## AI Entry Points

- App runtime entry:
  - `apps/mission-control/OPENCLAW_INSTRUCTIONS.md`
- Library root entry:
  - `AI/AI_INSTRUCTIONS.md`

## Keep In Mind

- `apps/mission-control/exports/` and `apps/mission-control/runtime-skill-evidence.json` are local/runtime outputs and were not part of the pushed app branch.
- The repo mirror and the external AI library should not drift for long. If the external library changes again, the mirror should be updated deliberately rather than assumed current.
