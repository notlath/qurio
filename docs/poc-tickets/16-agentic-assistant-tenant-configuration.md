# 16 — Add agenticAssistantId to Tenant Configuration

**What to build:** An optional Agentic Assistant identifier delivered through the existing managed/development Tenant Configuration resolver. Older configuration remains valid; absence of the new identifier disables the embedded Assistant entry.

**Blocked by:** None (can start immediately). The field is needed under every auth path ticket [15](15-record-embedded-auth-spike-outcome.md) may select, so it does not wait on that decision.

**Status:** ready-for-agent

- [ ] `TenantConfig` gains optional `agenticAssistantId`; it is distinct from the classic `assistantId` and never compiled in
- [ ] Managed configuration on both platforms and development configuration preserve the field through the existing normaliser, resolver and storage path; no second resolver is introduced
- [ ] Normalisation accepts a non-empty string, applies the existing identifier cleaning, and treats missing/blank values as absent. Tests cover malformed types and values that become empty after cleaning
- [ ] Existing whole-source precedence remains intact: complete managed configuration wins, including when it omits `agenticAssistantId`; the value is not filled from a development configuration that may name a different Tenant
- [ ] Add the optional restriction and description resource to `modules/managed-config/android/src/main/res/xml/app_restrictions.xml` and its strings. Verify the schema registered by `plugins/withManagedConfigRestrictions.js`; do not assume a declared key exists in the runtime Bundle
- [ ] The internal Settings form can load, save and clear the optional field; saving triggers the existing configuration reload path. Development entry remains absent in release builds
- [ ] Expose the resolved optional value to navigation without a duplicate source of truth. Tickets 17 and 21 use it to hide the Assistant tab and guard direct entry when absent
- [ ] Keep the classic `assistantId` requirement while native classic chat remains. Its removal and the final Apps-only configuration rules belong to ticket 22
- [ ] Tests cover old payloads, optional-field cleaning, managed/development precedence and the Settings save round-trip. Demonstrate Android and iOS managed-config delivery with the new key; document any emulation
- [ ] Evidence: configuration tests and `npm run lint`, `npx tsc --noEmit`, `npm test` pass. Rebuild affected development clients for the native restriction-resource change; use [the development-build runbook](../dev-build-runbook.md), never Expo Go

References: [ADR-0003](../adr/0003-single-multi-tenant-app.md), [ADR-0004](../adr/0004-mdm-managed-tenant-configuration.md), [ticket 14](14-enterprise-mdm-configuration.md).
