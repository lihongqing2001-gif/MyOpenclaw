# Local-First Release Flow

## Principle

`SoloCore` should be developed locally, versioned in GitHub, and only then deployed to the server.

The server is a deployment target, not the primary editing surface.

## Required Workflow

1. Change code locally.
2. Validate locally.
3. Commit to git.
4. Tag or otherwise mark the release version.
5. Build release artifacts and release manifests.
6. Push code and version records to GitHub.
7. Deploy the chosen git ref or artifact to the server.

## Server Rule

Avoid direct source edits on the server except for temporary emergency triage.

If an emergency change is ever made on the server, the same change must be reconciled back into git immediately before the next deployment.

## Version Records

Use all of the following together:

- git commits
- git tags
- release manifests
- GitHub repository history

## Branding Decision

Brand transition target:

- product family: `SoloCore`
- web product: `SoloCore Hub`

This naming change should be applied from local source and then rolled out through the same versioned deployment flow, not via direct server edits.
