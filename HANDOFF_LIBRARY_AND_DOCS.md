# Library And Docs Handoff

## Purpose

This branch carries repo-native entry documentation that accompanies the Mission Control split, plus a mirrored copy of the long-term AI library entry docs and manifests.

## Included

- `AGENTS.md` update pointing humans/agents to the long-term AI library entry
- `AI/` mirrored documentation tree containing:
  - root entry docs
  - `assets/` entry docs
  - `knowledge/` entry docs
  - `_taxonomy/domains.json`
  - `mappings/*.json`

## External Source Of Truth

The long-term library documents remain on disk here:

- `/Volumes/For Win/01_Projects/AI`

That directory is still the **operational source of truth**.
The `AI/` directory in this branch is a git mirror of the documentation and manifests only.

## What To Merge

- `AGENTS.md`
- `AI/**` (docs + manifests mirror)
- this handoff file

## What Not To Expect

- No long-term asset originals are included
- No large deliverables, archives, or copied binaries are included
- The external AI library still needs separate operational maintenance on disk

## Recommendation

Merge this branch if you want the repo to carry the AI library's structural docs and manifests.
Keep treating `/Volumes/For Win/01_Projects/AI` as the storage-plane source of truth until you explicitly decide to move operational writes into the repository mirror.
