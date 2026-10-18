# Customer onboarding runbook — MDM tenant configuration

Covers ticket 14 checklist item 9. Expands [technical-proposal.md §11](technical-proposal.md) with the concrete key names this app's managed-configuration reader (`src/config/load-managed-config.*.ts`, `modules/managed-config/`) expects. Background: [ADR-0004](adr/0004-mdm-managed-tenant-configuration.md).

## 1. Confirm entitlement and index the Knowledge Base

Confirm the Answers Entitlement and assign it to each intended Qlik User.

Index the Assistant's Knowledge Base before rollout. An Assistant with an unindexed Knowledge Base gives no answers.

## 2. Create the Native OAuth client

In the tenant's management console, create a **Native** OAuth client:

- Redirect URI: **`qlikanswers://auth`** — identical for every Customer, compiled into the binary. Do not create a Customer-specific redirect URI.
- Scopes: `user_default`, `offline_access`.
- No client secret is issued or needed (public client + PKCE).

## 3. Record the three configuration values

- Tenant hostname (no scheme, no trailing slash — e.g. `{tenant}.{region}.qlikcloud.com`)
- The Native OAuth client ID from step 2
- The assistant ID of the Assistant to expose

## 4. Push managed app configuration through the Customer's MDM

The app reads exactly these keys — names must match exactly, case-sensitive:

| Key | Type | Required | Notes |
|---|---|---|---|
| `tenantHost` | string | yes | No scheme, no trailing slash |
| `clientId` | string | yes | The Native OAuth client ID from step 2 |
| `assistantId` | string | yes | |
| `biometricTimeoutMs` | integer | no | Milliseconds before the lock gate re-locks after backgrounding. Defaults to 5 minutes if not pushed |

**iOS** — push these as Managed App Configuration (the `com.apple.configuration.managed` dictionary) through the MDM's app-config screen for this app.

**Android** — push these as App Restrictions. The app declares its restriction schema at `modules/managed-config/android/src/main/res/xml/app_restrictions.xml`; most MDM consoles read this schema automatically from the installed app and present a form for exactly these four keys.

A key the MDM doesn't send is simply absent, not an error — the app falls back to `ConfigMissing` guidance only if the whole set is incomplete (see step 5).

## 5. Verify with a low-privilege test user

1. Confirm the app resolves the pushed configuration. On an internal build, Settings shows "Active: `{tenantHost}}`"; on a release build the development entry screen is absent entirely, so success here is a normal sign-in.
2. Sign in as a Qlik User with deliberately limited Knowledge Base access.
3. Confirm answers are correctly restricted to that user's access — see [docs/poc-tickets/fixtures/13-authorization-guardrail-verification/NOTES.md](poc-tickets/fixtures/13-authorization-guardrail-verification/NOTES.md) for the exact method once two real users are available.
4. If configuration is missing or incomplete, confirm the app shows "This app has not been configured for your organization. Contact your IT administrator." rather than a raw error.
