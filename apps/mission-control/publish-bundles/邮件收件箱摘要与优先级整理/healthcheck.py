import json
from pathlib import Path


MANIFEST = json.loads(r'''{"id": "cap.openclaw.sop.workflow-c9523b0a", "name": "邮件收件箱摘要与优先级整理", "version": "0.2.0", "description": "自动整理邮箱中的新增邮件，输出一份可执行的收件箱摘要。", "domain": "个人管理", "category": "沟通与邮件", "tags": ["个人管理", "沟通与邮件", "sop"], "ownership": "openclaw", "publish": "local-bundle", "dependencies": [], "requires": ">=2026.3.2", "skills": ["skills/assistant-orchestrator/SKILL.md", "skills/email-sequence/SKILL.md", "skills/web-search-plus/SKILL.md"], "sops": ["sops/邮件收件箱摘要与优先级整理.md"], "install": "python3 install.py", "healthcheck": "python3 healthcheck.py", "outputs": ["outputs/cap.openclaw.sop.workflow-c9523b0a/"], "packaged_capabilities": ["cap.openclaw.skill.assistant-orchestrator", "cap.openclaw.skill.email-sequence", "cap.openclaw.skill.web-search-plus"], "entrypoints": [{"label": "邮件收件箱摘要与优先级整理", "command": "python3 /Users/liumobei/.openclaw/workspace/apps/mission-control/scripts/run_email_inbox_digest.py --email-address <邮箱地址> --imap-host <IMAP 主机> --imap-port <IMAP 端口> --username <用户名> --app-password <应用专用密码或授权令牌> --mailbox-scope <邮箱范围> --time-window <时间窗口> --unread-only <是否需要只看未读>"}]}''')


def main():
    workspace = Path.home() / ".openclaw" / "workspace"
    required = [
        workspace / "sops/邮件收件箱摘要与优先级整理.md",
        workspace / "agents" / "knowledge" / "portable" / MANIFEST["id"],
        workspace / "portable-bundles" / MANIFEST["id"] / "bundle" / "capability-manifest.json",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise SystemExit("Missing required paths: " + ", ".join(missing))
    print(f"Healthcheck OK for {MANIFEST['id']}")


if __name__ == "__main__":
    main()
