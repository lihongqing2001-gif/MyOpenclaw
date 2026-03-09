# SOP: Xiaohongshu Comment Semantic Extraction (Agent Batch)

## Goal
For given Xiaohongshu note links, extract note + all comments, assign row_id, batch-send comments to an engineer agent for semantic extraction (country/brand/product/valid), then merge results into Excel.

## Inputs
- Xiaohongshu note URL(s)
- Logged-in Chrome for xiaohongshu-skills
- Batch size: 20–50 (default 50)

## Preconditions
- Chrome logged in to Xiaohongshu
- xiaohongshu-skills CLI available
- Python with openpyxl installed

## Steps
1) Parse URL to get feed_id and xsec_token.
2) Create project folder for this link:
   - `sops/xhs_comment_semantic_extract_projects/<feed_id>/`
   - All temporary files for this feed live here.
3) Fetch note + comments:
   - `python scripts/cli.py get-feed-detail --feed-id <id> --xsec-token <token> --load-all-comments --click-more-replies`
4) Assign row_id for every comment (include subcomments). Preserve:
   - comment_id, parent_id, is_subcomment, commenter, content, like_count, ip_location, comment_images (if any)
5) Freeze ordering and batch by the same row list used for Excel:
   - Always build `rows` once, store to `tmp_xhs_<id>_rows.json` in the project folder.
   - Use that exact order to create batches and send `row_id | comment_text`.
6) Parallel agent execution:
   - Split into batches of 20–50 rows.
   - Spawn 2–3 engineer agents in parallel, one batch per agent.
7) Receive agent output per row_id:
   - `row_id, country, brand, product, valid`
   - valid = true if any of country/brand/product appears
8) Merge results strictly by `row_id` (never by position) into `comments` sheet.
   - If any row_id missing/duplicate, re-send only missing row_ids.
9) Consistency check (hard guardrail):
   - If any extracted field is NOT found in `content` (case-insensitive, whitespace/punct-stripped), clear that field and set `valid=false` for that row.
   - Write `content_hash` to Excel so later checks can confirm alignment.
10) Download comment images and store local paths:
   - For each comment `comment_images` URL, download to `Desktop/xhs_images/<feed_id>/comment_<row_id>_<n>.jpg` (or png if needed).
   - Write local paths (newline-separated) into `comment_images` column.
11) Write Excel:
   - Sheet `note`: note_id, title, desc, author, author_id, like_count, collect_count, comment_count, share_count, ip_location, image_urls
   - Sheet `comments`: row_id, comment_id, parent_id, is_subcomment, commenter, content, content_hash, like_count, country, brand, product, valid, ip_location, comment_images
12) Save to Desktop as `xhs_note_<feed_id>_ai.xlsx`.
13) Cleanup:
   - Move all temp files (`tmp_xhs_<id>*`, batch txt, rows json) into the project folder.
   - Remove any duplicate temp files left in workspace root.

## Failure Handling
- If login invalid: run `python scripts/cli.py login` and scan QR.
- If comments load fails: rerun get-feed-detail.
- If agent output missing rows: resend only missing row_ids.
