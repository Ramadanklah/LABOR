# Migrations-Workflow und Backup/Restore-Plan

## Migrationen (SQL-first)

- Tooling: Flyway oder Liquibase, Migrationsverzeichnis: `sql/migrations/`
- Namenskonvention: `V{timestamp}__{kurze_beschreibung}.sql` (z. B. `V1__initial_schema.sql`)
- Entwicklungsfluss:
  1. Feature-Branch erstellen
  2. Migration hinzufügen/ändern (nur additive Änderungen für Zero-Downtime)
  3. CI: Lint → Unit → Integration (DB mit Migrationen) → Build
  4. Staging: automatische Anwendung + Smoke-Tests
  5. Produktion: manuelles Gate; ausrollen außerhalb Peak-Zeiten
- Rollback-Strategie:
  - Bevorzugt nondestruktiv und vorwärts gerichtete Fixes
  - Destruktive Änderungen zweiphasig: Deprecate → Backfill/Read-only → Entfernen
  - PITR via WAL als letzte Rückfallebene

## Backup & Restore

- Backups
  - Tägliche Snapshots (automatisch) in allen Environments
  - WAL-Archiving für Continuous PITR in Staging/Prod
  - Offsite-Kopien (separater Bucket/Region)
  - Retention: dev 7–14d, staging 14–30d, prod 35–90d
- Restore-Tests
  - Dev: mindestens 1× pro Sprint
  - Staging: monatlich vollständiger Restore inkl. Applikationsprüfungen
  - Dokumentation der Dauer, Schritte und Validierungsergebnisse
- Sicherheit
  - Backup-Buckets verschlüsselt (SSE-KMS), WORM-Option für Audit-Ablagen
  - Zugriff strikt auf Ops-Rollen beschränkt; Zugriff protokolliert

## Monitoring

- Alarme bei Backup-Fehlschlägen und Replica-Lags
- Metriken: Backup-Dauer, Restore-Zeit, RPO/RTO, WAL-Lag