# 23 — Extend Customer onboarding for Analytics Apps and the Agentic Assistant

**What to build:** Update the existing Customer onboarding runbook with the selected auth path, optional Agentic Assistant configuration and Tenant-side prerequisites, so an administrator can enable the product without discovering them through failed sign-ins.

**Blocked by:** Tickets [15](15-record-embedded-auth-spike-outcome.md), [16](16-agentic-assistant-tenant-configuration.md) and [21](21-embedded-agentic-assistant-tab.md). It does not wait on ticket [20](20-open-analytics-app-sheets.md): Analytics App opening and Sheet guidance are added to this runbook only if and when ticket 20 ships.

**Status:** blocked

- [ ] Edit `docs/customer-onboarding-runbook.md` rather than creating a parallel runbook; retain one build/many Tenants, MDM delivery and `qlikanswers://auth` Native OAuth setup
- [ ] Add the optional `agenticAssistantId` key, how an administrator obtains it, its distinction from classic `assistantId`, and what omission means: Analytics Apps/Settings remain available and the final Assistant tab is hidden
- [ ] List the Agentic AI role permissions and OAuth scopes for the enabled contexts, based on research §10 and current published Qlik documentation: `analysis-agent`, `data-governance-agents`, `help-agent`, `thread-audits`. Distinguish available scopes from those actually needed/approved; do not grant all of them blindly
- [ ] Verify the Native OAuth client's granted scopes and the app's requested scopes agree for the selected path. If `src/auth/oauth.ts`'s existing `user_default`/`offline_access` request is insufficient, resolve the required request change in ticket 19 before accepting this runbook; a documentation edit alone does not add permissions
- [ ] Describe Answers Entitlement, Assistant/Knowledge Base access and Analytics App permissions; verify with a low-privilege Qlik User rather than an administrator
- [ ] Explain that cross-region inference opt-in is a Customer data-residency decision and a prerequisite for agentic use. Document Singapore's unavailable Data product, Glossary and Data quality contexts without suggesting app code can enable them
- [ ] Document the auth experience actually approved in ticket 15. If it uses Qlik web pages, explicitly describe the second sign-in, cookie lifetime and sign-out clearing; do not create a SPA client or promise a single sign-in contrary to the evidence
- [ ] Provide an end-to-end check: push configuration, sign in, list accessible Analytics Apps, ask Knowledge Base/Analytics App questions, inspect Citations/history, and sign out. Verify no previous Qlik User's embedded session survives
- [ ] State online-only operation, development-build requirements and any rebuild required by MDM resource changes; no Expo Go or offline-download instructions are added
- [ ] Keep examples as placeholders and evidence sanitised. Match configuration requirements to the migration stage; ticket 22 updates this same runbook when classic `assistantId` retires
- [ ] Evidence: an administrator or documented MDM emulation follows the updated steps on iOS/Android; verify document links/key names, and run `npm run lint`, `npx tsc --noEmit`, `npm test`

References: [Customer onboarding runbook](../customer-onboarding-runbook.md), [research §10](../research-integration-gaps.md#10-agentic-path--any-supported-route-today), [ADR-0003](../adr/0003-single-multi-tenant-app.md), [ADR-0004](../adr/0004-mdm-managed-tenant-configuration.md), [development-build runbook](../dev-build-runbook.md).
