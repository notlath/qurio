/**
 * The chat screen's search params, which the side panel also reads.
 * - `thread`, `assistantId`: the Thread opened from History, and the Assistant it belongs to.
 * - `chat`: a new value for each new chat.
 * - `started`: the Thread that this new chat created with its first question.
 */
export type ChatParams = { thread?: string; assistantId?: string; chat?: string; started?: string };

/** A new `chat` value, so the chat screen starts a new Thread even when it is already open. */
export function newChatKey(): string {
  return String(Date.now());
}
