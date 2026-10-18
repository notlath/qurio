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

**Profile**:
The signed-in Qlik User's identity details within the active Tenant: name, email address, and picture when available.
_Avoid_: App account, Customer account

### Qlik Answers concepts

**Assistant**:
A configured Qlik Answers conversational endpoint within a Tenant, identified by an assistant ID. The app talks to an Assistant, never to "Qlik Answers" in the abstract.
_Avoid_: Bot, agent, chatbot

**Agentic Assistant**:
An Assistant that reasons over both Knowledge Bases and an Analytics App, returning insights and explanations as well as document answers. Distinct from a classic Assistant, which covers Knowledge Bases only.
_Avoid_: Agentic chat, agent

**Legacy Assistant**:
An Assistant that covers Knowledge Bases only. The app chats with it natively over the Qlik REST API and keeps its Threads. Qlik's own help pages call this kind "legacy", and the app shows that word to Qlik Users. The code and older notes call it a "classic" Assistant.
_Avoid_: Classic Assistant in text the Qlik User reads

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
One continuous conversation with one Assistant, owned by a Qlik User and persisted in the Tenant. The Qlik User chooses the Assistant when the Thread starts, and the Thread keeps it for its whole life: resuming a Thread always continues with that Assistant. The app shows Qlik Users the word "conversation". The code and docs say Thread.
_Avoid_: Conversation, session, chat

**History**:
The Qlik User's Threads with the selected Assistant, newest first. An Agentic Assistant has no History in the app: Qlik keeps its chats inside its own Assistant view.
_Avoid_: Recents, chats, conversations

**Pinned Thread**:
A Thread the Qlik User keeps at the top of History, in a Pinned group above the other Threads. The app says "Pin" and "Unpin". Qlik stores the pin as the Thread's `favorite` flag, so a pin shows on every device of the Qlik User.
_Avoid_: Favorite (Qlik's field name), starred, bookmarked

**Interaction**:
A single question-and-answer exchange inside a Thread. Feedback is attached to an Interaction, not to a Thread.
_Avoid_: Message, turn, prompt

**Citation**:
A reference from an answer back to the specific source material it was drawn from. Showing Citations is a product requirement, not a nicety.
_Avoid_: Source, reference, footnote

**Answer**:
The content an Assistant returns for one Interaction — prose, structured content, or an Analytics Insight — together with its Citations. Modelled in our own terms, never as Qlik's response JSON. It is never stored on the device.
_Avoid_: Response, result, output

**Analytics Insight**:
Answer content that an Agentic Assistant derives from an Analytics App rather than from a Knowledge Base document. A Legacy Assistant never produces one. The domain models it even while the Legacy adapter cannot produce it.

**Feedback**:
A Qlik User's rating of a single Interaction, sent back to the Tenant. Attached to an Interaction, never to a Thread.

**Tenant Configuration**:
The values that point the app at one Customer's Tenant. Only the tenant hostname is needed: the Qlik User enters it, or the Customer's MDM supplies it. The Assistant is found after sign-in, never entered.
_Avoid_: Settings, environment, tenant info, workspace connection

**Tenant Approval**:
A Tenant admin's one-time approval that lets this app sign in that Tenant's Qlik Users. Needed once per Tenant, not once per Qlik User.
_Avoid_: Consent (that is the per-sign-in screen), registration, onboarding

**Starter**:
A suggested opening question configured on an Assistant, shown before a Thread has any Interactions.
_Avoid_: Prompt, suggestion, example
