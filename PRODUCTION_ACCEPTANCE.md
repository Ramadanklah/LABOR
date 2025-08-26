## Production Acceptance Checklist

- Repo hygiene: secret-scan clean; history purged
- RLS: test suite green for cross-tenant isolation
- Auth: token spec enforced; RBAC tests pass
- Ingestion: matching/quarantine/idempotency tests pass
- Observability: dashboards and alerts configured; runbooks linked
- Security & legal: DPA/RoPA docs present; SAST in CI; pentest scheduled
- DR: backup restore validated
- CI/CD: PR gating and preview envs configured
- Owners sign-off: technical, security, product, legal