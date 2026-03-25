import argparse
import json
import re
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from run_email_inbox_digest import fetch_messages


WORKSPACE_ROOT = Path("/Users/liumobei/.openclaw/workspace")
RUNTIME_DIR = WORKSPACE_ROOT / "agents" / "runtime"
INPUT_PROFILES_PATH = RUNTIME_DIR / "input-profiles.json"
RULES_PATH = RUNTIME_DIR / "email-triage-rules.json"
STATE_PATH = RUNTIME_DIR / "email-triage-state.json"
OUTPUT_DIR = WORKSPACE_ROOT / "skills" / "assistant-orchestrator" / "outputs" / "email-daily-triage"
WATCHDOG_ENV_PATH = WORKSPACE_ROOT / "openclaw-watchdog" / ".env"
EMAIL_DIGEST_NODE_ID = "sop-邮件收件箱摘要与优先级整理"


DEFAULT_RULES = {
    "mode": "observe-first",
    "updatedAt": "",
    "senderRules": [],
    "subjectRules": [],
    "notes": [
        "V1 默认只做观察和建议，不自动回复、不自动删除。",
        "当用户确认某类邮件的长期处理习惯后，再把规则写入 senderRules 或 subjectRules。",
    ],
}


def read_json(path: Path, default: Any):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def ensure_rules_file() -> dict[str, Any]:
    rules = read_json(RULES_PATH, DEFAULT_RULES.copy())
    changed = False
    for key, value in DEFAULT_RULES.items():
        if key not in rules:
            rules[key] = value
            changed = True
    if not rules.get("updatedAt"):
        rules["updatedAt"] = datetime.now(timezone.utc).isoformat()
        changed = True
    if changed or not RULES_PATH.exists():
        write_json(RULES_PATH, rules)
    return rules


def slugify(value: str) -> str:
    lowered = (value or "").strip().lower()
    lowered = re.sub(r"[^0-9a-zA-Z\u4e00-\u9fff]+", "-", lowered)
    lowered = lowered.strip("-")
    return lowered or "default"


def parse_bool(value: str, default: bool = False) -> bool:
    normalized = (value or "").strip().lower()
    if not normalized:
        return default
    return normalized in {"1", "true", "yes", "y", "是"}


def load_dotenv_defaults() -> dict[str, str]:
    values: dict[str, str] = {}
    if not WATCHDOG_ENV_PATH.exists():
        return values
    for line in WATCHDOG_ENV_PATH.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, raw = stripped.split("=", 1)
        values[key.strip()] = raw.strip().strip('"').strip("'")
    return values


def load_watchdog_notify_config(dotenv_defaults: dict[str, str], override_channel: str = "") -> dict[str, str]:
    channel = (override_channel or dotenv_defaults.get("NOTIFIER", "")).strip().lower()
    return {
        "channel": channel,
        "telegram_bot_token": dotenv_defaults.get("TELEGRAM_BOT_TOKEN", "").strip(),
        "telegram_chat_id": dotenv_defaults.get("TELEGRAM_CHAT_ID", "").strip(),
        "discord_webhook_url": dotenv_defaults.get("DISCORD_WEBHOOK_URL", "").strip(),
        "whatsapp_webhook_url": dotenv_defaults.get("WHATSAPP_WEBHOOK_URL", "").strip(),
        "whatsapp_webhook_token": dotenv_defaults.get("WHATSAPP_WEBHOOK_TOKEN", "").strip(),
        "feishu_webhook_url": dotenv_defaults.get("FEISHU_WEBHOOK_URL", "").strip(),
    }


def run_openclaw_json_command(args: list[str]) -> dict[str, Any]:
    process = subprocess.run(
        args,
        capture_output=True,
        text=True,
        timeout=30,
    )
    if process.returncode != 0:
        raise RuntimeError((process.stderr or process.stdout or "openclaw command failed").strip())

    raw = (process.stdout or "").strip()
    match = re.search(r"(\{[\s\S]*\})\s*$", raw)
    if not match:
        raise RuntimeError(f"openclaw command did not return JSON: {raw[:400]}")
    return json.loads(match.group(1))


def detect_openclaw_whatsapp_target() -> str:
    status = run_openclaw_json_command(["openclaw", "channels", "status", "--probe", "--json"])
    whatsapp = (status.get("channels") or {}).get("whatsapp") or {}
    if not whatsapp.get("connected"):
        raise RuntimeError("OpenClaw WhatsApp 通道当前未连接。")

    self_meta = whatsapp.get("self") or {}
    target = str(self_meta.get("e164", "")).strip()
    if target:
        return target

    accounts = ((status.get("channelAccounts") or {}).get("whatsapp") or [])
    for account in accounts:
        allow_from = account.get("allowFrom") or []
        if allow_from:
            return str(allow_from[0]).strip()

    raise RuntimeError("未能从 OpenClaw WhatsApp 状态里识别发送目标。")


def load_email_profile(profile_name: str) -> tuple[str, dict[str, str]]:
    store = read_json(INPUT_PROFILES_PATH, {})
    record = store.get(EMAIL_DIGEST_NODE_ID, {})
    profiles = record.get("profiles", [])
    selected = None
    if profile_name:
        selected = next((item for item in profiles if item.get("name") == profile_name), None)
    if selected is None:
        default_profile_id = record.get("defaultProfileId")
        selected = next((item for item in profiles if item.get("id") == default_profile_id), None)
    if selected is None and profiles:
        selected = profiles[0]
    if selected is None:
        raise ValueError("未找到已保存的邮箱账户档案。请先运行“邮件收件箱摘要与优先级整理”并保存账户档案。")
    return selected.get("name", ""), selected.get("values", {})


def triage_action_from_rules(rules: dict[str, Any], message_text: str, sender: str, subject: str) -> tuple[str, str] | None:
    sender_rules = rules.get("senderRules", [])
    subject_rules = rules.get("subjectRules", [])
    lowered_sender = sender.lower()
    lowered_subject = subject.lower()

    for rule in sender_rules:
        pattern = str(rule.get("pattern", "")).strip().lower()
        if pattern and pattern in lowered_sender:
            return str(rule.get("action", "review")), str(rule.get("reason", f"匹配发件人规则：{pattern}"))

    for rule in subject_rules:
        pattern = str(rule.get("pattern", "")).strip().lower()
        if pattern and pattern in lowered_subject:
            return str(rule.get("action", "review")), str(rule.get("reason", f"匹配主题规则：{pattern}"))

    lowered_text = message_text.lower()
    if any(token in lowered_text for token in ["unsubscribe", "newsletter", "digest", "promotion", "促销", "订阅"]):
        return "archive", "命中订阅/简报特征，建议归档。"
    if any(token in lowered_text for token in ["lottery", "loan", "博彩", "贷款", "兼职刷单", "中奖"]):
        return "spam_review", "命中高风险垃圾邮件特征。"
    if any(token in lowered_text for token in ["reply", "回复", "review", "合同", "报价", "invoice", "meeting", "面试", "合作"]):
        return "review", "主题或正文包含需要人工判断的事务信号。"
    return None


def classify_message(rules: dict[str, Any], message: dict[str, Any]) -> dict[str, str]:
    sender = str(message.get("from", ""))
    subject = str(message.get("subject", ""))
    preview = str(message.get("preview", ""))
    combined = " ".join([sender, subject, preview]).strip()
    guided = triage_action_from_rules(rules, combined, sender, subject)
    if guided:
      action, reason = guided
    else:
      action, reason = "review", "未命中既有规则，默认进入人工决策队列。"

    if action == "review":
        bucket = "待你拍板"
        priority = "high" if any(token in combined.lower() for token in ["合作", "reply", "回复", "meeting", "合同", "invoice"]) else "medium"
        next_step = "打开原邮件，决定回复、归档或加入规则。"
    elif action == "archive":
        bucket = "建议归档"
        priority = "low"
        next_step = "确认不需要处理后归档；若这类邮件长期无需看，可加入自动归档规则。"
    else:
        bucket = "疑似垃圾"
        priority = "low"
        next_step = "确认是否垃圾邮件；若确认，可加入垃圾规则。"

    return {
        "bucket": bucket,
        "priority": priority,
        "reason": reason,
        "suggestedAction": next_step,
    }


def load_state() -> dict[str, Any]:
    return read_json(STATE_PATH, {"accounts": {}})


def account_state_key(account_name: str, mailbox: str) -> str:
    return f"{account_name}::{mailbox or 'INBOX'}"


def filter_unprocessed(messages: list[dict[str, Any]], state: dict[str, Any], state_key: str, only_unprocessed: bool) -> list[dict[str, Any]]:
    processed = set(state.get("accounts", {}).get(state_key, {}).get("triagedUids", []))
    if not only_unprocessed:
        return messages
    return [message for message in messages if str(message.get("uid", "")) not in processed]


def update_state(state: dict[str, Any], state_key: str, messages: list[dict[str, Any]]) -> None:
    account_state = state.setdefault("accounts", {}).setdefault(state_key, {"triagedUids": [], "lastRunAt": ""})
    triaged = set(account_state.get("triagedUids", []))
    for message in messages:
        uid = str(message.get("uid", "")).strip()
        if uid:
            triaged.add(uid)
    account_state["triagedUids"] = list(sorted(triaged, key=lambda item: int(item) if item.isdigit() else item))[-2000:]
    account_state["lastRunAt"] = datetime.now(timezone.utc).isoformat()


def build_report(account_name: str, args: argparse.Namespace, rules: dict[str, Any], messages: list[dict[str, Any]]) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    counts = {"待你拍板": 0, "建议归档": 0, "疑似垃圾": 0}
    for message in messages:
        triage = classify_message(rules, message)
        item = {
            "uid": str(message.get("uid", "")),
            "from": str(message.get("from", "")),
            "subject": str(message.get("subject", "")),
            "date": str(message.get("date", "")),
            "preview": str(message.get("preview", "")),
            **triage,
        }
        items.append(item)
        counts[item["bucket"]] = counts.get(item["bucket"], 0) + 1

    return {
        "generatedAt": datetime.now(timezone.utc).astimezone().isoformat(),
        "mode": "daily-email-triage",
        "account": account_name,
        "mailbox": args.mailbox_scope or "INBOX",
        "timeWindow": args.time_window or "1d",
        "unreadOnly": parse_bool(args.unread_only, True),
        "onlyUnprocessed": parse_bool(args.only_unprocessed, True),
        "maxMessages": int(args.max_messages),
        "rulesMode": rules.get("mode", "observe-first"),
        "counts": counts,
        "items": items,
    }


def markdown_from_report(report: dict[str, Any]) -> str:
    lines = [f"# 邮件每日分诊 - {report['account']}", ""]
    lines.append(f"- 生成时间：{report['generatedAt']}")
    lines.append(f"- 邮箱范围：{report['mailbox']}")
    lines.append(f"- 时间窗口：{report['timeWindow']}")
    lines.append(f"- 只看未读：{'是' if report['unreadOnly'] else '否'}")
    lines.append(f"- 只看未处理：{'是' if report['onlyUnprocessed'] else '否'}")
    lines.append(f"- 规则模式：{report['rulesMode']}")
    lines.append("")
    lines.append("## 今日概览")
    lines.append("")
    lines.append(f"- 待你拍板：{report['counts'].get('待你拍板', 0)}")
    lines.append(f"- 建议归档：{report['counts'].get('建议归档', 0)}")
    lines.append(f"- 疑似垃圾：{report['counts'].get('疑似垃圾', 0)}")
    lines.append("")

    grouped = {
        "待你拍板": [],
        "建议归档": [],
        "疑似垃圾": [],
    }
    for item in report["items"]:
        grouped.setdefault(item["bucket"], []).append(item)

    for bucket in ["待你拍板", "建议归档", "疑似垃圾"]:
        lines.append(f"## {bucket}")
        lines.append("")
        bucket_items = grouped.get(bucket, [])
        if not bucket_items:
            lines.append("- 本次没有该类邮件。")
            lines.append("")
            continue
        for item in bucket_items:
            lines.append(f"### {item['subject'] or '(无主题)'}")
            lines.append("")
            lines.append(f"- 发件人：{item['from'] or '(未知)'}")
            lines.append(f"- 时间：{item['date'] or '(未知)'}")
            lines.append(f"- 优先级：{item['priority']}")
            lines.append(f"- 判断依据：{item['reason']}")
            lines.append(f"- 建议动作：{item['suggestedAction']}")
            lines.append(f"- 预览：{item['preview'] or '(无正文预览)'}")
            lines.append("")

    lines.append("## 规则建设建议")
    lines.append("")
    lines.append("- 对于稳定不需要处理的订阅/通知类邮件，可在 `agents/runtime/email-triage-rules.json` 追加归档规则。")
    lines.append("- 对于你总是亲自回复的合作/客户/朋友邮件，可追加 review 规则，确保始终进入待拍板队列。")
    lines.append("- V1 不自动回复、不自动删除，只提供建议并保留人工决策口。")
    lines.append("")
    return "\n".join(lines)


def build_telegram_text(report: dict[str, Any], report_path: Path) -> str:
    lines = [
        f"OpenClaw 邮件分诊",
        f"账户: {report['account']}",
        f"窗口: {report['timeWindow']} | 未读: {'是' if report['unreadOnly'] else '否'} | 未处理: {'是' if report['onlyUnprocessed'] else '否'}",
        f"待你拍板 {report['counts'].get('待你拍板', 0)} / 建议归档 {report['counts'].get('建议归档', 0)} / 疑似垃圾 {report['counts'].get('疑似垃圾', 0)}",
        "",
    ]

    review_items = [item for item in report["items"] if item["bucket"] == "待你拍板"][:5]
    if review_items:
        lines.append("优先处理:")
        for index, item in enumerate(review_items, start=1):
            sender = item["from"] or "未知发件人"
            subject = item["subject"] or "(无主题)"
            lines.append(f"{index}. {sender} | {subject}")
            lines.append(f"   建议: {item['suggestedAction']}")
    else:
        lines.append("今天没有新的待你拍板邮件。")

    lines.extend(
        [
            "",
            f"完整报告: {report_path}",
            "如需回看已推送邮件，可在 Mission Control 手动关闭“只看未处理”。",
        ]
    )
    return "\n".join(lines)[:3800]


def send_telegram_message(bot_token: str, chat_id: str, text: str) -> None:
    if not bot_token or not chat_id:
        raise ValueError("缺少 Telegram Bot Token 或 Chat ID。")
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = urllib.parse.urlencode(
        {
            "chat_id": chat_id,
            "text": text,
        }
    ).encode("utf-8")
    request = urllib.request.Request(url, data=payload, method="POST")
    with urllib.request.urlopen(request, timeout=20) as response:
        body = json.loads(response.read().decode("utf-8"))
        if not body.get("ok"):
            raise RuntimeError(f"Telegram 推送失败: {body}")


def send_json_post(url: str, payload: dict[str, Any], headers: dict[str, str] | None = None) -> None:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", **(headers or {})},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read().decode("utf-8", errors="ignore")
            if response.status >= 400:
                raise RuntimeError(f"通知请求失败: {response.status} {raw}")
            return raw
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"通知请求失败: {error.code} {body}") from error


def send_watchdog_notification(notify_config: dict[str, str], text: str) -> str:
    channel = notify_config.get("channel", "")
    if not channel or channel == "none":
        raise ValueError("watchdog 未配置可用通知通道。")

    if channel == "telegram":
        send_telegram_message(
            notify_config.get("telegram_bot_token", ""),
            notify_config.get("telegram_chat_id", ""),
            text,
        )
        return "telegram"

    if channel == "whatsapp":
        webhook_url = notify_config.get("whatsapp_webhook_url", "")
        if not webhook_url:
            raise ValueError("watchdog 的 WHATSAPP_WEBHOOK_URL 为空。")
        headers = {}
        token = notify_config.get("whatsapp_webhook_token", "")
        if token:
            headers["Authorization"] = f"Bearer {token}"
        send_json_post(webhook_url, {"text": text}, headers=headers)
        return "whatsapp"

    if channel == "discord":
        webhook_url = notify_config.get("discord_webhook_url", "")
        if not webhook_url:
            raise ValueError("watchdog 的 DISCORD_WEBHOOK_URL 为空。")
        send_json_post(webhook_url, {"content": text})
        return "discord"

    if channel == "feishu":
        webhook_url = notify_config.get("feishu_webhook_url", "")
        if not webhook_url:
            raise ValueError("watchdog 的 FEISHU_WEBHOOK_URL 为空。")
        send_json_post(
            webhook_url,
            {
                "msg_type": "text",
                "content": {"text": text},
            },
        )
        return "feishu"

    raise ValueError(f"暂不支持的通知通道: {channel}")


def send_openclaw_whatsapp_message(text: str) -> str:
    target = detect_openclaw_whatsapp_target()
    process = subprocess.run(
        [
            "openclaw",
            "message",
            "send",
            "--channel",
            "whatsapp",
            "--target",
            target,
            "--message",
            text,
        ],
        capture_output=True,
        text=True,
        timeout=60,
    )
    if process.returncode != 0:
        raise RuntimeError((process.stderr or process.stdout or "OpenClaw WhatsApp send failed").strip())
    return "whatsapp-openclaw"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email-profile", default="")
    parser.add_argument("--notify-channel", default="")
    parser.add_argument("--mailbox-scope", default="INBOX")
    parser.add_argument("--time-window", default="1d")
    parser.add_argument("--unread-only", default="yes")
    parser.add_argument("--only-unprocessed", default="yes")
    parser.add_argument("--max-messages", default="15")
    parser.add_argument("--push-mode", default="summary")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    rules = ensure_rules_file()
    dotenv_defaults = load_dotenv_defaults()
    notify_config = load_watchdog_notify_config(dotenv_defaults, args.notify_channel)
    account_name, profile_values = load_email_profile(args.email_profile.strip())

    fetch_args = argparse.Namespace(
        email_address=profile_values.get("邮箱地址", ""),
        imap_host=profile_values.get("IMAP 主机", ""),
        imap_port=profile_values.get("IMAP 端口", "993"),
        username=profile_values.get("用户名", ""),
        app_password=profile_values.get("应用专用密码或授权令牌", ""),
        mailbox_scope=args.mailbox_scope or profile_values.get("邮箱范围", "INBOX"),
        time_window=args.time_window or profile_values.get("时间窗口", ""),
        unread_only=args.unread_only or profile_values.get("是否需要只看未读", "yes"),
    )

    account_slug = slugify(account_name)
    account_output_dir = OUTPUT_DIR / account_slug
    account_output_dir.mkdir(parents=True, exist_ok=True)
    report_base = datetime.now().strftime("%Y-%m-%d")
    markdown_path = account_output_dir / f"{report_base}__triage.md"
    json_path = account_output_dir / f"{report_base}__triage.json"

    try:
        messages = fetch_messages(fetch_args)
        state = load_state()
        state_key = account_state_key(account_name, fetch_args.mailbox_scope)
        filtered = filter_unprocessed(
            messages,
            state,
            state_key,
            only_unprocessed=parse_bool(args.only_unprocessed, True),
        )
        max_messages = max(1, int(args.max_messages))
        filtered = filtered[:max_messages]

        report = build_report(account_name, args, rules, filtered)
        markdown = markdown_from_report(report)
        markdown_path.write_text(markdown, encoding="utf-8")
        json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

        telegram_sent = False
        notifier_channel = ""
        preferred_channel = notify_config.get("channel") or "none"
        if preferred_channel and preferred_channel != "none":
            telegram_text = build_telegram_text(report, markdown_path)
            if preferred_channel == "whatsapp":
                try:
                    notifier_channel = send_openclaw_whatsapp_message(telegram_text)
                    telegram_sent = True
                except Exception:
                    notifier_channel = send_watchdog_notification(notify_config, telegram_text)
                    telegram_sent = True
            else:
                notifier_channel = send_watchdog_notification(notify_config, telegram_text)
                telegram_sent = True

        if telegram_sent:
            update_state(state, state_key, filtered)
            write_json(STATE_PATH, state)

        print(
            json.dumps(
                {
                    "success": True,
                    "output_file": str(markdown_path),
                    "report_json": str(json_path),
                    "notification_sent": telegram_sent,
                    "notification_channel": notifier_channel or "none",
                    "message_count": len(filtered),
                    "execution_summary": (
                        f"已完成 {account_name} 的每日邮件分诊，"
                        f"{f'并已通过 {notifier_channel} 推送。' if telegram_sent else '未检测到可用通知通道，已只生成本地报告，未标记为已处理。'}"
                    ),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    except Exception as error:
        fallback = "\n".join(
            [
                "# 邮件每日分诊失败",
                "",
                f"- 账户档案：{args.email_profile or '默认'}",
                f"- 阻塞原因：{error}",
                "",
                "## 下一步",
                "",
                "- 先确认邮箱账户档案存在且可用。",
                "- 如果要消息推送，请补齐 watchdog .env 里的既有 notifier 配置。",
                "- 若只是手动排查，可先运行“邮件收件箱摘要与优先级整理”验证邮箱连接。",
            ]
        )
        markdown_path.write_text(fallback, encoding="utf-8")
        print(
            json.dumps(
                {
                    "success": False,
                    "output_file": str(markdown_path),
                    "blocker": {
                        "kind": "email-triage-failed",
                        "summary": "每日邮件分诊未完成。",
                        "detail": str(error),
                    },
                    "execution_summary": "每日邮件分诊受阻，已写出失败说明。",
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
