import { Platform } from 'react-native';

import { unlockTabletRotation } from './tablet-orientation';

const mockLockAsync = jest.fn(async () => {});
let mockModuleMissing = false;
let mockTablet = true;

// A dev client built before expo-screen-orientation was added has no ExpoScreenOrientation native
// module: importing the package then throws "Cannot find native module".
jest.mock('expo-screen-orientation', () => {
  if (mockModuleMissing) throw new Error("Cannot find native module 'ExpoScreenOrientation'");
  return { lockAsync: mockLockAsync, OrientationLock: { ALL: 'ALL' } };
});
jest.mock('expo-device', () => ({
  DeviceType: { PHONE: 1, TABLET: 2 },
  get deviceType() {
    return mockTablet ? 2 : 1;
  },
}));

beforeEach(() => {
  jest.resetModules();
  mockLockAsync.mockClear();
  mockModuleMissing = false;
  mockTablet = true;
  Platform.OS = 'android';
});

it('unlocks every orientation on an Android tablet', async () => {
  await unlockTabletRotation();
  expect(mockLockAsync).toHaveBeenCalledWith('ALL');
});

it('leaves an Android phone portrait', async () => {
  mockTablet = false;
  await unlockTabletRotation();
  expect(mockLockAsync).not.toHaveBeenCalled();
});

it('starts the app when the dev client has no screen orientation module', async () => {
  mockModuleMissing = true;
  await expect(unlockTabletRotation()).resolves.toBeUndefined();
  expect(mockLockAsync).not.toHaveBeenCalled();
});
