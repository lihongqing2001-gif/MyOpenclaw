# 2026-03-25 Integration Pass 01

## Summary

This integration pass combines the current completed local branches into a single testable branch:

- admin 2FA policy toggle
- admin user management surface and admin workspace IA refresh
- shared runtime and trusted local compute sharing
- package onboarding metadata and first-run install contract
- cloud console resident-agent internal access fix

Branch:

- `codex/integration-pass-01`

## User-Facing Changes

- Added a dedicated `Shared Runtime` entry for authenticated users.
- Added trusted shared runtime support on local compute nodes.
- Added a package onboarding contract for guided first-run flows.
- Split the admin workspace into dedicated control surfaces:
  - overview
  - users and roles
  - security
  - platform
  - cloud access
  - runtime
  - local compute
- Added an admin toggle for whether super-admin sessions require 2FA.

## Runtime / Platform Changes

- Local compute nodes now support:
  - `author-only` mode
  - `trusted-shared` mode
  - shared user allowlists
  - allowed auth capability allowlists
  - allowed path scope declarations
- Shared runtime tasks are audited with requester, owner, and access mode context.
- Community package manifests now support optional `onboarding`.
- Mission Control package inspection/install responses now expose onboarding and install state.
- The cloud console resident agent can use the internal token path for broker access.

## Validation

- `apps/openclaw-web-platform`
  - `npm run typecheck`
  - `npm run build`
- `apps/mission-control`
  - `npm run lint`
  - `npm run build`
- `python3 -m py_compile apps/mission-control/scripts/export_sop_bundle.py`

## Test Focus

- admin login and 2FA toggle behavior
- admin workspace navigation
- user management page
- local compute node registration and dispatch
- shared runtime access and task creation
- package onboarding metadata visibility
- cloud console resident-agent linkage
