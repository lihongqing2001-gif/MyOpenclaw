# Submission State Machine

- `draft`
- `submitted`
- `under_review`
- `changes_requested`
- `approved`
- `published`
- `rejected`
- `archived`

## Rules

- only `published` items are publicly visible
- `submitted` -> `under_review` happens when a reviewer claims the item
- `changes_requested` returns ownership to the author
- `approved` is review-complete but may still await publication
- `rejected` is terminal for that submission version
