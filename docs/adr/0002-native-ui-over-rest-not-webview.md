---
status: superseded
---

> **Superseded 2026-10-02 by [ADR-0009](0009-native-lists-over-rest-qlik-content-via-qlik-embed.md).** The device spike showed `qlik-embed` can run in a native WebView with our token, so Qlik content is embedded while lists stay native. Kept below as the original reasoning.

# Native React Native UI over Qlik REST, not an embedded Qlik web UI

The product requires a purpose-built mobile experience, so the app renders every screen itself and consumes Qlik REST APIs, rather than hosting `qlik-embed` in a WebView. This is **proposed, not accepted**: the target capability is an Agentic Assistant, and agentic Answers is served by `/api/v1/cloud-assistants/...`, which Qlik has not published.

## The constraint

The GA Assistants API (`/api/v1/assistants/...`) reaches Knowledge-Base-only classic Assistants. Agentic Answers, over structured and unstructured data, runs on unpublished `cloud-assistants` endpoints — confirmed publicly by a Qlik employee, with publication "on the roadmap" and no committed date. The only supported route to an Agentic Assistant today is the `ai/agentic-assistant` web component, which is browser-only.

Building against unpublished endpoints is rejected for production: no SLA, no versioning promise, no support path, in the app's most important code path.

## What settles this

Confirmation from the Qlik account team on whether a supported Agentic Assistant API exists (including preview programs) and on what timeframe. Until then the POC proceeds against a classic Assistant behind an abstracted transport, and one of three outcomes gets recorded here: accept classic for v1, relax the native-only requirement for an embedded agentic surface, or delay.

## Boundary on the unpublished API

`cloud-assistants` may be explored experimentally if Qlik grants access, but it must never be merged into the production transport adapter while it remains unpublished. Experimental work lives outside `src/qlik/classic/` and outside any release build. This is deliberate: the usual failure mode is a POC workaround quietly becoming the production architecture because it already worked once.

## Hard boundary on the unpublished API

`cloud-assistants` may be explored experimentally if Qlik grants access, but it must never be merged into the production transport adapter unless Qlik explicitly supports it. Experimental access is not a decision to ship — a POC workaround must not become the production architecture by default.
