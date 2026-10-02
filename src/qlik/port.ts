import type { AnalyticsApp, Feedback, Interaction, Starter, Thread, ThreadDetail } from '@/domain';

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

  listThreads(opts?: { limit?: number; cursor?: string }): Promise<{ items: Thread[]; next?: string }>;
  createThread(name: string): Promise<Thread>;
  getThread(id: string): Promise<ThreadDetail>;
  deleteThread(id: string): Promise<void>;

  ask(threadId: string, prompt: string, h: AskHandlers): Promise<Interaction>;
  listInteractions(threadId: string): Promise<Interaction[]>;
  submitFeedback(threadId: string, interactionId: string, f: Feedback): Promise<void>;

  listStarters(): Promise<Starter[]>;

  // Every Analytics App the signed-in Qlik User can see, most recently updated first. `cursor` is the
  // `next` of the previous page; callers never build one.
  listAnalyticsApps(opts?: { limit?: number; cursor?: string }): Promise<{ items: AnalyticsApp[]; next?: string }>;
}
