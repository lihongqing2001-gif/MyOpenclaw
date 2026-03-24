# Architecture

## Product Lines

- `OpenClaw Local Console`
  - local-first
  - single-user trust model
  - package import/install/enable/disable/rollback
- `OpenClaw Web Platform`
  - public web app
  - authenticated submissions and downloads
  - reviewer and super-admin governance

## Core Principle

The web platform never directly executes local broker capabilities.

## Core Subsystems

- `frontend`
  - landing pages
  - package browser
  - tutorials
  - community details
- `auth`
  - email login
  - admin 2FA
  - RBAC
- `registry`
  - package records
  - package versions
  - signed download URLs
- `submission`
  - draft / submitted / review / publish lifecycle
- `review`
  - reviewer queue
  - moderation actions
- `audit`
  - admin-sensitive action logs
- `security`
  - WAF/CDN
  - rate limiting
  - session protection

## Non-Reusable Local APIs

The following stay local-only and are not part of the web platform:

- local file opening
- local task execution
- local agent polling
- local broker control-plane mutation
- local qmd document serving
