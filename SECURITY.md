## Security Policy

- Threat model: multi-tenant healthcare API; threats include auth bypass, tenant data leakage, webhook forgery, secret leakage, and supply chain.
- Redaction rules: logs must never include PHI, access tokens, secrets, or full PDFs; use hashing for identifiers where needed.
- Encryption: TLS 1.2+ in transit; at rest via DB-native encryption and encrypted object storage; KMS-managed keys for backups.
- Secrets: no secrets in repo. Use environment injection and a secrets manager. Pre-commit and CI secret scans enforced.
- SAST/DAST: ESLint + dependency audit on PR; detect-secrets in CI; OWASP ZAP baseline monthly on staging; npm audit weekly.
- Pen-test cadence: external pen-test per major release or quarterly; remediate criticals within 7 days.
- Incident response: triage within 1 hour, severity classification, customer comms within 24h, postmortem within 5 days.
- Owners: security lead, tech lead.