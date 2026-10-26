---
status: accepted
---

> **Amended 2026-10-23 by [ADR-0013](0013-customer-brand-at-runtime-one-build.md).** The app reads one static Brand file per Customer that MTC hosts. There is still no server and no secret.

# Per-Qlik-User OAuth with PKCE, no backend token broker

Every app user is a Qlik User holding an Answers Entitlement, so the app authenticates each person as themselves against their Tenant using a public Native OAuth client with Authorization Code + PKCE, and talks to Qlik directly. We deliberately introduce no backend to broker tokens.

## Considered options

- **OAuth impersonation** via a confidential M2M client — required if app users were not Qlik Users. Rejected: it mandates a backend holding a client secret, and it moves authorization out of Qlik and into code we write.
- **A shared service account** — rejected outright. It collapses every Knowledge Base source permission onto one identity and makes audit trails meaningless.

## Consequences

Knowledge Base and source-level authorization stays entirely inside Qlik and is enforced per user, which is the point. In exchange we own nothing server-side — so anything that later *needs* a server (a hosted tenant-config service, aggregate usage analytics, a proxy for an API the client cannot reach) is a reversal of this decision and should be recorded as one, not slipped in.
