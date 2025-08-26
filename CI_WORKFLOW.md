## CI Workflow

- Gates: secret scan, lint, unit/integration, e2e smoke.
- Artifacts: build server image tagged `ghcr.io/your-org/lab-results-server:${GIT_SHA}` and upload as build artifact; same for client if applicable.
- Preview: optional PR previews deploying `deploy/prod-compose.yml` with sanitized data.