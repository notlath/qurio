import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import type { AppError, Thread } from '@/domain';
import { useAnswersPort } from '@/qlik/context';

function isAppError(value: unknown): value is AppError {
  return typeof value === 'object' && value !== null && 'kind' in value;
}

/**
 * The selected Assistant's History, one page at a time, newest first, as the side panel lists it:
 * load, page, delete and recover.
 */
export function useThreadHistory() {
  const port = useAnswersPort();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [erroredAt, setErroredAt] = useState(0);

  const load = useCallback(() => {
    port.listThreads().then(
      ({ items, next }) => {
        setThreads(items);
        setNextCursor(next);
        setError(null);
        setInitialLoad(false);
      },
      (e) => {
        // The list used to render as a permanently blank screen when this rejected.
        setError(isAppError(e) ? e : { kind: 'ServiceUnavailable' });
        setErroredAt(Date.now());
        setInitialLoad(false);
      },
    );
  }, [port]);

  useEffect(load, [load]);

  // Only the retry path resets these — doing it inside the effect would be a synchronous
  // setState on mount, which React flags and which re-renders for no reason.
  function retry() {
    setError(null);
    setInitialLoad(true);
    load();
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { items, next } = await port.listThreads({ cursor: nextCursor });
      setThreads((prev) => [...prev, ...items]);
      setNextCursor(next);
    } finally {
      setLoadingMore(false);
    }
  }

  async function remove(id: string) {
    const previous = threads;
    setThreads((prev) => prev.filter((t) => t.id !== id)); // optimistic — restored below if it fails
    try {
      await port.deleteThread(id);
    } catch {
      setThreads(previous);
      // The row reappearing on its own read as a glitch; say why it came back.
      Alert.alert('Could not delete conversation', 'Check your connection and try again.');
    }
  }

  return {
    /** Empty while the first page loads or after it failed, so a list renders its empty component. */
    threads: initialLoad || error ? [] : threads,
    initialLoad,
    error,
    erroredAt,
    loadingMore,
    /** Loads the first page again without the loading state, so the list stays in place until it arrives. */
    refresh: load,
    retry,
    loadMore,
    dismissError: () => setError(null),
    remove,
  };
}
