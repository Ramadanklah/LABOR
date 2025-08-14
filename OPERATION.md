## Operations Runbook

- Deployments: trunk-based; feature branches → PR; CI passes tests and scans; CD to staging; prod deploy with approval window.
- Migrations: additive-first; deploy code with backward compatibility; apply SQL; flip flags; see `ops/MIGRATIONS_AND_BACKUPS.md`.
- DR: define RTO/RPO; warm standby in separate region; failover runbook tested quarterly.
- Backups: daily snapshots + PITR; retention per env; monthly restore tests with documented outcomes.
- On-call: severity levels; playbooks for common incidents (DB down, queue backlog, webhook failures); escalation to SRE.
- Monitoring: SLOs for latency, error rate, and ingestion success; alerts to on-call rotation.