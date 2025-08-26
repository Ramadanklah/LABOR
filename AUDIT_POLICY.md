## Audit Policy

- Store: append-only DB tables for app events; periodic export to WORM object storage (immutability window) for compliance.
- Events: logins, role changes, DSRs, exports, quarantine resolutions; include who/what/when/why.
- Access: restricted to audit roles; tamper-evident hashes on batches.
- Retention: per policy and regulation; legal holds override deletion until cleared.