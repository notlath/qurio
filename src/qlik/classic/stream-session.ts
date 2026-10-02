import type { AppError } from '@/domain';
import { takeObjects } from './stream-parser';

type StreamChunk = { output?: string; sources?: unknown[] };

export type StreamReader = { read(): Promise<{ done: boolean; value?: string }> };

export type ConsumeStreamHandlers = {
  onDelta(text: string): void;
  signal?: AbortSignal;
};

export type ConsumeStreamResult = {
  text: string;
  rawSources: unknown[];
  stopped: boolean;
};

/**
 * The transport-agnostic core of technical-proposal.md §6's `streamAnswer`:
 * takes any reader shape a real `expo/fetch` ReadableStream or a test double
 * can satisfy. Kept separate from the real network call so the accumulate /
 * stop / truncation logic is testable with no network (ticket 7).
 */
export async function consumeStream(
  reader: StreamReader,
  { onDelta, signal }: ConsumeStreamHandlers,
): Promise<ConsumeStreamResult> {
  let buffer = '';
  let text = '';
  let rawSources: unknown[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += value;
    const { objects, rest } = takeObjects(buffer);
    buffer = rest;

    for (const raw of objects) {
      let chunk: StreamChunk;
      try {
        chunk = JSON.parse(raw);
      } catch {
        continue;
      }
      if (chunk.output) {
        text += chunk.output;
        onDelta(chunk.output);
      }
      if (chunk.sources) rawSources = chunk.sources;
    }

    // Checked after processing whatever this read already delivered, so a Stop
    // tap preserves the partial answer rather than discarding an in-flight chunk.
    if (signal?.aborted) {
      return { text, rawSources, stopped: true };
    }
  }

  if (buffer.trim()) {
    // The connection closed with an in-progress object still in the buffer — the
    // stream was cut short, not completed. Never present that partial text as done.
    throw { kind: 'ServiceUnavailable' } satisfies AppError;
  }

  return { text, rawSources, stopped: false };
}
