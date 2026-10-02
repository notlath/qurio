# QlikAnswersApp

A dedicated iOS and Android client, in the spirit of Qlik's own Qlik Analytics app, that lets a Customer's people browse the Sheets of their Analytics Apps and ask questions of a Qlik Answers Assistant — the latter being what Qlik's app lacks. Online only: nothing is downloaded for offline use.

## Language

### Organisations and people

**Customer**:
An organisation that licenses this app and owns a Qlik Cloud Tenant. Never means an OAuth client.
_Avoid_: Client, account, org

**Tenant**:
A single Qlik Cloud instance belonging to one Customer, addressed by its own hostname. All Assistants, Knowledge Bases and identities are scoped to it.

**Qlik User**:
A person with an identity in a Tenant, holding an Answers Entitlement. In this project every app user is a Qlik User — there is no separate app-only identity.
_Avoid_: End user, app user, member

**Answers Entitlement**:
The per-Qlik-User license allocation that grants access to Qlik Answers. Without it a Qlik User can authenticate but cannot use an Assistant.

### Qlik Answers concepts

**Assistant**:
A configured Qlik Answers conversational endpoint within a Tenant, identified by an assistant ID. The app talks to an Assistant, never to "Qlik Answers" in the abstract.
_Avoid_: Bot, agent, chatbot

**Agentic Assistant**:
An Assistant that reasons over both Knowledge Bases and an Analytics App, returning insights and explanations as well as document answers. Distinct from a classic Assistant, which covers Knowledge Bases only.
_Avoid_: Agentic chat, agent

**Analytics App**:
A Qlik Sense application in the Tenant, made of Sheets. Qlik Users browse it in the app, and an Agentic Assistant can reason over it. Distinct from a Knowledge Base, which holds documents.
_Avoid_: App (unqualified)

**Sheet**:
One page of charts inside an Analytics App — what people mean when they say "dashboard". Opening an Analytics App shows its list of Sheets.
_Avoid_: Dashboard, page, report

**Knowledge Base**:
A governed collection of indexed source documents an Assistant draws answers from. Access to its sources is enforced per Qlik User by Qlik, not by this app.
_Avoid_: KB (in prose), corpus, index

**Thread**:
One continuous conversation with an Assistant, owned by a Qlik User and persisted in the Tenant. The app's conversation history is a list of Threads.
_Avoid_: Conversation, session, chat

**Interaction**:
A single question-and-answer exchange inside a Thread. Feedback is attached to an Interaction, not to a Thread.
_Avoid_: Message, turn, prompt

**Citation**:
A reference from an answer back to the specific source material it was drawn from. Showing Citations is a product requirement, not a nicety.
_Avoid_: Source, reference, footnote

**Answer**:
The content an Assistant returns for one Interaction — prose, and for an Agentic Assistant also analytics-derived insight and chart content. Modelled in our own terms, never as Qlik's response JSON.
_Avoid_: Response, result, output

**Analytics Insight**:
A finding an Agentic Assistant derives from a Qlik analytics app rather than from a Knowledge Base document. A classic Assistant never produces one.

**Feedback**:
A Qlik User's rating of a single Interaction, sent back to the Tenant. Attached to an Interaction, never to a Thread.

**Tenant Configuration**:
The non-secret values that point the app at one Customer's Tenant — tenant hostname, OAuth client ID, assistant ID. Supplied at deployment time, never compiled in.
_Avoid_: Settings, environment, tenant info

**Answer**:
The content Qlik returns for a single Interaction, in whatever form that takes — prose, structured content, or an Analytics Insight — together with its Citations. It is never stored on the device.
_Avoid_: Response, result, output

**Analytics Insight**:
Answer content derived from a Qlik analytics app rather than from documents, produced only by an Agentic Assistant. The domain models it even while the classic adapter cannot produce it.

**Feedback**:
A Qlik User's rating of a single Interaction. Attached to an Interaction, never to a Thread.

**Tenant Configuration**:
The non-secret values that point the app at one Customer's Tenant — tenant hostname, OAuth client ID, assistant ID. Supplied at deployment time, never compiled in.
_Avoid_: Settings, environment, app config

**Starter**:
A suggested opening question configured on an Assistant, shown before a Thread has any Interactions.
_Avoid_: Prompt, suggestion, example
