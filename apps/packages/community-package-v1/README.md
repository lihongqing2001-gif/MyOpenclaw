# Community Package V1

`Community Package V1` is the shared package contract for:

- local export from `OpenClaw Local Console`
- local import/install into a user's private console
- web distribution through `OpenClaw Web Platform`
- official and community submissions

## Core Goals

- keep local/private workspaces private by default
- let users explicitly publish installable artifacts
- make packages inspectable before install
- support manual review, versioning, and rollback
- avoid automatic remote execution

## Supported Package Types

- `skill-pack`
- `sop-pack`
- `demo-pack`
- `tutorial-pack`
- `case-pack`

## Required Files

Every package archive should contain:

- `community-package.json`
- payload files referenced by the manifest
- optional compatibility/supporting files such as `README.md`, `dependency-hints.json`, screenshots, or demo assets

## Install Trust Model

- packages are **not auto-executed**
- install requires checksum verification
- install requires explicit permission preview
- unsupported or missing manifest fields block installation
- unsigned packages are allowed in V1, but the manifest reserves signature fields for later versions

## Key Manifest Sections

- identity: `packageId`, `type`, `name`, `version`, `author`
- publishing: `reviewStatus`, `visibility`, `source`
- install metadata: `capabilities`, `dependencies`, `compatibility`, `permissions`
- content metadata: `description`, `docs`, `assets`
- integrity metadata: `checksums`

## Intended Lifecycle

1. Local console exports package
2. Author reviews package manifest
3. Author uploads package to web platform
4. Reviewer approves package
5. User downloads package from web platform
6. Local console inspects package
7. User confirms install
8. Local registry tracks enable/disable/rollback state
