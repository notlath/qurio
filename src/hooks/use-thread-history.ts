import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { errorMessageFor, type AppError, type Thread } from '@/domain';
import { useAnswersPort } from '@/qlik/context';

function isAppError(value: unknown): value is AppError {
  return typeof value === 'object' && value !== null && 'kind' in value;
}

// One request lists the pinned Threads. A pin beyond this limit shows in the other group until its page loads.
const PINNED_LIMIT = 100;

const byNewest = (a: Thread, b: Thread) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt);

/** `items` that `known` does not hold yet. A pinned Thread arrives in the pinned list and again in its page. */
const withNew = (known: Thread[], items: Thread[]) => [...known, ...items.filter((item) => !known.some((t) => t.id === item.id))];

/**
 * The selected Assistant's History as the side panel lists it: the pinned Threads, then the others in
 * pages, newest first in each group. Load, page, pin, rename, delete and recover.
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
    // Qlik cannot sort pinned Threads first, so they come from a query of their own.
    Promise.all([port.listThreads({ pinned: true, limit: PINNED_LIMIT }), port.listThreads()]).then(
      ([pinned, { items, next }]) => {
        setThreads(withNew(pinned.items, items));
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
      setThreads((prev) => withNew(prev, items));
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

  /** Resolves true when the Thread is renamed. On a failure the old name comes back and an alert says why. */
  async function rename(id: string, name: string): Promise<boolean> {
    const previous = threads.find((t) => t.id === id)?.name ?? name;
    const setName = (value: string) => setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, name: value } : t)));
    setName(name); // optimistic. The old name comes back below if the rename fails.
    try {
      await port.renameThread(id, name);
      return true;
    } catch (e) {
      setName(previous);
      Alert.alert('Could not rename conversation', errorMessageFor(isAppError(e) ? e : { kind: 'ServiceUnavailable' }).message);
      return false;
    }
  }

  /** Resolves true when the Thread is pinned or unpinned. On a failure it returns to its group and an alert says why. */
  async function setPinned(id: string, pinned: boolean): Promise<boolean> {
    const previous = threads.find((t) => t.id === id);
    if (!previous) return false;
    const patch = (changes: Partial<Thread>) => setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, ...changes } : t)));
    // Optimistic. Qlik also changes `updatedAt` when it saves the flag, so the Thread leads its new group.
    patch({ pinned, updatedAt: new Date().toISOString() });
    try {
      await port.setThreadPinned(id, pinned);
      return true;
    } catch (e) {
      // Only the pin and its date come back. A rename made meanwhile stays.
      patch({ pinned: previous.pinned, updatedAt: previous.updatedAt });
      Alert.alert(
        pinned ? 'Could not pin conversation' : 'Could not unpin conversation',
        errorMessageFor(isAppError(e) ? e : { kind: 'ServiceUnavailable' }).message,
      );
      return false;
    }
  }

  const listed = initialLoad || error ? [] : threads;

  return {
    /** The pinned Threads, newest first. Empty while the first page loads or after it failed. */
    pinned: listed.filter((t) => t.pinned).sort(byNewest),
    /** The other Threads, newest first. Empty while the first page loads or after it failed. */
    threads: listed.filter((t) => !t.pinned).sort(byNewest),
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
    rename,
    setPinned,
  };
}
