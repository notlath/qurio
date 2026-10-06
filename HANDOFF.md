# Handoff: Ticket #9 troubleshooting

> Temporary file. Delete it before this branch merges.

Branch: `fix/9-agentic-no-context`, from `dev` at `149d84f`. This branch has no code changes yet.

## Focus of the next session

Find the cause of #9: the embedded Agentic Assistant shows "No context selected" and accepts no questions. A human runs the device and Tenant tests. The agent writes each procedure and reads the results.

## Read first

- Issue #9: `gh issue view 9 --comments`. Its first comment lists the cross-region inference lead and the **Agentic AI › Data analysis** permission lead.
- Issue #10 is blocked by #9. Issue #1 is the spec.
- `docs/adr/0009-native-lists-over-rest-qlik-content-via-qlik-embed.md`: how the embed works, the run matrix from 2026-10-02, and the WebSocket token addendum.
- `docs/adr/0010-published-oauth-client-tenant-hostname-only.md`: the published `ap` client.
- `src/qlik-embed/qlik-embed-host.tsx`: every `hostTrace(...)` event. `src/auth/session.ts:55`: the `[auth] requested scope … granted …` trace. Both show only in internal builds, in the Metro terminal.

## Results so far

1. **Context7 (qlik.dev):** `ai/agentic-assistant` needs OAuth and cross-region inference opt-in. Its only required attribute is `assistant-id`, and the app sends it (`src/qlik-embed/page.ts:7`). A Tenant admin can turn on the opt-in with `qlik tenant-settings toggle-cross-region-inference --value true`. That command needs `admin.tenant-settings:update`.
2. **Sign-in PR #11 did not change the embed bridge.** It changed only the layout of `src/qlik-embed/agentic-entry.tsx`, plus `src/auth/oauth.ts` and `src/auth/session.ts`.
3. **Task 1, done by the user on 2026-10-07 as a non-admin on `mtcteam.ap`:**
   - Qlik's web UI is now at `/insights/universal-assistant`.
   - It starts every chat with no context and asks "Set your context".
   - The non-admin can use Help, Application analysis and Answers assistants. The other four contexts are greyed out.
   - **Answers assistants** says: "No assistants have been set up for Qlik Answers yet."
   - **Conclusion (not confirmed):** The app is probably not the cause. The user has no Agentic Assistant to choose. The embed probably shows this empty state as "No context selected".
4. **Risk to #10:** `GET /api/v1/assistants` returned 24 entries on `mtcteam`. The new UI shows this user none. #10's rule ("an Assistant with `appIds` is Agentic") may be wrong. Do not start #10 before Task 3C answers this.

## Next steps (waiting for the user)

The user received these steps in STE (see "Writing standard"). They must send the Task 3A result first.

- **Task 3A:** As the Tenant admin, open **Set your context › Answers assistants** in the web UI. Write down the names, or the message if there are none.
  - The admin also sees none → Task 3C.
  - The admin sees Assistants → Task 3B.
- **Task 3B:** Add the non-admin user to the Assistant's space, and to the space of its Analytics App. Set **Agentic AI › Data analysis** to Allowed. Test again in the web UI, then in the app.
- **Task 3C:** Create one Assistant in the new UI and link one Analytics App to it. Do Task 3B with it. Then run `GET /api/v1/assistants` as the non-admin user. Write down whether the new Assistant is in the result, and whether it has `appIds`.
- **Task 2 (if needed):** Check the cross-region inference setting. Get approval from the data owner before you turn it on.
- **Task 4 (if the web UI works but the app does not):** Record a device trace. Copy the `[auth]` line. Open the embed. Tap the selector three times, with 5 seconds between taps. Look for `blocked navigation` or `nav` lines. If the taps write no new lines, debug the WebView remotely (Chrome `chrome://inspect` on Android, Safari Web Inspector on iOS).
- **Task 5 (if still unclear):** Compare three configurations in the Developer form (Settings › Developer):
  1. The Tenant and client from 2026-10-02.
  2. `mtcteam` with its own native client.
  3. `mtcteam` with the `ap` published client.

## Open items

- Post the Task 1 result to #9 as a comment. Nobody has posted it yet. Ask the user before you post.
- If the cause is a Tenant setting or user access, close #9 with no code change. Then unblock #10, and correct its discovery rule if Task 3C shows the rule is wrong.
- If the cause is in the app, fix it test-first.

## Writing standard

The user wants all procedures and reports in ASD-STE100, Strict mode. AGENTS.md §10 gives the rules:

- Use one instruction per sentence.
- Write instructions with 20 words or fewer.
- Do not use semicolons.
- Use NOTE, CAUTION and WARNING blocks.
- Mark leads as not confirmed.

## Suggested skills

- `diagnosing-bugs`: the diagnosis loop for #9.
- `context7-mcp`: for Qlik docs (`/websites/qlik_dev`). The user asked to use Context7.
- `tdd`: only if the cause is in the app's code.
- `graphify`: run `graphify query` before you search the code. CLAUDE.md requires it.
