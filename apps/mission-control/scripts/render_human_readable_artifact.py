import argparse
import csv
import json
import os
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


def heading(title: str) -> str:
    return f"# {title}\n\n"


def summarize_json(path: Path) -> str:
    payload = json.loads(path.read_text(encoding="utf-8"))
    lines = [heading(path.stem), "## 摘要\n"]
    if isinstance(payload, dict):
      lines.append(f"- 顶层键数量：{len(payload.keys())}\n")
      lines.append(f"- 顶层键：{', '.join(list(payload.keys())[:12])}\n")
    elif isinstance(payload, list):
      lines.append(f"- 列表项数量：{len(payload)}\n")
    lines.append("\n## 内容\n\n```json\n")
    lines.append(json.dumps(payload, ensure_ascii=False, indent=2)[:12000])
    lines.append("\n```\n")
    return "".join(lines)


def summarize_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def summarize_csv(path: Path) -> str:
    lines = [heading(path.stem), "## 预览\n\n"]
    with path.open("r", encoding="utf-8", newline="") as handle:
      reader = csv.reader(handle)
      rows = list(reader)
    if not rows:
      lines.append("空文件。\n")
      return "".join(lines)
    preview = rows[:20]
    max_cols = max(len(row) for row in preview)
    lines.append("| " + " | ".join(f"列{i+1}" for i in range(max_cols)) + " |\n")
    lines.append("|" + "|".join(["---"] * max_cols) + "|\n")
    for row in preview:
      padded = row + [""] * (max_cols - len(row))
      lines.append("| " + " | ".join(cell.replace("\n", " ")[:80] for cell in padded) + " |\n")
    return "".join(lines)


def read_docx_text(path: Path) -> str:
    with zipfile.ZipFile(path) as archive:
      with archive.open("word/document.xml") as handle:
        root = ET.fromstring(handle.read())
    namespaces = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs = []
    for paragraph in root.findall(".//w:p", namespaces):
      texts = [node.text or "" for node in paragraph.findall(".//w:t", namespaces)]
      merged = "".join(texts).strip()
      if merged:
        paragraphs.append(merged)
    return "\n\n".join(paragraphs)


def read_xlsx_preview(path: Path) -> str:
    with zipfile.ZipFile(path) as archive:
      workbook = ET.fromstring(archive.read("xl/workbook.xml"))
      rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
      ns_main = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
      ns_rel = {"rel": "http://schemas.openxmlformats.org/package/2006/relationships"}
      shared_strings = []
      if "xl/sharedStrings.xml" in archive.namelist():
        shared_root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
        shared_strings = ["".join(node.itertext()) for node in shared_root.findall(".//main:si", ns_main)]

      rel_map = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in rels.findall(".//rel:Relationship", ns_rel)
      }

      lines = [heading(path.stem), "## 工作表预览\n\n"]
      for sheet in workbook.findall(".//main:sheets/main:sheet", ns_main)[:2]:
        name = sheet.attrib.get("name", "Sheet")
        rel_id = sheet.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id", "")
        target = rel_map.get(rel_id, "")
        if not target:
          continue
        sheet_xml = ET.fromstring(archive.read(f"xl/{target}"))
        lines.append(f"### {name}\n\n")
        rows = sheet_xml.findall(".//main:sheetData/main:row", ns_main)[:20]
        for row in rows:
          values = []
          for cell in row.findall("main:c", ns_main):
            cell_type = cell.attrib.get("t")
            value = cell.findtext("main:v", default="", namespaces=ns_main)
            if cell_type == "s" and value.isdigit():
              idx = int(value)
              value = shared_strings[idx] if idx < len(shared_strings) else value
            values.append(value)
          lines.append("- " + " | ".join(values) + "\n")
        lines.append("\n")
      return "".join(lines)


def summarize_directory(path: Path) -> str:
    files = sorted(path.rglob("*"))
    lines = [heading(path.name), "## 目录摘要\n\n"]
    entries = [item for item in files if item != path][:40]
    lines.append(f"- 文件/目录数量：{len(entries)}（预览前 40 项）\n\n")
    for item in entries:
      rel = item.relative_to(path)
      suffix = "/" if item.is_dir() else ""
      lines.append(f"- `{rel}{suffix}`\n")
    return "".join(lines)


def render(path: Path) -> dict:
    if path.is_dir():
      content = summarize_directory(path)
      kind = "directory"
    else:
      suffix = path.suffix.lower()
      if suffix == ".md":
        content = summarize_text(path)
        kind = "markdown"
      elif suffix in {".txt"}:
        content = heading(path.stem) + summarize_text(path)
        kind = "text"
      elif suffix == ".json":
        content = summarize_json(path)
        kind = "json"
      elif suffix == ".csv":
        content = summarize_csv(path)
        kind = "csv"
      elif suffix == ".docx":
        content = heading(path.stem) + read_docx_text(path)
        kind = "docx"
      elif suffix in {".xlsx"}:
        content = read_xlsx_preview(path)
        kind = "xlsx"
      else:
        content = heading(path.name) + f"该文件类型暂不支持直接抽取正文。\n\n原始路径：`{path}`\n"
        kind = "binary"

    return {
      "success": True,
      "title": path.stem or path.name,
      "kind": kind,
      "content_md": content,
      "source_path": str(path),
      "suggested_filename": f"{path.stem or path.name}__human.docx",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--path", required=True)
    args = parser.parse_args()

    target = Path(args.path).expanduser().resolve()
    if not target.exists():
      raise SystemExit(f"Artifact not found: {target}")

    print(json.dumps(render(target), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
