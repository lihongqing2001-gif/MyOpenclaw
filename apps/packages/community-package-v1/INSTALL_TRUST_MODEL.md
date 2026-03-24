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
- A package may not request network or shell privileges silently.
- The local console must persist install history, enable/disable state, and rollback eligibility.

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
