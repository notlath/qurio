# Derived contract — the unpublished `cloud-assistants` API

> **This is not a capture.** Nothing below was observed on the wire against our tenant. It was
> derived on 2026-09-09 by reading the source of a working client:
> `qlik-demo-team/qlik-answers-briefing` @ `main` (MIT, Qlik org repo, created and pushed
> 2026-09-01) — files `src/qlik.js`, `src/answerData.js`, `src/answerText.jsx`, `src/AnswerView.jsx`.
>
> It lives in `derived/`, not `fixtures/`, deliberately. Everything under `fixtures/` was seen on
> the wire and sanitised (see `fixtures/01-verify-assistants-api/NOTES.md`). Mixing the two is how
> a plausible reconstruction gets mistaken for evidence.

## What this does and does not establish

**Established** (read directly from a client that calls the endpoint): paths, HTTP methods, request
body keys, and the response field names that client's own code reads.

**Not established**: any response *value*; whether a token from our **Native** OAuth client with
`user_default` scope is accepted (the demo authenticates as a browser SPA — see Auth below); latency
against a Singapore tenant; whether threads can be listed, fetched or deleted; whether feedback has
any endpoint at all.

## Endpoints

| Operation | Method and path |
| --- | --- |
| Create thread | `POST /api/v1/cloud-assistants/threads` → `{ id }` |
| Ask | `POST /api/v1/cloud-assistants/{threadId}/actions/invoke` |

The assistant/app id is **not** in the path. It travels in the body under `context.id`.

## Request bodies

```jsonc
// POST /api/v1/cloud-assistants/threads
{ "name": "Briefing thread", "context": <context>, "messages": [] }

// POST /api/v1/cloud-assistants/{threadId}/actions/invoke
{ "context": <context>, "content": [{ "text": "the question" }] }
```

`<context>` is `{ type: 'app', id: <appId>, data: { mode: 'live', route: 'answers', custom: true } }`,
and `data.reasoning_mode` is added **only when a mode is passed** — the key is absent otherwise.

`reasoning_mode` is `'fast'` or `'think'`. The demo's own comment: *"'fast' (~15-20s, short trace) or
'think' (~45-55s, full reasoning); **same answer**"*, and *"reasoning_mode isn't in Qlik's public docs
yet, so treat it as experimental"*. Same answer either way is why we take `fast`.

## Response shape — the fields a real client reads

- `content[].text` — plain prose for the turn. **This is the answer text**; it does not have to be
  reassembled from the card. The demo's `extractText` joins these with `\n\n` and falls back through
  `message.content`, `answer`, `output`.
- `content[].card` — Adaptive Card, optional per item (`cards()` filters falsy).
- `card.body[]` — blocks. `type === 'TextBlock'` carries `text`, plus optional `weight` (`'bolder'`),
  `size` (`'medium'`), `isVisible`. Chart blocks are matched by `type.includes('Snapshot')` —
  **substring, not an exact literal**, so do not hard-code `'Qlik.Snapshot'`.
- `card.body[i].source` — `{ dimensions: [{label, expression}], measures: [{label, expression}], reason }`.
  This is where an Analytics Insight's title and narrative come from.
- `card.citations[]` — each `{ sources: [{ type, url, title, chart }] }`. `chart` is `"body/<i>"`; the
  index resolves into `card.body[i].source`. Citation number is **positional** (`i + 1`), not a field.
- `card.reasoning.body[]` — same TextBlock shape as `card.body`.
- `card.followUpActions[]`.

## Text is not clean markdown

Answer text carries a small tag zoo the demo strips: `<citation …>…</citation>`, `<cite …>…</cite>`,
`<br>`, `<statement>`, `<plan>`, any other `<…>`, literal `\r\n`, markdown `#` headings, and emoji.
`**bold**` survives and is rendered. Our `src/components/answer-markdown.ts` expects markdown, so this
needs its own cleaner rather than a reuse.

## Auth — why this does not answer our gating question

The demo obtains its bearer via `@qlik/api`'s browser auth runtime
(`getRestCallAuthParams`), caching under `qlik-qmfe-api-<clientId>` in `sessionStorage`. That is an
interactive **browser SPA** session. It proves the endpoint accepts `Authorization: Bearer <token>`;
it proves nothing about a Native-client token carrying only `user_default`.

`401` is treated as session-expired. A non-401 failure on `invoke` is treated as a possibly-stale
thread and retried once against a freshly created thread.
