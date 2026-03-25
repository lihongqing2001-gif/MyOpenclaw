# SoloCore Hub GitHub Pages Surface

This directory contains the static public landing page that is meant to be published via GitHub Pages, styled to match SoloCore Hub.

## Product Role

- public-facing landing page
- jump-off page for GitHub Releases downloads
- jump-off page for SoloCore Hub
- entry point for GitHub Discussions and public docs

## Files

- `index.html`: static landing page for GitHub Pages

## Publish Checklist

Before publishing, replace the placeholder links in `index.html`:

- `https://github.com/YOUR_ORG/YOUR_REPO/releases`
- `https://github.com/YOUR_ORG/YOUR_REPO/discussions`
- `https://app.your-domain.example`

Then run:

```bash
/Users/liumobei/.openclaw/workspace/scripts/deploy_check_openclaw.sh --strict-public
```

This surface should stay static and lightweight. Product logic, login flows, and signed download handling belong to SoloCore Hub in `apps/openclaw-web-platform`, not GitHub Pages.
