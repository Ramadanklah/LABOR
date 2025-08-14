## Tenancy Model

- Model: isolated tenants identified by subdomain; all data rows include `tenant_id`.
- Routing: subdomain-based routing maps requests to `tenant_id`; fallback header `X-Tenant-Id` for internal tools.
- Lifecycle: create → seed roles → configure webhooks → rotate secrets; suspend → read-only; delete → archive and purge per policy.
- RLS: database-level row security with `tenant_id = current_setting('app.tenant_id')::uuid`; set at session on request entry.
- Cross-tenant access: prohibited by default; admin tooling must assume tenant context explicitly.