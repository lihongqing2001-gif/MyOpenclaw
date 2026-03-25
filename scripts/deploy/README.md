# Deploy

This directory is for deployment helpers that assume a local-first workflow.

## Required Rule

- Develop and validate locally first.
- Commit changes to git.
- Tag or otherwise version the release.
- Publish versioned artifacts to GitHub or a tracked release directory.
- Deploy the server from a versioned git ref or release artifact.

## Explicit Non-Goal

Do not treat the server as the primary development workspace.

Hot-fixing files directly on the server without reflecting the same changes in git breaks version tracking, rollback, and release auditability.

## Expected Flow

1. Local development in the workspace
2. `npm run typecheck` / app-specific validation
3. Build release bundle or prebuilt server artifacts locally
4. Push code and version metadata to GitHub
5. Deploy the selected version to the server

## Prebuilt Node Deploy

Use `deploy_prebuilt_node_app.sh` when an app already has local `dist/` and `dist-server/` output and you want the server to avoid runtime transpilation or client builds.
