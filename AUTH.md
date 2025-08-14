## Authentication & Authorization

- Token model: JWT access tokens (short-lived) + refresh tokens (rotatable); include claims: `sub`, `tenant_id`, `roles`, `iat`, `exp`.
- SSO: optional OIDC providers; map `groups` to internal roles.
- MFA: TOTP required for admin roles; recovery codes; enforced at login.
- Session invalidation: token blacklist for revocations; rotate refresh tokens on use.
- RBAC roles:
  - user: view own results; limited actions
  - lab_admin: manage lab users, resolve quarantine, exports
  - org_admin: manage tenant configuration, users, and billing
  - infra/service: internal automation with limited scope
- Flows: signup/invite, accept, login, refresh, password reset, disable; all actions audited.