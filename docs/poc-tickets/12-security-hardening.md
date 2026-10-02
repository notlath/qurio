# 12 — Security hardening

**What to build:** The app locks when it should, resists casual capture, and provably does not leak the Customer's content into telemetry.

**Blocked by:** Ticket 05.

**Status:** ready-for-agent

- [ ] A biometric gate runs on cold start and after the app has been backgrounded longer than a configured interval, with the interval supplied by configuration rather than hard-coded
- [ ] Failing the gate locks the UI without signing the user out or discarding the stored refresh token
- [ ] Screen-capture protection is enabled and verified on each platform, with the iOS version gating documented (recording and screenshots are protected only from their respective minimum versions, and the call is silently inert below them)
- [ ] The iOS privacy manifest declares the required reason code for the managed-configuration UserDefaults access, so the build is submittable
- [ ] Telemetry and crash reporting **provably** exclude question text, answer text, citations, tokens and authorization headers — demonstrated by inspecting captured telemetry payloads, not by reading the code
- [ ] Release builds emit no sensitive content to logs
- [ ] Evidence: a per-platform verification record
