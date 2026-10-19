---
status: accepted
---

# A Metadata Client signs in every region that has no Published Client

A Published Client works only in the Region where MTC created it (ADR-0010). MTC owns Tenants in `sg`, `ap` and `us`. A Qlik User in any other Region could not sign in without a client ID from their Tenant admin. We now host one Client ID Metadata Document (CIMD) and use its address as the client ID in every Region that has no Published Client. The Qlik User types only the tenant hostname. The Tenant admin approves the app once.

This amends [ADR-0010](0010-published-oauth-client-tenant-hostname-only.md): the table of Published Clients stays for `sg`, `ap` and `us`, and the Metadata Client covers the rest. [ADR-0001](0001-per-user-native-oauth-no-backend.md) still holds: PKCE, no backend, no secret.

## Evidence (2026-10-19)

- Tenants in `us`, `eu`, `de`, `uk`, `se`, `sg` and `ap` advertise `client_id_metadata_document_supported: true`. Regions with no public Tenant (`jp`, `in`, `ca`, `il`, `ae`, `br`, `fr`) are unverified.
- In `mtcreports.us`, a Tenant with no Published Client, an admin approved a test document that listed `qlikanswers://auth`. Qlik created a Native client from it with the `refresh_token` grant and the `offline_access` scope. Qlik accepts a custom-scheme redirect without a period.
- An iOS device in Expo Go then signed in to that Tenant. The log showed `granted: offline_access user_default`.
- Research and probes: [research-qlik-oauth-any-region.md](../research-qlik-oauth-any-region.md).

## Considered options

- **Ask Qlik for a static all-region client.** Qlik runs one for Claude Desktop. Nothing says it offers one to a partner app. Ask in parallel. If Qlik agrees, it can replace the hosted document.
- **A Published Client per Region.** Works, but MTC needs a Tenant, a client and an app release for each new Region.
- **The Customer's admin makes a Native client.** Works, but it is the setup we removed in ADR-0010.
- **Dynamic client registration and API keys.** Rejected. Dynamic registration needs an admin to enable it and approve each registration within 60 minutes, and gives no `offline_access`. An API key gives full access.

## Consequences

- The document's address is the client's identity. A new address is a new client, and every Tenant that approved the old one must approve again. The address must never change.
- **Beta only.** The address is `https://notlath.github.io/qurio-oauth/client.json`, on a personal GitHub Pages account. Before any Customer production release, move the file to an MTC-owned domain, and accept that Tenants must approve again. This is a release gate.
- Qlik offers no way to approve in advance. The first sign-in at a new Tenant must be by a Tenant admin. A Qlik User who is not an admin sees the Tenant Approval message and can share a request with their admin.
- A Tenant admin cannot set a Metadata Client to "trusted" consent.
- Not verified: what Qlik shows a non-admin before approval, a token refresh after the access token expires, and Android. A non-admin test on `mtcreports.us` is a release gate.
- A session stays tied to the client that signed it in. Qlik refuses the engine token exchange when the client the app names differs from the client in the token (`OAUTH-31`, seen 2026-10-20 after a client change without a new sign-in). If MTC later publishes a client for a Region that uses the Metadata Client, existing sessions there must sign in again.
- Published Clients and the Metadata Client are separate clients. A Tenant in `sg`, `ap` or `us` never sees the Metadata Client.
- The app accepts `<name>.<region>.qlikcloud.com`, including a Tenant alias. Custom domains stay rejected. Qlik publishes no domain for the government and sovereign clouds.
- Qlik Answers is missing in some Regions (`fr`, `se`, `il`, `ae` are not listed), and the Agentic experience lacks some contexts in Singapore and Mumbai. These are limits of the Tenant. The app does not gate sign-in by Region.
