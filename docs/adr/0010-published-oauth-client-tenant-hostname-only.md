---
status: accepted
---

# One published OAuth client per region; the Qlik User enters only the tenant hostname

Customers found the setup too technical: a Tenant admin had to create a Native OAuth client and find its client ID and an assistant ID, then push them through MDM. We now ship MTC's own OAuth client inside the app instead. MTC creates one Native client in an MTC-owned Tenant per region and publishes it. A Customer's Tenant admin approves it once, and from then on a Qlik User types only the tenant hostname and signs in. The app finds the Assistant after sign-in by listing the Tenant's Assistants. MDM stays as an optional override for Customers that use it.

This amends [ADR-0003](0003-single-multi-tenant-app.md): the client ID is now compiled in, one per region, rather than being runtime configuration. It supersedes [ADR-0004](0004-mdm-managed-tenant-configuration.md) as the primary way configuration arrives. [ADR-0001](0001-per-user-native-oauth-no-backend.md) still holds: each Qlik User signs in as themselves with PKCE, and there is no backend.

## Evidence (2026-10-05)

A Native client created and published in `mtcmarketing.sg` showed its consent screen in `mtcklpi.sg`, a different Tenant. After one approval there, `mtcklpi` issued authorization codes with no further consent. A dev build then signed in to `mtcklpi` with that client ID and loaded the Qlik User's Analytics Apps. `GET /api/v1/assistants` with a user credential listed the Tenant's Assistants.

## Considered options

- **List the Qlik User's Tenants after sign-in, as My Qlik does.** Rejected: tenant-scoped credentials only see their own Tenant, and the cross-tenant Org API rejected a user credential (401).
- **Reuse the Qlik web session in a WebView, as Qlik's own app might.** Rejected: undocumented for third parties, and it would reverse ADR-0001.
- **Client ID Metadata Document.** Tenants advertise `client_id_metadata_document_supported`, which might remove the per-Tenant approval. Untested, and it needs a hosted file. Revisit if the approval step proves painful.

## Consequences

- MTC must own a Tenant in each region its Customers use. A published client only works within its region.
- Onboarding a Customer is one approval by their Tenant admin. Not yet verified: whether a non-admin's first sign-in can trigger that approval, and what such a user sees before it.
- Published clients use "required" consent by default. A Tenant admin may be able to switch their Tenant to "trusted".
- The Agentic Assistant is not yet discoverable the same way, because `/api/v1/cloud-assistants` returned 404.
