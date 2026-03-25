import json
import os
import re
import shlex
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, Optional


TEXT_DOC_SUFFIXES = {".md", ".json", ".txt", ".log", ".csv"}
ARTIFACT_LABELS = {
    "output_file": "Result File",
    "output_dir": "Result Folder",
    "index_md": "Index Markdown",
    "index_json": "Index JSON",
    "primary_artifact": "Primary Artifact",
    "archive_dir": "Archive Snapshot",
    "manifest": "Archive Manifest",
    "knowledge_note": "Knowledge Note",
}


def normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "", value.lower())


def is_sensitive_input_key(key: str) -> bool:
    normalized = key.lower()
    return any(
        token in normalized
        for token in ["password", "token", "secret", "授权", "密码"]
    )


def redact_input_values(values: Dict[str, Any]) -> Dict[str, Any]:
    redacted: Dict[str, Any] = {}
    for key, value in values.items():
        if is_sensitive_input_key(key) and value:
            redacted[key] = "********"
        else:
            redacted[key] = value
    return redacted


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def parse_leading_json_block(text: str) -> Optional[Dict[str, Any]]:
    source = (text or "").lstrip()
    if not source.startswith("{"):
        return None

    depth = 0
    in_string = False
    escaped = False

    for index, char in enumerate(source):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
            continue
        if char == "{":
            depth += 1
            continue
        if char == "}":
            depth -= 1
            if depth == 0:
                try:
                    parsed = json.loads(source[: index + 1])
                except Exception:
                    return None
                return parsed if isinstance(parsed, dict) else None

    return None


def build_doc_url(target: Path) -> str:
    return f"/api/v1/doc?path={urllib.parse.quote(str(target))}"


def artifact_label(key: str) -> str:
    return ARTIFACT_LABELS.get(key, key.replace("_", " ").title())


def infer_execution_mode(task: Dict[str, Any], command: str) -> str:
    normalized = command.strip()
    node_id = str(task.get("nodeId") or "")

    if normalized.startswith("__OPENCLAW_EVOLUTION__"):
        return "evolution"
    if node_id == "project_file_organize":
        return "asset-organize"
    if node_id == "project_file_index":
        return "asset-index"
    if normalized.startswith("__OPENCLAW_WORKFLOW__"):
        return "workflow"
    if normalized.startswith("/"):
        return "slash"
    if normalized.startswith(("python ", "python3 ", "npm ", "node ", "uv ", "claw ")):
        return "shell"
    return "unknown"


def build_artifact_ref(path_value: str, key: str, primary: bool = False) -> Dict[str, Any]:
    return {
        "path": path_value,
        "key": key,
        "label": artifact_label(key),
        "primary": primary,
    }


def blocker_priority(kind: str) -> str:
    return {
        "asset-root-missing": "p0",
        "permission-denied": "p0",
        "missing-inputs": "p1",
        "invalid-target-path": "p1",
        "timeout": "p1",
        "openclaw-session-failure": "p1",
        "process-error": "p2",
        "qmd-update-warning": "p2",
    }.get(kind, "p2")


def build_blocker(kind: str, detail: str = "", next_action: Optional[str] = None) -> Dict[str, Any]:
    summary_by_kind = {
        "missing-inputs": "Required inputs are missing.",
        "invalid-target-path": "Target directory is missing or outside the managed asset roots.",
        "permission-denied": "The workflow could not access the required files.",
        "timeout": "The workflow exceeded the allowed execution time.",
        "openclaw-session-failure": "OpenClaw orchestration failed before a usable result was produced.",
        "process-error": "The underlying script or command exited with an error.",
        "qmd-update-warning": "The run finished, but qmd indexing did not fully refresh.",
        "asset-root-missing": "No primary external asset root is configured yet.",
        "unknown": "The workflow failed for an uncategorized reason.",
    }
    next_action_by_kind = {
        "missing-inputs": "Fill the missing SOP inputs and run again.",
        "invalid-target-path": "Choose an existing directory inside the configured asset root or a legacy mapped root.",
        "permission-denied": "Adjust permissions or choose a directory the resident agent can read.",
        "timeout": "Narrow the scope or retry after confirming the upstream dependency is responsive.",
        "openclaw-session-failure": "Inspect upstream agent/auth state and retry with a simpler input.",
        "process-error": "Open the runtime lesson and inspect stderr before the next run.",
        "qmd-update-warning": "Re-run qmd update after the knowledge note is written.",
        "asset-root-missing": "Save the recommended asset root in Mission Control before using external intake.",
        "unknown": "Inspect the runtime lesson and command output before retrying.",
    }
    return {
        "kind": kind,
        "summary": summary_by_kind.get(kind, summary_by_kind["unknown"]),
        "detail": detail.strip()[:3000] if detail else "",
        "nextAction": next_action or next_action_by_kind.get(kind, next_action_by_kind["unknown"]),
        "evidenceLevel": "runtime",
    }


def build_decision_state(
    task: Dict[str, Any],
    *,
    success: bool,
    blocker: Optional[Dict[str, Any]] = None,
    parsed_output: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    node_label = str(task.get("nodeLabel") or "Task")
    node_id = str(task.get("nodeId") or "")
    action = str((parsed_output or {}).get("action") or "").lower()

    if blocker:
        return {
            "status": "attention",
            "priority": blocker_priority(str(blocker.get("kind") or "unknown")),
            "reason": blocker.get("summary") or f"{node_label} needs intervention.",
            "nextAction": blocker.get("nextAction") or "Inspect the runtime lesson before retrying.",
        }

    if not success:
        return {
            "status": "attention",
            "priority": "p2",
            "reason": f"{node_label} failed and needs review.",
            "nextAction": "Open the latest runtime lesson and inspect the command output.",
        }

    if node_id == "project_file_organize" and action == "skipped":
        return {
            "status": "watch",
            "priority": "p3",
            "reason": "No file changes were detected, so no new archive snapshot was created.",
            "nextAction": "Only rerun archive after the asset directory changes, or continue with indexing if needed.",
        }

    if node_id == "project_file_organize":
        return {
            "status": "watch",
            "priority": "p2",
            "reason": "Archive snapshot captured. The next useful step is searchable indexing.",
            "nextAction": "Run the indexing step for the same target directory and verify the resulting evidence.",
        }

    if node_id == "project_file_index":
        return {
            "status": "clear",
            "priority": "p3",
            "reason": "Index artifacts are ready for inspection and evidence search.",
            "nextAction": "Open INDEX.md or search for the new runtime evidence in Mission Control.",
        }

    return {
        "status": "clear",
        "priority": "p3",
        "reason": f"{node_label} finished and captured runtime evidence.",
        "nextAction": "Review the artifacts and continue the next downstream SOP.",
    }


def classify_blocker(reason: str, detail: str) -> str:
    combined = f"{reason}\n{detail}".lower()
    if "unresolved placeholders" in combined or "missing required inputs" in combined:
        return "missing-inputs"
    if "target directory not found" in combined or "no such file" in combined:
        return "invalid-target-path"
    if "permission denied" in combined or "operation not permitted" in combined:
        return "permission-denied"
    if "timed out" in combined or "timeout" in combined:
        return "timeout"
    if "openclaw" in combined and ("provider error" in combined or "routing failed" in combined or "session" in combined):
        return "openclaw-session-failure"
    if reason.startswith("process-exit-") or "exit code" in combined:
        return "process-error"
    if "qmd update skipped" in combined or "qmd update failed" in combined:
        return "qmd-update-warning"
    return "unknown"


def detect_business_blocker(
    task: Dict[str, Any],
    output_excerpt: str,
    parsed_output: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    text = output_excerpt.lower()
    node_id = str(task.get("nodeId") or "")
    node_label = str(task.get("nodeLabel") or "")

    email_like = "邮件" in node_label or "email" in node_id.lower() or "inbox" in node_id.lower()
    if email_like:
        email_block_tokens = [
            "未检测到可用的邮箱授权",
            "邮箱接入能力缺失",
            "无法拉取真实邮件",
            "还不能运行到“真实邮件抓取",
            "阻塞点仍是邮箱接入能力缺失",
            "imap",
        ]
        if any(token.lower() in text for token in email_block_tokens):
            return build_blocker(
                "missing-inputs",
                output_excerpt,
                "填写邮箱地址、IMAP 主机、IMAP 端口、用户名、应用专用密码或授权令牌后再重试。",
            )

    generic_block_tokens = [
        "未检测到可用",
        "缺少授权",
        "无法拉取真实",
        "阻塞点",
        "接入能力缺失",
        "cannot access",
        "missing authorization",
        "integration is missing",
    ]
    if any(token in text for token in generic_block_tokens):
        return build_blocker(
            "missing-inputs",
            output_excerpt,
            "先补齐上游接入、授权或必要输入，再重新运行该工作流。",
        )

    return None


def extract_artifact_refs(
    task: Dict[str, Any],
    output_excerpt: str,
    note_path: Optional[Path] = None,
) -> list[Dict[str, Any]]:
    refs: list[Dict[str, Any]] = []
    seen: set[str] = set()
    parsed = parse_leading_json_block(output_excerpt)

    def push(path_value: str, key: str, primary: bool = False) -> None:
        normalized = path_value.strip()
        if not normalized or normalized in seen or not normalized.startswith("/"):
            return
        seen.add(normalized)
        refs.append(build_artifact_ref(normalized, key, primary))

    if parsed:
        for key, value in parsed.items():
            if not isinstance(value, str):
                continue
            if key in {
                "output_file",
                "output_dir",
                "index_md",
                "index_json",
                "primary_artifact",
                "archive_dir",
                "manifest",
                "target_dir",
            }:
                push(
                    value,
                    "output_dir" if key == "target_dir" else key,
                    primary=key in {"output_file", "index_md", "primary_artifact"},
                )

    for match in re.findall(r"/Users/[^\s\"'`]+", output_excerpt):
        suffix = Path(match).suffix.lower()
        key = "output_file" if suffix else "output_dir"
        push(match.rstrip(".,);"), key)

    if note_path:
        push(str(note_path), "knowledge_note")

    return refs


def infer_route_hint(node_label: str, command: str, source_path: str | None) -> str | None:
    text = " ".join(part for part in [node_label, command, source_path or ""]).lower()

    if any(token in text for token in ["日记", "calendar", "trip", "reminder", "个人", "journal"]):
        return "Preferred route: main -> life-assistant for personal management, planning, diary, reminder, and schedule tasks."
    if any(token in text for token in ["xhs", "xiaohongshu", "小红书", "内容", "热点", "模仿", "评论"]):
        return "Preferred route: main -> executor and/or designer for content, crawling, generation, or media-oriented workflows."
    if any(token in text for token in ["ui", "design", "前端", "dashboard", "界面", "体验"]):
        return "Preferred route: main -> designer for UI/UX and presentation work, involving engineer only when implementation changes are needed."
    if any(token in text for token in ["code", "script", "工程", "索引", "归档", "file", "python", "node "]):
        return "Preferred route: main -> engineer for implementation details, using executor only when execution-heavy workflow steps are better separated."
    return "Preferred route: main should choose the best specialized agent instead of solving as a single worker by default."


def is_shell_like_command(command: str) -> bool:
    normalized = command.strip()
    return (
        normalized.startswith("__OPENCLAW_WORKFLOW__")
        or normalized.startswith("__OPENCLAW_EVOLUTION__")
        or
        normalized.startswith("/")
        or normalized.startswith("python ")
        or normalized.startswith("python3 ")
        or normalized.startswith("npm ")
        or normalized.startswith("node ")
        or normalized.startswith("uv ")
        or normalized.startswith("claw ")
    )


class OpenClawResidentAgent:
    def __init__(
        self,
        base_url: str = "http://127.0.0.1:3000",
        agent_id: str = "openclaw-resident-agent",
        heartbeat_interval: float = 5.0,
        poll_interval: float = 2.0,
        openclaw_agent_id: str = "main",
        whatsapp_target: Optional[str] = None,
        internal_console_token: Optional[str] = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.agent_id = agent_id
        self.heartbeat_interval = heartbeat_interval
        self.poll_interval = poll_interval
        self.openclaw_agent_id = openclaw_agent_id
        self.whatsapp_target = whatsapp_target
        self.internal_console_token = (
            (internal_console_token or "").strip()
            or os.environ.get("SOLOCORE_CLOUD_CONSOLE_INTERNAL_TOKEN", "").strip()
            or os.environ.get("OPENCLAW_CLOUD_CONSOLE_INTERNAL_TOKEN", "").strip()
            or os.environ.get("SOLOCORE_INTERNAL_TOKEN", "").strip()
        )
        self.running = True
        self.workspace_root = Path.home() / ".openclaw" / "workspace"
        self.knowledge_root = self.workspace_root / "agents" / "knowledge"

    def _post_json(self, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        headers = {"Content-Type": "application/json"}
        if self.internal_console_token:
            headers["x-solocore-internal-token"] = self.internal_console_token
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))

    def send_heartbeat(self) -> None:
        self._post_json(
            "/api/v1/heartbeat",
            {
                "agentId": self.agent_id,
            },
        )

    def poll_task(self) -> Optional[Dict[str, Any]]:
        response = self._post_json(
            "/api/v1/agent/poll",
            {
                "agentId": self.agent_id,
            },
        )
        return response.get("task")

    def update_task(
        self,
        task_id: str,
        status: str,
        node_status: str,
        result_summary: str,
        result_detail: Optional[str] = None,
        stage: Optional[str] = None,
        evidence_level: Optional[str] = None,
        artifact_refs: Optional[list[Dict[str, Any]]] = None,
        blocker: Optional[Dict[str, Any]] = None,
        decision_state: Optional[Dict[str, Any]] = None,
        runtime_skills_used: Optional[list[Dict[str, Any]]] = None,
        knowledge_payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        payload: Dict[str, Any] = {
            "agentId": self.agent_id,
            "taskId": task_id,
            "status": status,
            "nodeStatus": node_status,
            "resultSummary": result_summary,
        }
        if result_detail is not None:
            payload["resultDetail"] = result_detail
        if stage is not None:
            payload["stage"] = stage
        if evidence_level is not None:
            payload["evidenceLevel"] = evidence_level
        if artifact_refs is not None:
            payload["artifactRefs"] = artifact_refs
        if blocker is not None:
            payload["blocker"] = blocker
        if decision_state is not None:
            payload["decisionState"] = decision_state
        if runtime_skills_used:
            payload["runtimeSkillsUsed"] = runtime_skills_used
        if knowledge_payload is not None:
            payload["knowledgeAction"] = "upsert"
            payload["knowledgePayload"] = knowledge_payload
        self._post_json("/api/v1/agent/task-update", payload)

    def build_knowledge_item(
        self,
        task: Dict[str, Any],
        command: str,
        output_excerpt: str,
        *,
        knowledge_type: str = "case-study",
        summary: Optional[str] = None,
        links: Optional[list[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        task_suffix = task["id"].split("_", 1)[-1]
        node_label = task["nodeLabel"]
        return {
            "id": f"kb_runtime_{task_suffix}",
            "evidenceLevel": "runtime",
            "knowledgeType": knowledge_type,
            "sourceKind": "runtime",
            "updatedAt": now_iso(),
            "human": {
                "title": f"{node_label} 执行产物",
                "summary": summary or f"Resident agent executed `{command}` and captured a runtime artifact.",
                "content_md": (
                    f"# {node_label} 执行结果\n\n"
                    f"- Command: `{command}`\n"
                    f"- Agent: `{self.agent_id}`\n"
                    f"- Result excerpt:\n\n```text\n{output_excerpt}\n```"
                ),
                "tags": ["runtime", "openclaw", node_label],
                "domain": "OpenClaw Runtime",
                "platform": "Resident Agent",
                "links": links or [],
            },
            "machine": {
                "intent": "workflow_runtime",
                "entities": {"nodeId": task["nodeId"]},
                "steps": [
                    "Claim queued task",
                    "Resolve command and inputs",
                    "Execute workflow handler",
                    "Report result back to UI",
                ],
                "commands": [command],
                "constraints": ["Resident agent loop", "Broker mediated"],
            },
        }

    def ensure_knowledge_dirs(self) -> None:
        for subdir in [
            "cases",
            "runtime-lessons",
            "skills",
            "sops",
            "confirmed",
        ]:
            (self.knowledge_root / subdir).mkdir(parents=True, exist_ok=True)

    def write_markdown_file(self, target: Path, content: str) -> None:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    def run_qmd_update(self) -> str:
        try:
            process = subprocess.run(
                ["qmd", "update"],
                cwd=str(self.workspace_root),
                capture_output=True,
                text=True,
                timeout=180,
            )
            output = "\n".join(
                part for part in [process.stdout.strip(), process.stderr.strip()] if part
            ).strip()
            return output or "qmd update completed."
        except Exception as error:
            return f"qmd update skipped: {error}"

    def write_case_note(
        self,
        task: Dict[str, Any],
        command: str,
        output_excerpt: str,
        knowledge_type: str = "case-study",
        artifact_refs: Optional[list[Dict[str, Any]]] = None,
        decision_state: Optional[Dict[str, Any]] = None,
    ) -> Path:
        self.ensure_knowledge_dirs()
        target = self.knowledge_root / "cases" / f"{task['id']}.md"
        context = task.get("context") or {}
        content = f"""---
id: {task['id']}
type: case
evidence: runtime
knowledge_type: {knowledge_type}
node_id: {task['nodeId']}
execution_mode: {infer_execution_mode(task, command)}
updated_at: {now_iso()}
---

# {task['nodeLabel']} 运行案例

## Command

`{command}`

## Inputs

```json
{json.dumps(redact_input_values(context.get('inputValues') or {}), ensure_ascii=False, indent=2)}
```

## Artifacts

```json
{json.dumps(artifact_refs or [], ensure_ascii=False, indent=2)}
```

## Decision

```json
{json.dumps(decision_state or {}, ensure_ascii=False, indent=2)}
```

## Result

```text
{output_excerpt}
```
"""
        self.write_markdown_file(target, content)
        return target

    def write_runtime_lesson(
        self,
        task: Dict[str, Any],
        command: str,
        output_excerpt: str,
        reason: str,
        artifact_refs: Optional[list[Dict[str, Any]]] = None,
        blocker: Optional[Dict[str, Any]] = None,
    ) -> Path:
        self.ensure_knowledge_dirs()
        target = self.knowledge_root / "runtime-lessons" / f"{task['id']}.md"
        context = task.get("context") or {}
        content = f"""---
id: {task['id']}
type: runtime-lesson
evidence: runtime
knowledge_type: runtime-lesson
node_id: {task['nodeId']}
execution_mode: {infer_execution_mode(task, command)}
updated_at: {now_iso()}
---

# {task['nodeLabel']} 运行教训

## Reason

{reason}

## Blocker

```json
{json.dumps(blocker or {}, ensure_ascii=False, indent=2)}
```

## Command

`{command}`

## Inputs

```json
{json.dumps(context.get('inputValues') or {}, ensure_ascii=False, indent=2)}
```

## Artifacts

```json
{json.dumps(artifact_refs or [], ensure_ascii=False, indent=2)}
```

## Output

```text
{output_excerpt}
```
"""
        self.write_markdown_file(target, content)
        return target

    def knowledge_links_from_artifacts(
        self,
        artifact_refs: list[Dict[str, Any]],
    ) -> list[Dict[str, str]]:
        links: list[Dict[str, str]] = []
        for ref in artifact_refs:
            path_value = ref.get("path")
            if not isinstance(path_value, str):
                continue
            target = Path(path_value)
            if target.suffix.lower() in TEXT_DOC_SUFFIXES:
                links.append(
                    {
                        "title": ref.get("label") or target.name,
                        "url": build_doc_url(target),
                    }
                )
        return links

    def parse_xiaohongshu_url(self, url: str) -> Dict[str, str]:
        parsed = urllib.parse.urlparse(url)
        query = urllib.parse.parse_qs(parsed.query)
        match = re.search(r"/explore/([^/?#]+)", parsed.path)
        if not match:
            raise ValueError("Could not extract feed_id from Xiaohongshu URL")
        feed_id = match.group(1)
        xsec_token = query.get("xsec_token", [""])[0]
        if not xsec_token:
            raise ValueError("Could not extract xsec_token from Xiaohongshu URL")
        return {"id": feed_id, "token": xsec_token}

    def build_input_aliases(self, task: Dict[str, Any]) -> Dict[str, str]:
        aliases: Dict[str, str] = {}
        context = task.get("context") or {}
        input_values = context.get("inputValues") or {}
        input_schema = context.get("inputSchema") or []

        for item in input_schema:
            if not isinstance(item, dict):
                continue
            field = item.get("field")
            default_value = item.get("defaultValue")
            if not isinstance(field, str) or not isinstance(default_value, str):
                continue
            key = normalize_key(field)
            if key and default_value.strip():
                aliases[key] = default_value.strip()

        for raw_key, raw_value in input_values.items():
            if not isinstance(raw_value, str):
                continue
            value = raw_value.strip()
            if not value:
                continue
            aliases[normalize_key(raw_key)] = value

        # Bridge common URL field variants so renamed drawer labels keep older commands working.
        url_alias_groups = [
            ["视频链接", "收藏视频链接", "短视频链接"],
            ["笔记链接", "小红书链接", "noteurl"],
        ]
        for group in url_alias_groups:
            resolved = next((aliases.get(normalize_key(name)) for name in group if aliases.get(normalize_key(name))), None)
            if not resolved:
                continue
            for name in group:
                aliases.setdefault(normalize_key(name), resolved)

        note_url = next(
            (
                value
                for key, value in aliases.items()
                if "url" in key and "xiaohongshu" in value.lower()
            ),
            None,
        )
        if note_url:
            try:
                parsed = self.parse_xiaohongshu_url(note_url)
                aliases["id"] = parsed["id"]
                aliases["token"] = parsed["token"]
                aliases["feedid"] = parsed["id"]
                aliases["xsectoken"] = parsed["token"]
            except ValueError:
                pass

        return aliases

    def strip_optional_placeholder_segments(self, command: str, task: Dict[str, Any]) -> str:
        context = task.get("context") or {}
        input_schema = context.get("inputSchema") or []
        trimmed = command

        for item in input_schema:
            if not isinstance(item, dict):
                continue

            field = item.get("field")
            required = bool(item.get("required"))
            if not isinstance(field, str) or required:
                continue

            raw_value = (context.get("inputValues") or {}).get(field)
            default_value = item.get("defaultValue")
            has_value = isinstance(raw_value, str) and raw_value.strip()
            has_default = isinstance(default_value, str) and default_value.strip()
            if has_value or has_default:
                continue

            escaped = re.escape(f"<{field}>")
            trimmed = re.sub(
                rf"\s+--[a-zA-Z0-9_-]+\s+{escaped}",
                "",
                trimmed,
            )
            trimmed = re.sub(
                rf"\s+{escaped}",
                "",
                trimmed,
            )

        return re.sub(r"\s+", " ", trimmed).strip()

    def replace_placeholders(self, command: str, aliases: Dict[str, str]) -> str:
        shell_mode = not command.strip().startswith("/")

        def repl(match: re.Match[str]) -> str:
            key = normalize_key(match.group(1))
            value = aliases.get(key)
            if value is None:
                return match.group(0)
            return shlex.quote(value) if shell_mode else value

        return re.sub(r"<([^>]+)>", repl, command)

    def resolve_cwd(self, task: Dict[str, Any]) -> Optional[str]:
        context = task.get("context") or {}
        required_skills = context.get("requiredSkills") or []
        for module in required_skills:
            source_path = module.get("sourcePath")
            if source_path:
                return str(Path(source_path).parent)

        source_path = context.get("sourcePath")
        if source_path:
            return str(Path(source_path).parent)
        return None

    def infer_runtime_skills(
        self,
        task: Dict[str, Any],
        command: str,
        cwd: Optional[str],
    ) -> list[Dict[str, Any]]:
        context = task.get("context") or {}
        required_skills = context.get("requiredSkills") or []
        runtime_skills: list[Dict[str, Any]] = []

        cwd_path = Path(cwd).resolve() if cwd else None
        for module in required_skills:
            if not isinstance(module, dict):
                continue

            evidence = module.get("evidence")
            source_type = module.get("sourceType")
            source_path = module.get("sourcePath")
            label = module.get("label")

            confirmed = False
            if source_type == "skill" and source_path and cwd_path:
                skill_dir = Path(source_path).resolve().parent
                confirmed = cwd_path == skill_dir or skill_dir in cwd_path.parents
            elif source_type == "foundation" and evidence == "declared":
                confirmed = False
            elif label and label.lower() in command.lower():
                confirmed = True

            if confirmed:
                runtime_skills.append(
                    {
                        **module,
                        "evidence": "runtime",
                    }
                )

        return runtime_skills

    def normalize_shell_command(self, command: str) -> str:
        command = command.strip()
        if command.startswith("python "):
            return "python3 " + command[len("python ") :]
        return command

    def unresolved_placeholders(self, command: str) -> list[str]:
        return re.findall(r"<([^>]+)>", command)

    def run_shell_command(
        self,
        command: str,
        cwd: Optional[str],
    ) -> subprocess.CompletedProcess[str]:
        return self.run_subprocess(
            command,
            shell=True,
            cwd=cwd,
            timeout=600,
        )

    def run_subprocess(
        self,
        args: Any,
        *,
        shell: bool = False,
        cwd: Optional[str] = None,
        timeout: int = 600,
    ) -> subprocess.CompletedProcess[str]:
        process = subprocess.Popen(
            args,
            shell=shell,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        start = time.monotonic()
        next_heartbeat = start + self.heartbeat_interval

        while process.poll() is None:
            now = time.monotonic()
            if now >= next_heartbeat:
                try:
                    self.send_heartbeat()
                except Exception:
                    pass
                next_heartbeat = now + self.heartbeat_interval

            if now - start > timeout:
                process.kill()
                stdout, stderr = process.communicate()
                raise subprocess.TimeoutExpired(args, timeout, stdout, stderr)

            time.sleep(0.5)

        stdout, stderr = process.communicate()
        return subprocess.CompletedProcess(
            args=args,
            returncode=process.returncode or 0,
            stdout=stdout,
            stderr=stderr,
        )

    def run_openclaw_command(self, command: str) -> subprocess.CompletedProcess[str]:
        return self.run_subprocess(
            [
                "openclaw",
                "agent",
                "--agent",
                self.openclaw_agent_id,
                "--message",
                command,
                "--json",
                "--timeout",
                "120",
            ],
            timeout=180,
        )

    def detect_whatsapp_target(self) -> Optional[str]:
        if self.whatsapp_target:
            return self.whatsapp_target

        try:
            process = subprocess.run(
                ["openclaw", "directory", "self", "--channel", "whatsapp"],
                capture_output=True,
                text=True,
                timeout=30,
            )
            output = "\n".join(part for part in [process.stdout, process.stderr] if part)
            match = re.search(r"\+\d{8,20}", output)
            if match:
                self.whatsapp_target = match.group(0)
        except Exception:
            self.whatsapp_target = None

        return self.whatsapp_target

    def send_whatsapp_message(self, message: str) -> None:
        target = self.detect_whatsapp_target()
        if not target:
            return

        subprocess.run(
            [
                "openclaw",
                "message",
                "send",
                "--channel",
                "whatsapp",
                "--target",
                target,
                "--message",
                message,
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )

    def analyze_openclaw_result(
        self, process: subprocess.CompletedProcess[str]
    ) -> tuple[bool, str]:
        stdout = (process.stdout or "").strip()
        stderr = (process.stderr or "").strip()
        combined = "\n".join(part for part in [stdout, stderr] if part).strip()

        try:
          data = json.loads(stdout) if stdout else {}
        except Exception:
          data = {}

        payload_texts: list[str] = []
        if isinstance(data, dict):
            payloads = (
                data.get("result", {}).get("payloads", [])
                if isinstance(data.get("result"), dict)
                else []
            )
            for payload in payloads:
                if isinstance(payload, dict) and payload.get("text"):
                    payload_texts.append(str(payload["text"]))

        text_blob = "\n".join(payload_texts + [combined]).lower()
        aborted = bool(data.get("result", {}).get("meta", {}).get("aborted")) if isinstance(data, dict) else False
        summary = str(data.get("summary", "")).lower() if isinstance(data, dict) else ""

        if process.returncode != 0:
            return False, combined or "OpenClaw command failed."
        if aborted:
            return False, combined or "OpenClaw task aborted."
        if "error occurred while processing your request" in text_blob:
            return False, combined or "OpenClaw upstream provider error."
        if "all models failed" in text_blob:
            return False, combined or "OpenClaw model routing failed."
        if summary and summary != "completed":
            return False, combined or f"OpenClaw returned summary={summary}."

        return True, combined or "OpenClaw task completed."

    def looks_like_bootstrap_reply(self, text: str) -> bool:
        lowered = text.lower()
        return any(
            token in lowered
            for token in [
                "bootstrap.md",
                "who am i",
                "what should i call you",
                "identity setup",
                "memory.md",
                "tell me these",
            ]
        )

    def build_openclaw_prompt(
        self,
        task: Dict[str, Any],
        command: str,
        cwd: Optional[str],
    ) -> str:
        context = task.get("context") or {}
        input_values = context.get("inputValues") or {}
        required_skills = context.get("requiredSkills") or []
        skill_labels = [
            skill.get("label")
            for skill in required_skills
            if isinstance(skill, dict) and skill.get("label")
        ]
        task_session = f"openclaw-web-task-{task['id']}"
        lines = [
            "SYSTEM TASK FROM OPENCLAW WEB CONTROL.",
            "Do not do bootstrap, identity setup, memory setup, or small talk.",
            "Treat this as an app-dispatched operational task.",
            "You are the MAIN orchestration entrypoint for OpenClaw, not a single-purpose worker.",
            "Do not personally brute-force every task if another specialized agent is more appropriate.",
            "Route or delegate according to workspace rules, AGENTS.md, task type, and required capabilities.",
            "Use engineer only for genuine engineering implementation tasks. Use other agents when the task is better matched elsewhere.",
            f"Task session id: {task_session}",
            f"Node label: {task['nodeLabel']}",
            f"Command: {command}",
        ]
        if cwd:
            lines.append(f"Working directory: {cwd}")
        source_path = context.get("sourcePath")
        if source_path:
            lines.append(f"Primary reference document: {source_path}")
        route = context.get("route") or {}
        if isinstance(route, dict):
            orchestrator = route.get("orchestrator")
            preferred_agents = route.get("preferredAgents") or []
            reason = route.get("reason")
            if orchestrator:
                lines.append(f"Declared orchestrator: {orchestrator}")
            if preferred_agents:
                lines.append(
                    "Declared preferred agents: "
                    + ", ".join(str(item) for item in preferred_agents)
                )
            if reason:
                lines.append(f"Routing rationale: {reason}")
        route_hint = infer_route_hint(task["nodeLabel"], command, source_path)
        if route_hint:
            lines.append(route_hint)
        if command.startswith("__OPENCLAW_EVOLUTION__"):
            lines.extend(
                [
                    "This is an automatic self-evolution task triggered by explicit user feedback.",
                    "You must read the feedback and evolution notes, then immediately apply the smallest safe improvement you can in the relevant workspace.",
                ]
            )
            if context.get("feedbackPath"):
                lines.append(f"Feedback note: {context.get('feedbackPath')}")
            if context.get("evolutionPath"):
                lines.append(f"Evolution note: {context.get('evolutionPath')}")
            if context.get("originalTaskId"):
                lines.append(f"Original task id: {context.get('originalTaskId')}")
            if context.get("originalResultSummary"):
                lines.append(f"Original result summary: {context.get('originalResultSummary')}")
            artifact_paths = context.get("artifactPaths") or []
            if artifact_paths:
                lines.append(
                    "Artifacts: " + ", ".join(str(item) for item in artifact_paths[:8])
                )
        if skill_labels:
            lines.append(f"Required skills: {', '.join(skill_labels)}")
        if input_values:
            lines.append(f"Input values: {json.dumps(input_values, ensure_ascii=False)}")
        lines.extend(
            [
                "If the command is a shell/python command, execute it with tools in the correct working directory.",
                "If the command begins with '/', treat it as an OpenClaw workflow command and solve it accordingly.",
                "If the command begins with '__OPENCLAW_WORKFLOW__', ignore the literal command string and instead use the source document plus input values to complete the workflow.",
                "If the command begins with '__OPENCLAW_EVOLUTION__', ignore the literal command string and instead update the relevant workflow/app based on the feedback note and evolution note.",
                "Prefer orchestrating the best-suited agent(s) instead of making MAIN behave like ENGINEER by default.",
                "When possible, produce the actual deliverable, not just advice.",
                "Return a concise human-readable execution summary with the real result.",
            ]
        )
        return "\n".join(lines)

    def run_openclaw_session_task(
        self,
        task: Dict[str, Any],
        command: str,
        cwd: Optional[str],
    ) -> subprocess.CompletedProcess[str]:
        target = self.detect_whatsapp_target()
        args = [
            "openclaw",
            "agent",
            "--agent",
            self.openclaw_agent_id,
            "--session-id",
            f"openclaw-web-task-{task['id']}",
            "--message",
            self.build_openclaw_prompt(task, command, cwd),
            "--json",
            "--timeout",
            "180",
        ]
        if target:
            args.extend(
                [
                    "--deliver",
                    "--reply-channel",
                    "whatsapp",
                    "--reply-to",
                    target,
                ]
            )

        return self.run_subprocess(args, timeout=240)

    def execute_task(self, task: Dict[str, Any]) -> None:
        task_id = task["id"]
        raw_command = task["command"]
        node_label = task["nodeLabel"]
        execution_mode = infer_execution_mode(task, raw_command)
        print(f"[agent] executing {node_label}: {raw_command}")
        self.update_task(
            task_id,
            status="running",
            node_status="running",
            result_summary=f"{node_label} is now running on {self.agent_id}.",
            stage="orchestrating"
            if execution_mode in {"workflow", "evolution", "slash"}
            else "executing",
            evidence_level="declared",
        )

        aliases = self.build_input_aliases(task)
        command = self.replace_placeholders(raw_command, aliases)
        command = self.strip_optional_placeholder_segments(command, task)
        cwd = self.resolve_cwd(task)

        unresolved = self.unresolved_placeholders(command)
        if unresolved:
            blocker = build_blocker(
                "missing-inputs",
                f"Unresolved placeholders: {', '.join(unresolved)}",
            )
            lesson_path = self.write_runtime_lesson(
                task,
                raw_command,
                f"Unresolved placeholders: {', '.join(unresolved)}",
                "missing-inputs",
                blocker=blocker,
            )
            artifact_refs = extract_artifact_refs(
                task,
                f"Knowledge note: {lesson_path}",
                lesson_path,
            )
            qmd_result = self.run_qmd_update()
            decision_state = build_decision_state(
                task,
                success=False,
                blocker=blocker,
            )
            self.update_task(
                task_id,
                status="failed",
                node_status="error",
                result_summary=f"{node_label} is missing required inputs: {', '.join(unresolved)}.",
                result_detail=(
                    "Fill the SOP input fields in the drawer before running this workflow. "
                    f"Unresolved placeholders: {', '.join(unresolved)}\n\n"
                    f"Knowledge note: {lesson_path}\n{qmd_result}"
                ),
                stage="failed",
                evidence_level="runtime",
                artifact_refs=artifact_refs,
                blocker=blocker,
                decision_state=decision_state,
                knowledge_payload=self.build_knowledge_item(
                    task,
                    raw_command,
                    f"Missing inputs: {', '.join(unresolved)}\nKnowledge note: {lesson_path}",
                    knowledge_type="runtime-lesson",
                    summary=f"{node_label} was blocked because required inputs were missing.",
                    links=self.knowledge_links_from_artifacts(artifact_refs),
                ),
            )
            print(f"[agent] blocked {node_label}: missing inputs {unresolved}")
            return

        try:
            openclaw_process = self.run_openclaw_session_task(task, command, cwd)
        except subprocess.TimeoutExpired:
            blocker = build_blocker("timeout", "The workflow exceeded the execution timeout.")
            decision_state = build_decision_state(task, success=False, blocker=blocker)
            self.update_task(
                task_id,
                status="failed",
                node_status="error",
                result_summary=f"{node_label} timed out during execution.",
                result_detail="The workflow exceeded the execution timeout.",
                stage="failed",
                evidence_level="runtime",
                blocker=blocker,
                decision_state=decision_state,
            )
            print(f"[agent] timeout {node_label}")
            return
        except Exception as error:
            blocker = build_blocker("unknown", str(error))
            decision_state = build_decision_state(task, success=False, blocker=blocker)
            self.update_task(
                task_id,
                status="failed",
                node_status="error",
                result_summary=f"{node_label} crashed before completion.",
                result_detail=str(error),
                stage="failed",
                evidence_level="runtime",
                blocker=blocker,
                decision_state=decision_state,
            )
            print(f"[agent] unexpected failure {node_label}: {error}")
            return

        openclaw_stdout = (openclaw_process.stdout or "").strip()
        openclaw_stderr = (openclaw_process.stderr or "").strip()
        openclaw_combined = "\n".join(
            part for part in [openclaw_stdout, openclaw_stderr] if part
        ).strip()
        openclaw_ok, openclaw_assessment = self.analyze_openclaw_result(
            openclaw_process
        )

        local_process: Optional[subprocess.CompletedProcess[str]] = None
        if (
            not openclaw_ok
            or self.looks_like_bootstrap_reply(openclaw_combined)
        ):
            try:
                if command.startswith("__OPENCLAW_WORKFLOW__") or command.startswith("__OPENCLAW_EVOLUTION__"):
                    local_process = None
                elif command.startswith("/"):
                    local_process = self.run_openclaw_command(command)
                else:
                    local_process = self.run_shell_command(
                        self.normalize_shell_command(command),
                        cwd,
                    )
            except subprocess.TimeoutExpired:
                blocker = build_blocker(
                    "timeout",
                    openclaw_combined[:3000] or "OpenClaw session fallback timed out.",
                )
                decision_state = build_decision_state(
                    task,
                    success=False,
                    blocker=blocker,
                )
                self.update_task(
                    task_id,
                    status="failed",
                    node_status="error",
                    result_summary=f"{node_label} timed out during fallback execution.",
                    result_detail=openclaw_combined[:3000] or "OpenClaw session fallback timed out.",
                    stage="failed",
                    evidence_level="runtime",
                    blocker=blocker,
                    decision_state=decision_state,
                )
                self.send_whatsapp_message(
                    f"[OpenClaw Web] {node_label} failed: fallback execution timed out."
                )
                return
            except Exception as error:
                blocker = build_blocker(
                    "unknown",
                    f"{openclaw_combined[:2000]}\n\nFallback error: {error}",
                )
                decision_state = build_decision_state(
                    task,
                    success=False,
                    blocker=blocker,
                )
                self.update_task(
                    task_id,
                    status="failed",
                    node_status="error",
                    result_summary=f"{node_label} failed before fallback execution.",
                    result_detail=f"{openclaw_combined[:2000]}\n\nFallback error: {error}",
                    stage="failed",
                    evidence_level="runtime",
                    blocker=blocker,
                    decision_state=decision_state,
                )
                self.send_whatsapp_message(
                    f"[OpenClaw Web] {node_label} failed before fallback execution: {error}"
                )
                return

        process = local_process or openclaw_process
        runtime_skills_used = self.infer_runtime_skills(task, command, cwd)
        stdout = (process.stdout or "").strip()
        stderr = (process.stderr or "").strip()
        combined_output = "\n".join(part for part in [stdout, stderr] if part).strip()
        output_excerpt = combined_output[:3000] if combined_output else "No output captured."
        parsed_output = parse_leading_json_block(output_excerpt)

        if local_process is None and not openclaw_ok:
            blocker = build_blocker(
                "openclaw-session-failure",
                openclaw_assessment[:3000],
            )
            lesson_path = self.write_runtime_lesson(
                task,
                command,
                openclaw_assessment[:3000],
                "openclaw-session-failure",
                blocker=blocker,
            )
            artifact_refs = extract_artifact_refs(
                task,
                openclaw_assessment[:3000],
                lesson_path,
            )
            qmd_result = self.run_qmd_update()
            decision_state = build_decision_state(
                task,
                success=False,
                blocker=blocker,
            )
            self.update_task(
                task_id,
                status="failed",
                node_status="error",
                result_summary=f"{node_label} failed in OpenClaw session execution.",
                result_detail=f"{openclaw_assessment[:3000]}\n\nKnowledge note: {lesson_path}\n{qmd_result}",
                stage="failed",
                evidence_level="runtime",
                artifact_refs=artifact_refs,
                blocker=blocker,
                decision_state=decision_state,
                runtime_skills_used=runtime_skills_used,
                knowledge_payload=self.build_knowledge_item(
                    task,
                    command,
                    openclaw_assessment[:3000],
                    knowledge_type="runtime-lesson",
                    summary=f"{node_label} failed during OpenClaw session execution.",
                    links=self.knowledge_links_from_artifacts(artifact_refs),
                ),
            )
            self.send_whatsapp_message(
                f"[OpenClaw Web] {node_label} failed.\n\n{openclaw_assessment[:1200]}"
            )
            print(f"[agent] failed {node_label}: openclaw session assessment")
            return

        if process.returncode != 0:
            blocker = build_blocker(
                classify_blocker(f"process-exit-{process.returncode}", output_excerpt),
                output_excerpt,
            )
            lesson_path = self.write_runtime_lesson(
                task,
                command,
                output_excerpt,
                f"process-exit-{process.returncode}",
                blocker=blocker,
            )
            artifact_refs = extract_artifact_refs(task, output_excerpt, lesson_path)
            qmd_result = self.run_qmd_update()
            decision_state = build_decision_state(
                task,
                success=False,
                blocker=blocker,
                parsed_output=parsed_output,
            )
            self.update_task(
                task_id,
                status="failed",
                node_status="error",
                result_summary=f"{node_label} failed with exit code {process.returncode}.",
                result_detail=f"{output_excerpt}\n\nKnowledge note: {lesson_path}\n{qmd_result}",
                stage="failed",
                evidence_level="runtime",
                artifact_refs=artifact_refs,
                blocker=blocker,
                decision_state=decision_state,
                runtime_skills_used=runtime_skills_used,
                knowledge_payload=self.build_knowledge_item(
                    task,
                    command,
                    output_excerpt,
                    knowledge_type="runtime-lesson",
                    summary=f"{node_label} failed during command execution.",
                    links=self.knowledge_links_from_artifacts(artifact_refs),
                ),
            )
            self.send_whatsapp_message(
                f"[OpenClaw Web] {node_label} failed.\n\n{output_excerpt[:1200]}"
            )
            print(f"[agent] failed {node_label}: exit {process.returncode}")
            return

        business_blocker = detect_business_blocker(
            task,
            output_excerpt,
            parsed_output=parsed_output,
        )
        if business_blocker:
            lesson_path = self.write_runtime_lesson(
                task,
                command,
                output_excerpt,
                "business-blocked",
                blocker=business_blocker,
            )
            artifact_refs = extract_artifact_refs(task, output_excerpt, lesson_path)
            qmd_result = self.run_qmd_update()
            decision_state = build_decision_state(
                task,
                success=False,
                blocker=business_blocker,
                parsed_output=parsed_output,
            )
            self.update_task(
                task_id,
                status="failed",
                node_status="error",
                result_summary=f"{node_label} blocked before the intended business outcome was achieved.",
                result_detail=f"{output_excerpt}\n\nKnowledge note: {lesson_path}\n{qmd_result}",
                stage="failed",
                evidence_level="runtime",
                artifact_refs=artifact_refs,
                blocker=business_blocker,
                decision_state=decision_state,
                runtime_skills_used=runtime_skills_used,
                knowledge_payload=self.build_knowledge_item(
                    task,
                    command,
                    output_excerpt,
                    knowledge_type="runtime-lesson",
                    summary=f"{node_label} ran, but the intended business outcome was blocked.",
                    links=self.knowledge_links_from_artifacts(artifact_refs),
                ),
            )
            self.send_whatsapp_message(
                f"[OpenClaw Web] {node_label} blocked.\n\n{output_excerpt[:1200]}"
            )
            print(f"[agent] blocked {node_label}: business blocker detected")
            return

        decision_state = build_decision_state(
            task,
            success=True,
            parsed_output=parsed_output,
        )
        initial_artifact_refs = extract_artifact_refs(task, output_excerpt)
        case_path = self.write_case_note(
            task,
            command,
            output_excerpt,
            knowledge_type="asset-index" if execution_mode == "asset-index" else "case-study",
            artifact_refs=initial_artifact_refs,
            decision_state=decision_state,
        )
        artifact_refs = extract_artifact_refs(task, output_excerpt, case_path)
        qmd_result = self.run_qmd_update()
        result_summary = (
            str((parsed_output or {}).get("execution_summary") or "").strip()
            or str((parsed_output or {}).get("message") or "").strip()
        )
        if execution_mode == "asset-organize" and str((parsed_output or {}).get("action") or "").lower() == "skipped":
            result_summary = (
                f"{node_label} found no changes. The latest archive snapshot already matches the target."
            )
        if not result_summary:
            result_summary = f"{node_label} finished successfully."
        knowledge_item = self.build_knowledge_item(
            task,
            command,
            f"{output_excerpt}\n\nKnowledge note: {case_path}\n{qmd_result}",
            knowledge_type="asset-index" if execution_mode == "asset-index" else "case-study",
            summary=result_summary,
            links=self.knowledge_links_from_artifacts(artifact_refs),
        )
        self.update_task(
            task_id,
            status="completed",
            node_status="idle",
            result_summary=result_summary,
            result_detail=f"{output_excerpt}\n\nKnowledge note: {case_path}\n{qmd_result}",
            stage="completed",
            evidence_level="runtime",
            artifact_refs=artifact_refs,
            decision_state=decision_state,
            runtime_skills_used=runtime_skills_used,
            knowledge_payload=knowledge_item,
        )
        if local_process is not None:
            self.send_whatsapp_message(
                f"[OpenClaw Web] {node_label} completed via fallback execution.\n\n{output_excerpt[:1200]}"
            )
        print(f"[agent] completed {node_label}")

    def run(self) -> None:
        print(f"[agent] starting resident agent `{self.agent_id}` -> {self.base_url}")
        next_heartbeat_at = 0.0

        while self.running:
            now = time.monotonic()
            try:
                if now >= next_heartbeat_at:
                    self.send_heartbeat()
                    next_heartbeat_at = now + self.heartbeat_interval

                task = self.poll_task()
                if task is not None:
                    self.execute_task(task)
                    next_heartbeat_at = 0.0
                    continue
            except urllib.error.URLError as error:
                print(f"[agent] broker unavailable: {error}")
                next_heartbeat_at = 0.0
            except Exception as error:
                print(f"[agent] unexpected error: {error}")

            time.sleep(self.poll_interval)

        print("[agent] shutdown complete")

    def stop(self, *_args: Any) -> None:
        self.running = False


def main() -> int:
    agent = OpenClawResidentAgent(
        base_url=os.environ.get("OPENCLAW_BASE_URL", "http://127.0.0.1:3000"),
        agent_id=os.environ.get("OPENCLAW_AGENT_ID", "openclaw-resident-agent"),
        openclaw_agent_id=os.environ.get("OPENCLAW_EXECUTOR_AGENT", "main"),
        whatsapp_target=os.environ.get("OPENCLAW_WHATSAPP_TARGET"),
    )
    signal.signal(signal.SIGINT, agent.stop)
    signal.signal(signal.SIGTERM, agent.stop)
    agent.run()
    return 0


if __name__ == "__main__":
    sys.exit(main())
