# 02 — Strip the starter and stand up the chat-first shell

**What to build:** The app opens directly into a new Thread with a usable question input and an answer list, rendering local placeholder data. The repository carries only this product's code.

This is the prefactor: everything else is built on this structure, and it is cheapest to do before any Qlik code exists.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Expo starter routes and demo components are removed, with no dead imports left behind
- [ ] Lint and type checking pass clean
- [ ] Launching the app goes straight to a new-Thread screen with a working question input; history and settings are reachable as secondary navigation, not as co-equal tabs
- [ ] The domain, transport, auth and configuration module boundaries exist, with the domain types (Thread, Interaction, Answer, Citation, Starter) defined in the project's own vocabulary
- [ ] The UI imports domain types only — verified by inspection, since this is the boundary ADR-0006 exists to protect
- [ ] The web build renders the same screen from fixtures, and importing the Qlik transport on web fails loudly with an explanatory error
- [ ] No Qlik network call exists anywhere in the codebase yet
