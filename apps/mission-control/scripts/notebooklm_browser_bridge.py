import argparse
import json
import re
from pathlib import Path
from typing import Optional, Tuple

from patchright.sync_api import sync_playwright

STATE_FILE = Path("/Users/liumobei/.agents/skills/notebooklm/data/browser_state/state.json")


def extract_heading(source_path: Path) -> str:
    try:
        for line in source_path.read_text(encoding="utf-8").splitlines():
            if line.startswith("# "):
                return line[2:].strip()
    except Exception:
        return source_path.stem
    return source_path.stem


def upload_sources(page, source_files: list[Path]) -> None:
    with page.expect_file_chooser(timeout=10000) as chooser_info:
        page.get_by_role("button", name=re.compile("Upload files", re.I)).first.click(timeout=10000)
    chooser = chooser_info.value
    chooser.set_files([str(path) for path in source_files])


def wait_for_source_labels(page, source_files: list[Path], timeout_ms: int = 30000) -> list[str]:
    expected_labels = []
    for path in source_files:
        expected_labels.append(path.stem)
        heading = extract_heading(path)
        if heading:
            expected_labels.append(heading)

    found_labels: list[str] = []
    page.wait_for_timeout(5000)
    deadline = page.context._impl_obj._loop.time() + (timeout_ms / 1000)
    while page.context._impl_obj._loop.time() < deadline:
        content = page.content()
        found_labels = [label for label in expected_labels if label and label in content]
        if len(found_labels) >= max(1, min(len(source_files), len(expected_labels) // 3)):
            return found_labels
        page.wait_for_timeout(1000)
    return found_labels


def create_or_open_notebook(page, notebook_url: Optional[str]) -> Tuple[str, str]:
    if notebook_url:
        joiner = "&" if "?" in notebook_url else "?"
        target_url = f"{notebook_url}{joiner}addSource=true"
        page.goto(target_url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(4000)
        current_url = page.url
        match = re.search(r"/notebook/([^/?#]+)", current_url)
        if not match:
            raise RuntimeError(f"Could not extract notebook id from existing URL: {current_url}")
        return current_url.split("?")[0], match.group(1)

    page.goto("https://notebooklm.google.com", wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(3000)
    create_button = page.get_by_role("button", name=re.compile("Create new", re.I)).first
    create_button.click(timeout=15000)
    page.wait_for_timeout(5000)
    current_url = page.url
    match = re.search(r"/notebook/([^/?#]+)", current_url)
    if not match:
        raise RuntimeError(f"Could not extract notebook id from created URL: {current_url}")
    return current_url.split("?")[0], match.group(1)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--notebook-url", default="")
    parser.add_argument("--source-files", nargs="+", required=True)
    args = parser.parse_args()

    source_files = [Path(path).expanduser().resolve() for path in args.source_files]
    missing = [str(path) for path in source_files if not path.exists()]
    if missing:
        raise SystemExit(f"Source files not found: {missing}")

    playwright = sync_playwright().start()
    browser = None
    context = None

    try:
        browser = playwright.chromium.launch(
            channel="chrome",
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--no-sandbox",
                "--no-first-run",
                "--no-default-browser-check",
            ],
        )
        context = browser.new_context(
            storage_state=str(STATE_FILE),
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            viewport={"width": 1440, "height": 960},
        )
        page = context.new_page()
        notebook_url, notebook_id = create_or_open_notebook(page, args.notebook_url or None)
        upload_sources(page, source_files)
        found_labels = wait_for_source_labels(page, source_files)
        if not found_labels:
            raise RuntimeError("NotebookLM source upload could not be verified.")

        print(
            json.dumps(
                {
                    "success": True,
                    "notebook_url": notebook_url,
                    "notebook_id": notebook_id,
                    "uploaded_files": [str(path) for path in source_files],
                    "found_labels": found_labels,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    finally:
        if context:
            try:
                context.close()
            except Exception:
                pass
        if browser:
            try:
                browser.close()
            except Exception:
                pass
        try:
            playwright.stop()
        except Exception:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
