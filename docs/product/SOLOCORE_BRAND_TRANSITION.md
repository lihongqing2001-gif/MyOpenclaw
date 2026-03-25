# SoloCore Brand Transition

## Decision

The product family should move toward the `SoloCore` name.

Target naming:

- overall product family: `SoloCore`
- web product: `SoloCore Hub`

## Rollout Rule

Apply the rename from local source control first.

Do not rename server-side files or copy directly into production without the same change existing in git history.

## Recommended Rename Order

1. Product-facing docs
2. Package metadata
3. Page titles and visible brand strings
4. GitHub Pages public surface
5. Deployment/systemd labels
6. Repository and artifact naming where needed

## Constraints

- Runtime paths do not need to be renamed in the same pass if that increases migration risk.
- Public visible names can change before directory or data root names.
- Each rename pass should be versioned and deployed like any other release.
