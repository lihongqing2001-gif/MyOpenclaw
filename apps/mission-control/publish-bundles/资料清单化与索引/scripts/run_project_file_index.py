import argparse
import json
from datetime import datetime
from pathlib import Path


def classify_file(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".md", ".txt"}:
        return "文档"
    if suffix in {".json"}:
        return "数据"
    if suffix in {".html"}:
        return "页面"
    if suffix in {".py", ".ts", ".js", ".sh"}:
        return "脚本"
    return "文件"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target-dir", required=True)
    args = parser.parse_args()

    target_dir = Path(args.target_dir).expanduser().resolve()
    if not target_dir.exists() or not target_dir.is_dir():
        raise SystemExit(f"Target directory not found: {target_dir}")

    files = [p for p in sorted(target_dir.rglob("*")) if p.is_file()]
    index_md = target_dir / "INDEX.md"
    index_json = target_dir / "INDEX.json"

    node_count = None
    category_count = None
    data_json = target_dir / "data.json"
    if data_json.exists():
        try:
            payload = json.loads(data_json.read_text())
            nodes = payload.get("nodes", [])
            node_count = len(nodes)
            category_count = len({n.get("category") for n in nodes if n.get("category")})
        except Exception:
            pass

    generated_at = datetime.now().astimezone()
    summary = f"已生成资料索引，共 {len(files)} 个文件；默认查看 INDEX.md。"

    lines = [
        f"# {target_dir.name} 资料清单与索引",
        "",
        f"执行摘要：{summary}",
        f"生成时间：{generated_at.strftime('%Y-%m-%d %H:%M %Z')}",
        f"目录：`{target_dir}`",
        "",
        "## 文件清单",
        "",
        "| 文件 | 类型 | 大小 |",
        "|---|---|---:|",
    ]

    file_records = []
    for file_path in files:
        rel = file_path.relative_to(target_dir)
        kind = classify_file(file_path)
        size = file_path.stat().st_size
        lines.append(f"| `{rel}` | {kind} | {size} bytes |")
        file_records.append(
            {
                "path": str(rel),
                "type": kind,
                "size": size,
            }
        )

    if node_count is not None:
        lines.extend(
            [
                "",
                "## 数据索引",
                "",
                f"- 节点总数：{node_count}",
                f"- 分类数：{category_count}",
            ]
        )

    index_md.write_text("\n".join(lines) + "\n", encoding="utf-8")
    index_json.write_text(
        json.dumps(
            {
                "generated_at": generated_at.isoformat(),
                "target_dir": str(target_dir),
                "primary_artifact": str(index_md),
                "execution_summary": summary,
                "files": file_records,
                "node_count": node_count,
                "category_count": category_count,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(
        json.dumps(
            {
                "success": True,
                "target_dir": str(target_dir),
                "index_md": str(index_md),
                "index_json": str(index_json),
                "primary_artifact": str(index_md),
                "execution_summary": summary,
                "file_count": len(file_records),
                "node_count": node_count,
                "category_count": category_count,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
