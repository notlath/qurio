---
status: accepted
---

# The Qlik integration layer is native-only; the web target is development-only

`react-native-web` is retained for component development and testing, but the Qlik authentication and transport layer is never reachable from it — the web build runs against fixtures, and no SPA OAuth client is created for this product.

## Why this is not merely a preference

The Native OAuth client and its custom-scheme redirect cannot be used from a browser. Making the web target talk to Qlik would require registering a second, SPA OAuth client with an allowed web origin — which is precisely the browser-accessible Qlik Answers the Customer vetoed. Not creating that client is what enforces the veto; a platform guard on the transport module makes the boundary fail loudly at development time rather than silently at runtime.
