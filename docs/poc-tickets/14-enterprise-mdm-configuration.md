# 14 — Enterprise MDM configuration

**What to build:** Production configuration delivery. Tenant settings arrive from the Customer's device management instead of a development screen — plugging into the configuration abstraction that already exists, not introducing a second one.

Deliberately outside the core POC path: the development configuration screen already proves the Qlik integration works.

**Blocked by:** Tickets 04, 05 and 12.

**Status:** ready-for-agent

- [ ] iOS reads the managed application configuration from the platform's managed-configuration key
- [ ] Android reads managed restrictions through a local native bridge whose single responsibility is reading configuration and exposing it — it never touches auth or UI
- [ ] Both platforms normalise into the same tenant configuration value; the rest of the app cannot tell which source it came from
- [ ] Managed configuration takes precedence over development configuration, and the development entry screen is absent from release builds
- [ ] Missing or malformed managed configuration produces the configuration-missing state with administrator-facing guidance
- [ ] Runtime-change behaviour is recorded for both platforms, including the Android constraint that the restrictions-changed broadcast reaches dynamically registered receivers only
- [ ] The Android manifest and restrictions schema are in place, and the case of a declared key being absent at runtime is handled
- [ ] No tenant values or secrets are present in the binary; verified
- [ ] The Customer onboarding runbook is written: create the Native OAuth client, register the shared redirect URI, push the three configuration values, verify with a low-privilege user
- [ ] Verified end to end against at least one real device-management system on each platform, or the emulation used is documented
