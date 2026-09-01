# 03 — Development build with the custom scheme

**What to build:** The app installs and runs on real devices on both platforms from a development build, and the custom scheme opens it. This is what makes every subsequent ticket testable on hardware.

**Blocked by:** Ticket 02.

**External prerequisite:** Apple Developer access, Android distribution access, and an EAS account/project.

**Status:** ready-for-agent

- [ ] A development build installs and runs on a physical iOS device and a physical Android device
- [ ] The `qlikanswers://auth` scheme opens the app from a cold start and from background, on both platforms
- [ ] Build and install steps are documented well enough that another developer reproduces them without help
- [ ] Expo Go is no longer part of the workflow, and the reason is written down so nobody reintroduces it
