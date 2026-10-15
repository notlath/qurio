# Research: our app compared with Qlik's "Qlik Analytics" mobile app

Researched 2026-10-15. Our side comes from this repository. Qlik's side comes from the Apple App Store, Google Play, help.qlik.com and Qlik Community release notes (Qlik staff posts). Store reviews are user reports, and this document labels them as such. No third-party blog is used as fact.

"Our app" means QlikAnswersApp (product name Qurio). "Qlik Analytics" means Qlik's own Qlik Cloud mobile app, formerly "Qlik Sense SaaS mobile". The separate "Qlik Sense Client-Managed" mobile app is out of scope.

Status labels for our app:

- **Shipped** — in the code today, per `README.md`.
- **PoC** — in the code, but proof-of-concept only, with limited device evidence.
- **Planned** — in a ticket or ADR, not in the code.

## 1. Summary

Our app has one real advantage: a Qlik Answers Assistant chat in a native mobile app. No Qlik source that we read says Qlik Analytics has Qlik Answers. Its store listings and mobile help pages do not mention Qlik Answers, Insight Advisor or any AI chat (see §2.2). But Qlik Answers chat is officially supported in mobile browsers, so the gap is "no native app", not "no mobile access".

For analytics, Qlik Analytics is much stronger. It has offline apps, push alerts, monitored charts, bookmarks, native chart rendering, several Tenants at once, Intune MAM, and a monthly release cadence. Our Analytics App viewer is a PoC with Android emulator and development-build evidence only. Our agentic Assistant also depends on an undocumented token workaround with no Qlik contract.

Bottom line: our app is a credible Qlik Answers client and a weak Qlik Analytics substitute. Position it as a companion for Assistant use, not as a replacement for Qlik Analytics.

## 2. What each app is

### 2.1 Our app (QlikAnswersApp / Qurio)

- An iOS and Android Expo app for Qlik Cloud. It lists Analytics Apps and gives access to Qlik Answers Assistants (`README.md`).
- Three tabs: Apps, Assistant, Settings (`README.md` § Current behavior).
- The Qlik User types only the Tenant hostname, then signs in with per-user OAuth and PKCE. There is no backend (`docs/adr/0001-per-user-native-oauth-no-backend.md`, `docs/adr/0010-published-oauth-client-tenant-hostname-only.md`).
- Legacy (classic) Assistants use native chat over the published Assistants REST API. Agentic Assistants open in Qlik's own `qlik-embed` UI inside a WebView (`README.md`, `docs/adr/0009-native-lists-over-rest-qlik-content-via-qlik-embed.md`).
- Online only. Answer content is never stored on the device (`CONTEXT.md`, `docs/adr/0007-no-answer-content-on-device.md`).
- Distribution today: EAS `development` profile with internal distribution. The repository has no production build profile (`eas.json`, `README.md` § Development and verification). The app is not on a public store.

### 2.2 Qlik Analytics (Qlik's app)

- Free app from QlikTech for Qlik Cloud. The listing describes mobile dashboards, an interactive analytics engine, offline access, push alerts, sharing and enterprise security (App Store and Google Play listings).
- Supports Qlik Cloud Tenants. Qlik Cloud Government does not support it (help: `qsmsaas-intro.htm`).
- The App Store listing, the Google Play listing, and the four mobile help pages do not mention Qlik Answers, Insight Advisor, AI chat or an assistant. The Qlik Answers help pages (`Qlik-Answers.htm`, `using-assistants.htm`, `qlik-answers-limitations.htm`) do not mention the mobile app. The Agentic Analytics FAQ (Qlik Support, updated 2026-08-06) does not mention mobile either.
- Qlik Answers itself states: "The chat experience is supported for mobile browsers" (help: `qlik-answers-limitations.htm`).

Store facts (accessed 2026-10-15):

| Fact | App Store (iOS) | Google Play (Android) |
| --- | --- | --- |
| Current version | 1.179.14, released "3d ago" | Not shown on the page we read |
| Last update | About 2026-10-12. The release note is dated 2026-10-12. | "Updated on Oct 9, 2026" |
| Rating | 4.4 / 5 from 8 ratings | 5.0 / 5. The page shows both "62 reviews" and "67 reviews". |
| Downloads | Not shown | 10K+ |
| Size | 669.9 MB | Not shown |
| Requirements | iOS 18.0+, iPadOS 18.0+, visionOS 2.0+ | Not verified |
| Price | Free, no in-app purchases shown | Free |
| Privacy | Not linked to user: Device ID, Product Interaction. No tracking. | No data shared. May collect Personal info and App activity. Encrypted in transit. "Data can't be deleted." |
| Languages | English plus 14 others | Not checked |

## 3. Comparison table

| Dimension | Our app | Qlik Analytics | Edge |
| --- | --- | --- | --- |
| Qlik Answers chat | **Shipped:** native Legacy Assistant chat with streaming, Stop, Starters, Citations, Feedback, History (`README.md`). **PoC:** Agentic Assistant in embedded Qlik UI (`docs/poc-tickets/21-embedded-agentic-assistant-tab.md`). | No mention in listings or mobile help (§2.2). Chat works in mobile browsers (`qlik-answers-limitations.htm`). | **Ours** |
| Analytics App browsing | **Shipped:** native list with search, grid/list views, pagination (`README.md`). | Mobile Collection with search. Several Tenants (`qsmsaas-get-started.htm`, `qsmsaas-using.htm`). | Even |
| Sheet viewing and interaction | **PoC:** opens an Analytics App in embedded `classic/app`. Sheet browsing and full device acceptance are incomplete (`README.md` § Known limitations, ticket 20). | Sheet swipe, selections, selection history, selections tool, bookmarks, table sort, View data, filter panes. Several object types render natively (`qsmsaas-work-with-apps.htm`, `qsmsaas-setup.htm`). | **Qlik** |
| Offline | None, by design (ADR-0007). | Download apps. Read-only offline use, with selections, for 7 days after the last online sign-in. Admin can disable it (`qsmsaas-using.htm`, `qsmsaas-setup.htm`, `mobile-set-access.htm`). | **Qlik** for features. **Ours** for data-on-device risk. |
| Alerts, push, monitored charts | None (`README.md` § Known limitations). | Alerts tab, push notifications, monitored charts (`qsmsaas-using.htm`). | **Qlik** |
| Sign-in | Per-user OAuth with PKCE in the system auth session. One Tenant Approval per Tenant. Hostname-only entry (ADR-0010, `README.md` § Authentication). | Add the Tenant URL, then sign in. QR code and email buttons add the Tenant automatically (`qsmsaas-setup.htm`, `qsmsaas-get-started.htm`). No Tenant admin approval step is documented. | **Qlik** (less onboarding) |
| Region coverage | Published clients for `ap` and `sg` only. Other regions and custom domains need a Customer-made client (`README.md`). Production clients are not yet published (GitHub issue #8). | Any Qlik Cloud Tenant except Qlik Cloud Government (`qsmsaas-intro.htm`). | **Qlik** |
| Multi-tenant | One Tenant at a time. "Change tenant" signs out (`README.md`). | Several connections. Switch without logout (`qsmsaas-using.htm`). | **Qlik** |
| MDM / enterprise config | **Shipped (code):** generic AppConfig keys on iOS and Android App Restrictions. No live change listener (`README.md`). Real-MDM verification is not recorded (ticket 14 status: ready-for-agent). | Intune only: app config key `mdm` with an `Accounts` array, Intune MAM SDK, app protection policies (`configure-mobile-app.htm`, App Store 1.177.10 note). | **Qlik** for depth. **Ours** for vendor-neutral config. |
| App lock | Privacy lock on by default, device authentication (`README.md`). | Optional PIN, fingerprint or face lock (`qsmsaas-setup.htm`). | Even |
| Screen capture | Release builds always request capture protection (`README.md` § Security). | Through Intune policy only, per docs (`configure-mobile-app.htm`). | **Ours** without Intune |
| Data on device | Access token in memory. Refresh token in SecureStore. No Answer content stored. Embedded WebView is incognito with HTTP cache off (`README.md`). Embedded runtime storage is not yet verified (ticket 24). | Offline QVF files. After revocation, offline data "stays on the device" (`mobile-set-access.htm`). | **Ours** |
| Platform coverage | iOS and Android. Android evidence is from emulator and development builds. iOS acceptance of embedded views is not established (`README.md`, ADR-0009). | iPhone, iPad, Vision Pro, Android phones and tablets (App Store, `qsmsaas-get-started.htm`). | **Qlik** |
| OS floor | Not stated in this repo. | iOS 18.0+. One Play review (2024) says only the latest Android is supported (user report). | Unknown |
| Maturity and cadence | Pre-release. Internal distribution. No production build profile (`eas.json`, `README.md`). | Releases about monthly in 2026: 1.179.0 (Jun 1) to 1.179.14 (Oct 12) (App Store, Qlik Community). | **Qlik** |
| Store ratings | None. Not on a public store. | 4.4 (8 ratings) iOS. 5.0 (62–67) Android. | **Qlik** (small samples) |
| Cost to the Customer | The Customer licenses this app (`CONTEXT.md`). Price is not in the repo. | Free download. Needs a Qlik Cloud subscription and the "Native mobile app" permission (`mobile-set-access.htm`). | **Qlik** |
| Dependency on Qlik APIs | Published REST for lists and Legacy chat. Agentic and Analytics App views use a token workaround with "no Qlik contract". `qlik-embed` loads from jsDelivr at major version 1, not pinned (ADR-0009, `README.md`). | First-party. Qlik owns both sides. | **Qlik** |
| Maintenance burden for us | Full: two platforms, OAuth clients per region, Android managed-config module, runtime re-checks after Qlik updates (ADR-0009, ADR-0010, `README.md`). | None for us. | **Qlik** |

## 4. Advantages of our app

- **Native Qlik Answers chat.** Shipped: Legacy Assistant chat with streaming, Stop, Starters, Citations, Feedback and History (`README.md` § Current behavior). No Qlik listing or mobile help page that we read mentions Qlik Answers in Qlik Analytics (§2.2).
- **Agentic Assistant on mobile.** PoC: the app opens Qlik's agentic UI in-app with the user's own token. There is no second sign-in (ADR-0009, ticket 21). Qlik documents agentic chat in mobile browsers only (`qlik-answers-limitations.htm`).
- **No browser exposure.** The Customer vetoed browser-accessible Qlik Answers. Our app gives Answers on mobile with no SPA client and no system browser (ADR-0005). The mobile-browser route that Qlik documents does not meet that veto.
- **Assistant choice per Thread, with History.** The user picks an Assistant for each new Thread and can delete Threads (`README.md`, `CONTEXT.md`).
- **Less data on the device.** No Answer content and no offline files are stored (ADR-0007, `README.md` § Security and storage). Qlik Analytics keeps offline app data on the device after access is revoked (`mobile-set-access.htm`).
- **Capture protection without Intune.** Release builds always request screenshot and recording protection (`README.md`). Qlik documents screenshot control only through Intune app protection policies (`configure-mobile-app.htm`).
- **Privacy lock on by default.** Qlik's app lock is opt-in (`README.md`, `qsmsaas-setup.htm`).
- **Vendor-neutral MDM config.** Standard iOS managed config and Android App Restrictions work with any MDM that supports them (`README.md` § Configure through device management). Qlik documents Intune only, with an Entra ID identity provider required (`configure-mobile-app.htm`). Real-MDM testing of our path is not recorded (ticket 14).
- **No backend.** We run no server and hold no client secret (ADR-0001).
- **Small sign-in input.** The user types only the hostname. The app finds Assistants after sign-in (ADR-0010).
- **We control the roadmap.** We can add Answers features without waiting for Qlik. This is an inference, not a measured benefit.

## 5. Disadvantages of our app

- **Analytics viewing is a PoC.** Opening an Analytics App works on an Android development build. Sheet browsing, reconnect after the 90-second engine token, and full device acceptance are incomplete (`README.md` § Known limitations, ADR-0009 addendum, ticket 20). Qlik Analytics has full sheet navigation, selections and bookmarks (`qsmsaas-work-with-apps.htm`).
- **No offline use.** By design (ADR-0007). Qlik Analytics offers offline apps (`qsmsaas-using.htm`).
- **No alerts, push notifications or monitored charts** (`README.md`). Qlik Analytics has all three (`qsmsaas-using.htm`).
- **One Tenant at a time.** Changing Tenant signs the user out (`README.md`). Qlik Analytics switches Tenants without logout (`qsmsaas-using.htm`).
- **Narrow region coverage.** Published clients exist for `ap` and `sg` only. Production clients are not yet published (`README.md`, GitHub issue #8). Qlik Analytics works with any Qlik Cloud Tenant except Government (`qsmsaas-intro.htm`).
- **Extra onboarding step.** A Tenant admin must approve our client once per Tenant. Before that, users get `OAUTH-28` (`README.md` § Authentication). Qlik documents no such step for its app.
- **Agentic path has no Qlik contract.** The token bridge depends on Qlik runtime behavior, which Qlik can change without notice (ADR-0009). The runtime loads from a CDN at major version 1, not pinned (`README.md`).
- **Unverified on iOS and physical devices.** Embedded-view evidence is from an Android emulator and development builds (ADR-0009, `README.md`). Sign-out teardown, navigation containment and runtime storage are open (ticket 24).
- **Two chat experiences.** Legacy Threads are native. Agentic chats live in Qlik's UI with separate history (`README.md`). Retirement of native classic chat is blocked (ticket 22).
- **No Intune MAM SDK.** Qlik integrates the Intune SDK for MAM policies (App Store note 1.177.10, `configure-mobile-app.htm`). We read config only, with no live change listener (`README.md`).
- **No public store presence or ratings.** Internal distribution only (`eas.json`). Qlik Analytics is on both stores (§2.2).
- **No tablet or Vision Pro specifics.** Our repo states no tablet layout. Qlik ships one app for phones and tablets, plus visionOS (App Store, `qsmsaas-get-started.htm`).
- **Shared rate ceiling.** The Answers guardrail of 20 questions per minute per subscription limits concurrent use (`docs/technical-proposal.md` §14). This limit is Qlik's, so it may also apply to Qlik's own surfaces. That is not verified.
- **Full maintenance cost.** We own two platforms, OAuth clients per region, a native Android module, and re-checks after each Qlik runtime change (ADR-0009, ADR-0010, `README.md` § Maintenance).

## 6. Open questions and unverified claims

1. **Does Qlik Analytics have Qlik Answers today?** No source we read says yes. The evidence is absence: listings, mobile help, Answers help and the agentic FAQ do not mention it. A hands-on check of version 1.179.14 on a Tenant with Qlik Answers is the only way to confirm.
2. **Can a sheet in Qlik Analytics show an Answers or agentic object?** Not documented. Not checked.
3. **Insight Advisor on Qlik Analytics mobile.** Not mentioned in the mobile help pages. Qlik states that a Tenant uses either Qlik Answers or Insight Advisor, not both (Agentic Analytics FAQ).
4. **Qlik Analytics Android requirements and version.** The Play page did not show them in our fetch.
5. **Play review count.** The page shows both 62 and 67. We do not know which view each count belongs to.
6. **Qlik Analytics sign-in method.** `qsmsaas-setup.htm` describes username and password entry. `configure-mobile-app.htm` describes a device browser flow for Intune. A general browser or SSO flow is not documented for the non-Intune case.
7. **Does Qlik enforce its 5-device limit or the "Native mobile app" permission on third-party OAuth clients?** Not documented. Our research notes that the `mobile:all` scope gates Qlik's app only (`docs/research-integration-gaps.md` §12).
8. **Our app's price, OS floor and app size.** Not stated in the repository.
9. **Our MDM path on a real MDM.** Implemented, but not verified (ticket 14).
10. **Our embedded views on iOS and physical devices.** Not established (ADR-0009, `README.md`).

## 7. Sources

All web sources accessed 2026-10-15.

Qlik, primary:

- https://apps.apple.com/us/app/qlik-analytics/id1523006591 — App Store listing, version history, privacy labels, rating.
- https://play.google.com/store/apps/details?id=com.qlik.qsm&hl=en_US&gl=US — Google Play listing, data safety, rating, reviews.
- https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Mobile/qsmsaas-intro.htm
- https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Mobile/qsmsaas-get-started.htm
- https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Mobile/qsmsaas-setup.htm
- https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Mobile/qsmsaas-using.htm
- https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Mobile/qsmsaas-work-with-apps.htm
- https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Admin/mobile-set-access.htm
- https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Admin/configure-mobile-app.htm
- https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikAnswers/Qlik-Answers.htm
- https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikAnswers/qlik-answers-limitations.htm
- https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Global_Common/QlikAnswers/using-assistants.htm
- https://community.qlik.com/t5/Release-Notes/tkb-p/ReleaseNotes — mobile release notes index.
- https://community.qlik.com/t5/Release-Notes/Qlik-Analytics-Mobile-App-Release-Notes-1-179-14/ta-p/2559639 — 2026-10-12.
- https://community.qlik.com/t5/Release-Notes/Qlik-Sense-SaaS-Mobile-App-Release-Notes-1-179-11/ta-p/2554894 — 2026-08-19.
- https://community.qlik.com/t5/Release-Notes/Qlik-Sense-SaaS-Mobile-App-Release-Notes-1-179-5/ta-p/2552755 — 2026-07-06.
- https://community.qlik.com/t5/Official-Support-Articles/Qlik-Answers-Agentic-Analytics-FAQ/ta-p/2542617 — Qlik Support, updated 2026-08-06.

User reports (not fact):

- Google Play reviews on the listing above: 2024-08-01 (Android version support), 2026-07-15 (reporting and email request).

Our app (repository paths):

- `CONTEXT.md`, `README.md`, `eas.json`
- `docs/technical-proposal.md`
- `docs/adr/0001-per-user-native-oauth-no-backend.md` to `docs/adr/0010-published-oauth-client-tenant-hostname-only.md`
- `docs/research-integration-gaps.md`, `docs/research-assistant-selector-ticket-28.md`
- `docs/poc-tickets/14-enterprise-mdm-configuration.md`, `20-open-analytics-app-sheets.md`, `21-embedded-agentic-assistant-tab.md`, `22-retire-native-classic-chat-and-update-domain-port-adr.md`, `24-harden-embedded-host-navigation-storage-signout.md`
- `src/app/` route files
- GitHub issue #8, `notlath/qlik-answers-mobile` ("Ship production published OAuth clients")
