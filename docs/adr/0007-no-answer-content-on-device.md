---
status: accepted
---

# Answer content is never persisted on the device

Threads and Interactions live in Qlik and are fetched on demand; the app holds them in memory for the duration of a session only. No answer bodies, Citations, Knowledge Base content or analytics-derived content are written to disk — no cache, no offline store.

## Why this is deliberate

This is governed customer data whose access Qlik controls per user. Persisting it on a phone moves it outside those controls, and offline access to BI answers is not a requirement anyone asked for. A future engineer will be tempted to add a cache for launch performance — that is a reversal of this decision, not an optimisation, and it would require encryption at rest plus a guaranteed wipe on logout. If launch performance genuinely demands it, cache Thread metadata (titles, timestamps) only.

## The embedded agentic surface

The WebView hosting `qlik-embed` is covered by this decision, not an exception to it. Platform WebViews cache to disk by default, so it runs with a non-persistent data store (`incognito`) and caching disabled, and is unmounted on sign-out.
