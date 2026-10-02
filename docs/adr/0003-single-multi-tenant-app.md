---
status: accepted
---

# One application serving many Tenants

The app ships as a single codebase and single build that can connect to any Customer's Tenant, rather than a per-Customer fork or white-label build. Tenant hostname, OAuth client ID and assistant ID are runtime configuration, never source constants.

## Consequences

Qlik OAuth clients are per-Tenant with no cross-tenant registration, so onboarding a Customer always includes that Customer's admin creating a Native OAuth client in their own Tenant. There is no way to design that step away — see ADR-0004 for how the resulting values reach the app.
