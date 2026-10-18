# Ticket 40 — Qlik accepts PATCH /favorite

Run on 2026-10-16 against a real Tenant, Legacy Assistant "Chat Assistant", with a personal API key.
One existing Thread was patched to `true` and back to `false`. Ids are redacted. Message content is not saved.

## Result

| Check | Result |
| --- | --- |
| `PATCH …/threads/{id}` `[{"op":"replace","path":"/favorite","value":true}]` | **204**, empty body |
| `GET` the Thread afterwards | `favorite: true` |
| Patch back to `false` | 204, `GET` shows `false` |
| `GET …/threads` returns `favorite` on each Thread | Yes |
| `sort=-FAVORITE`, `sort=FAVORITE`, `-favorite` | **400** `unsupported sort field: favorite` |
| `sort=-UPDATED` (the app's sort) | 200 |
| `filter=favorite eq true` | 200, **0 Threads** (silently matches nothing) |
| `filter=favorite eq "true"` (quoted) | **200, the pinned Threads** |
| `filter=favorite==true` | 400 parse error |

## Consequences for the pin ticket

- Pinning works through `favorite`. No device store needed.
- The list cannot sort pinned Threads first. A pinned Thread beyond the first page is found with a
  second query: `filter=favorite eq "true"&sort=-UPDATED`.
- A PATCH of `favorite` also changes `updatedAt` (the pinned Thread moved to the top of `sort=-UPDATED`).
  Pin and Unpin therefore move a Thread within the unpinned order.
- Not tested: a second Qlik User's view of the same Thread (needs two accounts).
