## Test Plan

- Matrix:
  - Unit: utilities (parsers, validators), services, controllers.
  - Integration: DB with Prisma, queue interactions, webhook signature validation.
  - E2E: API flows (auth, import, search, export), access control, tenancy isolation.
  - Performance: ingestion throughput, export generation time, DB query latencies.
  - Security: authz boundaries, rate limiting, input validation, SSRF/RCE checks.
- Local:
  - npm ci in `server` and `client`; start server, run `bash test-api.sh` and `bash test-access-control.sh`.
  - Run unit/integration with `npm test` in `server`.
- CI:
  - See `.github/workflows/ci.yml`: install, start server, run API/access-control tests; secrets-scan job enforced.