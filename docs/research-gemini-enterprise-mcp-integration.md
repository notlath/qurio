# Research: Gemini Enterprise with the Qlik MCP server and Context7 MCP

Access date for every source: 2026-10-16. Sources are primary only: Google Cloud and Gemini API docs, the MCP specification, Qlik Help and qlik.dev, and the Context7 repository and docs. Writing style follows `AGENTS.md` section 10 (STE-flavored).

## Summary and verdict

**The premise is only partly supported.**

1. **Gemini Enterprise can act as an MCP client.** Its "Custom MCP Server" data store reached GA on 2026-08-07. An admin registers a remote server. Gemini Enterprise lists the tools as "actions". [High]
2. **No source documents a "Qlik MCP connector" inside Gemini Enterprise.** Qlik ships its own MCP server (`https://<tenant>.<region>.qlikcloud.com/api/ai/mcp`). Neither Google nor Qlik documents the two working together. The pairing is plausible but untested. [High that no document exists. Medium that it is plausible.]
3. **Context7 has no documented path into Gemini Enterprise.** Gemini Enterprise accepts OAuth 2.0 or no authentication. Context7 documents Bearer API key and its own OAuth endpoint. Compatibility is unverified. [Medium]
4. **Context7 adds little value for a Qlik User asking business questions.** It serves library documentation to coding agents. It indexes qlik.dev, so it helps developers build this app. It does not help answer Analytics App questions. [High]
5. **No Gemini path fits the current architecture without a reversal.** Each option needs one of: a backend (reverses ADR-0001), a Google credential or Gemini API key on the device, or a second identity beside the Qlik User. Each option also sends Qlik data to Google. [Medium. This is an inference from the sources, not a statement in them.]
6. **The most useful finding is about Qlik, not Google.** The Qlik MCP server is a published, documented route to Analytics App data for any MCP client. It may relate to the open Agentic Assistant gap in ADR-0002 and ADR-0009. It needs the `mcp:execute` scope, which the published client in ADR-0010 does not request today. [High for the facts. Medium for the relevance.]

**Recommendation.** Do not build this now. If the team wants to learn more, run a time-boxed spike behind `IS_INTERNAL_BUILD`, as ADR-0008 did. Record any adoption as a new ADR. See section 4.6 and section 5.

### Confidence legend

| Tag | Meaning |
| --- | --- |
| [High] | A primary source states it directly. |
| [Medium] | Inferred from primary sources. The inference is stated. |
| [Unverified] | No primary source found. Treat as an open question. |

Some pages were read through a fetch tool that summarizes page text. Raw page text was re-read for the Gemini Enterprise `streamAssist` reference, the Gemini Enterprise locations page, the Gemini API Interactions page, and the Gemini API function-calling page. A claim marked [High] was explicit in the extract.

---

## 1. What Gemini Enterprise is and how it consumes MCP

### 1.1 What it is

- Google describes Gemini Enterprise as "an intranet search, AI assistant, and agentic platform". It offers permission-aware search, conversational assistance, and hosting for custom agents. [High: S1]
- The main documentation covers the Standard, Plus, Pay-as-you-go, and Frontline editions. The Business edition has a separate help center. [High: S1, S2]
- Agentspace is now part of Gemini Enterprise. Google's Agentspace launch post carries an editor's note dated 2025-10-09 that says so. [High: S3]
- Gemini Enterprise has a mobile app for iOS and Android. A user installs it from the app stores and signs in with company credentials. [High: S4]
- Search results describe the Vertex AI developer platform as renamed "Agent Platform". Only a Firebase page states this. It is not needed for this research. [Unverified for the rename date: S5]

### 1.2 Is Gemini Enterprise an MCP client?

Yes, through a "Custom MCP Server" data store. Facts from the setup page (S2):

| Item | Fact | Confidence |
| --- | --- | --- |
| Transport | Streamable HTTP only. SSE is not supported. The URL must be HTTPS. | High |
| Authentication | "No authentication" or OAuth 2.0. No API key option is shown. | High |
| OAuth fields | MCP Server URL, Authorization URL, Token URL, Client ID, Client Secret, optional PKCE, scopes (space-separated, include `offline_access` for refresh). | High |
| Redirect URL | `https://vertexaisearch.cloud.google.com/oauth-redirect`. Register it with the identity provider. | High |
| Who sets it up | An admin with `roles/discoveryengine.editor`. | High |
| Org policy | The org policy constraint that blocks custom MCP data stores must be overridden. The server, authorization, and token FQDNs must be allowed. | High |
| VPC Service Controls | Add `custom_mcp` to the allowed data sources. | High |
| Tools | Called "actions". All are off by default. "Reload custom actions" runs `tools/list`. | High |
| Limit | At most 100 enabled actions. | High |
| Confirmation | Every action needs user confirmation by default. Set `readOnlyHint: true` and `destructiveHint: false` to skip it for read-only tools. | High |
| TLS | A publicly trusted CA must sign the certificate. Self-signed certificates fail. | High |
| Not supported | Connecting an existing data store (create a new one in the app). Private Service Connect in the current version. | High |
| Cloud Run | Gemini Enterprise sends `X-Serverless-Authorization` with a Google-signed ID token, and keeps the user OAuth token in `Authorization`. | High |

Launch stage (S6, release notes):

- 2026-08-07: "Custom MCP server data stores" is GA. The feature is off by default. [High]
- 2026-07-22: "Unauthenticated Custom MCP Server data stores" is Preview. [High]
- 2026-08-06: The description field is removed. Gemini Enterprise now uses `tools/list`. [High]
- 2026-06-25: Governance for agents and MCP servers is GA (Agent Registry import, Agent Gateway egress policies). [High]
- The setup page itself states no launch stage. [High]
- Third-party guides that call the feature "Preview" predate the 2026-08-07 note. They are not used here.

Edition scope is unclear. The setup page covers Standard, Plus, Pay-as-you-go, and Frontline. Whether the Business edition supports custom MCP data stores is [Unverified].

### 1.3 How a custom app could call Gemini Enterprise

- The `streamAssist` method sends a query to the assistant of a Gemini Enterprise app. The page says to use it "in your web app". [High: S7]
- Endpoint form: `POST https://{ENDPOINT_LOCATION}-discoveryengine.googleapis.com/v1/projects/{P}/locations/{L}/collections/default_collection/engines/{APP_ID}/assistants/default_assistant:streamAssist`. Location values are `us`, `eu`, and `global`. [High: S7]
- The caller needs the Discovery Engine API enabled, an app, and the permission `discoveryengine.assistants.assist`. [High: S7, S8]
- Accepted OAuth scopes include `https://www.googleapis.com/auth/discoveryengine.assist.readwrite` and `cloud-platform`. [High: S8]
- A session keeps context across turns. The response is a stream of partial answers (`state: IN_PROGRESS`, then `SUCCEEDED`). [High: S8]
- The response has a `connectorAuthErrors[]` field. It lists connectors that failed authentication while the request continued. [High: S8]
- The authentication page shows only `gcloud` credentials, Application Default Credentials, and service account impersonation. It does not describe end-user sign-in from a mobile app. [High that it is absent. The mobile flow is Unverified: S9]
- No page states that `streamAssist` calls tools from a custom MCP data store. The page says only that it "integrates with various agents and tools". [High that it is absent. The behavior is Unverified.]
- The `toolsSpec` request field lists web grounding, image generation, and video generation. Custom MCP tools do not appear in it. [High: S8]
- The REST reference also lists agent A2A message and task methods. Their detail was not read. [Unverified: S10]

### 1.4 Identity in Gemini Enterprise

- Google recommends Google Identity for new setups. Workforce Identity Federation (WIF) works with a third-party OIDC or SAML 2.0 provider. [High: S11]
- Changing identity provider type causes users to lose chat history. [High: S11]
- Every user needs a Gemini Enterprise license and a Google-side identity. A Qlik User has neither today. This is an inference from S11 and the product model. [Medium]

### 1.5 Other Google routes that consume MCP

| Route | Fact | Confidence |
| --- | --- | --- |
| Gemini API, Interactions API | GA as of June 2026. It connects to remote MCP servers. You give `name` and `url`. Optional fields are `headers` (for example auth tokens) and `allowed_tools`. Streamable HTTP only. | High: S12, S13 |
| Gemini 3 limit | "Gemini 3 does not support remote MCP, this is coming soon." The page banner also announces a newer model family. Whether that family supports remote MCP is not stated. | High for the quote. Unverified for newer models: S12 |
| Who connects to the MCP server | The page does not say whether Google or the client opens the connection. The `headers` field suggests Google connects. | Medium |
| Gemini API SDK built-in MCP helpers | Not found on the pages read. | Unverified |
| ADK (Agent Development Kit) | `McpToolset` makes ADK an MCP client. It supports stdio, Streamable HTTP, and SSE. It supports `auth_scheme` and `auth_credential`. | High: S14 |
| Firebase AI Logic | Client SDKs call the Gemini API from mobile apps (Swift, Kotlin, JavaScript, Flutter, Unity). React Native appears on a Firebase AI page. MCP or tool support was not found. | High for existence. Unverified for MCP: S5 |

---

## 2. The Qlik MCP server

### 2.1 What exists

- Qlik ships a hosted MCP server. It is "available with all Qlik Cloud subscriptions". A tenant admin must activate it. [High: S15]
- The endpoint is `https://<tenant-id>.<region>.qlikcloud.com/api/ai/mcp`. [High: S16, S17]
- Qlik runs it. It is not self-hosted. Qlik's security guide says the server "does not run AI inference or process prompts". [High: S18]
- A launch stage (GA or preview) is not stated on the pages read. A "Private Preview" page exists in the help set. It has no stage label. [Unverified: S15, S19]
- Community MCP servers for Qlik exist. They are not Qlik products. This report ignores them.

### 2.2 Transport

- No Qlik page read names the transport. [High that it is absent: S15, S16, S18]
- Gemini Enterprise and the Gemini API both require Streamable HTTP. Qlik compatibility with them is therefore [Unverified].
- A Qlik Community thread shows Gemini CLI connecting with a `url` entry and OAuth. A community MVP wrote the accepted answer. A Qlik support employee confirmed it works. [Medium: S20]
- The same thread quotes a Qlik employee: "The web based version of Gemini does not support MCP servers." This predates the Gemini Enterprise GA note. [High for the quote. Medium for current relevance: S20]

### 2.3 Tools

- Qlik documents more than 70 tools in nine categories. [High: S21, S22]
- Categories include App Discovery, Application Script Lifecycle, Automations, Bookmarks, Business Glossary, Data Pipeline Projects, Datasets and Data Quality, Data Exploration and Analysis, Data Products, Knowledge Bases, Lineage, Master Items, Selections and Filtering, and Visualization and Sheets. [High: S21]
- Read tools include `qlik_search`, `qlik_describe_app`, `qlik_list_sheets`, `qlik_get_chart_data`, and `qlik_get_field_values`. [High: S21]
- Write tools exist: `qlik_create_app`, `qlik_update_script`, `qlik_delete_automation`, `qlik_create_data_product`, and others. A Gemini Enterprise admin must enable tools one by one. [High: S21, S2]
- The server has one Knowledge Base tool, `qlik_search_knowledgebase_chunks`. No documented tool asks an Assistant a question or reads a Thread. [High: S21]
- Tools respect the user's role and space permissions. Tool availability can depend on tenant licensing. [High: S21]
- Consequence: MCP does not replace the Assistant endpoints in `docs/technical-proposal.md` section 2.1. It gives raw analytics and catalog tools. A Gemini model would do the reasoning. [Medium]

### 2.4 Authentication

- OAuth 2.0 is required. Qlik rejects unauthenticated requests. Tokens are user-bound. There are no static API keys or shared accounts. [High: S18]
- Client types: Native, Single-page application, or Web. [High: S15]
- Scopes: `user_default` and `mcp:execute`. `offline_access` is optional and reduces re-authentication to about once every 30 days. [High: S15]
- The user role needs "Qlik MCP" set to Allowed under Features and actions > Agentic AI. [High: S15]
- Client registration methods: manual client, Client ID Metadata Documents (CIMD), or Dynamic Client Registration (DCR). An admin must enable DCR. [High: S15, S16, S23]
- DCR endpoint: `POST https://<tenant>/oauth/register`. Unapproved DCR clients are deleted after 60 minutes (the Connecting page says one hour). [High: S23, S16]
- First-use rule: the tenant admin must be the first user to connect each new MCP client. Other users connect afterward. [High: S15]
- Claude has a predefined static client ID. ChatGPT needs a client per user or CIMD or DCR. [High: S16]
- Orchestration frameworks need a Web client with Machine-to-Machine (M2M) enabled. [High: S15]
- The 6-hour access token and 30-day refresh token figures in `docs/technical-proposal.md` come from the `@qlik/api` page, not from the MCP pages. For MCP, Qlik states only that sessions "are subject to OAuth timeout settings governed by Qlik". [High: S16]
- The MCP spec requires an authorization server to publish metadata. Qlik publishes RFC 8414 metadata (`/.well-known/oauth-authorization-server`), as `docs/technical-proposal.md` section 3.1 records. Whether the MCP endpoint serves RFC 9728 Protected Resource Metadata is [Unverified].
- Whether Qlik accepts the RFC 8707 `resource` parameter is [Unverified].

### 2.5 Licensing, quotas, and limits

- Questions are a monthly quota. Every five billable tool calls per user consume one question. Qlik Answers shares the same quota when licensed. [High: S15]
- Guardrails: 200 concurrent application sessions in memory per tenant. 300 MCP tool calls per user per minute. [High: S15]
- Cross-region inference does not need to be enabled for the MCP server. [High: S15]
- A third-party article says MCP needs cross-region data processing. Qlik's own page says it does not. The Qlik page wins. [High: S15]
- Qlik Cloud Government clients must create their own OAuth clients. [High: S16]

### 2.6 Data leaves Qlik's boundary

- Qlik states that results reaching the MCP client "leave Qlik's boundary". The user's chosen MCP client or LLM provider is outside Qlik's trust boundary. Qlik has no contract with that provider. [High: S18]
- Qlik enforces Section Access server-side before it returns data. [High: S18]
- Qlik logs tool usage. It says it does not log content. [High: S18]
- The Approve screen warns that content "will be stored, processed, and managed under the third party's control". [High: S16]
- Prompt injection mitigations are not addressed in Qlik's security guide. [High that it is absent: S18]
- Organizations can disable MCP at the tenant level. [High: S18]

---

## 3. The Context7 MCP server

### 3.1 What it provides

- Context7 supplies version-specific library documentation to coding agents. [High: S24, S25]
- It indexes qlik.dev (`/websites/qlik_dev`), `@qlik/api` (`/qlik-oss/qlik-api-ts`), and Qlik Help (`/websites/help_qlik`). This was verified with the Context7 `resolve-library-id` tool on 2026-10-16. [High]
- It does not hold Tenant data, Knowledge Base content, or Analytics App data. [High]

### 3.2 Hosting, transport, and authentication

| Item | Fact | Confidence |
| --- | --- | --- |
| Remote URL | `https://mcp.context7.com/mcp` | High: S24, S26 |
| Local server | `npx -y @upstash/context7-mcp` with `--api-key`. Default transport is stdio. `--transport http` starts an HTTP server on port 3000. | High: S26, S27 |
| Remote transport | HTTP (Streamable HTTP in client examples). The docs do not mention SSE. | Medium: S26 |
| API key | Free key at context7.com/dashboard. Send `Authorization: Bearer <key>`. Keys start with `ctx7sk`. | High: S24, S28 |
| OAuth | Remote only, at `https://mcp.context7.com/mcp/oauth`. Not for stdio. | High: S26 |
| Anonymous use | Allowed with low limits. The self-hosted HTTP server requires a credential by default. | High: S28, S27 |
| Tools | `resolve-library-id` (`query`, `libraryName`) and `query-docs` (`libraryId`, `query`, optional `language`). | High: S24 |
| Node requirement | Node.js 22.13 or newer for the `ctx7` CLI. | High: S24 |
| Rate limits | No numbers published. A 429 response carries `Retry-After` and `RateLimit-*` headers. Plans are on context7.com/plans, which was not read. | High: S28, S29 |

### 3.3 Data handling

- The tool sends the model-written search query, library name or ID, API key, client name, and transport type. [High: S30]
- Context7 sends queries to LLM providers (OpenAI, Google Gemini, Anthropic) for reranking. [High: S30]
- It stores model-written queries anonymously for benchmarking. Enterprise plans can turn this off. API logs are kept 30 days. [High: S30]
- It relies on the assistant to strip secrets from queries. The page says tool descriptions instruct this. [High: S30]
- Indexed documentation sits in the US and the EU. [High: S30]

### 3.4 Fit with Gemini Enterprise

- Gemini Enterprise supports no API key option for custom MCP servers. [High: S2]
- It could connect to the remote URL with "No authentication" (Preview) at low rate limits, or with OAuth if Context7's OAuth is compatible. [Medium]
- Context7 OAuth compatibility with the manual client ID and secret flow is [Unverified]. Context7 documents its own authorization server for OAuth clients, with no static client ID and secret setup.
- Mobile cannot spawn the local `npx` server. The MCP specification defines stdio as a client-launched subprocess. [High: S31]

### 3.5 Relevance to the app

- Runtime value for a Qlik User: low. Qlik Users ask about their data and documents. Context7 answers "how do I call this library".
- Development value: high. Developers can query Expo and Qlik docs while they write this app. The repo already uses Context7 for that, outside the app.
- Risk if added to a runtime Assistant: a model-written query may carry Customer content to a third party. [Medium]

---

## 4. Architecture options for the native app

Constraints from the repo: native-only transport (ADR-0005), no backend (ADR-0001), no answer content on the device (ADR-0007), Qlik User is the only identity (CONTEXT.md).

### 4.1 Where MCP client work can run

| Component | On device | In a backend |
| --- | --- | --- |
| stdio MCP server (Context7 via `npx`) | Not possible. Mobile cannot launch subprocesses. [High: S31] | Possible. |
| Remote Streamable HTTP MCP client | Possible in principle. The TypeScript SDK `StreamableHTTPClientTransport` accepts a custom `fetch`. `expo/fetch` streams on native. Not tested in React Native. [Medium: S32, repo] | Easy. |
| LLM call to Gemini | Needs a Google credential on the device. | Credential stays server-side. |

### 4.2 Option A: Gemini Enterprise as the host

The app calls `streamAssist`. An admin registers Qlik MCP (and optionally Context7) as custom MCP data stores.

- Identity: the user needs a Google Identity or WIF identity, a Gemini Enterprise license, and an IAM role with `discoveryengine.assistants.assist`. [Medium]
- Qlik authorization: each user authorizes the Qlik connector through Gemini Enterprise's redirect (`vertexaisearch.cloud.google.com/oauth-redirect`). No documented API lets a third-party app run that step. [Unverified]
- Qlik client: a Web client with a client secret, held by Google. The tenant admin must connect first. [High: S2, S15]
- Mobile Google sign-in: not documented for `streamAssist`. [Unverified]
- Output: `groundedContent` replies. No mapping to Qlik Citation, Thread, or Interaction. [Medium]
- Region: us, eu, or global. In-country Singapore (`sg`) is "GA with allowlist" through the Google account team. [High: S33]
- Result: two identities, Qlik data in Google, no Qlik Thread. This conflicts with CONTEXT.md.

### 4.3 Option B: Gemini API with remote MCP, called from the device

The app calls the Interactions API. It passes the Qlik MCP URL and the user's Qlik access token in `headers`.

- Gemini credential: the Gemini Developer API uses an API key (`x-goog-api-key` in the docs). A key in a shipped app can be extracted. [High: S12 for the header. Medium for the risk.]
- Firebase AI Logic is Google's route to call Gemini from mobile without an embedded key. MCP support was not found. [Unverified: S5]
- Model limit: Gemini 3 does not support remote MCP. [High: S12]
- Token flow: the Qlik token goes to Google. Qlik issued it, so the MCP rule on foreign tokens is not broken. Audience binding is not documented. [Medium]
- Qlik endpoint must be reachable from Google. It is public on `qlikcloud.com`. [Medium]
- Result: no backend, but a shared secret problem and a Qlik token sent to a third party.

### 4.4 Option C: Device orchestrates, Gemini only generates

The device runs the MCP client against Qlik MCP with the existing Native OAuth token. The device sends tool results to Gemini through function calling.

- No Google identity needed if Gemini access uses an app-level control such as Firebase App Check. [Unverified]
- The Native client needs `mcp:execute` added. [High: S15. Repo: `src/auth/oauth.ts` requests only `user_default offline_access`.]
- Qlik data still reaches Google as prompt context. [High: S18]
- The app owns the orchestration loop, the tool allow-list, and prompt-injection handling. [Medium]
- Result: the closest fit to ADR-0001. It adds a Google dependency and a large client-side surface.

### 4.5 Option D: Backend or ADK agent

A server runs the LLM loop and the MCP clients. ADK `McpToolset` is one framework. The server holds the Gemini credential.

- Per-user Qlik tokens must pass to the server. A shared service account is rejected by ADR-0001. [High: ADR-0001]
- Orchestration frameworks need a Web client with M2M. That is a service identity. [High: S15]
- ADK per-user token propagation to MCP calls is not documented in the page read. [Unverified: S14]
- Result: simplest technically. It reverses ADR-0001, so it needs a new ADR.

### 4.6 Option E: No Gemini

Keep the current design. Use the Assistant REST API for Legacy Assistants and `qlik-embed` for the Agentic Assistant (ADR-0009). No new data flow leaves Qlik. This is the baseline for every comparison.

### 4.7 Streaming, network, and security

- Qlik's Assistant stream is concatenated JSON with no delimiter (`docs/technical-proposal.md` section 2.4). Gemini and MCP streams differ. MCP Streamable HTTP replies are a JSON object or a request-scoped SSE stream. [High: S31]
- A new parser per stream is needed. The `streamAssist` wire framing was not read. [Unverified]
- Every MCP HTTP request must carry `Authorization: Bearer`. Tokens must not appear in the URI. [High: S34]
- MCP clients must keep refresh tokens confidential in storage. The repo already uses SecureStore. [High: S34]
- Tool results from Qlik are untrusted input to the model. Qlik does not address prompt injection. [High: S18]
- Data residency: a Singapore Tenant sends MCP results to wherever the LLM runs. Qlik's data stays in the home region only until delivery. [High: S18]

---

## 5. Requirements checklist, open questions, and risks

### 5.1 Checklist by option

**Qlik side (all options that use Qlik MCP)**

- [ ] Tenant admin activates the Qlik MCP server in the Administration activity center. [S15]
- [ ] User role has "Qlik MCP: Allowed" under Agentic AI. [S15]
- [ ] An OAuth client with scopes `user_default` and `mcp:execute` (and `offline_access`). Native for a device. Web for Gemini Enterprise. [S15]
- [ ] Admin completes the first connection per new MCP client. [S15]
- [ ] Subscription quota covers MCP use. Five billable tool calls equal one question, shared with Answers. [S15]

**Google side for Option A**

- [ ] Google Cloud project with the Discovery Engine API enabled. [S7]
- [ ] Gemini Enterprise app in the Standard, Plus, Pay-as-you-go, or Frontline edition, in `us`, `eu`, `global`, or allowlisted `sg`. [S33]
- [ ] Identity provider: Google Identity or WIF. [S11]
- [ ] Admin with `roles/discoveryengine.editor`. [S2]
- [ ] Org policy override for the custom MCP constraint. FQDN allow-list for the Qlik MCP, authorize, and token hosts. [S2]
- [ ] `custom_mcp` allowed in VPC Service Controls if used. [S2]
- [ ] Callers hold `discoveryengine.assistants.assist`. OAuth scope `discoveryengine.assist.readwrite`. [S7, S8]
- [ ] Per-user license assignment. [S11]

**Google side for Options B and C**

- [ ] Gemini API access and a safe credential model for a mobile app. [Unverified]
- [ ] A model that supports remote MCP (Option B) or function calling (Option C). [S12]

**App side**

- [ ] Add `mcp:execute` to `SCOPES` and republish the client from ADR-0010. [Repo]
- [ ] An MCP client that runs in Expo SDK 57 (Option C). [Medium: S32]
- [ ] Spec version support. The current MCP revision is 2026-07-28. Earlier revisions used an `initialize` handshake. [High: S35]

### 5.2 Open questions

1. Which MCP transport and spec revision does the Qlik server use? Ask the Qlik account team. [Unverified]
2. Does Gemini Enterprise complete an OAuth flow against Qlik with a manual Web client and the Google redirect URL? Test with a sandbox Tenant. [Unverified]
3. Does `streamAssist` call tools from a custom MCP data store? [Unverified]
4. Can a third-party app start the per-user connector authorization in Gemini Enterprise? [Unverified]
5. Does the published Native client in ADR-0010 need a new Tenant Approval when `mcp:execute` is added? Does the "admin connects first" rule apply? [Unverified]
6. Does the Customer's veto in ADR-0005 (browser-accessible Qlik Answers) cover a Web OAuth client with an https redirect for Gemini Enterprise? Ask the Customer. [Unverified]
7. Do newer Gemini models support remote MCP in the Interactions API? [Unverified]
8. Does Firebase AI Logic support tool or MCP calls from React Native? [Unverified]
9. Does Context7 OAuth work with Gemini Enterprise's manual client fields? [Unverified]
10. Do the Customer's data rules allow Tenant data to reach Google (Singapore Tenant, ADR-0008 residency notes)? [Unverified]

### 5.3 Risks

| Risk | Detail |
| --- | --- |
| Data leaves Qlik control | Qlik states results leave its boundary. Source-level permissions then depend on Google's controls. |
| Write tools | The Qlik server has delete and update tools. Enable only read tools. Gemini Enterprise asks for confirmation by default. |
| Prompt injection | Qlik does not address it. A document in a Knowledge Base could steer tool calls. |
| Quota drain | MCP and Qlik Answers share the monthly question quota. |
| Preview features | Unauthenticated custom MCP is Preview. Interactions API remote MCP excludes Gemini 3. |
| Spec movement | The MCP spec changed the session model in 2026-07-28. Vendors may lag. |
| Second identity | Option A adds a Google identity for every Qlik User. |
| Unpublished API pattern | ADR-0008 warned that a POC can become the architecture. Fence any spike. |

---

## 6. Fit with repo decisions

| Document | Fit | Notes |
| --- | --- | --- |
| ADR-0001 (per-Qlik-User OAuth, no backend) | Conflict for Options A and D. Partial fit for C. | Option D needs a server. Option A puts a second identity beside the Qlik User. The ADR says anything that needs a server "is a reversal of this decision and should be recorded as one". The M2M client for orchestration is the service identity ADR-0001 rejects. |
| ADR-0005 (native-only, no SPA client) | Open. | Gemini Enterprise needs a Web client with an https redirect. The Customer vetoed a browser-accessible Qlik Answers. Ask the Customer before any Web client. |
| ADR-0006 (domain port) | Weak fit. | `AnswersPort` models Thread, Interaction, and Citation. A Gemini path returns none of these. It would need its own port, as ADR-0008 did with `AgenticPort`. Do not widen `AnswersPort`. |
| ADR-0007 (no answer content on device) | Holds on the device only. | Do not cache Gemini or MCP results. Content now also sits in Google sessions (`streamAssist` sessions store the query and answer). That is server-side, but outside Qlik's per-user controls. |
| ADR-0008 (quarantined experiment, superseded) | Useful precedent. | Qlik MCP is a published API, so the "unpublished API" violation does not apply. The quarantine pattern (separate directory, `IS_INTERNAL_BUILD`, expiry) still fits a spike. |
| ADR-0009 (qlik-embed for the Agentic Assistant) | Competing path. | The Qlik MCP server could give another published route to Analytics App data. It does not create an Agentic Assistant. ADR-0009 already covers the agentic surface. |
| ADR-0010 (published OAuth client, hostname only) | Needs change. | The client requests `user_default offline_access`. MCP needs `mcp:execute`. Region rules still apply. |
| `docs/research-integration-gaps.md` section 10 | Consistent. | Agentic Answers needs cross-region inference (Qlik help). The Qlik MCP server does not (S15). The two should not be mixed up. |
| `docs/technical-proposal.md` | Consistent. | It states "no backend", the 20 questions per minute limit, and the 6-hour and 30-day token figures. The MCP limits (300 calls per minute) are separate. |
| `CONTEXT.md` | Term conflict. | "Qlik User" is the only identity. A **Thread** is "persisted in the Tenant". A Gemini session is neither. **Assistant** means a Qlik Answers endpoint, and the glossary says to avoid "bot, agent, chatbot". This report uses "Gemini surface" for the Google side. A new term is needed if the team builds it. |

---

## 7. Sources

All accessed 2026-10-16.

**Google Cloud and Gemini**

- S1: Gemini Enterprise overview. https://docs.cloud.google.com/gemini/enterprise/docs/overview
- S2: Custom MCP server data store setup. https://docs.cloud.google.com/gemini/enterprise/docs/connectors/custom-mcp-server/set-up-custom-mcp-server
- S3: Google Agentspace launch post (editor's note, 2025-10-09). https://blog.google/feed/google-agentspace/
- S4: Gemini Enterprise mobile app. https://docs.cloud.google.com/gemini/enterprise/docs/use-the-mobile-app
- S5: Firebase AI Logic. https://firebase.google.com/docs/ai-logic
- S6: Gemini Enterprise release notes. https://docs.cloud.google.com/gemini/enterprise/docs/release-notes
- S7: Get results from StreamAssist. https://docs.cloud.google.com/gemini/enterprise/docs/get-answers-from-streamassist
- S8: `streamAssist` REST reference (v1). https://docs.cloud.google.com/gemini/enterprise/docs/reference/rest/v1/projects.locations.collections.engines.assistants/streamAssist
- S9: Authenticate to Gemini Enterprise. https://docs.cloud.google.com/gemini/enterprise/docs/authentication
- S10: Gemini Enterprise developer guide. https://docs.cloud.google.com/gemini/enterprise/docs/developer-guide
- S11: Configure identity provider. https://docs.cloud.google.com/gemini/enterprise/docs/configure-identity-provider
- S12: Gemini API, Interactions API. https://ai.google.dev/gemini-api/docs/interactions
- S13: Gemini API, function calling (Remote MCP section). https://ai.google.dev/gemini-api/docs/function-calling
- S14: ADK, MCP tools. https://adk.dev/tools-custom/mcp-tools/
- S33: Gemini Enterprise data residency and locations. https://docs.cloud.google.com/gemini/enterprise/docs/locations

**Qlik**

- S15: Deploying and administering Qlik MCP server. https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikMCP/Administering-Qlik-MCP.htm
- S16: Connecting to the Qlik MCP server. https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikMCP/Connecting-Qlik-MCP-server.htm
- S17: Qlik OAuth dynamic client registration (endpoint pattern). https://qlik.dev/authenticate/oauth/oauth-dynamic-client-registration/
- S18: Qlik MCP Server security architecture and controls. https://help.qlik.com/en-US/evaluation-guides/Content/ai/mcp-security.htm
- S19: Qlik MCP private preview page. https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikMCP/Qlik-MCP-Private-Preview.htm
- S20: Qlik Community thread, "Connect Qlik MCP in Gemini CLI" (community post, with Qlik staff replies). https://community.qlik.com/t5/Integration-Extension-APIs/Connect-Qlik-MCP-in-Gemini-CLI/m-p/2550489
- S21: Qlik MCP server tools. https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/QlikMCP/Qlik-MCP-server-tools.htm
- S22: Qlik MCP Server evaluation guide. https://help.qlik.com/en-US/evaluation-guides/Content/ai/mcp.htm
- S23: qlik.dev changelog 246, MCP tools for declarative pipelines. https://qlik.dev/changelog/246-mcp-tools-declarative-pipelines/

**Context7**

- S24: Context7 repository README. https://github.com/upstash/context7
- S25: Context7 docs overview. https://context7.com/docs/overview
- S26: Context7 MCP clients page. https://context7.com/docs/resources/all-clients
- S27: Context7 MCP package README. https://github.com/upstash/context7/blob/master/packages/mcp/README.md
- S28: Context7 API guide. https://context7.com/docs/api-guide.md
- S29: Context7 usage page. https://context7.com/docs/howto/usage.md
- S30: Context7 data privacy. https://context7.com/docs/security/data-privacy.md
- Context7 library index lookup for Qlik documentation: run with the Context7 `resolve-library-id` tool on 2026-10-16 (no URL).

**MCP specification and SDK**

- S31: MCP transports (spec 2026-07-28). https://modelcontextprotocol.io/specification/latest/basic/transports
- S34: MCP authorization (spec 2026-07-28). https://modelcontextprotocol.io/specification/latest/basic/authorization
- S35: MCP versioning. https://modelcontextprotocol.io/specification/versioning
- S32: MCP TypeScript SDK (`StreamableHTTPClientTransport`, `authProvider`, `fetch` option), read through Context7 (`/modelcontextprotocol/typescript-sdk`). https://github.com/modelcontextprotocol/typescript-sdk

**Repo documents**

- `CONTEXT.md`, `docs/adr/0001` to `0011`, `docs/research-integration-gaps.md`, `docs/technical-proposal.md`, `src/auth/oauth.ts`.

**Not used as evidence.** Medium posts, CData, Extole, Glean, Boomi, and similar vendor or blog write-ups appeared in search results. They are secondary. This report does not rely on them.
