# 04 — Tenant configuration with a preflight check

**What to build:** The app learns which tenant it talks to, validates that tenant before trying to use it, and says something actionable when it cannot.

The preflight matters because a mistyped hostname would otherwise surface much later as a login that mysteriously fails, with nothing on screen to diagnose.

**Blocked by:** Ticket 02.

**Status:** ready-for-agent

- [ ] A development-only entry screen accepts tenant hostname, OAuth client id and assistant id, and persists them between launches
- [ ] The hostname is validated by an unauthenticated request to the tenant's OAuth authorization-server metadata document before it is accepted
- [ ] A hostname that is wrong or unreachable produces a message naming the field at fault, not a generic failure
- [ ] The resolver exposes one tenant configuration value regardless of where it came from, with a documented precedence order that MDM can later slot into without a second configuration architecture
- [ ] Missing or incomplete configuration produces a distinct configuration-missing state — never a crash, and never a login attempt against nothing
- [ ] No tenant values are compiled into the binary; verified by inspecting a release bundle
