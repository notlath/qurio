import { Dimensions, Platform } from 'react-native';

import { unlockTabletRotation } from './tablet-orientation';

const mockLockAsync = jest.fn(async () => {});
let mockModuleMissing = false;

// A dev client built before expo-screen-orientation was added has no ExpoScreenOrientation native
// module: importing the package then throws "Cannot find native module".
jest.mock('expo-screen-orientation', () => {
  if (mockModuleMissing) throw new Error("Cannot find native module 'ExpoScreenOrientation'");
  return { lockAsync: mockLockAsync, OrientationLock: { ALL: 'ALL' } };
});

function screen(width: number, height: number) {
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width, height, scale: 2, fontScale: 1 });
}

beforeEach(() => {
  jest.resetModules();
  mockLockAsync.mockClear();
  mockModuleMissing = false;
  Platform.OS = 'android';
  screen(800, 1280);
});

it('unlocks every orientation on an Android tablet', async () => {
  await unlockTabletRotation();
  expect(mockLockAsync).toHaveBeenCalledWith('ALL');
});

it('unlocks a tablet that is held in landscape', async () => {
  screen(1280, 800);
  await unlockTabletRotation();
  expect(mockLockAsync).toHaveBeenCalledWith('ALL');
});

it('unlocks a small tablet whose physical size the device reports wrongly', async () => {
  screen(600, 960);
  await unlockTabletRotation();
  expect(mockLockAsync).toHaveBeenCalledWith('ALL');
});

it('leaves an Android phone portrait', async () => {
  screen(412, 915);
  await unlockTabletRotation();
  expect(mockLockAsync).not.toHaveBeenCalled();
});

it('leaves a phone portrait when it is held in landscape', async () => {
  screen(915, 412);
  await unlockTabletRotation();
  expect(mockLockAsync).not.toHaveBeenCalled();
});

it('starts the app when the dev client has no screen orientation module', async () => {
  mockModuleMissing = true;
  await expect(unlockTabletRotation()).resolves.toBeUndefined();
  expect(mockLockAsync).not.toHaveBeenCalled();
});
