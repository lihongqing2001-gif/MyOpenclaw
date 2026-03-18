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

Default storage location:
- `sops/xhs_comment_semantic_extract_projects/<feed_id>/`

Default file name:
- `xhs_note_<feed_id>_comments.xlsx`

Default columns:
- `评论ID`
- `评论内序号`
- `评论人`
- `用户ID`
- `国家`
- `品牌`
- `产品`
- `评论内容`
- `点赞数`
- `回复数`
- `IP属地`
- `评论时间`
- `格式状态`
- `识别置信度`
- `备注`
- `是否新增`

Even though the SOP is domain-agnostic at the workflow level, the default delivery schema must stay simple and concrete: country, brand, product. Do not switch the user-facing Excel into abstract entity/domain columns unless the user explicitly asks for that.

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
   - Default output must identify:
     - `国家`
     - `品牌`
     - `产品`
     - `格式状态`
     - `识别置信度`
     - `备注`
   - The workflow stays domain-agnostic in how it reads comments, but the user-facing output remains fixed to the concrete fields above.
   - Prefer semantic reading over mechanical delimiter splitting.
   - Handle common patterns:
     - structured tuples such as `A + B + C`
     - phrase-style comments
     - numbered multi-line lists
     - recommendation lists
     - opinion-only comments
     - activity/campaign replies
   - If a comment does not clearly contain country/brand/product, leave unknown fields blank and mark `格式状态 = needs_review`.

8) Session-first semantic batching
   - Default to distributing semantic extraction work across sessions.
   - Do not use local heuristic extraction as the default path.
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

10) Historical comparison and new-comment marking
   - If the same link was processed before, compare the current comment set against the previous saved version for the same `feed_id`.
   - Mark new comments in the final Excel:
     - set `是否新增 = 是`
     - append `新增评论` in `备注` when appropriate
     - render new-comment rows in red if the writer supports formatting
   - If no prior version exists, treat the current run as the baseline.

11) Project management and link tracking
   - Keep every tracked link inside its own project folder:
     - `sops/xhs_comment_semantic_extract_projects/<feed_id>/`
   - Maintain a lightweight tracking file for that link, including at least:
     - source URL
     - latest fetch time
     - latest comment count
     - previous comment count
     - latest output path
     - whether new comments were detected
   - Prefer updating the existing project folder over creating duplicate exports on Desktop.
   - This project structure should support later proactive refresh runs.

12) Final review before export
   - Check these things before writing Excel:
     - full comment count fetched
     - multi-item comments properly split when needed
     - semantic output merged from session results
     - historical comparison performed when prior data exists
   - If only one Excel is requested, do not leave extra JSON/CSV/MD on Desktop.

13) Write Excel
   - Save the canonical final file into the project folder:
     - `sops/xhs_comment_semantic_extract_projects/<feed_id>/xhs_note_<feed_id>_comments.xlsx`
   - Optionally mirror a copy to Desktop only when the user explicitly asks for Desktop delivery.
   - Prefer Chinese headers by default.
   - If a richer Excel library is unavailable, still create a valid `.xlsx` rather than downgrading to CSV.

14) Cleanup
   - Move temp artifacts into the project folder.
   - Avoid leaving stale temp files in workspace root or Desktop.

## Failure Handling
- If login is invalid: run `python scripts/cli.py login` and scan QR.
- If fetched count is suspiciously low: rerun with `--load-all-comments --click-more-replies --scroll-speed slow`.
- If semantic extraction is not precise enough: rerun only the uncertain rows or batch them across parallel sessions.
- Do not fall back to local heuristic-only extraction unless the user explicitly permits it.
- If Excel tooling is missing: generate a standards-compliant `.xlsx` directly; do not block on `openpyxl`.

## Lessons Added From 2026-03-18
- Missing `--load-all-comments` causes incomplete exports.
- Raw export alone is not enough for this workflow; semantic normalization is required.
- Multi-item comments must be split into multiple rows when they mention multiple entities.
- Phrase-style comments need pattern recognition, not just delimiter splitting.
- Semantic extraction should default to session distribution, with each session handling at most 50 comments.
- This SOP must remain domain-agnostic by default; do not silently narrow it to wine, alcohol, or any other vertical.
- Historical comparison should be built in so repeated runs can surface newly added comments.
- Link outputs should live in project folders, not pile up on Desktop, so later proactive refresh is possible.
- Final delivery should be one clean Excel unless the user asks for intermediate files.
