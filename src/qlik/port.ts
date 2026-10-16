import type { AnalyticsApp, Assistant, Feedback, Interaction, QlikUser, Starter, Thread, ThreadDetail } from '@/domain';

export type Capabilities = {
  streaming: boolean;
  analyticsInsights: boolean; // false for classic; true for a future agentic adapter
};

export type AskHandlers = {
  onDelta(text: string): void; // streamed text appended to the open text block
  signal?: AbortSignal; // user cancel, or app backgrounded
};

export interface AnswersPort {
  readonly capabilities: Capabilities;

  getCurrentUser(): Promise<QlikUser>;

  // `pinned` limits the list to pinned Threads. Qlik cannot sort pinned Threads first, so History asks for them on their own.
  listThreads(opts?: { limit?: number; cursor?: string; pinned?: boolean }): Promise<{ items: Thread[]; next?: string }>;
  createThread(name: string): Promise<Thread>;
  getThread(id: string): Promise<ThreadDetail>;
  deleteThread(id: string): Promise<void>;
  renameThread(id: string, name: string): Promise<void>;
  setThreadPinned(id: string, pinned: boolean): Promise<void>;

  ask(threadId: string, prompt: string, h: AskHandlers): Promise<Interaction>;
  listInteractions(threadId: string): Promise<Interaction[]>;
  submitFeedback(threadId: string, interactionId: string, f: Feedback): Promise<void>;

  listStarters(): Promise<Starter[]>;

  // Every Assistant the signed-in Qlik User can see. Works before an Assistant is chosen; every
  // Assistant-scoped call above fails with AssistantNotChosen until one is.
  listAssistants(): Promise<Assistant[]>;

  // Every Analytics App the signed-in Qlik User can see, most recently updated first. `cursor` is the
  // `next` of the previous page; callers never build one. `name` limits the list to a name search.
  listAnalyticsApps(opts?: { limit?: number; cursor?: string; name?: string }): Promise<{ items: AnalyticsApp[]; next?: string }>;

  // An image request for an app's thumbnail, ready for an image view — resolved per use so it always
  // carries a current token. Null when there is no session to send. Only asked for `hasThumbnail` apps.
  thumbnailImage(appId: string): Promise<ThumbnailImage | null>;
}

export type ThumbnailImage = { uri: string; headers: Record<string, string> };
