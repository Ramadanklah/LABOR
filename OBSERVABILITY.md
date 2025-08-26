## Observability

- SLOs/KPIs:
  - Ingestion success rate, p95 ingestion latency, queue depth, availability.
  - Team to define numeric targets per environment.
- Metrics instrumentation:
  - Ingestion: requests, successes/failures, size, latency.
  - Normalization/Matching: success/ambiguous/no_match counts, durations.
  - Delivery: success/failure, retries.
  - Quarantine: volume, age, resolution times.
- Tracing policy:
  - Propagate correlation/request ID and tenant ID across services; include in logs.
  - Use OpenTelemetry SDK; export traces and metrics to Prometheus/OTLP.
- Dashboards:
  - Provide Grafana dashboards for ingestion pipeline, API latency/errors, queue health.
  - Include links or JSON placeholders in `monitoring/`.
- Alerts → Runbooks:
  - DLQ surge → runbook: check upstream failures, increase consumers, fix poison messages.
  - Ingestion failure spike → runbook: rollout issues or upstream; feature flag rollback.
  - High error rate → runbook: inspect recent deploys and logs; trigger incident process.