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
  // A failed next page. The pages already loaded stay listed above it.
  const [moreError, setMoreError] = useState<AppError | null>(null);

  const load = useCallback(() => {
    port.listThreads().then(
      ({ items, next }) => {
        setThreads(items);
        setNextCursor(next);
        setError(null);
        setMoreError(null);
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

  async function fetchMore() {
    setMoreError(null);
    setLoadingMore(true);
    try {
      const { items, next } = await port.listThreads({ cursor: nextCursor });
      setThreads((prev) => [...prev, ...items]);
      setNextCursor(next);
    } catch (e) {
      setMoreError(isAppError(e) ? e : { kind: 'ServiceUnavailable' });
      setErroredAt(Date.now());
    } finally {
      setLoadingMore(false);
    }
  }

  // After a failure, only Retry loads the next page. Scrolling to the end does not try again.
  function loadMore() {
    if (!nextCursor || loadingMore || moreError) return;
    void fetchMore();
  }

  /** Resolves true when the Thread is deleted. On a failure the row comes back and an alert says why. */
  async function remove(id: string): Promise<boolean> {
    const previous = threads;
    setThreads((prev) => prev.filter((t) => t.id !== id)); // optimistic — restored below if it fails
    try {
      await port.deleteThread(id);
      return true;
    } catch {
      setThreads(previous);
      // A row that comes back with no message looks like a glitch. The alert says why it came back.
      Alert.alert('Could not delete conversation', 'Check your connection and try again.');
      return false;
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
    moreError,
    retryMore: fetchMore,
    dismissMoreError: () => setMoreError(null),
    dismissError: () => setError(null),
    remove,
  };
}
