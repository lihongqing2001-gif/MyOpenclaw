import argparse
import hashlib
import json
import os
import subprocess
from pathlib import Path
from typing import Any

from _short_video_factory import read_json, write_json, write_text


NOTEBOOKLM_SKILL_DIR = Path("/Users/liumobei/.agents/skills/notebooklm")
NOTEBOOKLM_RUNNER = NOTEBOOKLM_SKILL_DIR / "scripts" / "run.py"
NOTEBOOKLM_VENV_PYTHON = NOTEBOOKLM_SKILL_DIR / ".venv" / "bin" / "python"
NOTEBOOK_MAP_PATH = Path("/Volumes/For Win/01_Projects/AI/mappings/notebooklm-account-map.json")
NOTEBOOK_VALIDATION_PATH = NOTEBOOKLM_SKILL_DIR / "data" / "validation.json"

QUESTION_SET = [
    (
        "stable_structure",
        "基于当前 notebook 中的账号研究包与代表样本，判断这个账号最稳定的内容结构和钩子模式是什么。请区分高频共性与低频偶然，并给出简洁条目。",
    ),
    (
        "common_vs_accidental",
        "基于当前 notebook 中的资料，判断哪些表达或镜头是账号共性，哪些只是单条偶然。再判断当前选中的样本更适合模仿主题、结构、情绪还是镜头，并说明理由。",
    ),
    (
        "rewrite_rules",
        "如果把当前选中的样本改成“我来讲”的版本，必须改掉什么，哪些地方如果保留会显得像抄。请给出明确改写规则。",
    ),
    (
        "enhanced_brief",
        "基于当前 notebook 中的账号研究与 creative context，请输出一版更强的创作建议，至少覆盖：更稳的模仿策略、must_keep_patterns、must_change_patterns、hook 建议、口播段建议、AI 补镜建议。",
    ),
]


def now_iso() -> str:
    from datetime import datetime

    return datetime.now().astimezone().isoformat()


def run_notebooklm_command(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["python3", str(NOTEBOOKLM_RUNNER), *args],
        cwd=NOTEBOOKLM_SKILL_DIR,
        capture_output=True,
        text=True,
        timeout=1800,
    )


def ensure_map_file() -> dict[str, Any]:
    NOTEBOOK_MAP_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not NOTEBOOK_MAP_PATH.exists():
        payload = {"accounts": {}, "updated_at": now_iso()}
        NOTEBOOK_MAP_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return payload
    try:
        return json.loads(NOTEBOOK_MAP_PATH.read_text(encoding="utf-8"))
    except Exception:
        payload = {"accounts": {}, "updated_at": now_iso()}
        NOTEBOOK_MAP_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return payload


def save_map_file(payload: dict[str, Any]) -> None:
    payload["updated_at"] = now_iso()
    NOTEBOOK_MAP_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_validation_state(valid: bool, detail: str) -> None:
    NOTEBOOK_VALIDATION_PATH.parent.mkdir(parents=True, exist_ok=True)
    NOTEBOOK_VALIDATION_PATH.write_text(
        json.dumps(
            {
                "valid": valid,
                "detail": detail,
                "checked_at": now_iso(),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def notebook_key(account_name: str, account_handle: str, platform: str) -> str:
    return f"{platform}::{account_handle or account_name}"


def account_name_from_bundle(bundle: dict[str, Any]) -> str:
    return bundle.get("source_account", {}).get("name", "") or "未命名账号"


def account_handle_from_bundle(bundle: dict[str, Any]) -> str:
    return bundle.get("source_account", {}).get("handle", "") or ""


def notebook_display_name(bundle: dict[str, Any]) -> str:
    return f"短视频对标__{account_name_from_bundle(bundle)}"


def notebook_library_id(display_name: str) -> str:
    return display_name.lower().replace(" ", "-").replace("_", "-")


def hash_files(paths: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in paths:
      digest.update(str(path).encode("utf-8"))
      digest.update(path.read_bytes())
    return digest.hexdigest()


def gather_case_docs(bundle: dict[str, Any], selected_contents: list[dict[str, Any]]) -> str:
    lines = ["# NotebookLM Selected Cases", ""]
    for item in selected_contents:
        lines.extend(
            [
                f"## {item.get('title', item.get('content_id', '未命名样本'))}",
                "",
                f"- 平台：{item.get('platform', '')}",
                f"- 内容ID：{item.get('content_id', '')}",
                f"- 钩子：{item.get('hook', '')}",
                f"- 结构：{item.get('structure', '')}",
                "",
            ]
        )
        report_path = item.get("analysis_report")
        if report_path and Path(report_path).exists():
            lines.append(Path(report_path).read_text(encoding="utf-8"))
            lines.append("")
        analysis_json = item.get("analysis_json")
        if analysis_json and Path(analysis_json).exists():
            payload = read_json(Path(analysis_json))
            lines.append("### 结构化要点")
            lines.append("")
            lines.append(f"- opening_strategy: {payload.get('opening_strategy', '')}")
            lines.append(f"- visual_patterns: {payload.get('visual_patterns', [])}")
            lines.append(f"- reusable_elements: {payload.get('reusable_elements', [])}")
            lines.append("")
    return "\n".join(lines)


def build_source_pack(bundle: dict[str, Any], brief: dict[str, Any], research_bundle_path: Path, creative_brief_path: Path) -> dict[str, Path]:
    research_dir = research_bundle_path.parent / "notebooklm"
    research_dir.mkdir(parents=True, exist_ok=True)

    selected_ids = {item.get("content_id", "") for item in brief.get("source_contents", [])}
    selected_contents = [item for item in bundle.get("source_contents", []) if item.get("content_id", "") in selected_ids] or bundle.get("source_contents", [])[:1]

    account_report_path = research_dir / "notebooklm_source__account_report.md"
    selected_cases_path = research_dir / "notebooklm_source__selected_cases.md"
    creative_context_path = research_dir / "notebooklm_source__creative_context.md"

    account_report_lines = [
        "# NotebookLM Account Report",
        "",
        f"- 账号：{account_name_from_bundle(bundle)}",
        f"- 平台：{selected_contents[0].get('platform', '') if selected_contents else ''}",
        f"- 样本数：{bundle.get('sample_count', 0)}",
        f"- 高频开头：{bundle.get('top_hooks', [])}",
        f"- 高频结构：{bundle.get('structure_patterns', [])}",
        f"- 主题母题：{bundle.get('topic_motifs', [])}",
        f"- 镜头模式：{bundle.get('shot_patterns', [])}",
        "",
    ]
    for key in ["strategy_report", "topic_motifs", "expression_patterns", "shot_patterns", "imitation_card"]:
        report_path = bundle.get("reports", {}).get(key)
        if report_path and Path(report_path).exists():
            account_report_lines.append(Path(report_path).read_text(encoding="utf-8"))
            account_report_lines.append("")
    write_text(account_report_path, "\n".join(account_report_lines))
    write_text(selected_cases_path, gather_case_docs(bundle, selected_contents))

    creative_context_lines = [
        "# NotebookLM Creative Context",
        "",
        f"- 目标平台：{brief.get('target_platform', '')}",
        f"- 创作目标：{brief.get('target_goal', '')}",
        f"- 模仿策略：{brief.get('imitation_strategy', '')}",
        f"- 时长：{brief.get('duration_target', '')}",
        f"- 语气：{brief.get('tone', '')}",
        "",
        "## Must Keep",
        "",
        *[f"- {item}" for item in brief.get("must_keep_patterns", [])],
        "",
        "## Must Change",
        "",
        *[f"- {item}" for item in brief.get("must_change_patterns", [])],
        "",
        "## Human Segments",
        "",
        *[
            f"- {item.get('purpose', '')} · {item.get('duration_sec', '')}s · {item.get('script_focus', '')}"
            for item in brief.get("human_shoot_segments", [])
        ],
        "",
        "## AI B-roll Segments",
        "",
        *[
            f"- {item.get('purpose', '')} · {item.get('duration_sec', '')}s · {item.get('visual_focus', '')}"
            for item in brief.get("ai_broll_segments", [])
        ],
        "",
        "## Original Creative Brief",
        "",
        json.dumps(brief, ensure_ascii=False, indent=2),
    ]
    write_text(creative_context_path, "\n".join(creative_context_lines))

    return {
        "dir": research_dir,
        "account_report": account_report_path,
        "selected_cases": selected_cases_path,
        "creative_context": creative_context_path,
    }


def ensure_notebook_mapping(bundle: dict[str, Any], notebook_url: str, notebook_id: str, source_pack_hash: str) -> dict[str, Any]:
    mapping = ensure_map_file()
    key = notebook_key(
        account_name_from_bundle(bundle),
        account_handle_from_bundle(bundle),
        bundle.get("source_contents", [{}])[0].get("platform", "mixed"),
    )
    display_name = notebook_display_name(bundle)
    library_id = notebook_library_id(display_name)

    result = run_notebooklm_command(
        [
            "notebook_manager.py",
            "add",
            "--url",
            notebook_url,
            "--name",
            display_name,
            "--description",
            f"{account_name_from_bundle(bundle)} 的短视频对标研究与创作增强资料",
            "--topics",
            f"短视频,对标研究,{bundle.get('source_contents', [{}])[0].get('platform', 'mixed')},{account_name_from_bundle(bundle)}",
        ]
    )
    if result.returncode != 0 and "already exists" not in (result.stderr + result.stdout):
        raise RuntimeError(result.stderr or result.stdout or "Failed to add notebook to library")

    activate = run_notebooklm_command(["notebook_manager.py", "activate", "--id", library_id])
    if activate.returncode != 0 and "not found" in (activate.stderr + activate.stdout):
        raise RuntimeError(activate.stderr or activate.stdout or "Failed to activate notebook")

    entry = {
        "account_name": account_name_from_bundle(bundle),
        "account_handle": account_handle_from_bundle(bundle),
        "platform": bundle.get("source_contents", [{}])[0].get("platform", "mixed"),
        "library_notebook_id": library_id,
        "notebook_id": notebook_id,
        "notebook_url": notebook_url,
        "last_synced_at": now_iso(),
        "last_source_pack_hash": source_pack_hash,
    }
    mapping.setdefault("accounts", {})[key] = entry
    save_map_file(mapping)
    return entry


def ensure_notebook(bundle: dict[str, Any], source_files: list[Path], source_pack_hash: str) -> dict[str, Any]:
    mapping = ensure_map_file()
    key = notebook_key(
        account_name_from_bundle(bundle),
        account_handle_from_bundle(bundle),
        bundle.get("source_contents", [{}])[0].get("platform", "mixed"),
    )
    entry = mapping.get("accounts", {}).get(key)
    notebook_url = entry.get("notebook_url", "") if entry else ""
    current_hash = entry.get("last_source_pack_hash", "") if entry else ""

    if notebook_url and current_hash == source_pack_hash:
        return {
            "entry": entry,
            "notebook_created": False,
            "sources_synced": False,
        }

    process = subprocess.run(
        [
            str(NOTEBOOKLM_VENV_PYTHON),
            str(Path(__file__).resolve().parent / "notebooklm_browser_bridge.py"),
            *([] if not notebook_url else ["--notebook-url", notebook_url]),
            "--source-files",
            *[str(path) for path in source_files],
        ],
        cwd=Path(__file__).resolve().parent,
        capture_output=True,
        text=True,
        timeout=2400,
        env={
            **os.environ,
            "PYTHONPATH": f"{NOTEBOOKLM_SKILL_DIR / 'scripts'}:{os.environ.get('PYTHONPATH', '')}",
        },
    )
    if process.returncode != 0:
        raise RuntimeError(process.stderr or process.stdout or "Failed to create or sync NotebookLM notebook")

    payload = json.loads(process.stdout)
    updated_entry = ensure_notebook_mapping(bundle, payload["notebook_url"], payload["notebook_id"], source_pack_hash)
    return {
        "entry": updated_entry,
        "notebook_created": not bool(notebook_url),
        "sources_synced": True,
    }


def extract_answer(stdout: str) -> str:
    separator = "=" * 60
    lines = stdout.splitlines()
    indices = [index for index, line in enumerate(lines) if line.strip() == separator]
    if len(indices) >= 3:
        answer_lines = lines[indices[1] + 1 : indices[2]]
        answer = "\n".join(answer_lines).strip()
    else:
        answer = stdout.strip()
    reminder = (
        "EXTREMELY IMPORTANT: Is that ALL you need to know?"
    )
    if reminder in answer:
        answer = answer.split(reminder, 1)[0].strip()
    return answer


def ask_notebook(bundle: dict[str, Any], notebook_url: str, question: str) -> str:
    result = run_notebooklm_command(["ask_question.py", "--question", question, "--notebook-url", notebook_url])
    if result.returncode != 0:
        raise RuntimeError(result.stderr or result.stdout or "NotebookLM question failed")
    return extract_answer(result.stdout)


def validate_notebooklm_auth() -> None:
    result = run_notebooklm_command(["auth_manager.py", "validate"])
    combined = (result.stdout or "") + (result.stderr or "")
    if result.returncode != 0 or "Authentication is invalid or expired" in combined:
        write_validation_state(False, "NotebookLM authentication is invalid or expired.")
        raise RuntimeError(
            "NotebookLM authentication is invalid or expired. Run `python scripts/run.py auth_manager.py setup` or `reauth` in the notebooklm skill first."
        )
    write_validation_state(True, "NotebookLM authentication is valid.")


def build_summary_markdown(
    bundle: dict[str, Any],
    notebook_entry: dict[str, Any],
    answers: dict[str, str],
    source_pack_paths: dict[str, Path],
) -> str:
    return f"""---
id: notebooklm-summary-{notebook_entry['notebook_id']}
type: reference
evidence: runtime
knowledge_type: case-study
platform: {notebook_entry['platform']}
updated_at: {now_iso()}
---

# NotebookLM 归纳总结

## Notebook

- 账号：{notebook_entry['account_name']}
- 平台：{notebook_entry['platform']}
- notebook_id：{notebook_entry['notebook_id']}
- notebook_url：{notebook_entry['notebook_url']}
- last_synced_at：{notebook_entry['last_synced_at']}

## 稳定结构与钩子

{answers['stable_structure']}

## 共性与偶然

{answers['common_vs_accidental']}

## 改写规则与模仿风险

{answers['rewrite_rules']}

## 创作增强建议

{answers['enhanced_brief']}

## Source Pack

- account_report: {source_pack_paths['account_report']}
- selected_cases: {source_pack_paths['selected_cases']}
- creative_context: {source_pack_paths['creative_context']}
"""


def build_enhanced_brief(
    brief: dict[str, Any],
    notebook_entry: dict[str, Any],
    answers: dict[str, str],
    summary_path: Path,
    source_pack_paths: dict[str, Path],
) -> dict[str, Any]:
    return {
        **brief,
        "notebooklm": {
            "status": "enhanced_brief_ready",
            "notebook_id": notebook_entry["notebook_id"],
            "notebook_url": notebook_entry["notebook_url"],
            "last_synced_at": notebook_entry["last_synced_at"],
            "source_pack": {key: str(value) for key, value in source_pack_paths.items() if key != "dir"},
            "summary_path": str(summary_path),
            "qa": answers,
        },
        "notebooklm_enhancement": {
            "stable_structure_summary": answers["stable_structure"],
            "common_vs_accidental": answers["common_vs_accidental"],
            "rewrite_rules": answers["rewrite_rules"],
            "enhanced_direction": answers["enhanced_brief"],
        },
    }


def build_enhanced_brief_markdown(brief: dict[str, Any], enhanced_brief: dict[str, Any]) -> str:
    enhancement = enhanced_brief["notebooklm_enhancement"]
    return f"""# Creative Brief · NotebookLM 增强版

## 原始策略

- 模仿策略：{brief.get('imitation_strategy', '')}
- 目标平台：{brief.get('target_platform', '')}
- 目标目标：{brief.get('target_goal', '')}

## NotebookLM 增强

### 稳定结构

{enhancement['stable_structure_summary']}

### 共性与偶然

{enhancement['common_vs_accidental']}

### 改写规则

{enhancement['rewrite_rules']}

### 创作增强建议

{enhancement['enhanced_direction']}
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--research-bundle-path", required=True)
    parser.add_argument("--creative-brief-path", required=True)
    args = parser.parse_args()

    research_bundle_path = Path(args.research_bundle_path).expanduser().resolve()
    creative_brief_path = Path(args.creative_brief_path).expanduser().resolve()
    if not research_bundle_path.exists():
        raise SystemExit(f"Research bundle not found: {research_bundle_path}")
    if not creative_brief_path.exists():
        raise SystemExit(f"Creative brief not found: {creative_brief_path}")

    bundle = read_json(research_bundle_path)
    brief = read_json(creative_brief_path)
    validate_notebooklm_auth()

    source_pack_paths = build_source_pack(bundle, brief, research_bundle_path, creative_brief_path)
    source_files = [
        source_pack_paths["account_report"],
        source_pack_paths["selected_cases"],
        source_pack_paths["creative_context"],
    ]
    source_pack_hash = hash_files(source_files)
    notebook = ensure_notebook(bundle, source_files, source_pack_hash)
    notebook_entry = notebook["entry"]

    answers: dict[str, str] = {}
    for key, question in QUESTION_SET:
        answers[key] = ask_notebook(bundle, notebook_entry["notebook_url"], question)

    summary_path = source_pack_paths["dir"] / "notebooklm_summary__runtime.md"
    summary_md = build_summary_markdown(bundle, notebook_entry, answers, source_pack_paths)
    write_text(summary_path, summary_md)

    production_dir = creative_brief_path.parent
    research_notebooklm_dir = source_pack_paths["dir"]
    enhanced_brief_path = research_notebooklm_dir / "notebooklm_enhanced_brief.json"
    enhanced_brief = build_enhanced_brief(brief, notebook_entry, answers, summary_path, source_pack_paths)
    write_json(enhanced_brief_path, enhanced_brief)

    production_brief_json_path = production_dir / "creative_brief__notebooklm.json"
    production_brief_md_path = production_dir / "creative_brief__notebooklm.md"
    write_json(production_brief_json_path, enhanced_brief)
    write_text(production_brief_md_path, build_enhanced_brief_markdown(brief, enhanced_brief))

    knowledge_summary_path = (
        Path(source_pack_paths["dir"]).parents[4]
        / "knowledge"
        / "projects"
        / Path(source_pack_paths["dir"]).parts[5]
        / Path(source_pack_paths["dir"]).parts[6]
    )
    # compute explicit searchable note path using research bundle location
    account_reference_dir = (
        Path(bundle["reports"]["knowledge_reference"]).parent / "notebooklm"
    )
    account_reference_dir.mkdir(parents=True, exist_ok=True)
    knowledge_note_path = account_reference_dir / "notebooklm_summary__runtime.md"
    write_text(knowledge_note_path, summary_md)

    print(
        json.dumps(
            {
                "success": True,
                "notebook_created": notebook["notebook_created"],
                "sources_synced": notebook["sources_synced"],
                "notebook_id": notebook_entry["notebook_id"],
                "notebook_url": notebook_entry["notebook_url"],
                "notebook_status": "enhanced_brief_ready",
                "notebook_source_sync_at": notebook_entry["last_synced_at"],
                "notebooklm_summary": str(summary_path),
                "knowledge_note": str(knowledge_note_path),
                "notebooklm_enhanced_brief": str(enhanced_brief_path),
                "creative_brief_notebooklm": str(production_brief_json_path),
                "creative_brief_notebooklm_md": str(production_brief_md_path),
                "primary_artifact": str(production_brief_md_path),
                "execution_summary": f"已完成 {notebook_entry['account_name']} 的 NotebookLM 归纳，并生成增强版 creative brief。",
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
