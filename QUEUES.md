## Queues & Workers

- Queues: ingestion, parse, match, deliver, export.
- Retry/backoff: exponential with jitter; max attempts 5; poison jobs to DLQ with reason and payload reference.
- Idempotency: re-check external_id and checksum before writes.
- DLQ monitoring: threshold alerts on growth rate and age; runbook to drain/fix.