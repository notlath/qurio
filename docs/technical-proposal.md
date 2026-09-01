# Technical Proposal — QlikAnswersApp

A dedicated React Native client for Qlik Answers on iOS and Android.

**Status of this document.** It implements the decisions recorded in [ADR-0001 to ADR-0007](./adr) and uses the vocabulary in [CONTEXT.md](../CONTEXT.md). It introduces no new architectural decisions. Open questions are researched in [research-integration-gaps.md](./research-integration-gaps.md). Claims are tagged:

- **[API]** — verified against Qlik's published OpenAPI specs (`qlik.dev/specs/rest/assistants.json`, `qlik.dev/specs/rest/oauth.json`) or vendor documentation, re-checked 2026-09-01.
- **[POC]** — must be measured or confirmed during the proof of concept.
- **[ASSUMED]** — a reasoned assumption that has not been verified.

---

## 1. Recommended architecture

```
┌────────────────────── React Native (iOS / Android) ───────────────────────┐
│                                                                           │
│  src/app/       Expo Router screens — chat-first, new Thread on launch     │
│       │                                                                   │
│       │ consumes only domain types                                        │
│       ▼                                                                   │
│  src/domain/    Thread · Interaction · Answer · Citation · Starter · errors│
│       ▲                                                                   │
│       │ implements AnswersPort                                            │
│  src/qlik/      classic adapter → Assistants REST   (agentic adapter later)│
│                                                                           │
│  src/auth/      PKCE · SecureStore · refresh · revoke · biometric gate     │
│  src/config/    TenantConfig from MDM (prod) or dev screen (internal)      │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │ HTTPS, per-user bearer token
                                    ▼
                       Qlik Cloud tenant ({tenantHost})
                       /oauth/*  ·  /api/v1/assistants/*
```

**No backend.** Every user authenticates as themselves and calls Qlik directly (ADR-0001). Knowledge Base and source-level authorization stays inside Qlik. Nothing server-side is owned, deployed, or paid for.

The only layer that knows Qlik exists is `src/qlik/`. That is what makes the eventual agentic swap a contained change rather than a rewrite (ADR-0006).

---

## 2. Qlik Answers integration approach

### 2.1 What is actually available

**[API]** The published Assistants REST API (`/api/v1/assistants/...`) serves **classic** Assistants — Knowledge Base retrieval only. Endpoints this app uses:

| Purpose | Endpoint |
|---|---|
| Verify assistant access at startup | `GET /api/v1/assistants/{id}` |
| List Threads (paginated, sortable) | `GET /api/v1/assistants/{assistantId}/threads` |
| Create Thread | `POST /api/v1/assistants/{assistantId}/threads` |
| Get Thread with messages | `GET /api/v1/assistants/{assistantId}/threads/{threadId}` |
| Delete Thread | `DELETE /api/v1/assistants/{assistantId}/threads/{threadId}` |
| Ask (streaming) | `POST .../threads/{threadId}/actions/stream` |
| Ask (non-streaming) | `POST .../threads/{threadId}/actions/invoke` |
| List Interactions | `GET .../threads/{threadId}/interactions` |
| Submit Feedback | `POST .../threads/{threadId}/interactions/{interactionId}/feedback` |
| Starters | `GET /api/v1/assistants/{assistantId}/starters` |

**[API]** `GET threads` supports `filter`, `limit`, `next`/`prev` cursors and `sort` (`NAME`, `CREATED`, `UPDATED`, each reversible with `-`). History pagination is server-side, which is why no client cache is needed.

**[API]** Rate limits are declared per operation in the spec as `x-qlik-tier`: `GET threads` is `{tier: 1, limit: 1000}`; `POST threads`, `actions/invoke` and `actions/stream` are all `{tier: 2, limit: 100}` per minute. Every endpoint used here is marked `x-qlik-visibility: public` and `x-qlik-stability: stable`. Tier limits are evaluated per tier, per user, per tenant over a rolling 5-minute window, with a tenant aggregate of `user_limit x users x 0.5`. The only rate-limit response header Qlik publishes is `Retry-After` — there are no `X-RateLimit-*` headers anywhere in its specs, so the client is purely reactive.

### ⚠ The binding limit is not the tier limit

**[API]** Qlik Answers declares its own guardrails **per subscription**: *"Knowledge base search rate limit: 50 per minute per subscription. Assistant question rate limit: 20 per minute per subscription."* Twenty questions per minute across an entire tenant is two orders of magnitude below the tier-2 limit, and every user of the app shares it.

The consequence is a product one, not a tuning one: past a modest number of concurrent users, a question is rejected because of *other people's* traffic. "Too busy, try again" must therefore be a first-class retryable UI state rather than an error, the client must honour `Retry-After` and must not auto-retry aggressively (that worsens the contention), and the Customer needs this number before they size a rollout. Because limits are tier-scoped, a 429 on a prompt does not block thread listing, so history and navigation stay responsive while asking is throttled.

### 2.2 Agentic Assistant — the open dependency

**[API]** Agentic Answers (structured + unstructured) is served by `/api/v1/cloud-assistants/...`, which Qlik has **not published**. Verbatim, from Levi Turner (badged Qlik Employee) on the Qlik Community, 2026-08-19: the `/api/v1/assistants/...` path "routes to Qlik Answers prior to the integration of structured data so it will only return information from Knowledge Bases", while "Qlik Answers against structured and unstructured uses the path /api/v1/cloud-assistants/.... which is not published. It is on the roadmap to have these API published." No committed date. The only supported route today is the `ai/agentic-assistant` web component, which is browser-only.

Per ADR-0002, the unpublished endpoints are barred from the production adapter. The architecture prepares for agentic; it cannot deliver what Qlik does not support. The accurate description of v1 is:

> A native React Native client for Qlik Answers using the supported Assistants REST API, architected to support Agentic Assistant when Qlik exposes a supported native API.

### 2.3 Wire shapes

**[API]** Ask request (both `invoke` and `stream`):

```json
{ "input": { "prompt": "What changed in the Q3 policy?", "promptType": "thread", "includeText": true } }
```

`includeText: true` returns matched chunk text inside each source — this is what makes a Citation worth rendering rather than a bare filename.

**[API]** `invoke` response (`promptOutputInvoke`): `{ output, sources[], question }`.

**[API]** Each `source`: `{ source, documentId, datasourceId, knowledgebaseId, chunks[] }`, where a chunk is `{ chunkId, text }`. Note `source` is the *document path* (e.g. `"Reference.md"`).

**[API]** An `Interaction`: `{ id, request, response, sources[], feedback?, rejected?, threadId, ownerId, createdAt, updatedAt }`. A `Thread` fetched by id returns `ThreadWithMessages`, whose `messages[]` carry `{ id, role: "human" | "ai", content, sources[], createdAt }`.

**[API]** Feedback body: `{ vote: 1 | -1, reason: "inaccurate" | "irrelevant" | "repetitive" | "unhelpful" | "other", comment? }`.

### 2.4 Two gotchas found in the spec

**The stream is not SSE, and it is not newline-delimited either.** **[API]** The spec declares the `actions/stream` 200 response as `application/json` returning `promptOutput` — no `text/event-stream`, no `data:` prefixes. Qlik's own worked example reads the body as raw chunks and splits them with `/(?<=\})(?=\{)/` — i.e. **the response is a run of JSON objects concatenated with no delimiter at all**, `}{` against `}{`. There is no `[DONE]` sentinel from Qlik; the stream simply ends. (The `[DONE]` visible in Qlik's example is that blog's *own* Node server re-emitting SSE to its browser — `res.write("data: [DONE]\n\n")` — not something Qlik sends. Its `EventSource` likewise points at its own backend, not at Qlik.)

Two consequences: any `EventSource` polyfill is the wrong tool, and **splitting on `}{` by regex is unsafe** — it breaks when an object spans two network chunks and when the answer text itself contains `}{`. Qlik's example papers over exactly this with a `catch` that silently drops unparseable fragments, which would lose answer text. The parser in §6 splits on brace depth outside of strings instead.

**[ASSUMED]** Sources appear to arrive as their own object in the same stream rather than as a field on the text chunks — Qlik's example special-cases a fragment starting `{"sources"`, though it does so inside its `catch`, i.e. only for fragments that failed to parse. That is evidence such fragments exist and can arrive split, not proof of their framing. **[POC]** Confirm ordering and whether sources always arrive last.

**Streaming returns no interaction id.** `promptOutput` carries only `output` and `sources` **[API]**, yet feedback is addressed as `.../interactions/{interactionId}/feedback`. After a streamed answer completes, the adapter must reconcile via `GET .../interactions` (newest first) to obtain the id. This is an extra round-trip — and it is the same reconciliation path used after a backgrounded stream, so one mechanism serves both needs.

---

## 3. Authentication

### 3.1 Flow

```
Sign in
  → resolve TenantConfig (MDM, or dev screen on internal builds)
  → build discovery from tenantHost (no .well-known — see below)
  → expo-auth-session: authorization code + PKCE, scopes: user_default offline_access
  → ASWebAuthenticationSession / Chrome Custom Tab → tenant IdP → consent
  → redirect qlikanswers://auth?code=…
  → exchangeCodeAsync → { accessToken, refreshToken, expires_at }
  → refreshToken → SecureStore (WHEN_UNLOCKED_THIS_DEVICE_ONLY)
  → accessToken → memory only
```

**[API]** Qlik serves **no OIDC discovery document**, but it does serve the RFC 8414 OAuth metadata document at `GET https://{tenantHost}/.well-known/oauth-authorization-server` — public and stable, declared in its own spec file (`qlik.dev/specs/rest/.well-known.json`), returning `issuer`, `jwks_uri`, `authorization_endpoint`, `token_endpoint`, `revocation_endpoint`, `grant_types_supported` and `response_types_supported`.

Two consequences. `expo-auth-session`'s `fetchDiscoveryAsync()` / `useAutoDiscovery()` request `/.well-known/openid-configuration` and will **404** — keep constructing the discovery object from the tenant hostname. But the metadata document is an unauthenticated GET, which makes it the ideal **preflight check on MDM-supplied configuration**: fetch it before opening a browser, and a typo'd or unreachable `tenantHost` surfaces as `ConfigMissing` instead of as a failed login the user cannot diagnose.

**[API]** The OAuth spec exposes exactly three paths — `GET /oauth/authorize`, `POST /oauth/token`, `POST /oauth/revoke` — the metadata document above living in a separate spec. `/oauth/revoke` takes `{ token, token_type_hint?: "access_token" | "refresh_token" }`, i.e. the RFC 7009 shape `expo-auth-session`'s `revokeAsync` already sends. **This is now verified, not assumed.**

**[API]** `/oauth/authorize` requires `client_id`, `redirect_uri`, `response_type`, `scope`, `state` **and `code_challenge_method` — only `S256` is accepted**. expo-auth-session sends S256 when `usePKCE` is on, so this is satisfied by default. The token request requires `grant_type`, `code`, `code_verifier` (43–128 chars), `redirect_uri`, `client_id`; **`client_secret` is optional**, confirming a Native public client needs none. Two optional extras are worth sending from a mobile client: `deviceType` ("Phone" / "Tablet") and `description`, which make tokens identifiable in the tenant's token list when an admin audits or revokes.

### ⚠ The access token carries no `expires_in`

**[API]** Qlik's `oauth-token-response` schema returns **`expires_at`** (an ISO 8601 timestamp) and has **no `expires_in` field**. **[API]** expo-auth-session's documented behaviour: *"If the provider didn't return a `expires_in` then it's assumed that the token does not expire."*

Taken together, `TokenResponse.shouldRefresh()` / `isTokenFresh()` will report the access token as permanently fresh, the app will never refresh proactively, and every request will fail with a `401` once the token actually expires. Handle expiry explicitly rather than relying on the library:

```ts
// Qlik returns expires_at (ISO), not expires_in — derive it ourselves.
const raw = tokens.rawResponse as { expires_at?: string } | undefined;
const expiresAtMs = raw?.expires_at
  ? Date.parse(raw.expires_at)
  : Date.now() + (tokens.expiresIn ?? 0) * 1000;

const needsRefresh = Date.now() > expiresAtMs - 60_000; // 60s margin
```

**[POC]** Confirm whether the live token endpoint *also* returns `expires_in` (specs are sometimes incomplete). If it does, the library's own freshness check is sufficient and this can be deleted. If it does not, the code above is load-bearing.

**[API]** Lifetimes are published in exactly one place, the `@qlik/api` authentication page: an access token *"is valid for 6 hours"*, a refresh token *"is valid for 30 days"*. Treat both as indicative rather than contractual — that page describes the `clientSecret` browser flow, not the Native/PKCE path, and it ties the refresh token to a client secret rather than to `offline_access`.

**[POC]** Still unpublished: whether refresh tokens **rotate** on use, and whether the 30 days is idle or absolute. Also unpublished is whether the tenant-wide session policy at `GET/PATCH /api/core/auth-settings` (`userSessionInactivityTimeoutMinutes`, `maxUserSessionLifespanMinutes`, TenantAdmin only) bounds OAuth token validity or only interactive browser sessions — if it does, a Customer can silently shorten every mobile session by changing a tenant setting.

**[POC]** Qlik's own token-management tutorial shows `"expires_in": 21600` in a response example even though `oauth-token-response` does not declare the field, so the schema may simply be incomplete. Check the live response: if `expires_in` is really there, the library's freshness check works and the `expires_at` code below can be deleted.

### 3.2 Code

```ts
// src/auth/oauth.ts
import * as AuthSession from 'expo-auth-session';
import type { TenantConfig } from '@/config/types';

export const REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: 'qlikanswers',
  path: 'auth',
});

/** Qlik publishes no discovery document; endpoints derive from the tenant host. */
export const discoveryFor = (c: TenantConfig): AuthSession.DiscoveryDocument => ({
  authorizationEndpoint: `https://${c.tenantHost}/oauth/authorize`,
  tokenEndpoint: `https://${c.tenantHost}/oauth/token`,
  revocationEndpoint: `https://${c.tenantHost}/oauth/revoke`,
});

export const SCOPES = ['user_default', 'offline_access'];
```

```ts
// src/auth/session.ts — the hook the UI uses
import * as AuthSession from 'expo-auth-session';
import type { TenantConfig } from '@/config/types';
import { discoveryFor, REDIRECT_URI, SCOPES } from './oauth';
import { saveRefreshToken, loadRefreshToken, clearTokens } from './tokens';

export function useQlikAuth(config: TenantConfig) {
  const discovery = discoveryFor(config);

  // usePKCE defaults to true
  const [request, , promptAsync] = AuthSession.useAuthRequest(
    { clientId: config.clientId, scopes: SCOPES, redirectUri: REDIRECT_URI },
    discovery,
  );

  async function signIn() {
    const result = await promptAsync();
    if (result.type !== 'success') return null;

    const tokens = await AuthSession.exchangeCodeAsync(
      {
        clientId: config.clientId,
        code: result.params.code,
        redirectUri: REDIRECT_URI,
        extraParams: { code_verifier: request!.codeVerifier! },
      },
      discovery,
    );

    if (tokens.refreshToken) await saveRefreshToken(tokens.refreshToken);
    return tokens; // accessToken stays in memory only
  }

  async function signOut(accessToken: string) {
    const refreshToken = await loadRefreshToken();
    // Revoke server-side first — clearing local storage is not logging out.
    await Promise.allSettled([
      AuthSession.revokeAsync({ token: accessToken, clientId: config.clientId }, discovery),
      refreshToken
        ? AuthSession.revokeAsync(
            { token: refreshToken, clientId: config.clientId, tokenTypeHint: 'refresh_token' },
            discovery,
          )
        : Promise.resolve(),
    ]);
    await clearTokens();
  }

  return { signIn, signOut, ready: !!request };
}
```

```ts
// src/auth/tokens.ts
import * as SecureStore from 'expo-secure-store';

const KEY = 'qlik.refreshToken';
const OPTS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export const saveRefreshToken = (t: string) => SecureStore.setItemAsync(KEY, t, OPTS);
export const loadRefreshToken = () => SecureStore.getItemAsync(KEY, OPTS);
export const clearTokens = () => SecureStore.deleteItemAsync(KEY, OPTS);
```

### 3.3 Biometric gate

`expo-local-authentication`, triggered on cold start and after the app has been backgrounded longer than a threshold carried in `TenantConfig`, so enterprise policy sets it. On failure: lock the UI, keep the refresh token, do not sign out.

---

## 4. Multi-tenant configuration

**[API]** OAuth clients are per-Tenant with no cross-tenant registration. Every Customer's admin creates their own Native OAuth client. That step cannot be designed away (ADR-0003, ADR-0004).

```ts
// src/config/types.ts
export type TenantConfig = {
  tenantHost: string; // "acme.eu.qlikcloud.com" — no scheme, no trailing slash
  clientId: string; // Native OAuth client in that tenant
  assistantId: string;
  biometricTimeoutMs?: number;
};
```

```ts
// src/config/resolver.ts
import { Platform, Settings } from 'react-native';
import type { TenantConfig } from './types';
import ManagedConfig from './managed-config'; // local Expo module (Android)
import { devConfig, IS_INTERNAL_BUILD } from './development';

/** Production: MDM only. Internal builds: manual entry fallback. Never compiled-in defaults. */
export async function resolveTenantConfig(): Promise<TenantConfig | null> {
  const managed =
    Platform.OS === 'ios'
      ? (Settings.get('com.apple.configuration.managed') as Partial<TenantConfig> | undefined)
      : await ManagedConfig.getAsync();

  if (isComplete(managed)) return managed;
  if (__DEV__ || IS_INTERNAL_BUILD) return devConfig();
  return null; // → ConfigMissing error state
}

const isComplete = (c?: Partial<TenantConfig>): c is TenantConfig =>
  !!c?.tenantHost && !!c.clientId && !!c.assistantId;
```

**iOS costs nothing** — `Settings.get('com.apple.configuration.managed')` is built into `react-native`, no dependency.

**Android needs `RestrictionsManager`**, which has no first-party Expo API. Write a local Expo module (~40 lines of Kotlin) rather than adopting a third-party package: the available options are thin wrappers, and one exists specifically because another conflicted with `expo-screen-capture`, which this app requires. Its single responsibility is reading managed configuration and exposing it to JS — it never touches auth or UI.

---

## 5. Domain model and the port

```ts
// src/domain/answer.ts
export type Citation = {
  documentId: string;
  knowledgeBaseId: string;
  documentPath: string; // maps from Qlik's `source`, e.g. "Q3-Handbook.pdf"
  excerpts: string[]; // chunk text, present when includeText was requested
};

/**
 * An Answer is a list of blocks so a future agentic adapter can emit richer
 * block kinds without restructuring the UI. The classic adapter emits exactly
 * one 'text' block. See ADR-0006.
 */
export type AnswerBlock =
  | { kind: 'text'; markdown: string }
  | { kind: 'insight'; markdown: string; insight: AnalyticsInsight };

export type AnalyticsInsight = {
  title: string;
  narrative: string;
  // Chart payload shape stays unmodelled until Qlik publishes the agentic API.
  // Inventing it now would be fiction, not preparation.
};

export type Answer = { blocks: AnswerBlock[]; citations: Citation[] };
```

```ts
// src/qlik/port.ts
import type { Answer } from '@/domain/answer';
import type { Thread, ThreadDetail, Interaction, Starter, Feedback } from '@/domain';

export type Capabilities = {
  streaming: boolean;
  analyticsInsights: boolean; // false for classic; true for a future agentic adapter
};

export type AskHandlers = {
  onDelta(text: string): void; // streamed text appended to the open text block
  signal?: AbortSignal; // user cancel, or app backgrounded
};

export interface AnswersPort {
  readonly capabilities: Capabilities;

  listThreads(opts?: { limit?: number; cursor?: string }): Promise<{ items: Thread[]; next?: string }>;
  createThread(name: string): Promise<Thread>;
  getThread(id: string): Promise<ThreadDetail>;
  deleteThread(id: string): Promise<void>;

  ask(threadId: string, prompt: string, h: AskHandlers): Promise<Interaction>;
  listInteractions(threadId: string): Promise<Interaction[]>;
  submitFeedback(threadId: string, interactionId: string, f: Feedback): Promise<void>;

  listStarters(): Promise<Starter[]>;
}
```

The UI never imports from `src/qlik/`. It imports the port *type* and receives an instance from a context — which is also what makes the web build renderable against fixtures (§8).

---

## 6. Streaming implementation

**[API]** SDK 57 ships `expo/fetch` with real `ReadableStream` support on native; React Native's built-in `fetch` does not stream.

```ts
// src/qlik/classic/stream.ts
import { fetch as streamingFetch } from 'expo/fetch';
import { toDomainError } from '../errors';

type StreamChunk = { output?: string; sources?: unknown[] };

/**
 * Qlik concatenates JSON objects with no delimiter (`}{`), so we split on brace
 * depth while ignoring braces inside strings. Splitting on `}{` textually — as
 * Qlik's own example does — corrupts answers containing that sequence, and
 * splitting on newlines finds nothing at all.
 */
function takeObjects(buf: string): { objects: string[]; rest: string } {
  const objects: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < buf.length; i++) {
    const ch = buf[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        objects.push(buf.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return { objects, rest: start >= 0 ? buf.slice(start) : '' };
}

/** [POC] Confirm framing and source ordering against a live tenant. */
export async function streamAnswer(
  url: string,
  accessToken: string,
  prompt: string,
  { onDelta, signal }: { onDelta(t: string): void; signal?: AbortSignal },
): Promise<{ text: string; rawSources: unknown[] }> {
  const res = await streamingFetch(url, {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: { prompt, promptType: 'thread', includeText: true } }),
  });

  if (!res.ok) throw await toDomainError(res);

  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let text = '';
  let rawSources: unknown[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += value;
    const { objects, rest } = takeObjects(buffer);
    buffer = rest; // an object split across reads waits for the next chunk

    for (const raw of objects) {
      let chunk: StreamChunk;
      try {
        chunk = JSON.parse(raw);
      } catch {
        continue; // a complete-looking object that will not parse is not ours
      }

      if (chunk.output) {
        text += chunk.output;
        onDelta(chunk.output);
      }
      if (chunk.sources) rawSources = chunk.sources; // arrives as its own object
    }
  }

  if (buffer.trim()) {
    // A trailing fragment means the stream ended mid-object — treat as truncated
    // and let the caller reconcile against Qlik rather than showing a partial answer.
    throw { kind: 'ServiceUnavailable' } satisfies AppError;
  }

  return { text, rawSources };
}
```

**Lifecycle rules:**

- Backgrounding aborts the stream via `AbortSignal`. Qlik continues processing server-side.
- On foreground, re-fetch the Thread's interactions and render the completed answer. No attempt is made to hold a connection while suspended.
- The **Stop** button aborts the same signal. It does not assume server-side cancellation, and it does not delete the partial Interaction — what Qlik stored is what the user sees after reconciliation.
- **[POC]** Confirm whether aborting the client actually cancels Qlik's processing. Do not assume it does.

---

## 7. Error architecture

```ts
// src/domain/errors.ts
export type AppError =
  | { kind: 'ConfigMissing' } // no MDM config — administrator action
  | { kind: 'NotEntitled' } // authenticated, no Answers entitlement
  | { kind: 'AssistantForbidden' } // entitled, but no access to this Assistant
  | { kind: 'AssistantNotFound' } // wrong assistantId — misconfiguration
  | { kind: 'SessionExpired' } // refresh failed → interactive re-auth
  | { kind: 'RateLimited'; retryAfterMs?: number }
  | { kind: 'ServiceUnavailable' }
  | { kind: 'Offline' };
```

Mapping: `401` → `SessionExpired` (refresh once, then re-auth) · `403` → `NotEntitled` or `AssistantForbidden` · `404` → `AssistantNotFound` · `429` → `RateLimited` (honour `Retry-After`, exponential backoff, never hammer a rejected request) · `5xx` → `ServiceUnavailable` · transport failure → `Offline`.

**[POC]** Distinguishing `NotEntitled` from `AssistantForbidden` likely needs a second call (the licenses API or `/users/me`), since both plausibly surface as `403`. Confirm early — the two have completely different remedies, and collapsing them is what generates "the app is broken" tickets during multi-tenant rollout.

User-facing copy states what happened, whether the user can fix it, and who to contact. Raw API errors and tenant internals never reach the screen.

---

## 8. Responsibilities and the platform boundary

| Layer | Owns |
|---|---|
| `src/app/` | Screens, navigation, loading and error presentation |
| `src/domain/` | Types and the app's language. No Qlik, no HTTP, no React |
| `src/qlik/` | HTTP, streaming, response→domain mapping, retry and backoff |
| `src/auth/` | PKCE, token lifecycle, SecureStore, revocation, biometric gate |
| `src/config/` | Resolving `TenantConfig` from MDM or the dev screen |

**Enforcing ADR-0005** uses the repo's existing platform-extension convention (`*.web.tsx` beside `*.tsx`):

```ts
// src/qlik/adapter.web.ts — Metro resolves this on web
import type { AnswersPort } from './port';

export function createAnswersPort(): AnswersPort {
  throw new Error('The Qlik adapter is native-only (ADR-0005). Web builds inject a fixture port.');
}
```

The web build injects a fixture-backed port at the context boundary. That is what makes web useful for component work and structurally incapable of reaching Qlik. No SPA OAuth client is ever created — that absence is the real enforcement; the guard is just a fast failure.

---

## 9. iOS and Android specifics

| Concern | iOS | Android |
|---|---|---|
| Redirect | `scheme: "qlikanswers"` in `app.json`; `ASWebAuthenticationSession` | Same scheme; Chrome Custom Tab |
| Managed config | `Settings.get('com.apple.configuration.managed')` — zero dependencies, but **declare UserDefaults reason code `AC6B.1` in `PrivacyInfo.xcprivacy`** or risk App Store rejection. Apple designates this key legacy (successor: the `ManagedApp` framework, iOS 18.4+) | `RestrictionsManager` via local Expo module. `ACTION_APPLICATION_RESTRICTIONS_CHANGED` fires **only for dynamically registered receivers**, and a key can be absent even when the XML declares a default |
| Token storage | Keychain, `WHEN_UNLOCKED_THIS_DEVICE_ONLY` | Keystore-backed SecureStore |
| Screen protection | `preventScreenCaptureAsync()` blocks **both screenshots and recording** — recording on iOS 11+, screenshots on iOS 13+. Below those versions it silently does nothing | `FLAG_SECURE` blocks both, and also blanks the app-switcher preview |
| Biometrics | Face ID — needs `NSFaceIDUsageDescription` | BiometricPrompt |

Expo Go is unusable once a custom scheme, SecureStore, screen-capture protection and a local native module are in play. Development builds and EAS from day one.

---

## 10. Dependencies

Install with `npx expo install` so versions match SDK 57 rather than pinning guessed numbers:

```bash
npx expo install expo-auth-session expo-crypto expo-secure-store expo-local-authentication expo-screen-capture
```

- `expo-auth-session` (+ `expo-crypto`, its PKCE dependency) — PKCE by default, `refreshAsync`, `revokeAsync`.
- `expo-secure-store` — Keychain / Keystore.
- `expo-local-authentication` — biometric gate.
- `expo-screen-capture` — blocks recording (iOS 11+) and screenshots (iOS 13+, `FLAG_SECURE` on Android); `addScreenshotListener` for detection.
- `expo/fetch` — already in the SDK, nothing to install. On Android and iOS it is *also* installed as the global `fetch` in SDK 57 — but `EXPO_PUBLIC_USE_RN_FETCH=1` reverts the global to React Native's non-streaming implementation, so the explicit named import is load-bearing, not cosmetic.
- One local Expo module for Android managed configuration.

**Deliberately not added:** Redux / Zustand / TanStack Query (React state + contexts; there is no persistence to manage — ADR-0007 removed the main argument for a query cache) · any markdown renderer (chosen after inspecting real payloads) · `react-native-app-auth` (expo-auth-session covers it) · `@qlik/api` — **[ASSUMED]** it targets browser/Node and brings its own auth handling; the REST surface needed here is small enough that direct `fetch` avoids the question entirely.

---

## 11. Qlik Cloud tenant configuration — per-Customer onboarding runbook

1. Confirm the Answers entitlement and assign it to each intended Qlik User.
2. Create a **Native** OAuth client in the management console — **[API]** Native is selectable in the client-type dropdown, and custom app schemes are explicitly sanctioned. Limits: 5 redirect URIs per client, 200 clients per tenant.
   - Redirect URI: **`qlikanswers://auth`** — identical for every Customer, since it is compiled into the binary.
   - Scopes: `user_default`, `offline_access`.
   - No client secret is issued or needed (public client + PKCE).
3. Record the **tenant hostname**, **client ID** and the **assistant ID** of the Assistant to expose.
4. Push those three values as managed app configuration through the Customer's MDM.
5. Verify with a deliberately low-privilege test user that answers are correctly restricted.

No web origins are configured. No SPA client is created. **[API]** Consent can be pre-set to Trusted so users skip the consent screen — but **not** for published, cross-tenant clients, which is the trade-off if one client ID is ever shared across Customers instead of one per Tenant.

---

## 12. Proof of concept

**Prerequisites — blockers, not tasks:** a **classic** Assistant over the existing Knowledge Base (the current tenant has an agentic one); a Native OAuth client; Apple Developer, Android distribution and EAS access; test devices; and a named owner for the Qlik escalation.

| # | Step | Exit criterion |
|---|---|---|
| 0 | Escalate the agentic API question to Qlik | Written answer: supported options, preview programmes, roadmap, timeframe |
| 1 | `curl` the Assistants API with an API key | Thread created; `invoke` returns `output` + `sources` |
| 2 | PKCE flow on device, both platforms | Token obtained as a real Qlik User; **lifetimes measured**; confirmed whether the token response carries `expires_in` or only `expires_at` |
| 3 | Stream from the app | `actions/stream` parses cleanly on iOS and Android; framing confirmed |
| 4 | Capture and sanitise real payloads | Rendering subset decided from evidence, not guesswork |
| 5 | Interaction reconciliation | Interaction id retrievable after a stream; feedback submits; backgrounded stream recovers |
| 6 | Authorization | An under-permissioned Qlik User receives correctly restricted answers |
| 7 | **Guardrail contention** | Fire >20 questions/minute across **two or more Qlik Users at once**. Confirm the 429 + `Retry-After`, confirm the limit is subscription-scoped (user B is throttled by user A's traffic), confirm a tier-1 read still succeeds while asking is throttled, and confirm the UI shows a retryable "busy" state rather than an error |
| 8 | Security | Tokens in SecureStore; telemetry redaction verified; screen protection validated per platform |
| 9 | Architecture | UI imports no Qlik types; swapping the adapter is demonstrably local |

Steps 0–1 need no React Native at all. If step 1 fails, nothing downstream matters — which is the point of sequencing Qlik problems ahead of React Native problems.

---

## 13. Testing strategy

- **Adapter unit tests** against sanitised captured payloads (step 4): mapping, citation extraction, error classification.
- **Stream parser tests**: objects split across buffer boundaries, `}{` inside answer text, a trailing partial object, malformed fragments, abort mid-stream. (No `[DONE]` case — Qlik does not send one; see §2.4.) Highest-risk parsing in the app, and the cheapest thing to test.
- **Domain tests**: no network, no React.
- **Web build against fixtures**: component and state coverage with no tenant required. This is the payoff for retaining `react-native-web` under ADR-0005.
- **Manual device matrix**: auth, background/foreground during streaming, offline, expired refresh, biometric lock, screen protection.

---

## 14. Known limitations

1. **Agentic Answers has no supported API.** The defining constraint. v1 is classic-only unless Qlik changes that.
2. **The stream carries no interaction id** — feedback needs an extra reconciliation fetch.
3. **The token response schema has no `expires_in`** — expiry must be derived from `expires_at`, or expo-auth-session treats the access token as never expiring (§3.2). Lifetimes are published (6h / 30d) but rotation and idle-vs-absolute expiry are not.
4. **No OIDC discovery document** (RFC 8414 metadata exists, OIDC does not) — endpoints are still constructed, so a future Qlik path change fails silently. Keep them in one file.
5. **Screen-capture blocking is version-gated on iOS** — screenshots only from iOS 13+, recording from iOS 11+, silently inert below. Still defence in depth, never a guarantee: a second device photographing the screen defeats it everywhere.
6. **Every Customer must create their own OAuth client** — onboarding friction no architecture removes.
7. **20 assistant questions per minute per subscription** — a hard tenant-wide ceiling on the app's core action, unrelated to the tier limits. It constrains how many people can use the app at once, and no client-side design removes it.
8. **No offline capability, by design** (ADR-0007).

---

## 15. Migration path to Agentic Assistant

When Qlik publishes a supported agentic API:

1. Add `src/qlik/agentic/adapter.ts` implementing the same `AnswersPort`, with `capabilities.analyticsInsights: true`.
2. Add `insight` block rendering — the block list already accommodates it (§5).
3. Select the adapter from `TenantConfig` (e.g. an `assistantKind` field) so Customers migrate independently.
4. Update ADR-0002 to `accepted` and record the outcome.

Steps 1 and 3 are contained. Step 2 is genuinely new UI work: the abstraction protects the plumbing, not the pixels, and was never meant to do otherwise.

**If Qlik confirms no supported agentic API within the product timeframe**, the three options are a business decision, not an implementation detail: accept classic for v1, relax the native-only requirement for an embedded agentic surface, or delay. The architecture supports the first, tolerates the second, and prejudges neither.

---

## 16. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Agentic API never published, or arrives too late | Core product requirement unmet | Named escalation owner; classic v1 is viable; decision framed for the business, not absorbed silently |
| Stream framing differs from Qlik's documented example | Streaming broken | POC step 3; `invoke` is a working non-streaming fallback |
| `expires_in` absent, so the library never refreshes | Every request 401s once the token expires; looks like random sign-outs | Explicit `expires_at` handling (§3.2); assert it in POC step 2 |
| `403` cannot separate entitlement from permission | Poor support experience at rollout | Confirm in POC step 6; add the licenses call if needed |
| Android MDM module is bespoke native code | Config path owned in-house | One narrow responsibility; never coupled to auth or UI |
| The 20/min-per-subscription Answers guardrail | Users blocked by other users' traffic at modest concurrency | First-class retryable "busy" state; honour `Retry-After`; no aggressive auto-retry; size the rollout against it and tell the Customer up front |
| Tenant session policy silently bounds token validity | Sessions end far sooner than 6h/30d; reads as random sign-outs | Live-tenant test #1 (§3.1) |
| Onboarding friction across many Customers | Slow rollout | The §11 runbook is a deliverable, not an afterthought |
| Telemetry leaking answer content | Confidentiality breach | Allowlist telemetry fields; never log request or response bodies; test it explicitly |
