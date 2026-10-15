import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { bottomInsetScript } from './page';
import { QlikEmbedHost } from './qlik-embed-host';

jest.mock('@/global.css', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/config', () => ({ IS_INTERNAL_BUILD: false }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'session-1' }));
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: jest.fn() }) }));
jest.mock('@/auth/access-token', () => ({
  getAccessTokenWithExpiry: jest.fn().mockResolvedValue({ token: 't', expiresAtMs: Date.now() + 3_600_000 }),
}));

// The real WebView is native; this stand-in exposes the props the host drives.
const mockWebView: { props: any; mounts: number; inject: jest.Mock } = { props: null, mounts: 0, inject: jest.fn() };
jest.mock('react-native-webview', () => {
  const { forwardRef, useEffect, useImperativeHandle } = jest.requireActual('react');
  const WebView = forwardRef(function WebViewStub(props: any, ref: any) {
    useImperativeHandle(ref, () => ({ injectJavaScript: mockWebView.inject }));
    useEffect(() => {
      mockWebView.mounts += 1;
    }, []);
    mockWebView.props = props;
    return null;
  });
  return { WebView };
});

const ORIGIN = 'https://acme.sg.qlikcloud.com';
const config = { tenantHost: 'acme.sg.qlikcloud.com', clientId: 'c', assistantId: 'a', agenticAssistantId: 'g' };
const message = (over: object) => ({
  nativeEvent: { url: `${ORIGIN}/`, data: JSON.stringify({ v: 1, session: 'session-1', ...over }) },
});

let renderer: TestRenderer.ReactTestRenderer;
const shown = () => JSON.stringify(renderer.toJSON());

beforeEach(() => {
  jest.useFakeTimers();
  mockWebView.props = null;
  mockWebView.mounts = 0;
  mockWebView.inject = jest.fn();
  act(() => {
    renderer = TestRenderer.create(<QlikEmbedHost config={config} surface="ai/agentic-assistant" resourceId="g" />);
  });
});
afterEach(() => {
  act(() => renderer.unmount());
  jest.useRealTimers();
});

describe('an embed that never starts (offline: the page loads but the Qlik script cannot download)', () => {
  it('shows the could-not-load guidance instead of a blank screen forever', () => {
    act(() => {
      jest.advanceTimersByTime(25_000);
    });

    expect(shown()).toContain('could not load');
    expect(shown()).toContain('Try again');
  });

  it('shows it straight away when the page reports that the Qlik script failed to load', async () => {
    await act(async () => {
      await mockWebView.props.onMessage(message({ type: 'load-failed' }));
    });

    expect(shown()).toContain('could not load');
  });

  it('ignores a load-failed report from another session', async () => {
    await act(async () => {
      await mockWebView.props.onMessage(message({ type: 'load-failed', session: 'other' }));
    });

    expect(shown()).not.toContain('could not load');
  });

  it('Try again starts a fresh attempt rather than leaving the failure up', () => {
    act(() => {
      jest.advanceTimersByTime(25_000);
    });
    const mountsBefore = mockWebView.mounts;

    act(() => renderer.root.findByProps({ accessibilityLabel: 'Try again' }).props.onPress());

    expect(mockWebView.mounts).toBe(mountsBefore + 1);
    expect(shown()).not.toContain('could not load');
  });
});

describe('an embed that starts normally', () => {
  it('is left alone once the runtime has asked for a token', async () => {
    await act(async () => {
      await mockWebView.props.onMessage(message({ type: 'token-request', id: 1, purpose: 'runtime' }));
    });
    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(shown()).not.toContain('could not load');
  });
});

describe('the space kept below the embed for a floating tab bar (#13)', () => {
  const embed = (bottomInset?: number) => (
    <QlikEmbedHost config={config} surface="ai/agentic-assistant" resourceId="g" bottomInset={bottomInset} />
  );

  // Token replies use the same injection; only the inset scripts matter here.
  const insetScripts = () => mockWebView.inject.mock.calls.map(([script]) => script as string).filter((s) => s.includes('--bottom-inset'));

  it('builds the page with the starting inset and does not touch the running page yet', () => {
    act(() => renderer.unmount());
    act(() => {
      renderer = TestRenderer.create(embed(83));
    });

    expect(mockWebView.props.source.html).toContain('--bottom-inset:83px');
    expect(insetScripts()).toEqual([]);
  });

  it('tells the running page when the inset changes, without starting a new session', () => {
    const mountsBefore = mockWebView.mounts;

    act(() => renderer.update(embed(83)));
    expect(insetScripts()).toEqual([bottomInsetScript(83)]);
    act(() => renderer.update(embed(0)));
    expect(insetScripts()).toEqual([bottomInsetScript(83), bottomInsetScript(0)]);

    expect(mockWebView.mounts).toBe(mountsBefore);
  });

  it('says nothing when the inset has not changed', () => {
    act(() => renderer.update(embed(83)));
    act(() => renderer.update(embed(83)));

    expect(insetScripts()).toEqual([bottomInsetScript(83)]);
  });
});
