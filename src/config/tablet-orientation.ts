import { Dimensions, Platform } from 'react-native';

/** Android's own large-screen rule: the `sw600dp` resource qualifier. */
const TABLET_MIN_SMALLEST_WIDTH_DP = 600;

/**
 * Phones stay portrait (app.json). An Android tablet rotates to every orientation. Android has no
 * per-idiom setting in app.json, as iOS has for iPad, so the app removes the lock at start.
 *
 * A tablet is a screen whose shorter side is at least 600dp. expo-device's `deviceType` is not used:
 * it guesses from the physical diagonal, which a wrong DPI report or a small tablet pushes to PHONE,
 * and the app then stays portrait with empty bars beside it in landscape.
 *
 * The module loads on demand. A dev client built before expo-screen-orientation was added has no
 * native module for it, and a top-level import then stopped the app from starting. Such a client
 * keeps the portrait lock until it is rebuilt.
 */
export async function unlockTabletRotation(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const { width, height } = Dimensions.get('screen');
  if (Math.min(width, height) < TABLET_MIN_SMALLEST_WIDTH_DP) return;
  try {
    // A require, not a top-level import: it throws inside this try when the native module is missing.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ScreenOrientation: typeof import('expo-screen-orientation') = require('expo-screen-orientation');
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.ALL);
  } catch {
    // No native module, or the lock failed: the app still runs, in portrait.
  }
}
