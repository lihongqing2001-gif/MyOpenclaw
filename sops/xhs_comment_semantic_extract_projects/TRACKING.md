# XHS Comment Tracking

This folder stores one project per Xiaohongshu note link.

## Layout
- `<feed_id>/xhs_note_<feed_id>_comments.xlsx` - canonical latest Excel
- `<feed_id>/tracking.json` - link tracking metadata
- `<feed_id>/tmp_*` - raw fetches, batches, intermediate data
- `<feed_id>/session_chunks/` - semantic batch inputs
- `<feed_id>/session_outputs/` - semantic batch outputs

## Tracking Rules
- Reuse the same `<feed_id>` folder on every rerun.
- Update `tracking.json` on each refresh with:
  - `feed_id`
  - `source_url`
  - `last_fetch_time`
  - `latest_comment_count`
  - `previous_comment_count`
  - `new_comment_count`
  - `latest_output`
  - `desktop_mirror` (if a Desktop copy was created)
- If an older version exists, compare comment ids and mark new rows in red in the latest Excel.
- Prefer project-folder delivery by default; mirror to Desktop only when explicitly requested.
- This structure is the basis for future proactive refresh runs.
