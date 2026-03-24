import argparse
import email
import html
import imaplib
import json
import re
from datetime import datetime, timedelta, timezone
from email.header import decode_header, make_header
from email.message import Message
from pathlib import Path


WORKSPACE_ROOT = Path("/Users/liumobei/.openclaw/workspace")
OUTPUT_DIR = WORKSPACE_ROOT / "skills" / "assistant-orchestrator" / "outputs"


def parse_uid(fetch_meta: object) -> str:
    raw = ""
    if isinstance(fetch_meta, tuple) and fetch_meta:
        raw = str(fetch_meta[0])
    else:
        raw = str(fetch_meta)
    match = re.search(r"UID\s+(\d+)", raw)
    return match.group(1) if match else ""


def clean_text(value: str) -> str:
    text = html.unescape(value or "")
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def decode_header_value(raw: str | None) -> str:
    if not raw:
        return ""
    try:
        return str(make_header(decode_header(raw)))
    except Exception:
        return raw


def message_preview(message: Message) -> str:
    if message.is_multipart():
        for part in message.walk():
          content_type = part.get_content_type()
          disposition = part.get("Content-Disposition", "")
          if content_type == "text/plain" and "attachment" not in disposition.lower():
              payload = part.get_payload(decode=True)
              charset = part.get_content_charset() or "utf-8"
              try:
                  return clean_text(payload.decode(charset, errors="ignore"))[:240]
              except Exception:
                  continue
        for part in message.walk():
          if part.get_content_type() == "text/html":
              payload = part.get_payload(decode=True)
              charset = part.get_content_charset() or "utf-8"
              try:
                  return clean_text(payload.decode(charset, errors="ignore"))[:240]
              except Exception:
                  continue
        return ""
    payload = message.get_payload(decode=True)
    if payload is None:
        return ""
    charset = message.get_content_charset() or "utf-8"
    try:
        return clean_text(payload.decode(charset, errors="ignore"))[:240]
    except Exception:
        return ""


def parse_time_window(value: str) -> datetime | None:
    raw = (value or "").strip().lower()
    if not raw:
        return None
    now = datetime.now(timezone.utc)
    if raw in {"today", "今天"}:
        return now - timedelta(days=1)
    match = re.match(r"(\d+)\s*d", raw)
    if match:
        return now - timedelta(days=int(match.group(1)))
    match = re.match(r"(\d+)", raw)
    if match:
        return now - timedelta(days=int(match.group(1)))
    return None


def build_search_criteria(unread_only: bool, since_dt: datetime | None) -> str:
    criteria = ["ALL"]
    if unread_only:
        criteria = ["UNSEEN"]
    if since_dt:
        criteria.append(f'SINCE "{since_dt.astimezone(timezone.utc).strftime("%d-%b-%Y")}"')
    return " ".join(criteria)


def fetch_messages(args: argparse.Namespace):
    host = args.imap_host.strip()
    port = int(args.imap_port)
    username = args.username.strip() or args.email_address.strip()
    password = args.app_password.strip()
    mailbox = args.mailbox_scope.strip() or "INBOX"
    unread_only = args.unread_only.strip().lower() in {"yes", "true", "1", "是"}
    since_dt = parse_time_window(args.time_window)

    if not all([args.email_address.strip(), host, str(port), username, password]):
        raise ValueError("缺少邮箱地址、IMAP 主机、IMAP 端口、用户名或应用专用密码/授权码。")

    conn = imaplib.IMAP4_SSL(host, port)
    try:
        conn.login(username, password)
        status, _ = conn.select(mailbox, readonly=True)
        if status != "OK":
            raise RuntimeError(f"无法打开邮箱范围: {mailbox}")

        criteria = build_search_criteria(unread_only, since_dt)
        status, data = conn.search(None, criteria)
        if status != "OK":
            raise RuntimeError("邮箱搜索失败。")
        message_ids = data[0].split()[-20:]
        messages = []
        for message_id in reversed(message_ids):
            fetch_status, fetch_data = conn.fetch(message_id, "(UID RFC822)")
            if fetch_status != "OK" or not fetch_data or not fetch_data[0]:
                continue
            raw_bytes = fetch_data[0][1]
            msg = email.message_from_bytes(raw_bytes)
            messages.append(
                {
                    "uid": parse_uid(fetch_data[0]),
                    "from": decode_header_value(msg.get("From")),
                    "subject": decode_header_value(msg.get("Subject")),
                    "date": decode_header_value(msg.get("Date")),
                    "message_id": decode_header_value(msg.get("Message-ID")),
                    "preview": message_preview(msg),
                    "unread": unread_only,
                }
            )
        return messages
    finally:
        try:
            conn.logout()
        except Exception:
            pass


def build_markdown(messages: list[dict], args: argparse.Namespace, blocked_reason: str | None = None):
    stamp = datetime.now().strftime("%Y-%m-%d")
    lines = [f"# 邮件收件箱摘要 - {stamp}", ""]
    lines.append(f"- 工作流：邮件收件箱摘要与优先级整理")
    lines.append(f"- 邮箱：{args.email_address}")
    lines.append(f"- 邮箱范围：{args.mailbox_scope or 'INBOX'}")
    lines.append(f"- 时间窗口：{args.time_window or '全部'}")
    lines.append(f"- 只看未读：{args.unread_only or '否'}")
    lines.append("")
    if blocked_reason:
        lines.append("## 当前阻塞")
        lines.append("")
        lines.append(f"- {blocked_reason}")
        lines.append("")
        lines.append("## 下一步")
        lines.append("")
        lines.append("- 补齐邮箱接入参数后重新运行")
        lines.append("- 或提供本地邮件导出文件走离线摘要路径")
        lines.append("")
        return "\n".join(lines)

    lines.append("## 高优先级邮件")
    lines.append("")
    if not messages:
        lines.append("- 当前没有匹配到邮件。")
        lines.append("")
        return "\n".join(lines)

    for message in messages:
        lines.append(f"### {message['subject'] or '(无主题)'}")
        lines.append("")
        lines.append(f"- 发件人：{message['from'] or '(未知)'}")
        lines.append(f"- 时间：{message['date'] or '(未知)'}")
        lines.append(f"- 摘要：{message['preview'] or '(无正文预览)'}")
        lines.append("")

    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email-address", required=True)
    parser.add_argument("--imap-host", required=True)
    parser.add_argument("--imap-port", required=True)
    parser.add_argument("--username", required=True)
    parser.add_argument("--app-password", required=True)
    parser.add_argument("--mailbox-scope", default="INBOX")
    parser.add_argument("--time-window", default="")
    parser.add_argument("--unread-only", default="")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / f"邮件摘要_{datetime.now().strftime('%Y-%m-%d')}.md"

    try:
        messages = fetch_messages(args)
        markdown = build_markdown(messages, args)
        output_path.write_text(markdown, encoding="utf-8")
        print(
            json.dumps(
                {
                    "success": True,
                    "output_file": str(output_path),
                    "message_count": len(messages),
                    "execution_summary": f"已读取 {len(messages)} 封邮件并生成真实收件箱摘要。",
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    except Exception as error:
        markdown = build_markdown([], args, blocked_reason=str(error))
        output_path.write_text(markdown, encoding="utf-8")
        print(
            json.dumps(
                {
                    "success": False,
                    "output_file": str(output_path),
                    "blocker": {
                        "kind": "missing-inputs",
                        "summary": "邮箱连接失败或凭证无效。",
                        "detail": str(error),
                    },
                    "execution_summary": "邮箱接入受阻，已输出缺口说明。",
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
