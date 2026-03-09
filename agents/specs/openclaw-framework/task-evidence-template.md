# Task Evidence Template

## Fields (JSON)
```
{
  "id": "EV-YYYYMMDD-####",
  "task_id": "<task or ticket id>",
  "task_title": "<short title>",
  "owner": "<name or handle>",
  "created_at": "<ISO 8601>",
  "updated_at": "<ISO 8601>",
  "status": "planned|in_progress|blocked|complete|invalid",
  "environment": {
    "system": "<os/hostname>",
    "repo": "<repo>",
    "branch": "<branch>",
    "commit": "<sha>"
  },
  "scope": {
    "description": "<what was done>",
    "out_of_scope": "<what was not done>"
  },
  "evidence": {
    "artifacts": [
      {
        "type": "log|screenshot|video|report|diff|config|dataset|other",
        "path": "<relative path>",
        "description": "<what this proves>"
      }
    ],
    "tests": [
      {
        "name": "<suite>",
        "command": "<exact command>",
        "result": "pass|fail|skipped",
        "log_path": "<relative path>"
      }
    ]
  },
  "review": {
    "reviewer": "<optional>",
    "notes": "<optional>"
  },
  "signoff": {
    "approved_by": "<optional>",
    "approved_at": "<optional>"
  }
}
```

## Storage Path
```
evidence/
  YYYY/
    YYYY-MM/
      TASKID/
        EV-YYYYMMDD-####/
          evidence.json
          artifacts/
            logs/
            screenshots/
            videos/
            reports/
          tests/
```
