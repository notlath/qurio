import * as Device from 'expo-device';
import { Platform } from 'react-native';

/**
 * Phones stay portrait (app.json). An Android tablet rotates to every orientation. Android has no
 * per-idiom setting in app.json, as iOS has for iPad, so the app removes the lock at start.
 *
 * The module loads on demand. A dev client built before expo-screen-orientation was added has no
 * native module for it, and a top-level import then stopped the app from starting. Such a client
 * keeps the portrait lock until it is rebuilt.
 */
export async function unlockTabletRotation(): Promise<void> {
  if (Platform.OS !== 'android' || Device.deviceType !== Device.DeviceType.TABLET) return;
  try {
    // A require, not a top-level import: it throws inside this try when the native module is missing.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ScreenOrientation: typeof import('expo-screen-orientation') = require('expo-screen-orientation');
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.ALL);
  } catch {
    // No native module, or the lock failed: the app still runs, in portrait.
  }
}
