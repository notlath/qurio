import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';

/** The narrowest window that docks the side panel beside the content (ADR-0011). iPad Split View can be narrower. */
const DOCK_MIN_WIDTH = 768;
const DOCKED_PANEL_WIDTH = 320;
// A UI preference, not answer content, so it may stay on the device (ADR-0007).
const COLLAPSED_KEY = 'qlik.sidePanelCollapsed';

export function isDocked(windowWidth: number): boolean {
  return windowWidth >= DOCK_MIN_WIDTH;
}

/**
 * The drawer options for the window. A narrow window overlays the panel, and the left edge opens it on a
 * top-level screen only. A wide window docks the panel and has no edge swipe. A `permanent` drawer cannot
 * close, so a collapsed docked panel stays `permanent` and is not displayed.
 */
export function sidePanelOptions({ windowWidth, collapsed, topLevel }: { windowWidth: number; collapsed: boolean; topLevel: boolean }) {
  if (!isDocked(windowWidth)) return { drawerType: 'front' as const, swipeEnabled: topLevel };
  return {
    drawerType: 'permanent' as const,
    drawerStyle: collapsed ? { width: DOCKED_PANEL_WIDTH, display: 'none' as const } : { width: DOCKED_PANEL_WIDTH },
    swipeEnabled: false,
  };
}

/**
 * Where Settings opens. While the panel overlays, Settings pushes over the whole window on the root
 * stack, with swipe-to-go-back. While it is docked, Settings opens in a drawer screen beside the panel.
 * A Settings screen that is already open stays where it is when the window changes size. Each one has Back.
 */
export function settingsHref(docked: boolean) {
  return docked ? ('/docked-settings' as const) : ('/settings' as const);
}

type SidePanelLayout = { docked: boolean; collapsed: boolean; toggleCollapsed: () => void };

const SidePanelLayoutContext = createContext<SidePanelLayout>({ docked: false, collapsed: false, toggleCollapsed: () => {} });

/** Docked or overlay from the window width, which follows rotation and Split View, and the remembered collapsed choice. */
export function SidePanelLayoutProvider({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // The panel stays expanded when the preference cannot be read.
    AsyncStorage.getItem(COLLAPSED_KEY).then((value) => setCollapsed(value === 'true'), () => {});
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    // A failed save only forgets the choice at the next start.
    AsyncStorage.setItem(COLLAPSED_KEY, String(next)).catch(() => {});
  }

  return (
    <SidePanelLayoutContext.Provider value={{ docked: isDocked(width), collapsed, toggleCollapsed }}>{children}</SidePanelLayoutContext.Provider>
  );
}

export function useSidePanelLayout(): SidePanelLayout {
  return useContext(SidePanelLayoutContext);
}
