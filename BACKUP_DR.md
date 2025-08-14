## Backup & Disaster Recovery

- Backups:
  - DB: daily snapshots + PITR; retention by env; offsite copies.
  - Object storage: versioning on; lifecycle policies; periodic integrity checks.
  - Audit logs: WORM storage where required.
- Restore:
  - Verify snapshot integrity; restore to staging; run validation suite (schema, counts, sample queries).
  - Document RTO/RPO results after each drill.
- DR:
  - Warm standby infra; replicate DB; failover steps and validation checklist.