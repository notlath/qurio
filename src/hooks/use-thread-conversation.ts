import { useEffect, useRef, useState } from 'react';

import type { AppError, Interaction } from '@/domain';
import { useAnswersPort } from '@/qlik/context';

function isAppError(value: unknown): value is AppError {
  return typeof value === 'object' && value !== null && 'kind' in value;
}

/**
 * The ask/stream/stop flow, shared between starting a new Thread and
 * resuming a past one (ticket 8) — same behavior either way once a
 * threadId exists. `question` lives here too (ticket 11): a failed ask
 * must restore exactly what the user typed, not just clear it and hope
 * something else remembers.
 *
 * A resumed thread passes its id directly; a new one passes a resolver, so the
 * Thread is created by the first question rather than by opening the screen —
 * against a live tenant the eager version cost a POST, and a junk thread in
 * history, every time the app was launched. The resolver gets the first question to name the Thread.
 */
export function useThreadConversation(
  thread: string | ((question: string) => Promise<string>),
  initialInteractions: Interaction[] = [],
) {
  const port = useAnswersPort();
  const [interactions, setInteractions] = useState<Interaction[]>(initialInteractions);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [partialAnswer, setPartialAnswer] = useState('');
  const [error, setError] = useState<AppError | null>(null);
  const [erroredAt, setErroredAt] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    abortControllerRef.current?.abort();
  }, []);

  // Accepts an explicit prompt (e.g. tapping a Starter) since setQuestion + immediately reading
  // `question` would race React's state batching; defaults to whatever's currently typed.
  async function ask(promptOverride?: string) {
    const trimmed = (promptOverride ?? question).trim();
    if (!trimmed || asking) return;
    setError(null);
    setErroredAt(null);
    setAsking(true);
    setPendingQuestion(trimmed);
    setPartialAnswer('');
    setQuestion(''); // cleared only once we're committed to asking — restored below on failure
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const threadId = typeof thread === 'string' ? thread : await thread(trimmed);
      const interaction = await port.ask(threadId, trimmed, {
        onDelta: (delta) => setPartialAnswer((prev) => prev + delta),
        signal: controller.signal,
      });
      setInteractions((prev) => [...prev, interaction]);
    } catch (e) {
      // Never a raw error on screen: an unrecognised failure still becomes a curated AppError,
      // just the most conservative one, rather than leaking whatever the port threw.
      setError(isAppError(e) ? e : { kind: 'ServiceUnavailable' });
      setErroredAt(Date.now());
      setQuestion(trimmed); // the typed question is never lost on failure
    } finally {
      abortControllerRef.current = null;
      setAsking(false);
      setPendingQuestion('');
    }
  }

  function stop() {
    abortControllerRef.current?.abort();
  }

  function dismissError() {
    setError(null);
    setErroredAt(null);
  }

  return {
    interactions,
    question,
    setQuestion,
    asking,
    pendingQuestion,
    partialAnswer,
    error,
    erroredAt,
    ask,
    stop,
    dismissError,
  };
}
