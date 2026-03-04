# WA Recovery Checklist

```bash
openclaw channels logout --channel whatsapp
openclaw gateway restart
openclaw channels login --channel whatsapp --verbose
openclaw channels status --probe --json
```

Success criteria:
- `running: true`
- `connected: true`

If `440 conflict` appears:
- remove duplicate linked device/session
- ensure only one OpenClaw instance is connected
