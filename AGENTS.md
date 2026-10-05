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
- **UI / Media:** @expo/ui ~57.0.14, expo-image, expo-symbols, expo-system-ui, expo-constants
- **Animation:** react-native-reanimated 4.5.1, react-native-worklets 0.10.1, react-native-gesture-handler ~2.32.0
- **Other Expo Modules:** expo-font, expo-linking, expo-splash-screen, expo-web-browser, expo-device
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
| Editor           | `.idea/`, `.vscode/`                                                                               | Local IDE state                                                                           |
| Cache            | `*.tsbuildinfo`, `.eslintcache`, `.parcel-cache/`, `.turbo/`, `graphify-out/`, `.opencode/`        | Incremental build caches                                                                  |
| Coverage         | `coverage/`, `.nyc_output/`                                                                        | Test reporting output                                                                     |
| Agent tooling    | `.agents/`, `agent/`, `.claude/`, `.codex/`, `.cursor/`, `.serena/`, `.scratch/`                     | Per-developer agent config, skills and MCP state; `skills-lock.json` is the committed manifest |
| Foreign lockfiles | `bun.lock`, `bun.lockb`, `yarn.lock`, `pnpm-lock.yaml`                                            | npm is the package manager; only `package-lock.json` is committed                         |

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

Verify commands from `package.json:34` and `app.json:2` before adding new scripts.

**Expo Go: iOS only.** On iOS, Expo Go runs the full app including sign-in (`npx expo start --go`; Face ID falls back to passcode) — iOS's auth session catches the fixed `qlikanswers://auth` redirect itself (`src/auth/oauth.ts`). On Android, use a development build: Expo Go cannot run the local `managed-config` module or receive the `qlikanswers://` redirect. See [docs/dev-build-runbook.md](docs/dev-build-runbook.md).

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

## 10. Writing Standard: Simplified Technical English (ASD-STE100)

> Source: [danyuchn/asd-ste100-skill](https://github.com/danyuchn/asd-ste100-skill/blob/master/SKILL.md) (v0.4.0), based on ASD-STE100 Issue 9. This is a clarity discipline inspired by STE, not certified STE compliance. The official ~900-word dictionary is not reproduced here.

Apply STE to English that a reader must parse without a human to resolve ambiguity, and where a misreading has a cost. Do not apply it to creative or marketing copy.

### 10.1 Modes

Pick a mode from the text type before you write or rewrite.

| Mode | Use for | Enforce |
| --- | --- | --- |
| **Strict** | Error messages, tool and function descriptions, inter-agent instructions, system prompts, status reports, procedures, safety text | All rules below, including length caps and one-word-one-meaning |
| **STE-flavored** | READMEs, PR descriptions, commit messages, changelogs, code comments, ADRs, explanatory prose | All structural rules. Treat lexical rules as advisory. |

### 10.2 Structural Rules (apply in both modes)

| Rule | Do | Don't |
| --- | --- | --- |
| Active voice | "The agent deletes the file." | "The file is deleted." (unless the actor is unknown or irrelevant) |
| No phrasal verbs | "Remove the panel." / "Start the job." | "Take off the panel." / "Spin up the job." |
| One instruction per sentence | "Open the file. Read line 3." | "Open the file and read line 3, then check if it matches." |
| Sentence length | ≤20 words for instructions, ≤25 words for descriptions | Long compound or subordinate-clause sentences |
| No semicolons | Split into separate sentences | Any semicolon. (Em dashes are allowed but often signal a sentence to split.) |
| Noun clusters | ≤3 stacked nouns ("fuel pump valve") | 4+ stacked nouns ("high pressure fuel pump inlet valve assembly") |
| No ellipsis | Keep subject, verb, and article explicit | "Files not backed up will be lost" (which files?) |
| Keep modality | "The request **may have** failed." stays as written | Promote a hedge to a fact, or add certainty the source did not state |
| Paragraph limits | One topic per paragraph, ≤6 sentences | Multi-topic paragraphs |
| Lists for sequences | Numbered or bulleted list for 3+ steps or conditions | A sequence buried in one prose sentence |

### 10.3 Lexical Rules (enforce in Strict, advisory in STE-flavored)

- **One word, one meaning:** Use one term for one thing or action in a document. Do not rotate "check" / "verify" / "confirm" for the same action.
- **One part of speech per word:** Prefer "Apply oil to the valve" over "Oil the valve".
- **Verb, not noun:** Write "Analyze the log", not "Perform an analysis of the log".
- **Domain terms:** Keep necessary technical terms. Define each one once if it is not common English (see `CONTEXT.md` for the project glossary).

### 10.4 Tenses

Use simple tenses: infinitive, imperative, simple present, simple past, simple future, and past participle as adjective. Avoid present perfect ("we received the report", not "we have received the report").

Exception: keep a compound form when it carries information the simple form cannot. Examples are current relevance ("the job has completed") or a hedge ("may have failed").

### 10.5 Scan Checklist

Scan for these six habits before you finish any text:

1. **Synonym rotation:** one thing has several names ("user", "customer", "client"). Pick one name.
2. **Hedge stacking:** "it is important to note that this may potentially help to improve". State the claim or delete it.
3. **Nominalization:** "perform an analysis of", "provides assistance to". Use the verb.
4. **Marketing adjectives:** seamless, robust, powerful, cutting-edge, effortless, blazing-fast. Delete them, or replace them with a measurement.
5. **Run-on sentences:** ideas joined by semicolons or em dashes. Write one idea per sentence.
6. **Soft phrasal verbs:** spin up, reach out, dive into, kick off. Use start, contact, read, begin.

### 10.6 Rewrite Process

1. Pick the mode.
2. Read the text once for meaning before you change it.
3. Check each sentence against §10.2–§10.5.
4. Rewrite each violation and keep the original meaning exactly.
   - Keep every fact, condition, scope qualifier, number, and safety condition. If a rewrite would lose precision, keep the longer phrasing.
   - Keep the strength of every hedge. Do not change "could be caused by X" to "X is the cause".
   - Do not add a fact, cause, frequency, or mechanism that the source did not state.
5. Output only the rewritten text. If you kept a longer phrasing on purpose, add one line: `Kept as-is: <phrase> — <precision it protects>`. Show a rule table (`Rule violated | Original | Simplified`) only when asked.
6. If the text already complies, say so. Do not force changes.

Stop when the sentence is unambiguous, not when it is shortest. STE fixes form, not substance. If the text has nothing to say, say so instead of polishing it.

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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
