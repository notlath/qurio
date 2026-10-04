---
status: superseded
---

> **Superseded 2026-10-05 by [ADR-0010](0010-published-oauth-client-tenant-hostname-only.md).** The Qlik User now enters only the tenant hostname. MDM remains an optional override. Kept below as the original reasoning.

# Tenant configuration arrives via MDM managed app configuration

Given enterprise/internal distribution, each Customer's MDM pushes their non-secret Tenant configuration (tenant hostname, OAuth client ID, assistant ID) into the app using the standard AppConfig mechanism. No configuration service is hosted, keeping ADR-0001's no-backend position intact.

## Considered options

- **A hosted config service** keyed by email domain — deferred, not rejected. It is the path if the product moves to public store distribution, and adopting it means accepting a backend.
- **OAuth Dynamic Client Registration** — rejected as the onboarding mechanism. Each Tenant admin must still enable DCR and approve the first consent, unapproved clients are deleted after 60 minutes, and native clients are not documented as supported. Explicit provisioning is simpler and more predictable for enterprise onboarding.
