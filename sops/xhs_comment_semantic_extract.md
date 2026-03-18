# SOP: Xiaohongshu Comment Semantic Extraction (Auto Excel)

## Goal
For a given Xiaohongshu note link, fetch the full comment area, normalize comment semantics into a single business-ready Excel, and default to this SOP whenever the user asks to crawl a Xiaohongshu link's comments.

This SOP is domain-agnostic by default. Do not assume the note is about wine, alcohol, beauty, hiring, education, or any other category unless the content itself clearly shows that domain.

## Default Trigger
Use this SOP automatically when the user says things like:
- "爬这个链接评论区"
- "抓取这个小红书评论"
- "把这个链接评论整理出来"
- "导出这个笔记评论到 Excel"

Unless the user asks otherwise, the default deliverable is one final Excel on Desktop.

## Inputs
- Xiaohongshu note URL
- Logged-in Chrome for `xiaohongshu-skills`
- Desktop output path
- Semantic batching uses sessions by default
- Batch size: each session handles at most 50 comments, preferably 10-20 for harder comment sets

## Preconditions
- Chrome is logged in to Xiaohongshu
- `xiaohongshu-skills` CLI is available
- Output path is writable
- Do not require `openpyxl`; if unavailable, still produce a valid `.xlsx`

## Output Contract
Always deliver only one final Excel unless the user explicitly asks for raw JSON/CSV/MD.

Default file name:
- `Desktop/xhs_note_<feed_id>_comments.xlsx`

Default columns:
- `评论ID`
- `评论内序号`
- `评论人`
- `用户ID`
- `主题领域`
- `实体1类型`
- `实体1`
- `实体2类型`
- `实体2`
- `实体3类型`
- `实体3`
- `关键信息`
- `评论内容`
- `点赞数`
- `回复数`
- `IP属地`
- `评论时间`
- `格式状态`
- `识别置信度`
- `备注`

If the user asks for a domain-specific schema later, adapt the entity columns into that schema. Otherwise keep the generic schema above.

## Steps
1) Parse URL
   - Extract `feed_id` and `xsec_token` from the note URL.

2) Create project folder
   - Use `sops/xhs_comment_semantic_extract_projects/<feed_id>/`
   - Keep all temp files for this note there.

3) Fetch full comments
   - Always use full-load flags, never the default partial fetch.
   - Command:
     - `python scripts/cli.py get-feed-detail --feed-id <id> --xsec-token <token> --load-all-comments --click-more-replies --scroll-speed slow`
   - This is mandatory because default `get-feed-detail` may return only the currently loaded comments.

4) Verify fetch completeness
   - Compare extracted count with visible page expectation when possible.
   - If the note visibly has more comments than fetched, rerun full fetch before any semantic work.
   - Do not proceed with partial comments unless the user explicitly accepts it.

5) Freeze raw rows once
   - Build one raw ordered row list and store it in the project folder.
   - Preserve at least:
     - `comment_id`
     - `parent_id`
     - `is_subcomment`
     - `commenter`
     - `user_id`
     - `content`
     - `like_count`
     - `reply_count`
     - `ip_location`
     - `create_time`
   - Never rebuild ordering later from a different source.

6) Expand multi-item comments
   - If one comment mentions multiple products, split it into multiple output rows.
   - Keep the same `评论ID`, and use `评论内序号` to preserve the within-comment order.
   - Multi-line list comments and numbered comments must be split before semantic merge.

7) Semantic extraction
   - Extract generic semantics first, not domain-fixed fields.
   - Default output should identify:
     - `主题领域`
     - `实体1类型` / `实体1`
     - `实体2类型` / `实体2`
     - `实体3类型` / `实体3`
     - `关键信息`
     - `格式状态`
     - `识别置信度`
     - `备注`
   - Prefer semantic reading over mechanical delimiter splitting.
   - Handle common patterns:
     - structured tuples such as `A + B + C`
     - phrase-style comments
     - numbered multi-line lists
     - recommendation lists
     - opinion-only comments
     - activity/campaign replies
   - Only map to domain-specific fields such as `国家/品牌/产品名/品类` when the comment content clearly belongs to that domain or the user explicitly asked for that schema.

8) Session-first semantic batching
   - Default to distributing semantic extraction work across sessions.
   - Each session must handle no more than 50 comments.
   - For harder or noisier comment sets, prefer 10-20 comments per session.
   - Merge strictly by `评论ID + 评论内序号`, never by plain list position.
   - If any batch result is missing or duplicated, rerun only the affected rows.

9) Precision guardrails
   - Do not treat delimiter position as truth.
   - Do not assume any default domain.
   - First infer what the comment is about, then extract matching entities.
   - Normalize obvious aliases only when the content clearly supports the normalization.
   - If the extraction is only inferred, lower `识别置信度` and explain in `备注`.
   - If the comment is only a feeling, campaign copy, or non-informational text such as `我要`, mark:
     - `格式状态 = needs_review`
   - Only mark `ok` when the extracted entities are sufficiently supported by the comment text itself.

10) Final review before export
   - Check three things before writing Excel:
     - full comment count fetched
     - multi-item comments properly split
     - obvious brand/product normalization applied
   - If only one Excel is requested, do not leave extra JSON/CSV/MD on Desktop.

11) Write Excel
   - Save one final file to:
     - `Desktop/xhs_note_<feed_id>_comments.xlsx`
   - Prefer Chinese headers by default.
   - If a richer Excel library is unavailable, still create a valid `.xlsx` rather than downgrading to CSV.

12) Cleanup
   - Move temp artifacts into the project folder.
   - Avoid leaving stale temp files in workspace root or Desktop.

## Failure Handling
- If login is invalid: run `python scripts/cli.py login` and scan QR.
- If fetched count is suspiciously low: rerun with `--load-all-comments --click-more-replies --scroll-speed slow`.
- If semantic extraction is not precise enough: rerun only the uncertain rows or batch them across parallel sessions.
- If Excel tooling is missing: generate a standards-compliant `.xlsx` directly; do not block on `openpyxl`.

## Lessons Added From 2026-03-18
- Missing `--load-all-comments` causes incomplete exports.
- Raw export alone is not enough for this workflow; semantic normalization is required.
- Multi-item comments must be split into multiple rows when they mention multiple entities.
- Phrase-style comments need pattern recognition, not just delimiter splitting.
- Semantic extraction should default to session distribution, with each session handling at most 50 comments.
- This SOP must remain domain-agnostic by default; do not silently narrow it to wine, alcohol, or any other vertical.
- Final delivery should be one clean Excel unless the user asks for intermediate files.
