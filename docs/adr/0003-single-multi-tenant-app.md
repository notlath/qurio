---
status: accepted
---

> **Amended 2026-10-05 by [ADR-0010](0010-published-oauth-client-tenant-hostname-only.md).** The OAuth client ID is now MTC's published client, compiled in once per region. Customers no longer create their own client. The single-app decision below still stands.

# One application serving many Tenants

The app ships as a single codebase and single build that can connect to any Customer's Tenant, rather than a per-Customer fork or white-label build. Tenant hostname, OAuth client ID and assistant ID are runtime configuration, never source constants.

## Consequences

Qlik OAuth clients are per-Tenant with no cross-tenant registration, so onboarding a Customer always includes that Customer's admin creating a Native OAuth client in their own Tenant. The Tenant admin's approval of a client cannot be designed away, but creating the client can. See ADR-0010 and ADR-0012.
