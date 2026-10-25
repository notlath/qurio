import { Image } from 'expo-image';
import TestRenderer, { act } from 'react-test-renderer';

import { BrandProvider } from '@/brand/context';
import { BrandLogo } from '@/components/brand-logo';

jest.mock('@/global.css', () => ({}));
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: jest.fn() }));
const { useColorScheme } = jest.requireMock('@/hooks/use-color-scheme');

const QURIO_LOGO = require('../../assets/images/logo.svg');
const FILE = {
  name: 'MTC AI',
  logo: 'https://example.com/logo.png',
  logoDark: 'https://example.com/logo-dark.png',
  primary: { light: '#0055A4', dark: '#7FB2FF' },
};

async function renderLogo(file: object | null, scheme: 'light' | 'dark' = 'light') {
  useColorScheme.mockReturnValue(scheme);
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: file !== null, status: file ? 200 : 404, json: async () => file }) as typeof fetch;
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(
      <BrandProvider configuredHost="mtcai.sg.qlikcloud.com">
        <BrandLogo style={{}} />
      </BrandProvider>,
    );
  });
  return renderer.root.findByType(Image);
}

it('shows the Brand logo, read with the Customer name', async () => {
  const logo = await renderLogo(FILE);
  expect(logo.props.source).toEqual({ uri: 'https://example.com/logo.png' });
  expect(logo.props.accessibilityLabel).toBe('MTC AI');
  expect(logo.props.accessible).toBe(true);
});

it('shows the dark logo in dark mode', async () => {
  const logo = await renderLogo(FILE, 'dark');
  expect(logo.props.source).toEqual({ uri: 'https://example.com/logo-dark.png' });
});

it('shows the light logo in dark mode when the Brand has no dark logo', async () => {
  const logo = await renderLogo({ ...FILE, logoDark: undefined }, 'dark');
  expect(logo.props.source).toEqual({ uri: 'https://example.com/logo.png' });
});

it('shows Qurio’s logo, not read aloud, with no Brand', async () => {
  const logo = await renderLogo(null);
  expect(logo.props.source).toBe(QURIO_LOGO);
  expect(logo.props.accessible).toBe(false);
});

it('shows Qurio’s logo when the Brand logo fails to load', async () => {
  const logo = await renderLogo(FILE);
  await act(async () => logo.props.onError());
  expect(logo.props.source).toBe(QURIO_LOGO);
  expect(logo.props.accessible).toBe(false);
});

it('shows the light logo when the dark logo fails to load', async () => {
  const logo = await renderLogo(FILE, 'dark');
  await act(async () => logo.props.onError());
  expect(logo.props.source).toEqual({ uri: 'https://example.com/logo.png' });
});
