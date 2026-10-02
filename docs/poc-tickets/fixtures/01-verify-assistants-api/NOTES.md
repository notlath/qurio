# Ticket 01 — hand verification notes

Captured 2026-09-02 against the real tenant via curl (personal API key), per the checklist in
[docs/poc-tickets/01-verify-assistants-api-by-hand.md](../../01-verify-assistants-api-by-hand.md).
Fixtures are sanitised: tenant host, assistant/thread/interaction/owner/tenant/KB/document/chunk ids
are replaced with `{placeholder}` tokens. The first pass (fixtures 01-08) was captured before any
document existed in the Knowledge Base, so `sources` was empty everywhere and there was no customer
content to redact. A book ("The Compound Effect") was then uploaded to the KB mid-session, which is
why the first two test questions came back empty — a second pass (fixtures 09-10) re-ran against the
now-populated KB. Real answer/chunk text from that second pass is copyrighted book content, so it is
redacted with `{sanitised — ...}` placeholders rather than reproduced, even sanitised-in-place —
structure (object/field shape, counts, ordering) is preserved verbatim, content is not.

## What contradicts docs/technical-proposal.md

1. **§2.4 (line 99) is wrong about the stream's `Content-Type`.** The proposal states the spec
   declares `application/json` — "no `text/event-stream`". The tenant actually returns
   `Content-Type: text/event-stream; charset=utf-8` (fixture 05). The body is still *not* real SSE
   (no `data:` framing), so the proposal's conclusion — don't use an `EventSource` polyfill, parse by
   brace depth — still holds. Only the stated Content-Type is inaccurate.

2. **§2.3 (line 89) undersells the `invoke`/`stream` response shape, and the extra fields are not
   just always-null noise.** Both endpoints also carry `title`, `generated_from_placeholder`, and
   `links_placeholder` — none declared by the published schema. In the empty-KB pass these were always
   `null` (fixture 03). Against the real book: `invoke` still returned all three as `null` even with a
   real matched answer (fixture 09), but `stream`, for a different question, returned all three
   **populated** with real content — a generated title, a "Generated from {document}" attribution
   string, and a static help-link label (fixture 10). This session didn't isolate whether that's an
   invoke-vs-stream difference or a per-question one; either way, a client that ignores unknown fields
   would silently drop what looks like real product content (an answer title, a source attribution
   line). Worth a deliberate decision, not just a defensive parse.

3. **§2.1's endpoint table doesn't mention the `legacy` field.** `GET /assistants/{id}` returns
   `legacy: true` (fixture 01) plus a `knowledgeBases[]` array and no analytics-app reference — this is
   the signal that confirmed the assistant is classic, not agentic, for the purposes of this ticket's
   external prerequisite. Not documented anywhere in the proposal as the way to distinguish the two.

4. **§2.3 (line 103) is now resolved with a real sample.** The "[ASSUMED]" note asks whether sources
   always arrive last. The empty-KB run (fixture 05, 2 objects total) was too degenerate to prove much.
   The real-content run (fixture 10) is 91 objects — 87 small `output` fragments plus 3 metadata
   fields — and `sources` is still the strictly final object, once, every time in this sample. Good
   evidence, not absolute proof: still only one thread's worth of runs, and the source list itself only
   ever had a single `source` entry (multiple chunks, not multiple sources) — a question that pulls
   from two different documents hasn't been tried.

5. **Chunk text carries an undocumented, inconsistent `File name: {document}\n` prefix.** In the
   real-content `invoke` fixture (09), 3 of the 6 returned chunks are prefixed with a line naming the
   source document; the other 3 chunks in that same response are not. Not in technical-proposal.md §2.3
   at all. Any renderer or citation-formatter reading chunk text needs to not assume this prefix's
   presence, or its absence, and definitely shouldn't show it to the user verbatim if present.

## Streaming granularity (new evidence, not a contradiction)

The empty-KB stream (fixture 05) was a single canned sentence sent as one `output` object — it gave no
signal about real streaming behavior. The real-content stream (fixture 10) shows the actual shape:
~87 `output` fragments for one answer, each roughly 15-70 bytes, a handful of words at a time. This is
the granularity ticket 07's parser and progressive-render UI need to be built and tested against — the
empty-KB fixture alone would have led to under-building for a much higher event frequency than the API
actually produces.

## What matches the proposal

- `invoke` never returns an interaction id (fixture 03); it's recovered via `GET .../interactions?sort=-CREATED`
  (fixture 04), exactly as §2.3 (line 105) describes.
- Stream body is concatenated JSON objects with zero delimiter, `}{` back to back (fixture 05) — matches
  the predicted framing.
- Structured error contract (`{"errors":[{code, status_code, title, ...}]}`) holds for a 404 (unknown
  assistant/thread, fixture 06) and a 400 (valid JSON, wrong shape, fixture 08).

## Additional finding — not in the ticket's checklist but worth recording

Malformed JSON in the request body does **not** hit the structured error contract at all: it returns a
bare `500 Internal Server Error` with a `text/plain` body (fixture 07), while every other error case
returns `application/json` with `{"errors": [...]}`. Whatever validates the request body client-side
(so this path is never hit in practice) should treat a 500 with no `errors` array as possible, not just
4xx.

## Not covered by this pass

- Multi-*source* answers (i.e. an answer citing more than one document) — every real sample here
  returned exactly one `source` with several `chunks`, never two or more `source` entries. The ordering
  finding above (#4) covers single-source multi-chunk framing only.
- 401/403 (entitlement vs. permission) — not exercised; the personal API key used here bypasses the
  per-user PKCE path entirely, so this ticket can't distinguish the two. Flagged for ticket 13.
- Ticket 10's corpus needs more than two real answers (lists, tables, code, links, very-long answers) —
  this pass only proved the pipes work, it isn't the corpus itself.
