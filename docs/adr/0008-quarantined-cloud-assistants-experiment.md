---
status: superseded
---

# A quarantined experiment against the unpublished `cloud-assistants` API

> **Superseded 2026-09-28, never started.** The agentic surface will instead embed `qlik-embed`
> `ui="ai/agentic-assistant"` in a WebView, the only supported route while the API is unpublished.
> ADR-0002 records that outcome once a device spike proves the WebView can reuse the native token.

ADR-0002 left three permitted outcomes and named the Qlik account team as what settles them. Before
that answer arrives, we run a time-boxed experiment that calls the unpublished
`/api/v1/cloud-assistants/…` endpoints from the app, to learn whether an Agentic Assistant is
reachable at all from a native client. It is quarantined in `src/qlik/agentic-experimental/`, gated
on `IS_INTERNAL_BUILD`, and it does not ship.

## Considered options

- **Embed `qlik-embed`'s `ai/agentic-assistant` in a WebView** — rejected for now. Its documented auth
  types are SPA, impersonation, anonymous and API key; there is no documented way to hand it a token
  we already hold. The SPA client it would need is the browser-accessible Qlik Answers the Customer
  vetoed (ADR-0005), and injected-HTML WebViews have no HTTPS origin to allowlist.
- **Delay until Qlik publishes the API** — still the fallback, and still where this lands if the
  experiment fails.

## What is being traded

Qlik's API policy states that use of unpublished APIs violates its API Terms. That is the cost, and
it is accepted only for a non-shipping experiment on an internal build. The mitigation is not
carefulness, it is the fence: quarantine directory, `__DEV__` gate, and an expiry.

## Consequences

**This expires when the account team answers.** Either they provide a supported route, or they
confirm there is none and ADR-0002 records "accept classic for v1". There is no third state in which
this directory quietly matures — that is precisely the failure mode ADR-0002 already named.

The experiment gets a narrow `AgenticPort` with `createThread` and `ask` only. Four of `AnswersPort`'s
nine methods — `listInteractions`, `submitFeedback`, `listStarters`, and thread listing/deletion —
have no known equivalent on this API, so `AnswersPort` is not swapped and not widened.

Two prerequisites sit outside our code. Agentic Answers needs the Tenant opted in to cross-region
inference (confirmed), and the Tenant is in Singapore, where the Data product, Glossary and Data
quality contexts are absent from the agentic experience regardless of anything we build.

The first thing the experiment must establish is whether a Native OAuth client token scoped
`user_default` is accepted at all. A `403` ends the experiment on day one, which is the point of
doing it first.
