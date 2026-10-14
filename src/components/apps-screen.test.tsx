import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import AppsScreen from '@/app/(tabs)/(home)/index';
import type { AnalyticsApp } from '@/domain';
import { AnswersScope } from '@/qlik/context';
import type { AnswersPort } from '@/qlik/port';

jest.mock('@/global.css', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: unknown }) => children,
  Stack: { Screen: (props: unknown) => jest.requireActual('react').createElement('Header', props as object) },
}));
jest.mock('@/components/icon', () => ({ Icon: () => null }));
jest.mock('@/components/app-cover', () => ({ AppCover: () => null }));
jest.mock('@/hooks/use-apps-view-mode', () => ({ useAppsViewMode: () => ['list', jest.fn()] }));

const app = (id: string, name: string): AnalyticsApp => ({ id, name, updatedAt: '2026-10-01T00:00:00Z', hasThumbnail: false });
const SALES = app('sales', 'Sales overview');
const BUDGET = app('budget', 'Budget tracker');

function portWith(list: jest.Mock) {
  return { listAnalyticsApps: list } as unknown as AnswersPort;
}

async function render(port: AnswersPort) {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AnswersScope port={port}><AppsScreen /></AnswersScope>); });
  const search = (text: string) => renderer.root.findByType('Header' as never).props.options.headerSearchBarOptions.onChangeText({ nativeEvent: { text } });
  const shown = (name: string) =>
    renderer.root.findAll((node) => typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith(`${name},`)).length > 0;
  const text = () =>
    renderer.root
      .findAll((node) => typeof node.props.children === 'string')
      .map((node) => node.props.children)
      .join('\n');
  return { renderer, search, shown, text };
}

// Past the search debounce.
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); });

it('searches Analytics Apps by name once the Qlik User stops typing', async () => {
  const list = jest.fn(async (opts?: { name?: string }) => ({ items: opts?.name ? [BUDGET] : [SALES, BUDGET] }));
  const { renderer, search, shown } = await render(portWith(list));
  expect(list).toHaveBeenCalledWith(undefined);
  expect(shown('Sales overview')).toBe(true);

  await act(async () => { search(' bud '); });
  expect(list).toHaveBeenCalledTimes(1);
  await settle();

  expect(list).toHaveBeenLastCalledWith({ name: 'bud' });
  expect(shown('Budget tracker')).toBe(true);
  expect(shown('Sales overview')).toBe(false);

  await act(async () => { search(''); });
  await settle();
  expect(list).toHaveBeenLastCalledWith(undefined);
  expect(shown('Sales overview')).toBe(true);
  await act(async () => { renderer.unmount(); });
});

it('says no app matches, instead of claiming there are no apps at all', async () => {
  const list = jest.fn(async (opts?: { name?: string }) => ({ items: opts?.name ? [] : [SALES] }));
  const { renderer, search, text } = await render(portWith(list));

  await act(async () => { search('zzz'); });
  await settle();

  expect(text()).toContain('No matching Analytics Apps');
  expect(text()).not.toContain('No Analytics Apps yet');
  await act(async () => { renderer.unmount(); });
});

it('drops an earlier search that answers after the latest one', async () => {
  let answerSlow!: () => void;
  const list = jest.fn((opts?: { name?: string }) => {
    if (opts?.name === 'sal') return new Promise((resolve) => { answerSlow = () => resolve({ items: [SALES] }); });
    return Promise.resolve({ items: opts?.name ? [BUDGET] : [SALES, BUDGET] });
  });
  const { renderer, search, shown } = await render(portWith(list));

  await act(async () => { search('sal'); });
  await settle();
  await act(async () => { search('bud'); });
  await settle();
  await act(async () => { answerSlow(); });

  expect(shown('Budget tracker')).toBe(true);
  expect(shown('Sales overview')).toBe(false);
  await act(async () => { renderer.unmount(); });
});
