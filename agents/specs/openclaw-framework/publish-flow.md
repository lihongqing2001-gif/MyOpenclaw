# Publish Flow (v0.2)

## Goal
Package and publish capability to ClawHub or registry.

## Steps
1) Build package tarball
   - tar -czf cap.<org>.<domain>.<name>-<version>.tgz <package_root>
2) Generate checksum
   - shasum -a 256 <package>.tgz
3) Upload to registry/ClawHub
   - clawhub publish <package>.tgz
4) Update registry index with checksum + download_url

## Notes
- Keep previous version available for rollback
- Record publish log in outputs/publish/
