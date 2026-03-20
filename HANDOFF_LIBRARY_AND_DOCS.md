# Library And Docs Handoff

## Purpose

This branch carries repo-native entry documentation that should accompany the Mission Control app split, without trying to force the external AI library itself into git.

## Included

- `AGENTS.md` update pointing humans/agents to the long-term AI library entry

## External Source Of Truth

The long-term library documents remain on disk here:

- `/Volumes/For Win/01_Projects/AI`

That directory is **not inside this git repository**, so it cannot be merged through a normal git branch.

## What To Merge

- `AGENTS.md`
- this handoff file

## What Not To Expect

- No `AI/` directory contents are included in this branch
- No library manifests or mapping files are committed here
- Those files remain external and must be managed or mirrored separately if you later want them under git

## Recommendation

Merge this branch only if you want the repo-level pointer to the external AI library.
Keep treating the external AI library as the storage-plane source of truth until you explicitly decide to mirror it into a repository.
