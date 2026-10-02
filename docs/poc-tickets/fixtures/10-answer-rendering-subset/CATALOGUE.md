# Ticket 10 — answer-formatting corpus and catalogue

Covers [docs/poc-tickets/10-answer-rendering-subset.md](../../10-answer-rendering-subset.md). Captured
2026-09-02 via `curl` against the real tenant with a personal API key (same approach as ticket 1's hand
verification — no app code, no device needed), against the Knowledge Base containing *The Compound
Effect*. 12 questions asked and answered (`POST .../actions/invoke`), one dedicated thread, deleted
after capture. Raw responses are **not** committed — they contain full copyrighted book excerpts in the
`sources[].chunks[].text` field, more sensitive than the `output` text alone. This catalogue documents
findings with sanitised, structure-preserving examples instead (real markdown syntax, invented prose).

## Method

Two passes:

1. **Organic** — 10 naturally-phrased questions covering the ticket's own categories: lists (2 prompts),
   a very long answer (1), code/formulas (1), a table (1), links/citations (1), headings (1), a nonsense
   question (1), an overly-terse request (1), a step-by-step process (2).
2. **Steered** — 2 follow-up prompts explicitly asking for markdown formatting (headings, bold, a table,
   a code block; then links and italics), to settle whether the assistant can produce constructs that
   never showed up organically, or whether they're simply unavailable. This mattered: the answer was
   "can, but doesn't unless asked" — a real product risk if we'd concluded "never happens" from organic
   phrasing alone.

## What actually appeared

| Construct | Organic (10 prompts) | Steered (2 prompts) | Verdict |
|---|---|---|---|
| Multi-paragraph prose (`\n\n`) | Yes — nearly every answer | Yes | **Implement** |
| Numbered list (`1. `, `2. `, …) | Yes — 2 of 10 | Yes | **Implement** |
| Bulleted list (`• ` *and* `- `) | Yes, `•` only — 1 of 10 | Yes, `-` only | **Implement** (both markers) |
| Header (`#`, `##`) | No | Yes | **Implement** |
| Bold (`**text**`) | No | Yes | **Implement** |
| Italic (`*text*`) | No | Yes | **Implement** |
| Table (`\| a \| b \|` with header separator) | No — explicitly requested once, got a fallback instead | Yes | **Implement** |
| Fenced code block (```` ``` ````) | No | Yes | **Implement** |
| Markdown link (`[text](url)`) | No — citations question got plain-text URLs, no link syntax | Yes | **Implement** |
| Inline code (single `` ` ``) | No | No (steered example produced a fenced block, not inline) | **Not implemented** — no evidence either way |
| Blockquote (`>`) | Not tested | Not tested | **Not implemented** — no evidence |
| Horizontal rule | Not tested | Not tested | **Not implemented** — no evidence |
| Nested/indented lists | No | No | **Not implemented** — no evidence |
| Strikethrough | Not tested | Not tested | **Not implemented** — no evidence |

Also observed, **not a markdown construct**: literal double-quoted phrases (`"like this"`) used for
emphasis in plain prose, and bare domain mentions (`TheCompoundEffect.com`, no `http://`, no link
syntax) in organic answers. Neither needs special rendering — they're just characters within plain text,
already handled correctly by rendering the paragraph as-is.

## Decision: render in-house, not a dependency

Confirmed the plan already stated in technical-proposal.md §10 ("Deliberately not added: any markdown
renderer — chosen after inspecting real payloads"), now backed by the inspection itself rather than an
assumption. The evidenced set is nine constructs, all with simple, well-known syntax (no nesting beyond
"bold/italic inside a table cell or list item"), no obscure edge cases. A dependency (`react-markdown`,
`markdown-it`, etc.) would pull in a general-purpose CommonMark/GFM engine — footnotes, nested
blockquotes, HTML passthrough, task lists, autolinks — for constructs that have never once appeared
across 12 real questions including two that explicitly asked for uncommon ones. A small in-house
block-level parser plus one shared inline-span renderer (bold/italic only — no other inline construct was
evidenced) covers exactly what's real and stays inspectable.

## Sanitised representative examples

Real markdown syntax, invented placeholder prose (the actual book text is copyrighted and not
reproduced here or in the renderer's tests).

**Organic numbered list** (real shape: often just one identified item, not a full enumerated set):
```
4. MOMENTUM

I can also see references to other sections, though I don't have the complete listing.
```

**Organic bulleted list** (real marker: `•`, not `-`):
```
• Small daily choices compound over time to create significant results
• Track key behaviours to establish momentum
• Every dollar spent today costs several times more in future value
```

**Organic long-form prose** (multi-paragraph, no list/heading structure):
```
I don't see any specific formulas or calculations in the excerpts I have access to.

The book appears to focus on conceptual principles. While there are references to a "cost multiplier"
idea, I don't have access to any actual expressions presented in the format you're looking for.
```

**Steered — full construct set** (only reachable when the question itself asks for markdown):
```
# Core Concept

The idea is **reaping large rewards from a series of small choices**.

## Key Characteristics

| Aspect | Description |
|--------|-------------|
| **Nature** | Small changes, little immediate result |
| **Timeline** | Results appear after consistent application |

- **Point one**: explanation
- **Point two**: explanation

1. First step
2. Second step

### Note

```
Small trajectory changes = large long-term impact
```

See [the resource site](http://example.com) for more — and note that *consistency* matters most.
```

**Cannot-answer fallback** (Qlik's own generated text, not book content — reproduced verbatim, same as
ticket 1's fixtures): `"I'm sorry, I don't have any information to answer that question, but I could
help with something else."`
