# Publish Flow (v0.2)

## Goal
Package and publish capability to ClawHub or a registry with checksum provenance.

## Steps
1) Validate package metadata
   - Ensure `capability-manifest.json` exists with `id` and `version`.
2) Build package tarball
   - `tar -czf <id>-<version>.tgz <package_root>`
3) Generate checksum
   - `shasum -a 256 <id>-<version>.tgz`
4) Upload to registry/ClawHub
   - `clawhub publish <id>-<version>.tgz`
5) Update registry index with `checksum` + `download_url`

## Scripted Flow
Use `publish-script.sh` to automate steps 1-3 and emit a checksum record.

Example:
- `./publish-script.sh ./example-capability`
- Outputs:
  - `<id>-<version>.tgz` in the current working directory
  - `outputs/publish/<id>-<version>.checksum.txt`

## Notes
- Keep previous versions available for rollback
- Record publish logs in `outputs/publish/`
