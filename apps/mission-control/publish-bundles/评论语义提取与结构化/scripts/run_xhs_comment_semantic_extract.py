import argparse
import json
import re
import subprocess
import urllib.parse
from datetime import datetime
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZIP_DEFLATED


COUNTRY_PATTERNS = [
    "泰国",
    "英国",
    "印度尼西亚",
    "印尼",
    "新西兰",
    "澳大利亚",
    "美国",
    "瑞士",
    "西班牙",
    "德国",
    "日本",
    "韩国",
    "法国",
    "意大利",
]


def parse_url(url: str) -> tuple[str, str]:
    parsed = urllib.parse.urlparse(url)
    query = urllib.parse.parse_qs(parsed.query)
    match = re.search(r"/explore/([^/?#]+)", parsed.path)
    if not match:
        raise SystemExit("Could not extract feed_id from Xiaohongshu URL")
    feed_id = match.group(1)
    xsec_token = query.get("xsec_token", [""])[0]
    if not xsec_token:
        raise SystemExit("Could not extract xsec_token from Xiaohongshu URL")
    return feed_id, xsec_token


def run_fetch(feed_id: str, xsec_token: str, cwd: Path) -> dict:
    python_bin = cwd / ".venv" / "bin" / "python"
    if not python_bin.exists():
        python_bin = Path("python3")

    process = subprocess.run(
        [
            str(python_bin),
            "scripts/cli.py",
            "get-feed-detail",
            "--feed-id",
            feed_id,
            "--xsec-token",
            xsec_token,
            "--load-all-comments",
            "--click-more-replies",
            "--scroll-speed",
            "slow",
        ],
        cwd=cwd,
        capture_output=True,
        text=True,
        timeout=600,
    )
    if process.returncode != 0:
        raise SystemExit(process.stderr or process.stdout or "xhs fetch failed")
    return json.loads(process.stdout)


def extract_country(text: str) -> str:
    for item in COUNTRY_PATTERNS:
        if item in text:
            return "印度尼西亚" if item == "印尼" else item

    match = re.search(r"产地[:：]\s*([^\s，,。/]+)", text)
    if match:
        return match.group(1).strip()
    return ""


def extract_brand(text: str) -> str:
    match = re.search(r"(?:品牌|牌子)[:：]\s*([^\s，,。/]+)", text)
    if match:
        return match.group(1).strip()

    match = re.search(r"产品名[:：]\s*([^\s，,。/]+)", text)
    if match:
        product = match.group(1).strip()
        if len(product) > 2:
          return ""
    return ""


def extract_product(text: str) -> str:
    explicit = re.search(r"(?:产品名|产品)[:：]\s*([^\n，,。]+)", text)
    if explicit:
        return explicit.group(1).strip()

    first_line = text.splitlines()[0].strip()
    if "理由" in first_line:
        first_line = first_line.split("理由", 1)[0].strip()
    first_line = re.sub(r"^产地[:：][^\s，,。/]+", "", first_line).strip(" /")
    return first_line


def flatten_comments(payload: dict) -> list[dict]:
    rows: list[dict] = []

    for comment in payload.get("comments", []):
        base = {
            "评论ID": comment.get("id", ""),
            "评论内序号": "1",
            "评论人": comment.get("user", {}).get("nickname", ""),
            "用户ID": comment.get("user", {}).get("userId", ""),
            "评论内容": comment.get("content", ""),
            "点赞数": comment.get("likeCount", ""),
            "回复数": comment.get("subCommentCount", ""),
            "IP属地": comment.get("ipLocation", ""),
            "评论时间": str(comment.get("createTime", "")),
        }
        rows.append(base)

    return rows


def enrich_rows(rows: list[dict]) -> list[dict]:
    enriched = []
    for row in rows:
        text = row["评论内容"]
        country = extract_country(text)
        brand = extract_brand(text)
        product = extract_product(text)
        complete = bool(country or brand or product)
        enriched.append(
            {
                **row,
                "国家": country,
                "品牌": brand,
                "产品": product,
                "格式状态": "complete" if complete else "needs_review",
                "识别置信度": 0.82 if complete else 0.12,
                "备注": "" if complete else "未能稳定识别完整商品结构",
                "是否新增": "",
            }
        )
    return enriched


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def column_letter(index: int) -> str:
    result = ""
    while index > 0:
        index, rem = divmod(index - 1, 26)
        result = chr(65 + rem) + result
    return result


def write_xlsx(path: Path, rows: list[dict]) -> None:
    headers = list(rows[0].keys()) if rows else []

    def cell(row_idx: int, col_idx: int, value: str) -> str:
        return (
            f'<c r="{column_letter(col_idx)}{row_idx}" t="inlineStr">'
            f"<is><t>{escape(value)}</t></is></c>"
        )

    sheet_rows = []
    sheet_rows.append(
        f'<row r="1">{"".join(cell(1, i + 1, header) for i, header in enumerate(headers))}</row>'
    )
    for row_idx, row in enumerate(rows, start=2):
        sheet_rows.append(
            f'<row r="{row_idx}">'
            + "".join(
                cell(row_idx, col_idx + 1, str(row.get(header, "")))
                for col_idx, header in enumerate(headers)
            )
            + "</row>"
        )

    worksheet = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    {''.join(sheet_rows)}
  </sheetData>
</worksheet>"""

    workbook = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="comments" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>"""

    workbook_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>"""

    root_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""

    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>"""

    with ZipFile(path, "w", ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", root_rels)
        zf.writestr("xl/workbook.xml", workbook)
        zf.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
        zf.writestr("xl/worksheets/sheet1.xml", worksheet)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--note-url", required=True)
    parser.add_argument("--output", default="")
    parser.add_argument("--batch-size", default="20")
    args = parser.parse_args()

    feed_id, xsec_token = parse_url(args.note_url)
    xhs_root = Path("/Users/liumobei/.openclaw/workspace/skills/xiaohongshu-skills")
    project_dir = Path("/Users/liumobei/.openclaw/workspace/sops/xhs_comment_semantic_extract_projects") / feed_id
    project_dir.mkdir(parents=True, exist_ok=True)

    payload = run_fetch(feed_id, xsec_token, xhs_root)
    raw_json = project_dir / f"tmp_xhs_{feed_id}_raw.json"
    write_json(raw_json, payload)

    input_rows = flatten_comments(payload)
    output_rows = enrich_rows(input_rows)
    rows_path = project_dir / "session_input_rows.json"
    write_json(rows_path, input_rows)
    enriched_path = project_dir / "session_outputs.json"
    write_json(enriched_path, output_rows)

    output_file = (
        Path(args.output).expanduser().resolve()
        if args.output
        else Path.home() / "Desktop" / f"xhs_note_{feed_id}_comments.xlsx"
    )
    write_xlsx(output_file, output_rows)

    summary = {
        "feed_id": feed_id,
        "url": args.note_url,
        "raw_comment_count": len(payload.get("comments", [])),
        "export_row_count": len(output_rows),
        "needs_review_count": sum(1 for row in output_rows if row["格式状态"] != "complete"),
        "output_file": str(output_file),
        "generated_at": datetime.now().astimezone().isoformat(),
    }
    write_json(project_dir / "summary.json", summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
