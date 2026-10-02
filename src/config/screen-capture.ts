import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ScreenCapture from 'expo-screen-capture';
import { Platform } from 'react-native';

import { IS_INTERNAL_BUILD } from './development';

const STORAGE_KEY = 'qlik.devAllowScreenshots';

/**
 * Screenshots and recording are blocked everywhere (ADR-0007). Only an internal build with the
 * Settings switch on may turn that off — a release build ignores the switch entirely.
 */
export function shouldProtect(internalBuild: boolean, allowScreenshots: boolean): boolean {
  return !(internalBuild && allowScreenshots);
}

/** Always `false` in a release build, without reading storage. */
export async function loadAllowScreenshots(): Promise<boolean> {
  if (!IS_INTERNAL_BUILD) return false;
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) === 'true';
  } catch {
    return false; // An unreadable preference stays protected.
  }
}

async function apply(allowScreenshots: boolean): Promise<void> {
  // expo-screen-capture has no web implementation — calling it throws (ERR_UNAVAILABLE).
  if (Platform.OS === 'web') return;
  if (shouldProtect(IS_INTERNAL_BUILD, allowScreenshots)) await ScreenCapture.preventScreenCaptureAsync();
  else await ScreenCapture.allowScreenCaptureAsync();
}

// Startup and a toggle can overlap (the startup read is async); run them in order so the
// native state always ends up matching the last thing asked for.
let queue: Promise<unknown> = Promise.resolve();
function inOrder(task: () => Promise<void>): Promise<void> {
  const run = queue.then(task);
  queue = run.catch(() => undefined);
  return run;
}

/** Sets the capture state explicitly at startup, from the saved choice (always protected in a release build). */
export function applyScreenCapture(): Promise<void> {
  return inOrder(async () => apply(await loadAllowScreenshots()));
}

/** Internal builds only: remembers the choice on this device and applies it straight away. */
export function setAllowScreenshots(allow: boolean): Promise<void> {
  if (!IS_INTERNAL_BUILD) return Promise.reject(new Error('setAllowScreenshots is for internal builds only'));
  return inOrder(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, String(allow));
    await apply(allow);
  });
}
