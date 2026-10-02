# 07 — Stream the answer, with stop and recovery

**What to build:** Answers arrive progressively, the user can stop one, and interrupting the app mid-answer recovers cleanly rather than losing or faking the result.

The parser, the stream lifecycle, cancellation and recovery are one capability and are tested together.

**Blocked by:** Ticket 06.

**Status:** ready-for-agent

- [ ] Answers render progressively from the streaming endpoint on both platforms
- [ ] The parser handles concatenated objects with no delimiter, objects split across network reads, the delimiter sequence appearing inside answer text, and a truncated tail — each covered by a unit test over the ticket-01 fixtures
- [ ] Stop cancels the client side and preserves the partial answer rather than deleting it
- [ ] Backgrounding mid-answer aborts the stream; returning to the app reconciles with the tenant and shows the completed answer
- [ ] **Recorded:** whether aborting the client actually cancels server-side processing, and whether the Interaction is still persisted when the client disconnects
- [ ] The interaction identifier is recovered after every completed answer, since feedback depends on it
- [ ] A truncated stream produces a service-unavailable state — never a partial answer presented as complete
