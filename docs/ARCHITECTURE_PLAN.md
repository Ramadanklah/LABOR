# Architektur-, Sicherheits- und Delivery-Plan

Dieses Dokument beschreibt die End-to-End-Architektur, Datenmodell, Security/Compliance-Vorgaben sowie den Delivery-/Operations-Plan entlang der Phasen 1–9. Es dient als Quelle für Umsetzung, Tests und Abnahme.

## Phase 1 — Persistenz & Datenmodell

- Zielarchitektur
  - PostgreSQL als persistente relationale Datenbank (Managed Service empfohlen; Alternativen: CloudNativePG/Crunchy Operator).
  - Objektstore für PDFs: S3/MinIO mit serverseitiger Verschlüsselung (SSE-KMS).
  - IaC via Terraform für dev/staging/prod.

- Provisionierung & Backups
  - Instanzen: `pg-{dev,staging,prod}`; prod hochverfügbar (Multi-AZ). Zeitzone UTC.
  - Parameter: `wal_level=replica`, `max_wal_senders>=10`, `shared_buffers≈25% RAM`.
  - Backups: tägliche Snapshots; PITR über WAL-Archiving (staging/prod); Offsite-Kopien; regelmäßige Restore-Tests.
  - Sicherheit: TLS erzwungen, SCRAM-SHA-256, VPC-only/Firewall, Secrets in Secret-Store.

- ER-Modell (Kernentitäten)
  - `User` (Rollen, optional `lanr`)
  - `Patient`
  - `Result` (Befund; inkl. `orderingLanr`)
  - `RawMessage` (Roh-Nachrichten)
  - `Report` (PDF-Metadaten)
  - `AuditLog`
  - Optional: `Practice`, `UserPractice` (BSNR-Zuordnung)

- Felddefinitionen
  - Siehe `sql/migrations/V1__initial_schema.sql` für vollständiges DDL inkl. Indizes/Constraints.

- Migrations- & Release-Plan
  - Werkzeug: Flyway/Liquibase (SQL-first). Alternativ Prisma Migrate für App-nahe Entwicklung.
  - Workflow: Dev → CI (mit Migrationen) → Staging (auto) → Prod (manuelles Gate, zero-downtime, additive Änderungen, Backfill).
  - Rollback: bevorzugt nondestruktiv; 2-Phasen-Entfernung; PITR als Fallback.

## Phase 2 — Ingest & Verarbeitung

- Ingest-API
  - `POST /api/ingest/raw` mit `X-Source-Id`, `Content-Type`, optional `X-External-Message-Id`, Idempotency-Key.
  - Body: Base64-Payload, Typ (LDT/HL7/FHIR), Timestamps, Metadaten.
  - Server: SHA-256 berechnen, LANR/BSNR extrahieren, `RawMessage` speichern (Status `RECEIVED`).

- Idempotenz & Duplikate
  - Roh-Ebene: UNIQUE `sha256`; UNIQUE (`source_id`,`external_message_id`) wenn vorhanden.
  - Result-Ebene: UNIQUE `message_uid` oder deterministischer Inhaltshash; Duplikate via `duplicate_of_result_id` markieren.

- Asynchrone Pipeline
  - Queue (SQS/Rabbit/Kafka), Stufen: parse → validate → persist → finalize. Retries, DLQ, idempotente Worker.

- LANR-Extraktion & Validierung
  - 9-stellig numerisch; Validierungsreport; invalid/missing → Admin-Queue (`VALIDATION_FAILED`).

- Mapping-Logik
  - Exact `orderingLanr == user.lanr` → zuordnen.
  - BSNR-Prüfung (`practice.bsnr`) → bei Eindeutigkeit zuordnen, sonst manuell.

## Phase 3 — Authentifizierung & Autorisierung

- Auth-Mechanismus
  - JWT Access (5–15 min) + rotierende Refresh Tokens (DB-gebunden, 30–90 Tage), MFA für Admin optional.

- Token-Claims
  - `sub`, `role`, `lanr?`, `patientId?`, `practiceIds?`, `scope`, `iss`, `aud`, `iat`, `exp`.

- Object-Level Authorization (Default-Deny)
  - Patient: Zugriff nur auf eigene `Result`.
  - Doctor: Zugriff nur wenn `orderingLanr == token.lanr` (optional Praxis-Regeln).
  - Admin: Nur Admin-Endpunkte; alles audit-geloggt.

- Fallbacks
  - Kein/mehrfaches LANR-Match → keine Freigabe; Admin-Queue.

## Phase 4 — Ergebnishaltung & PDF-Handling

- Storage-Policy
  - S3/MinIO-Buckets mit Versioning, SSE-KMS, Block Public Access; Schlüssel-Schema `{env}/results/{result_id}/reports/{report_id}_v{version}.pdf`.

- Download-Flow
  - OLA-Prüfung → Pre-Signed URL (TTL 5–15 min) → AuditLog `REPORT_DOWNLOAD`.

- Archiv & Retention
  - Richtwerte (zu verifizieren): Results/Reports 10 Jahre; RawMessages 1–2 Jahre; AuditLogs ≥ 2 Jahre.

## Phase 5 — Security, Privacy & Compliance

- Secrets & TLS
  - Secret-Store; TLS überall; HSTS; HTTPS-Redirect; sichere Cookies.

- Hardening
  - CORS-Whitelist, Security Headers, Rate-Limits, Input-Sanitization, Parser-Härtung, Dependency/Container-Scans, Cloud-RBAC.

- Audit-Logging
  - Append-only; Export (CSV/JSON) signiert; Rotation/Partitionierung.

- GDPR
  - VVT, DPAs, Betroffenenrechte (Export/Korrektur/Löschung), Incident-Response (72h).

- Encryption & Pseudonymisierung
  - At-Rest (DB/Objektstore), In-Transit (TLS), optional Feldverschlüsselung (pgcrypto), KMS-Rollen.

## Phase 6 — Testing & QA

- Unit/Integration
  - Parser, LANR-Validierung, Mapping, AuthZ, Constraints/Idempotenz.

- E2E (Mirth → Ingest → Result → Download)
  - Duplikate, OLA, Unmatched-Queue, Download-Audit, Retention.

- Security Tests
  - OWASP ASVS/API, BOLA/BFLA, Fuzzing, externer Pentest.

## Phase 7 — DevOps, Deployment & Operations

- Environments
  - Dev/Staging/Prod via Terraform; `/health`, `/ready`, `/metrics`.

- CI/CD
  - lint → unit → integration (mit DB + Migrationen) → build → migration-check → deploy staging → E2E → manual prod.

- Backup & Restore
  - Täglich Full, stündlich WAL; regelmäßige Restore-Tests und Dokumentation.

- Monitoring & Alerting
  - Sentry + Prometheus/Grafana; SLIs (Queue depth, Latenzen), SLOs.

- Runbooks
  - Data breach, Restore, Mapping-Errors, DLQ, Key-Rotation, Token-Reuse.

## Phase 8 — UX / Admin / Support

- Admin-UI
  - Unmatched-RawMessages prüfen, LANR/BSNR korrigieren, Patient zuordnen; Kommentare + Audit.

- User-UI
  - Patient: nur eigene Befunde; Doctor: `orderingLanr`-basiert; autorisierte Downloads.

- Notifications & Consent
  - Opt-in/Double-Opt-In, Logs, Unsubscribe.

- Support
  - FAQ, Kontakt, SLA, Eskalation.

## Phase 9 — Rollout & Go-Live

- Pilot → stufenweiser Rollout → Post-Go-Live Review.

## Akzeptanzkriterien (Auszug)

- DB erreichbar, Backups aktiv, Restore getestet.
- ER-Diagramm/Schema genehmigt; Ingest speichert `payload`, `sha256`, `extractedLanr|null`.
- Idempotenz verhindert doppelte Results.
- JWT-Claims, Default-Deny OLA, Audit-Logs für Downloads/Admin.
- Retention/Deletion gemäß Policy.
- CI/CD grün inkl. E2E.

## Sprint-Priorisierung (6×2 Wochen)

1) DB + Schema + Auth-Basis + Raw-Ingest
2) Mapping-Logik + OLA + Auth-Tests
3) Worker-Pipeline + Idempotenz + PDF-Storage
4) Auditlog + Admin Unmatched UI + Retention-Basics
5) Security Hardening + Backups + CI/CD
6) Pilot-Rollout + Monitoring + Pentest