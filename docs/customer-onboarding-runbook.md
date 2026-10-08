# Customer onboarding runbook — MDM tenant configuration

Covers ticket 14 checklist item 9. This runbook expands [technical-proposal.md §11](technical-proposal.md). It lists the keys expected by the managed-configuration reader (`src/config/load-managed-config.*.ts`, `modules/managed-config/`). Background: [ADR-0004](adr/0004-mdm-managed-tenant-configuration.md).

## 1. Confirm entitlement

1. Confirm the Answers Entitlement.
2. Assign it to each intended Qlik User.
3. Confirm the Knowledge Base has completed indexing before rollout.
4. Grant intended users access to the Assistant and its space.
5. Verify an ordinary user can open the Assistant in Qlik Cloud. Tenant administration rights do not grant the user content access.

## 2. Approve the published Native OAuth client

The planned production regions are Singapore (`sg`) and Asia Pacific (`ap`). MTC plans one published Native OAuth client per region. Those production clients are not yet published.

The app selects a regional client ID from the Tenant hostname. A published client works across Tenants in its region. Each Customer Tenant must approve it. For a custom domain or unsupported region, the Customer can supply its own Native OAuth client ID through MDM. The approval steps below apply to MTC's published regional client.

1. Confirm MTC has published a production client for the Customer's region before the regional rollout.
2. Confirm its redirect URI is **`qlikanswers://auth`**.
3. Confirm its scopes include `user_default` and `offline_access`. A Native client uses PKCE and no client secret.
4. Ask a Tenant administrator to sign in through the app first.
5. Review the client name, publisher, and scopes in Qlik's consent screen.
6. Approve the connection.
7. Confirm the published client appears on the Customer Tenant's **Administration → OAuth** page.
8. Test sign-in with a normal Qlik User after Tenant Approval succeeds.
9. Repeat this check in a second Tenant in the same region before regional rollout.

Qlik calls the published client's consent method **Required**. Users may be prompted when the client requests a new scope. **Trusted** skips user consent for an unpublished, Tenant-owned client. Qlik does not allow Trusted for a published client. A Tenant administrator cannot switch this app's published client to Trusted. Do not replace the shared published client with a Tenant-owned client merely to suppress consent.

To withdraw this Tenant's approval, a Tenant administrator removes its connection to the client. The [OAuth clients API](https://qlik.dev/apis/rest/oauth-clients/) provides `DELETE /api/v1/oauth-clients/{id}/connection-configs/me` for the calling Tenant. This does not delete MTC's published client or connections in other Tenants. Verify that a fresh sign-in requires Tenant Approval again after removal. See [Qlik's OAuth client guide](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Admin/mc-create-oauth-client.htm) for the current publishing and consent rules.

## 3. Record configuration values

- Tenant hostname (no scheme, no trailing slash — e.g. `{tenant}.{region}.qlikcloud.com`)
- The regional published Native OAuth client ID supplied by MTC, if this region is not built into the app.
- For a custom domain or unsupported region, the Customer's own Native OAuth client ID.
- Optional classic Assistant ID. Users can choose an accessible Assistant after sign-in if this is absent.

## 4. Push managed app configuration through the Customer's MDM

The app reads exactly these keys — names must match exactly, case-sensitive:

| Key | Type | Required | Notes |
|---|---|---|---|
| `tenantHost` | string | yes | No scheme, no trailing slash |
| `clientId` | string | no for supported regions | Use MTC's published ID to override the built-in ID. Use the Customer's own Native client ID for a custom domain or unsupported region. |
| `assistantId` | string | no | Optional classic Assistant ID |
| `biometricTimeoutMs` | integer | no | Milliseconds before the lock gate re-locks after backgrounding. Defaults to 5 minutes if not pushed |

**iOS** — push these as Managed App Configuration (the `com.apple.configuration.managed` dictionary) through the MDM's app-config screen for this app.

**Android** — push these as App Restrictions. The app declares its restriction schema at `modules/managed-config/android/src/main/res/xml/app_restrictions.xml`. Most MDM consoles read this schema from the installed app.

A key the MDM does not send is absent. The app needs a hostname and a client ID from either the regional table or the managed configuration.

## 5. Verify with a low-privilege test user

1. Confirm the app resolves the configured Tenant. Settings shows the Tenant hostname (`{tenantHost}`). The development entry screen is absent on release builds.
2. Sign in as a Qlik User with deliberately limited Knowledge Base access.
3. Confirm answers respect that user's access. See [the authorization verification notes](poc-tickets/fixtures/13-authorization-guardrail-verification/NOTES.md) for the exact method once two real users are available.
4. Confirm the Assistant's Knowledge Base is indexed.
5. Confirm this user has access to its space.
6. Ask a question.
7. Confirm the Assistant returns an answer.
8. If configuration is missing or incomplete, confirm the app shows "This app has not been configured for your organization. Contact your IT administrator." rather than a raw error.
