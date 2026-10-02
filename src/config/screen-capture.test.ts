import * as ScreenCapture from 'expo-screen-capture';

import { applyScreenCapture, loadAllowScreenshots, setAllowScreenshots, shouldProtect } from './screen-capture';

const mockBuild = { internal: true };
jest.mock('./development', () => ({
  get IS_INTERNAL_BUILD() {
    return mockBuild.internal;
  },
}));
jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: jest.fn(),
  allowScreenCaptureAsync: jest.fn(),
}));
const mockStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => mockStore[key] ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStore[key] = value;
  }),
}));

const prevent = ScreenCapture.preventScreenCaptureAsync as jest.Mock;
const allow = ScreenCapture.allowScreenCaptureAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockStore).forEach((k) => delete mockStore[k]);
  mockBuild.internal = true;
});

describe('shouldProtect', () => {
  it.each([
    [false, false, true],
    [false, true, true], // a release build never honours the switch
    [true, false, true],
    [true, true, false], // only an internal build with the switch on
  ])('internal=%s allowScreenshots=%s → protected=%s', (internal, allowScreenshots, expected) => {
    expect(shouldProtect(internal, allowScreenshots)).toBe(expected);
  });
});

describe('applyScreenCapture at startup', () => {
  it('protects by default', async () => {
    await applyScreenCapture();

    expect(prevent).toHaveBeenCalledTimes(1);
    expect(allow).not.toHaveBeenCalled();
  });

  it('lets an internal build allow screenshots once the switch is on', async () => {
    mockStore['qlik.devAllowScreenshots'] = 'true';

    await applyScreenCapture();

    expect(allow).toHaveBeenCalledTimes(1);
    expect(prevent).not.toHaveBeenCalled();
  });

  it('keeps a release build protected even if an allow flag is stored, without reading it', async () => {
    mockBuild.internal = false;
    mockStore['qlik.devAllowScreenshots'] = 'true';

    await applyScreenCapture();

    expect(prevent).toHaveBeenCalledTimes(1);
    expect(allow).not.toHaveBeenCalled();
    await expect(loadAllowScreenshots()).resolves.toBe(false);
  });

  it('stays protected when the stored preference cannot be read', async () => {
    const storage = jest.requireMock('@react-native-async-storage/async-storage');
    storage.getItem.mockRejectedValueOnce(new Error('disk'));

    await applyScreenCapture();

    expect(prevent).toHaveBeenCalledTimes(1);
    expect(allow).not.toHaveBeenCalled();
  });
});

describe('setAllowScreenshots', () => {
  it('persists the choice and applies it straight away', async () => {
    await setAllowScreenshots(true);
    expect(mockStore['qlik.devAllowScreenshots']).toBe('true');
    expect(allow).toHaveBeenCalledTimes(1);

    await setAllowScreenshots(false);
    expect(mockStore['qlik.devAllowScreenshots']).toBe('false');
    expect(prevent).toHaveBeenCalledTimes(1);
  });

  it('refuses outside an internal build and changes nothing', async () => {
    mockBuild.internal = false;

    await expect(setAllowScreenshots(true)).rejects.toThrow('internal builds only');
    expect(allow).not.toHaveBeenCalled();
    expect(mockStore['qlik.devAllowScreenshots']).toBeUndefined();
  });
});

describe('a toggle made while startup is still reading the stored choice', () => {
  it('wins over the older startup apply, so the native state matches what the user chose last', async () => {
    const storage = jest.requireMock('@react-native-async-storage/async-storage');
    let releaseRead!: (value: string | null) => void;
    storage.getItem.mockImplementationOnce(() => new Promise((resolve) => (releaseRead = resolve)));

    const startup = applyScreenCapture(); // stuck reading storage
    const toggle = setAllowScreenshots(true); // user flips the switch meanwhile
    await new Promise((resolve) => setTimeout(resolve, 0)); // let the startup read begin
    releaseRead(null); // the startup read finally says "not allowed"
    await Promise.all([startup, toggle]);

    expect(allow).toHaveBeenCalledTimes(1);
    expect(allow.mock.invocationCallOrder[0]).toBeGreaterThan(prevent.mock.invocationCallOrder[0]);
    expect(mockStore['qlik.devAllowScreenshots']).toBe('true');
  });
});
