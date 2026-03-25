# Watchdog cron security notes

## Threat model snapshot
- Runs unattended (cron/systemd/launchd/Scheduled Task) and can execute restart/rollback actions.
- Uses environment config (e.g., `.env`) for commands and URLs.
- If the service runs with elevated privileges, any writable config becomes a privilege-escalation vector.

## High-risk areas
- **Command execution from config**: `RESTART_COMMAND` and `ROLLBACK_COMMAND` are executed via a shell. If `.env` or service configuration is writable by a lower-privileged user, this becomes command injection with the watchdog's privileges.
- **Unrestricted health URL**: `HEALTH_URL` is used for outbound HTTP requests. If an attacker can modify config, this can become SSRF to internal services or metadata endpoints.
- **Config-path file operations**: `OPENCLAW_CONFIG_PATH` controls which file is copied/restored during rollback. If an attacker can set this path, the watchdog could overwrite arbitrary files.
- **Cron environment pitfalls**: Cron runs with a minimal PATH, no login shell, and can inherit surprising environment. A writable `PATH` or working directory can change which binaries are executed.
- **Secrets in `.env`**: Webhook tokens are meant to be stored in `.env`. If this file is committed, world-readable, or stored in a shared directory, secrets can leak.

## Mitigations (recommended)
- **Drop shell execution**: Replace `execaCommand(cmd, { shell: true })` with `execa(file, args)` and a strict allowlist of command + args. If shell is unavoidable, escape/validate and require absolute paths.
- **Lock config permissions**: Ensure `.env` and service definition files are owned by the service account and mode `0600` (or tighter). Do not store secrets in repo.
- **Pin trusted paths**: Use absolute paths for `openclaw` and `systemctl/launchctl`. Explicitly set PATH in service units to a safe, minimal value.
- **Validate URLs**: Restrict `HEALTH_URL` to `localhost` / `127.0.0.1` / `::1` or an allowlist; reject file/ftp/gopher schemes.
- **Constrain rollback paths**: Enforce that `OPENCLAW_CONFIG_PATH` resolves inside a known safe directory (e.g., `~/.openclaw/`). Reject symlinks or paths outside the directory.
- **Run unprivileged**: Always run watchdog as a non-root user. If root is required for restarts, use a narrowly-scoped privileged helper (sudoers allowlist with no shell).
- **Harden cron usage**: If cron is used, prefer systemd/launchd over raw cron. If cron is unavoidable, use a dedicated crontab for the service user and explicit `PATH`, `SHELL`, and `HOME` settings.

## Suggested follow-up
- Add a security section in the watchdog README covering permissions, command allowlists, and safe service installation.
- Provide a `watchdog.env.example` and keep `.env` out of version control by default.
