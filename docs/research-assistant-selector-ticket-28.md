# Research: Assistant selector redesign (issue #28)

Researched 2026-10-12. Primary sources only. Anything not verified is marked UNVERIFIED.

Question: should classic Assistants and Agentic Assistants share one selector, or stay separate?

## Summary

1. The two kinds are different objects with different screens after selection. Classic is native chat over REST. Agentic is a Qlik-owned embed.
2. The assistant-ui Model Selector is a web popover. Its portable ideas are small: a trigger that shows the current item, a list of name plus description rows, a check mark on the current row, and optional group headings.
3. No `@expo/ui` control gives grouped rows with kind badges. A small custom list in a sheet or modal is needed.
4. Recommendation: one selector with two groups (Classic, Agentic), a kind badge on every row, and a different result per kind. See section 6.

## 1. How selection works today (repo)

### Listing

- `listAssistants()` reads all pages of `GET /api/v1/assistants?limit=100` (`src/qlik/adapter.ts:149-159`).
- The app decides the kind from one field. An Assistant with a non-empty `appIds` array is `agentic`. All others are `classic` (`src/qlik/classic/mappers.ts:5`).
- The `appIds` field comes from a live capture on `mtcteam.ap` on 2026-10-05 (`src/qlik/classic/wire-types.ts:10-12`). The published OpenAPI spec does not declare it. See section 2.
- `loadAssistantChoice` splits the list into `assistants` (classic) and `agentic`. It picks `selected` from the remembered id, or the only classic Assistant (`src/qlik/assistant-choice.ts:13-22`).
- The remembered id lives under `qlik.lastAssistant.<tenantHost>` and holds classic ids only (`src/qlik/assistant-choice.ts:5`).
- `Selection.agentic` is documented as "opened in the embed, never chosen for classic Threads" (`src/qlik/assistant-selection.tsx:17`).

### Classic selection (`AssistantSwitcher`)

- `AssistantSwitcher` is a text button plus an inline expanding list of classic Assistants (`src/components/assistant-switcher.tsx:36-63`).
- The button has `accessibilityLabel="Choose Assistant"` and `accessibilityState.expanded`. Rows have `accessibilityState.selected`.
- It is disabled when only one classic Assistant exists (line 39).
- States it handles today:
  - Loading: spinner labelled "Loading Assistants" (line 14).
  - Error: title and message from `errorMessageFor` (lines 15-23).
  - Empty classic list with at least one Agentic Assistant: renders nothing (line 27).
  - Empty everywhere: "No Assistants available" (lines 28-33).
  - Save failure: "Could not remember the Assistant. Try again." (line 61).
- It appears on two screens: New thread (`src/app/(tabs)/assistant/index.tsx:41`) and History (`src/app/(tabs)/assistant/history.tsx:74`).
- History lists classic Threads for the selected classic Assistant only. The History screen hides the list when there is nothing to choose (`history.tsx:65-75`).

### Agentic selection (`AgenticEntry`)

- `AgenticEntry` renders above the chat list on the New thread screen (`src/app/(tabs)/assistant/index.tsx:84`).
- If the tenant sets `agenticAssistantId`, it shows one row, "Open the Agentic Assistant". If the user cannot view that id (list loaded, id missing), it shows a no-access text instead (`src/qlik-embed/agentic-entry.tsx:24-45`).
- Otherwise it shows one row per discovered Agentic Assistant under the heading "Agentic Assistants". It shows nothing on web (line 45).
- Each row is a `Link` to `/assistant/agentic` with `?id=<assistantId>` for discovered ones (lines 53-59).
- A configured id wins over a discovered id (`src/qlik-embed/agentic-target.ts:6-17`).

### What differs after selection

| Aspect | Classic | Agentic |
| --- | --- | --- |
| Screen | Stays on `assistant/index` | Pushes `assistant/agentic` (`src/app/(tabs)/assistant/_layout.tsx:26`) |
| Renderer | Native: `FlatList`, `InteractionRow`, our `Composer` | Qlik-owned page in `QlikEmbedHost`, `ui="ai/agentic-assistant"` (`agentic.tsx:48-53`) |
| Transport | REST via `AnswersPort` (`portFor(id)`) | Embed runtime with our native token (ADR-0009) |
| Threads and history | Our History screen lists classic Threads | Qlik's history control inside the embed. Reopening starts a fresh chat. After app restart no conversation is visible outside the embed (`docs/poc-tickets/21-embedded-agentic-assistant-tab.md`, Evidence section) |
| Composer, starters, feedback | Ours | Qlik's |
| Availability | iOS, Android, web (fixtures on web) | Native only. Web redirects to `/assistant` (ADR-0005, `agentic.tsx:40`) |
| Persistence of choice | Remembered per tenant | Not remembered |

### Glossary and ADRs

- `CONTEXT.md`: **Assistant** covers both kinds. **Agentic Assistant** "reasons over both Knowledge Bases and an Analytics App" and is "Distinct from a classic Assistant". **Thread** keeps its Assistant for life ("resuming a Thread always continues with that Assistant").
- ADR-0009 (`docs/adr/0009-native-lists-over-rest-qlik-content-via-qlik-embed.md`): "The app renders lists itself from published Qlik REST APIs ... and opens Qlik-owned content — first the Agentic Assistant — in a native WebView running `qlik-embed`." Native lists plus embedded Qlik content is the accepted pattern. A selector is a native list that opens Qlik content.
- ADR-0005: the web target never reaches Qlik, so the Agentic option cannot run on web.
- Ticket 22 (`docs/poc-tickets/22-retire-native-classic-chat-and-update-domain-port-adr.md`), status blocked: plans to remove native classic chat after the embed ships. If it ships, the classic group disappears. This decides how much the classic side of the selector is worth. See open question 1.

## 2. Qlik: how the two kinds are identified

### Official statements

- `qlik-embed` has two Answers UIs. `ai/agentic-assistant` is "The embedded version of the agentic Qlik Answers assistant." It "uses knowledge bases and analytics apps together". `ai/assistant` is the embedded legacy assistant, "a quick retrieval-augmented generation (RAG) tool". Source: https://qlik.dev/embed/qlik-embed/parameters/
- Both take `assistant-id`. Only `ai/assistant` documents `thread-id` and a dark theme. The agentic UI "Requires OAuth authentication and a Qlik Cloud user with access to the assistant" and cross-region inference. Same source.
- Agentic needs an opt-in: "To use the agentic Qlik Answers experience, you must opt in to cross-region inference." Source: https://qlik.dev/changelog/202-qlik-embed-agentic-assistant/
- Help pages name the classic kind "legacy". The legacy experience is "an alternative to the Qlik Answers agentic experience" and "does not require cross-regional data processing". Source: https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikAnswers/legacy-answers.htm
- Permissions page: under Agentic AI, Data analysis, "If they have the permissions, they can use the experience with legacy assistants." Source: https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikAnswers/qlik-answers-permissions.htm (read through a page-summary tool, not verbatim from the page).

### REST list endpoint

- `GET /api/v1/assistants` "Retrieves the list of assistants." Parameters: `limit`, `next`, `prev`, `sort`, `spaceId`, `countTotal`. Source: https://qlik.dev/specs/rest/assistants.json (fetched 2026-10-12).
- The `Assistant` schema lists `legacy` in `required` but does not declare it under `properties`. It declares `knowledgeBases`, `welcomeMessage`, `defaultPromptType`, `orderedStarterIds` and others. It does not declare `appIds`. Same source.
- The repo found `legacy: true` on a classic Assistant (`docs/poc-tickets/fixtures/01-verify-assistants-api/NOTES.md`, note 3). It treated that as the classic signal for ticket 1.
- The repo's code uses `appIds` instead (section 1). No official page I found says that `appIds` marks an Agentic Assistant. UNVERIFIED: that `appIds` is a stable contract.
- UNVERIFIED: whether `legacy` is absent or false for Agentic Assistants on the list endpoint. No fixture in the repo shows this.
- The Qlik help page "Qlik Answers" says an assistant "can also include a single application as a content source". This is consistent with `appIds` but it is not a field definition. Source: https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikAnswers/Qlik-Answers.htm
- The agentic REST API (`/api/v1/cloud-assistants/...`) is not published. Qlik staff say publication is "on the roadmap". See `docs/research-integration-gaps.md` section 10, which cites the Qlik Community thread. I did not re-verify that thread.

### Can they be mixed?

- The Qlik pages I read frame legacy as a tenant-level alternative to agentic ("for Qlik Cloud users unable to use the agentic experience"). They do not say whether both kinds can exist in one tenant.
- The repo's own tenant (`mtcteam.ap`) returned both kinds in one list (the mapper comment and ticket 21 evidence show this). That is evidence from one tenant. It is not an official statement.
- UNVERIFIED: any official statement that a user may see both kinds in one tenant and one list.

## 3. assistant-ui Model Selector

Sources: docs page https://www.assistant-ui.com/elements/model-selector and source file `packages/ui/src/components/react/assistant-ui/elements/model-selector.radix.tsx` in https://github.com/assistant-ui/assistant-ui (read through the GitHub API on 2026-10-12, file last commit `208cc81`). The docs page was read through a page-summary tool. The source is the authority where the two differ.

### Layout

- Trigger: a button with `role="combobox"` and `aria-haspopup="listbox"`. It shows the selected item (optional icon, name) and a chevron-down. Variants `outline`, `ghost`, `muted`. Sizes `sm`, `default`, `lg`.
- Content: a popover, `w-72`, rounded, containing a cmdk `Command` list. It opens below the trigger by default and aligns to `start`. It does not flip once open.
- Row (`ModelSelectorItem`): optional icon, then a column with the name (bold, truncated) and an optional description (muted, small, truncated).
- Current row: a check icon at the right end of the row. The docs page says it "does not describe a check mark on items", but the source renders one when `value === model.id`.
- Groups: `ModelSelectorGroup heading="..."`. The default list has one group with no heading. Grouping is opt-in through children. Sample: "provider-groups-and-availability".
- Disabled rows stay visible and cannot be selected (`disabled`).
- Empty state: `ModelSelectorEmpty`, default text "No models found." It shows only when a search filter matches nothing. The component has no loading or error state.
- Search: optional (`searchable`, default `false`). Matches `id`, `name` and `keywords`.
- Extra: a "Thinking" effort row for models that declare `efforts`. Not relevant here.

### Behavior

- Selecting a row sets the value and closes the popover (`onSelect` calls `setValue` then `setOpen(false)`).
- ArrowDown or ArrowUp on the focused trigger opens the popover.
- Without a visible search box, a visually hidden read-only input (`FocusAnchor`) keeps cmdk keyboard navigation working.
- The runtime variant registers the choice with assistant-ui `ModelContext`. This ties to its chat runtime and has no use here.

### Web-only parts

- Radix `Popover`, cmdk `Command`, CSS classes, `sr-only`, hover and focus-visible rings, the arrow-key trigger handler, and the popover flip logic. None of these exist in React Native.

### Portable parts

- Trigger shows the current item with a chevron.
- Name plus one-line description per row.
- Check at the row end for the current item.
- Optional headed groups.
- Close on select.
- Disabled rows that stay visible.
- No search at small list sizes (default `searchable=false`).

## 4. Platform guidance for the native version

### Apple (developer.apple.com HIG, JSON content API, read 2026-10-12)

- Pop-up button: "Use a pop-up button to present a flat list of mutually exclusive options or states." After a choice "the menu closes, and the button can update its content to indicate the current selection." Use a pull-down button instead if you need "a submenu". Source: https://developer.apple.com/design/human-interface-guidelines/pop-up-buttons
- Pop-up button, space: "Consider using a pop-up button when space is limited and you don't need to display all options all the time." Same source.
- Pull-down buttons are for actions, not for showing a current value. Source: https://developer.apple.com/design/human-interface-guidelines/pull-down-buttons
- Menus: "Consider grouping logically related items" and "use a separator". "Be mindful of menu length." Use a "checkmark to show that an attribute is currently in effect." Source: https://developer.apple.com/design/human-interface-guidelines/menus
- Menus: submenus "sparingly", one level, and if a submenu holds "more than about five items, consider creating a new menu". Same source.
- Pickers: "Consider using a picker to offer medium-to-long lists." For "a fairly short list of choices, consider using a pull-down button instead of a picker". Source: https://developer.apple.com/design/human-interface-guidelines/pickers
- Read as a whole: for 2 to 10 items, Apple points to a menu-style control with a checkmark on the current item, grouped by separators. The HIG pages I read do not mention section headers or badges. UNVERIFIED for those two.

### Material 3

- The Material 3 design pages (m3.material.io menus and bottom sheets) render with JavaScript. Both fetches returned only the page title. I could not read the guidance. UNVERIFIED: any M3 rule on when to use a menu, exposed dropdown or bottom sheet.
- Compose: "Drop-down menus let users click an icon, text field, or other component, and then select from a list of options on a temporary surface." `HorizontalDivider` separates groups. The page does not cover a selected-item indicator. Source: https://developer.android.com/develop/ui/compose/components/menu
- Material Web: "Select menus display a list of choices on temporary surfaces and display the currently selected menu item above the menu." Source: https://github.com/material-components/material-web/blob/main/docs/components/select.md
- Compose `ModalBottomSheet` is the sheet component. The page gives API only and no usage advice. Source: https://developer.android.com/develop/ui/compose/components/bottom-sheets

### Expo SDK 57 and React Native

The repo installs `@expo/ui` 57.0.21 (`package.json:7`). Context7 has no SDK 57 branch for Expo (it lists sdk-54 to sdk-56), so I used the versioned docs at docs.expo.dev/versions/v57.0.0 and the installed package source.

| Option | Platforms | Fits grouped rows with badges? | Source |
| --- | --- | --- | --- |
| Universal `Picker`, `appearance="menu"` | Android, iOS, web, Expo Go | No. `Picker.Item` takes only `label` and `value` (`node_modules/@expo/ui/src/universal/Picker/types.ts`) | https://docs.expo.dev/versions/v57.0.0/sdk/ui/universal/picker/ |
| SwiftUI `Menu` | iOS, Expo Go | Partly. Children may be `Button`, `Toggle`, `Picker`, `Section`, `Divider`. A `Toggle` shows a checkmark when on. Badges are not documented | https://docs.expo.dev/versions/v57.0.0/sdk/ui/swift-ui/menu/ |
| Compose `DropdownMenu` and `ExposedDropdownMenuBox` | Android | Partly. Items and dividers exist in the package source. Section headings and badges are not documented. UNVERIFIED | `node_modules/@expo/ui/src/jetpack-compose/` |
| Universal `BottomSheet` | Android, iOS, web, Expo Go | Yes, with our own rows. It takes any React children. Wrap tall content in a `ScrollView`. On Android, `fraction` and `height` snap points round to `half` or `full` | https://docs.expo.dev/versions/v57.0.0/sdk/ui/universal/bottomsheet/ |
| React Native `Modal` | All | Yes, with our own rows. `onRequestClose` is required and handles the Android Back button. While open, `BackHandler` events are not emitted | https://reactnative.dev/docs/modal |

- Accessibility props in React Native: `accessibilityRole` (and `role`) support `combobox`, `menu`, `menuitem`, `radio`, `radiogroup`. `accessibilityState` supports `expanded` and `selected`. Source: https://reactnative.dev/docs/accessibility
- Repo precedent for platform files: `src/components/native-switch.ios.tsx` and `native-switch.android.tsx` wrap `@expo/ui` controls in `Host`. The repo already uses `AppPressable` and `Icon` for custom rows.
- UNVERIFIED: how screen readers announce rows inside the universal `BottomSheet`. Test on device before choosing it.

## 5. Options

### Option A. One selector, two groups, kind badge, different result per kind

- The trigger shows the current classic Assistant. The list has a "Classic" group and an "Agentic" group. Each row shows a kind badge. Classic rows set the current Assistant and keep the user on the screen. Agentic rows open the embed screen. The current classic row has a check mark.
- Pros:
  - Meets every acceptance criterion in #28 (one selector, kind shown, current marked).
  - Matches the model selector's grouped-list pattern.
  - Removes the separate `AgenticEntry` block above the chat.
  - Fits ADR-0009: a native list that opens Qlik content.
  - Keeps the Thread rule: classic choice stays the Thread's Assistant.
- Cons:
  - The check mark means "current for native chat", not "the screen you are on". After an Agentic row opens, the check stays on the classic row. A badge or a trailing "opens in Qlik" cue on Agentic rows must make this clear.
  - The selector must show classic rows only on the History screen. History lists classic Threads. An Agentic row there would lead away from History. Either pass a prop, or show Agentic rows only on New thread.
  - Selecting an Agentic row is navigation. Selecting a classic row is state. Mixed semantics inside one list is a risk for screen reader users, so the row labels must say it.
  - Needs a decision for the configured `agenticAssistantId`, which has no name today.

### Option B. One selector that switches the whole screen between native chat and embed

- Choosing any Assistant makes it current. The screen body swaps: classic shows native chat, Agentic shows `QlikEmbedHost` in the same route. The check always marks the screen you see.
- Pros:
  - The cleanest meaning: one current Assistant, one body.
  - Matches the direction of ticket 22, where the embed is the only surface.
- Cons:
  - Largest change. The embed host has keyboard and tab-bar inset workarounds tied to its own route (`agentic.tsx:24-39`, #13 and #18). Moving it into a shared screen risks those.
  - The header History button and the Composer exist only for classic. They must hide or change with the kind.
  - Agentic choice would need a remembered key and a direct-entry guard like today's route.
  - The web build cannot show the embed, so the Agentic rows need a web rule anyway.

### Option C. Keep two separate controls

- Redesign the classic switcher as a menu or sheet with a check. Keep `AgenticEntry` rows as they are, perhaps restyled.
- Pros:
  - Smallest change. No mixed semantics.
  - No change to the embed route.
- Cons:
  - Does not meet "One selector ... opens a list of the available Assistants" and "The list shows which kind each Assistant is" in #28.
  - The user still looks in two places to choose an Assistant.
  - `AssistantSwitcher` already hides itself when only Agentic Assistants exist, so the screen would show two different controls for the same job.

## 6. Recommendation

Choose Option A.

Reasons:

1. It meets the issue's acceptance criteria with the least risk to the embed.
2. The kinds differ in what happens next, not in what the user picks. Both are "an Assistant I can ask". The row can say what happens next with a badge and a cue.
3. It degrades well. If ticket 22 removes classic chat, the selector keeps one group (Agentic) and the same design.
4. Option B is the better end state only if ticket 22 ships. It can follow later from Option A without a rewrite of the list.

Rules to write down with the choice:

- The check mark marks the current classic Assistant, because Thread history belongs to it. Agentic rows have no check mark. They show the badge and a cue that they open in Qlik.
- Show Agentic rows on New thread only. History shows classic rows only.
- Keep the loading, error and empty states from `AssistantSwitcher` unchanged.
- Skip search. With about 2 to 10 Assistants, the Model Selector's own default is no search.
- Platform control: build one custom list inside the universal `BottomSheet` (or RN `Modal` if device tests fail). Universal `Picker` cannot carry groups or badges. Native menus (SwiftUI `Menu`, Compose `DropdownMenu`) match the HIG better on a flat list but need two platform files and have no documented badges. UNVERIFIED which of these a product owner will prefer visually.
- Labels: trigger `accessibilityRole="combobox"` with `expanded` state. Rows use `accessibilityState.selected` for classic and a label such as "Name, Agentic, opens in Qlik" for Agentic rows.

## 7. Open questions for the product owner

1. Is ticket 22 (retire native classic chat) still planned, and when? It decides whether the classic group will exist.
2. Should Agentic Assistants open inside the Assistant tab as today (a pushed screen), or replace the screen body (Option B)?
3. Does the tenant's `agenticAssistantId` setting stay? If it stays, should it appear in the list with its real name, even when the list endpoint does not return it?
4. Should the app remember the last Agentic Assistant, as it does for classic?
5. What do Qlik Users expect to see when both kinds exist: one list ordered by kind, or one ordered by name with badges?
6. Which wording names the kinds for users: "Classic" and "Agentic" (the issue's words), or Qlik's "Legacy" and "Agentic"? CONTEXT.md uses "classic". Qlik's help pages use "legacy".
7. Is it acceptable to rely on `appIds` to tell the kinds apart, or should the team ask Qlik for a documented field? Section 2 shows the spec does not declare `appIds`.

## Sources not fully verified

- Material 3 design guidance: page content did not load. UNVERIFIED.
- Qlik help pages and the assistant-ui docs page were read through a page-summary tool. Quotes there are as the tool returned them.
- The Qlik Community thread on `cloud-assistants` is cited only through `docs/research-integration-gaps.md`.
