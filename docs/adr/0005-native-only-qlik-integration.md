---
status: accepted
---

# The Qlik integration layer is native-only; the web target is development-only

`react-native-web` is retained for component development and testing, but the Qlik authentication and transport layer is never reachable from it — the web build runs against fixtures, and no SPA OAuth client is created for this product.

## Why this is not merely a preference

The Native OAuth client and its custom-scheme redirect cannot be used from a browser. Making the web target talk to Qlik would require registering a second, SPA OAuth client with an allowed web origin — which is precisely the browser-accessible Qlik Answers the Customer vetoed. Not creating that client is what enforces the veto; a platform guard on the transport module makes the boundary fail loudly at development time rather than silently at runtime.

## Native WebView is not the web target (amended 2026-10-02)

[ADR-0009](0009-native-lists-over-rest-qlik-content-via-qlik-embed.md) lets native iOS and Android builds host `qlik-embed` in a WebView, fed by the same Native OAuth token. That does not loosen this decision. The WebView host is native-only, unreachable on web including direct routes, and web previews stay on fixtures. Embedding in a native WebView needs no SPA client and no allowed web origin; the page's origin is only set to the tenant in-process. Neither a SPA client nor a system browser is implicitly authorised: either would be the browser-accessible Qlik Answers the Customer vetoed and needs its own decision.
