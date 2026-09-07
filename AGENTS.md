# AGENTS.md — Project Guidelines

> This document defines behavioral and technical standards for all AI agents and human contributors working in this repository. Follow these rules strictly. Merge with task-specific instructions when provided and ask before assuming.

## 1. Project Overview

| Field           | Value                                          |
| --------------- | ---------------------------------------------- |
| Project         | QlikAnswersApp                                 |
| Platform        | Expo (Managed) + expo-router                   |
| Language        | TypeScript (strict)                            |
| Package Manager | npm                                            |
| Path Alias      | `@/*` → `./src/*`, `@/assets/*` → `./assets/*` |
| Routing         | File-based routing in `src/app/`               |

## 2. Technology Stack

- **Runtime:** Expo ~57.0.18, React 19.2.3, React Native 0.86.3, react-dom 19.2.3
- **Navigation:** expo-router ~57.0.17 (typedRoutes enabled), react-native-screens, react-native-safe-area-context
- **UI / Media:** @expo/ui ~57.0.14, expo-image, expo-symbols, expo-glass-effect, expo-system-ui, expo-constants
- **Animation:** react-native-reanimated 4.5.1, react-native-worklets 0.10.1, react-native-gesture-handler ~2.32.0
- **Other Expo Modules:** expo-font, expo-linking, expo-splash-screen, expo-status-bar, expo-web-browser, expo-device
- **Web Support:** react-native-web ~0.21.0
- **Tooling:** TypeScript ~6.0.3, Expo ESLint (`expo lint`), React Compiler enabled (`experiments.reactCompiler: true`)

## 3. Documentation Standard

### 3.1 Expo Version Pin

- **Expo SDK version is 57.** Always consult the exact versioned documentation before writing code:
  `https://docs.expo.dev/versions/v57.0.0/`
- Do not rely on memory, prior Expo versions, or generic React Native docs when an Expo v57 equivalent exists.
- If the versioned docs and a general guide conflict, the versioned docs take precedence.

## 4. Project Structure

```
.
├── src/
│   ├── app/            # expo-router routes (_layout.tsx, index.tsx, explore.tsx)
│   ├── components/     # Reusable UI (components/ui/, themed-*, app-tabs.*)
│   ├── hooks/          # Custom hooks (use-theme, use-color-scheme)
│   ├── constants/      # Theme and app constants
│   └── global.css
├── assets/             # Icons, splash, adaptive icons
├── scripts/            # Project scripts (reset-project.js)
├── app.json            # Expo config (typedRoutes, reactCompiler, splash, icons)
├── tsconfig.json       # Extends expo/tsconfig.base, strict mode
└── package.json
```

- Routes live under `src/app/` — do not create a top-level `app/` duplicate.
- Import with the `@/` alias instead of relative `../../../` chains.

### 4.1 Ignored Paths (`.gitignore`)

Source of truth is `.gitignore:1`. Do not commit ignored artifacts.

| Group            | Patterns                                                                                           | Reason                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Dependencies     | `node_modules/`, `.pnp/`, `*.log`                                                                  | Install output, not source                                                                |
| Expo & Build     | `.expo/`, `.expo-shared/`, `expo-env.d.ts`, `dist/`, `web-build/`, `.metro-health-check*`          | Generated Expo/Metro cache and output                                                     |
| Native (managed) | `/android`, `/ios`, `.kotlin/`, `.cxx/`, `build/`, `.gradle/`                                      | Regenerated via `npx expo prebuild`                                                       |
| Secrets / Env    | `.env`, `.env*.local`, `*.pem`, `*.p12`, `*.p8`, `*.key`, `*.jks`, `*.mobileprovision`             | Credentials, must not be committed                                                        |
| OS               | `.DS_Store`, `Thumbs.db`, `Desktop.ini`                                                            | Platform-specific noise                                                                   |
| Editor           | `.idea/`, `.vscode/*` (allowlist: `settings.json`, `tasks.json`, `launch.json`, `extensions.json`) | Local IDE state; shared settings are allowlisted                                          |
| Cache            | `*.tsbuildinfo`, `.eslintcache`, `.parcel-cache/`, `.turbo/`, `graphify-out/`, `.opencode/`        | Incremental build caches                                                                  |
| Coverage         | `coverage/`, `.nyc_output/`                                                                        | Test reporting output                                                                     |
| Agent tooling    | `.agents/`, `agent/`, `.claude/skills/`, `.claude/settings.local.json`, `.serena/`, `.scratch/`    | Installed skill packages and MCP tool state; `skills-lock.json` is the committed manifest |

- Keep `.env.example` (if present) committed as a template; never commit real `.env` files.
- If a generated directory must be committed for an ejected workflow, remove its entry from `.gitignore` explicitly and document why.

## 5. Commands

| Task                   | Command                          |
| ---------------------- | -------------------------------- |
| Install dependencies   | `npm install`                    |
| Start dev server       | `npm start` / `npx expo start`   |
| Run on Android         | `npm run android`                |
| Run on iOS             | `npm run ios`                    |
| Run on Web             | `npm run web`                    |
| Lint                   | `npm run lint` / `npx expo lint` |
| Test                   | `npm test` / `npx jest`          |
| Reset starter template | `npm run reset-project`          |

Verify commands from `package.json:34` and `app.json:2` before adding new scripts.

**Do not run the app in Expo Go.** The project depends on `expo-secure-store`, `expo-screen-capture`, a local Expo module (Android managed config) and a custom URL scheme (`qlikanswers://auth`) — none of which Expo Go can run. Use a development build instead; see [docs/dev-build-runbook.md](docs/dev-build-runbook.md).

## 6. Engineering Principles

> **Tradeoff:** These principles bias toward caution over speed. For trivial tasks, use judgment. Surface tradeoffs instead of hiding them.

### 6.1 Think Before Coding

**Principle:** Do not assume. Do not hide confusion. Surface tradeoffs.

**Rules:**

- State assumptions explicitly before implementing. If uncertain, ask.
- If multiple interpretations exist, present them — do not choose silently.
- If a simpler approach exists, propose it and push back when warranted.
- If anything is unclear, stop, name what is confusing, and ask for clarification.

### 6.2 Simplicity First

**Principle:** Minimum code that solves the problem. Nothing speculative.

**Rules:**

- Do not add features beyond what was requested.
- Do not create abstractions for single-use code.
- Do not add speculative flexibility or configurability.
- Do not add error handling for impossible scenarios.
- If 200 lines can be 50, rewrite to 50.

**Check:** Would a senior engineer call this overcomplicated? If yes, simplify.

### 6.3 Surgical Changes

**Principle:** Touch only what you must. Clean up only your own mess.

**When editing existing code:**

- Do not improve adjacent code, comments, or formatting unrelated to the task.
- Do not refactor code that is not broken.
- Match existing style, even if you would do it differently.
- If you notice unrelated dead code, mention it — do not delete it.

**When your changes create orphans:**

- Remove imports, variables, and functions that your changes made unused.
- Do not remove pre-existing dead code unless explicitly requested.

**Test:** Every changed line must trace directly to the user's request.

### 6.4 Goal-Driven Execution

**Principle:** Define success criteria. Loop until verified.

**Rules:**

- Transform tasks into verifiable goals:
  - `Add validation` → Write tests for invalid inputs, then make them pass.
  - `Fix the bug` → Write a test that reproduces it, then make it pass.
  - `Refactor X` → Ensure tests pass before and after.
- For multi-step tasks, state a brief plan with verification:

  ```
  1. [Step] → verify: [check]
  2. [Step] → verify: [check]
  3. [Step] → verify: [check]
  ```

- Strong criteria let you loop independently; weak criteria (`make it work`) require constant clarification.

## 7. Code Style and Conventions

- **TypeScript:** `strict: true` (`tsconfig.json:3`). No `any` without justification. Prefer explicit return types on exported functions.
- **Style:** Follow existing file style for formatting, naming, and imports. Run `npm run lint` before finishing.
- **Components:** Functional components with hooks. Co-locate platform variants as `*.web.tsx` / `*.tsx` (e.g., `components/app-tabs.tsx:1`, `components/app-tabs.web.tsx:1`).
- **Styling:** Use `src/constants/theme.ts:1` and `src/global.css:1` / `src/hooks/use-theme.ts:1` for theming. Avoid hard-coded colors.
- **Imports:** Prefer `@/` alias. Keep import order: external → expo → internal (`@/`) → relative.
- **Edits:** Prefer editing existing files over creating new ones. Never create documentation files (`*.md`) unless explicitly requested.

## 8. Workflow and Verification

1. Read relevant files in full before editing.
2. Keep changes surgical and minimal (see §6.3).
3. Verify locally:
   - Lint: `npm run lint`
   - Type check: `npx tsc --noEmit`
   - Manual run: `npx expo start` (or `--android` / `--ios` / `--web`)
4. Remove only the unused code your changes introduced.
5. Ensure every changed line maps to the task — no opportunistic refactors.

## 9. Success Criteria

These guidelines are working if:

- Diffs contain fewer unnecessary changes.
- Rewrites due to overcomplication decrease.
- Clarifying questions are asked before implementation, not after mistakes.
- Expo v57 APIs are used correctly per versioned docs.

## Knowledge Graph & Token Optimization

### Strict Tool Priority

- **CRITICAL:** Before reading any raw code files, executing glob patterns, or performing grep searches, you MUST first read `graphify-out/GRAPH_REPORT.md` or query `graphify-out/graph.json` to locate the target modules.
- Use the knowledge graph to trace call chains, pinpoint dependencies, and understand cross-module architecture before touching individual files.
- If you notice yourself performing multiple sequential grep or find actions, interrupt the cycle and query Graphify first to save tokens.

### Graph Navigation Workflow

1. Read `graphify-out/GRAPH_REPORT.md` to identify structural highlights, core concept hubs, and important file clusters.
2. Navigate via `graphify-out/wiki/index.md` (if available) to locate codebase logic instead of scanning files line-by-line from scratch.
3. Only open the specific target files mapped out by Graphify to execute code modifications.

### Session Synchronization

- At the start of every session, verify if codebase modifications occurred and run `graphify update .` to keep the AST map current without incurring unnecessary API costs.
