# Deployment Guide

- Artifacts: Docker images for `server` and `client`.
- Secrets: Use environment injection from a secret manager (AWS Secrets Manager, Vault, GCP Secret Manager). Do not store plaintext in files.
- Steps (docker-compose):
  1. Prepare `.env.production` with only non-secret placeholders; real secrets should come from the orchestrator.
  2. `docker compose -f deploy/prod-compose.yml --env-file .env.production up -d`.
- Steps (Kubernetes):
  - Apply `deploy/k8s/` manifests; integrate with your Secrets Store CSI driver for live secret mounts.
- Health: `/api/health` endpoint for liveness/readiness.