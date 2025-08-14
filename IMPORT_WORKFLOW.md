## Import Workflow (LDT)

- Ingest: receive LDT via API/webhook; validate signature (HMAC) and content-type; store raw message and checksum.
- Parsing rules: strict LDT 3.x; reject unknown segments; capture BSNR/LANR; log parser errors without PHI.
- Normalization: map codes to LOINC/UCUM where available; preserve original values for audit.
- Matching: deterministic by patient identifiers and timestamps; fallback fuzzy match with thresholds; manual review queue on conflicts.
- Idempotency: use checksum and external message ID; deduplicate; exactly-once processing ensured via transactional outbox.
- Error handling: quarantine invalid messages; retry policy with backoff; alerting on sustained failures.