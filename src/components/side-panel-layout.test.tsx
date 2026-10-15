import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, create } from 'react-test-renderer';

import { sidePanelOptions, SidePanelLayoutProvider, useSidePanelLayout } from '@/components/side-panel-layout';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('sidePanelOptions', () => {
  it.each([375, 767])('overlays the content on a %ipt window, as on a phone or in iPad Split View', (windowWidth) => {
    expect(sidePanelOptions({ windowWidth, collapsed: false, topLevel: true })).toEqual({ drawerType: 'front', swipeEnabled: true });
  });

  it('keeps the left edge for swipe-to-go-back on a pushed screen in the overlay', () => {
    expect(sidePanelOptions({ windowWidth: 375, collapsed: false, topLevel: false }).swipeEnabled).toBe(false);
  });

  it('ignores a collapsed choice while the panel overlays', () => {
    expect(sidePanelOptions({ windowWidth: 375, collapsed: true, topLevel: true }).drawerType).toBe('front');
  });

  it.each([768, 1366])('docks the panel at 320pt beside the content on a %ipt window, with no edge swipe', (windowWidth) => {
    expect(sidePanelOptions({ windowWidth, collapsed: false, topLevel: true })).toEqual({
      drawerType: 'permanent',
      drawerStyle: { width: 320 },
      swipeEnabled: false,
    });
  });

  it('hides the docked panel when the Qlik User collapses it', () => {
    expect(sidePanelOptions({ windowWidth: 1024, collapsed: true, topLevel: true })).toEqual({
      drawerType: 'permanent',
      drawerStyle: { width: 320, display: 'none' },
      swipeEnabled: false,
    });
  });
});

describe('SidePanelLayoutProvider', () => {
  let layout: ReturnType<typeof useSidePanelLayout>;
  function Probe() {
    layout = useSidePanelLayout();
    return null;
  }

  beforeEach(() => AsyncStorage.clear());

  it('remembers on the device that the docked panel is collapsed', async () => {
    await act(async () => {
      create(
        <SidePanelLayoutProvider>
          <Probe />
        </SidePanelLayoutProvider>,
      );
    });
    expect(layout.collapsed).toBe(false);

    await act(async () => layout.toggleCollapsed());
    expect(layout.collapsed).toBe(true);

    await act(async () => {
      create(
        <SidePanelLayoutProvider>
          <Probe />
        </SidePanelLayoutProvider>,
      );
    });
    expect(layout.collapsed).toBe(true);
  });
});
