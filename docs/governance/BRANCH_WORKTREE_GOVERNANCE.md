# Branch And Worktree Governance

## Long-Lived Branch Policy

- `main` is the only long-lived branch for the SoloCore app/web suite.
- Do not keep parallel long-lived integration branches for the same product line.
- Any current side branch must either:
  - be merged into `main`
  - be archived and deleted

## Short-Lived Branch Policy

- All short-lived development branches must use the `codex/<topic>` pattern.
- Each branch should represent one concrete delivery topic.
- Do not mix unrelated themes in the same temporary branch.

Examples:

- `codex/solocore-branding`
- `codex/hub-auth-email`
- `codex/resource-release-metadata`
- `codex/deploy-versioned-flow`

## Worktree Policy

- Each active short-lived branch may have at most one active worktree.
- Worktree names should match the branch topic.
- Remove the worktree immediately after the branch is merged or archived.
- Do not keep inactive test or experiment worktrees around.

## Cleanup Requirements

Before deleting any branch or worktree:

1. Record its purpose and final SHA in an archive document.
2. Confirm whether its useful work has already been merged or superseded.
3. If the working tree is dirty, create a safety snapshot first.

## Deployment Alignment

- The server must deploy only versioned git refs or release artifacts.
- Do not treat direct server edits as the source of truth.
- Branch cleanup and deployment discipline are linked: fewer long-lived branches means clearer release lineage.
