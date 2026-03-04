# Postmortem: Monitor DB Corruption + WA Session Conflict (2026-03-05)

## Incident A: monitor.db malformed
- Symptom: API 500, dashboard empty.
- Error: `sqlite3.DatabaseError: database disk image is malformed`.
- Impact: monitoring backend failed to start.

### Fix
1. Backup corrupted DB.
2. Remove wal/shm side files.
3. Recreate DB schema via backend init.
4. Re-sync from COMM_LOG and STATE files.
5. Restart uvicorn and verify `/api/health`.

### Prevention
- Add periodic DB backup snapshots.
- Add startup integrity check with auto-recover path.

## Incident B: WhatsApp conflict/logged-out
- Symptom: login succeeds then disconnects (`440 conflict` / logged out).
- Cause: session conflict or account-side invalidation.

### Fix
1. `openclaw channels logout --channel whatsapp`
2. `openclaw gateway restart`
3. `openclaw channels login --channel whatsapp --verbose`
4. Verify `connected=true` via status probe.

### Prevention
- Keep one active WA listener for one account.
- Always run status probe before send.
