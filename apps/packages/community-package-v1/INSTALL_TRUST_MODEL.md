# Install Trust Model

## Defaults

- default execution policy: `manual-confirmation`
- default publish policy: `review-before-public`
- default privacy policy: `local-first`

## V1 Rules

- A package must expose `permissions` before install.
- A package must expose `checksums` before install.
- A package may be installed locally without a cryptographic signature in V1.
- A package may not auto-run on import.
- A package may only request controlled first-run execution when `onboarding.mode` is `guided-first-run`, `onboarding.autoRunEntrypoint` is declared, and required onboarding checks are confirmed.
- A package may not request network or shell privileges silently.
- The local console must persist install history, enable/disable state, and rollback eligibility.

## Controlled First-Run Exception

- Default remains no auto-run.
- The only V1 exception is a single guided first run during install/enablement.
- Guided first run must be declared via `onboarding` metadata and be limited to `onboarding.autoRunEntrypoint`.
- Required onboarding checks must be surfaced before execution (permissions/config/login/consent/dependency as applicable).
- The user must be able to cancel before execution.

## Permission Categories

- `filesystem.read`
- `filesystem.write`
- `process.exec`
- `network.http`
- `agent.orchestration`
- `knowledge.write`

## Reviewer Guidance

- reject packages with missing or misleading permissions
- reject packages with empty docs for non-trivial capabilities
- reject packages that bundle opaque binaries without explanation
- require screenshots or demo assets for public community packages when useful
