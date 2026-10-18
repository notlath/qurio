---
status: accepted
---

# A side panel replaces the tab bar, and the app opens on the Assistant

Qlik Answers is the reason this app exists, but a three-tab bar (Apps, Assistant, Settings) made it one destination among three, and History was a screen two taps deep. We replace the tab bar with a side panel, as the ChatGPT and Gemini apps do, on iOS and Android. The app opens on the Assistant. The panel holds the Qurio logo, New chat, Apps, the History of the selected Assistant, and a Profile footer whose gear opens Settings. Tapping a Thread makes it the current chat; it is no longer a pushed screen with Back.

## Considered options

- **Keep the tab bar and add History as a fourth tab.** Rejected: it keeps Apps and Settings level with the Assistant, and History still competes for the same bar.
- **Merge every Legacy Assistant's Threads into one History.** Rejected for now: one request per Assistant and merged paging, for a list a Qlik User reads one Assistant at a time. Revisit if Qlik Users ask for it.
- **Panel on iOS only, bottom navigation kept on Android.** Rejected: two navigation shapes to build and test, and both reference apps use a panel on both platforms.

## Consequences

- Apps is no longer one tap away. It is a panel destination with its own hamburger button.
- On phones the panel overlays the content and opens from the hamburger button or a swipe from the left edge, on top-level screens only, so pushed screens keep swipe-to-go-back.
- When the window is at least 768pt wide, the panel docks at 320pt beside the content and the hamburger button collapses it; the choice is remembered on the device. There is no edge swipe while docked. The Analytics App and Settings open in the content area beside it.
- A real tablet layout needs `ios.supportsTablet: true` (iPad was running the scaled iPhone app). Phones stay portrait and tablets rotate, which on Android needs a runtime lock.
- Deleting a Thread from the panel is a long press, not a swipe, because a left swipe closes the panel.
- An Agentic Assistant has no History in the app (ADR-0009); the panel says so instead of showing an empty list.
