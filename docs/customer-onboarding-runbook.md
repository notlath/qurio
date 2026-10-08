# Customer onboarding runbook — MDM tenant configuration

Covers ticket 14 checklist item 9. Expands [technical-proposal.md §11](technical-proposal.md) with the concrete key names this app's managed-configuration reader (`src/config/load-managed-config.*.ts`, `modules/managed-config/`) expects. Background: [ADR-0004](adr/0004-mdm-managed-tenant-configuration.md).

## 1. Confirm entitlement

Confirm the Answers Entitlement and assign it to each intended Qlik User.

Before rollout, confirm the Knowledge Base has completed indexing. Grant intended users access to the Assistant and its space. Verify an ordinary user can open the Assistant in Qlik Cloud; Tenant administration rights alone are not a substitute for the user's content access.

## 2. Approve the published Native OAuth client

MTC owns one published Native OAuth client per supported Qlik Cloud region. The app selects its client ID from the Tenant hostname. Confirm that MTC has supplied a production client for the Customer's region before rollout. A published client works across Tenants in its region, but it needs approval in each Customer Tenant. Its redirect URI is **`qlikanswers://auth`** and its scopes must include `user_default` and `offline_access`. A Native client uses PKCE and no client secret.

Ask a Tenant administrator to sign in through the app first. Review the client name, publisher and requested scopes in Qlik's consent screen, then approve the connection. After this first approval, the published client appears on the Customer Tenant's **Administration → OAuth** page. Test sign-in with a normal Qlik User only after Tenant Approval succeeds. Repeat this check in a second Tenant in the same region before a regional rollout.

Qlik calls the published client's consent method **Required**. Users may be prompted when the client requests a new scope. **Trusted** skips user consent for an unpublished, Tenant-owned client, but Qlik does not allow it for a published client. A Tenant administrator cannot switch this app's published client to Trusted. Do not replace the shared published client with a Tenant-owned client merely to suppress consent.

To withdraw this Tenant's approval, a Tenant administrator removes its connection to the client. The [OAuth clients API](https://qlik.dev/apis/rest/oauth-clients/) provides `DELETE /api/v1/oauth-clients/{id}/connection-configs/me` for the calling Tenant. This does not delete MTC's published client or connections in other Tenants. Verify that a fresh sign-in requires Tenant Approval again after removal. See [Qlik's OAuth client guide](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Admin/mc-create-oauth-client.htm) for the current publishing and consent rules.

## 3. Record configuration values

- Tenant hostname (no scheme, no trailing slash — e.g. `{tenant}.{region}.qlikcloud.com`)
- The regional published Native OAuth client ID supplied by MTC, if this region is not built into the app
- Optional classic Assistant ID. Users can choose an accessible Assistant after sign-in if this is absent.

## 4. Push managed app configuration through the Customer's MDM

The app reads exactly these keys — names must match exactly, case-sensitive:

| Key | Type | Required | Notes |
|---|---|---|---|
| `tenantHost` | string | yes | No scheme, no trailing slash |
| `clientId` | string | no for supported regions | Set only when MTC supplies a published Native OAuth client ID to override the built-in ID or to support another region |
| `assistantId` | string | no | Optional classic Assistant ID |
| `biometricTimeoutMs` | integer | no | Milliseconds before the lock gate re-locks after backgrounding. Defaults to 5 minutes if not pushed |

**iOS** — push these as Managed App Configuration (the `com.apple.configuration.managed` dictionary) through the MDM's app-config screen for this app.

**Android** — push these as App Restrictions. The app declares its restriction schema at `modules/managed-config/android/src/main/res/xml/app_restrictions.xml`; most MDM consoles read this schema automatically from the installed app.

A key the MDM does not send is absent. The app needs a hostname and a client ID from either the regional table or the managed configuration.

## 5. Verify with a low-privilege test user

1. Confirm the app resolves the configured Tenant. On an internal build, Settings shows "Active: `{tenantHost}`"; on a release build the development entry screen is absent, so success here is a normal sign-in.
2. Sign in as a Qlik User with deliberately limited Knowledge Base access.
3. Confirm answers are correctly restricted to that user's access — see [docs/poc-tickets/fixtures/13-authorization-guardrail-verification/NOTES.md](poc-tickets/fixtures/13-authorization-guardrail-verification/NOTES.md) for the exact method once two real users are available.
4. Confirm the Assistant's Knowledge Base is indexed and this user has access to its space. Ask a question and confirm the Assistant returns an answer.
5. If configuration is missing or incomplete, confirm the app shows "This app has not been configured for your organization. Contact your IT administrator." rather than a raw error.
