import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export type AppsViewMode = 'list' | 'grid';

// A display preference, not Qlik content, so it may outlive the session (ADR-0007 covers Qlik data).
const APPS_VIEW_MODE_KEY = 'qlik.appsViewMode';

/** List or grid for the Apps tab, remembered on this device. Falls back to list if storage fails. */
export function useAppsViewMode(): [AppsViewMode, (mode: AppsViewMode) => void] {
  const [mode, setMode] = useState<AppsViewMode>('list');

  useEffect(() => {
    AsyncStorage.getItem(APPS_VIEW_MODE_KEY).then(
      (saved) => saved === 'grid' && setMode('grid'),
      () => {},
    );
  }, []);

  function change(next: AppsViewMode) {
    setMode(next);
    AsyncStorage.setItem(APPS_VIEW_MODE_KEY, next).catch(() => {}); // the switch still applies this session
  }

  return [mode, change];
}
