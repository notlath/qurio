# 08 — Thread history and starters

**What to build:** Past conversations are browsable and resumable, and a new Thread offers the Assistant's configured opening questions.

**Blocked by:** Ticket 06.

**Status:** ready-for-agent

- [ ] History lists Threads newest-first using server-side pagination, and scrolling loads older pages
- [ ] Opening a past Thread restores its messages and their citations
- [ ] Deleting a Thread removes it, and it stays gone after a relaunch
- [ ] A new Thread displays the Assistant's configured Starters, and tapping one asks it
- [ ] **Recorded:** whether thread listing returns only the signed-in user's Threads, which determines whether history is private by construction
- [ ] No thread or message content is cached on disk
