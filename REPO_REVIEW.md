### Repository Security Review

- Findings:
  - Tracked environment files: `.env`, `server/.env` (removed).
  - Tracked logs under `server/logs/` (removed).
  - Demo credentials appear in docs and helper scripts; marked as dev-only.
  - No private keys or secrets found in source files beyond examples.

- Actions taken:
  - Removed `.env`, `server/.env`, and log files from source control and added ignores in `.gitignore`.
  - Added pre-commit secret scanning config via `detect-secrets` and `git-secrets`.
  - Generated `.secrets.baseline` for use with detect-secrets and CI.
  - Added CI job `.github/workflows/ci.yml` `secrets-scan` to fail builds when secrets are detected.
  - Updated README to clearly mark sample credentials as development-only.

- How to run secret scans locally:
  - Install detect-secrets: `pip install detect-secrets` or use a virtualenv.
  - Scan: `detect-secrets scan --baseline .secrets.baseline`
  - Audit: `detect-secrets audit .secrets.baseline`
  - Pre-commit: install `pre-commit` and run `pre-commit install`, then commits will be scanned automatically.

- Commit demonstrating purge:
  - See commit removing `.env` and logs from tracking in this branch.

- Risks & mitigations:
  - Risk: accidental re-introduction of secrets. Mitigation: enforced pre-commit and CI secret scanning; `.gitignore` hardened.