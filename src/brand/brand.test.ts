import AsyncStorage from '@react-native-async-storage/async-storage';

import { brandPrimary, contrastRatio, fetchBrand, loadBrand, parseBrand, type Brand } from './brand';
import { Colors } from '@/constants/theme';

jest.mock('@/global.css', () => ({}));

const FILE = {
  name: 'Example',
  logo: 'https://example.com/logo.png',
  logoDark: 'https://example.com/logo-dark.png',
  primary: { light: '#0055A4', dark: '#7FB2FF' },
};

describe('parseBrand', () => {
  it('reads every field of the file', () => {
    expect(parseBrand(FILE)).toEqual(FILE);
  });

  it('accepts a file with only the colours', () => {
    expect(parseBrand({ primary: FILE.primary })).toEqual({ primary: FILE.primary });
  });

  it.each([
    ['not an object', 'brand'],
    ['null', null],
    ['no primary', { name: 'Example' }],
    ['no dark colour', { primary: { light: '#0055A4' } }],
    ['a colour that is not #RRGGBB', { primary: { light: 'blue', dark: '#7FB2FF' } }],
    ['a short hex colour', { primary: { light: '#05A', dark: '#7FB2FF' } }],
    ['a name that is not a string', { ...FILE, name: 3 }],
    ['a logo that is not https', { ...FILE, logo: 'http://example.com/logo.png' }],
  ])('rejects %s', (_, json) => {
    expect(parseBrand(json)).toBeNull();
  });
});

describe('fetchBrand', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("reads the hostname's Brand file", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => FILE }) as typeof fetch;

    expect(await fetchBrand('acme.sg.qlikcloud.com')).toEqual(FILE);
    expect(globalThis.fetch).toHaveBeenCalledWith('https://notlath.github.io/qurio-oauth/brands/acme.sg.qlikcloud.com.json');
  });

  it('returns null when the hostname has no file', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as typeof fetch;
    expect(await fetchBrand('acme.sg.qlikcloud.com')).toBeNull();
  });

  it('throws when the request fails', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as typeof fetch;
    await expect(fetchBrand('acme.sg.qlikcloud.com')).rejects.toThrow();

    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 }) as typeof fetch;
    await expect(fetchBrand('acme.sg.qlikcloud.com')).rejects.toThrow();
  });

  it('returns null when the file is not JSON', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    }) as typeof fetch;
    expect(await fetchBrand('acme.sg.qlikcloud.com')).toBeNull();
  });
});

describe('brandPrimary', () => {
  const brand = FILE as Brand;

  it('uses the Brand colour with the text colour that reads better on it', () => {
    expect(brandPrimary(brand, 'light')).toEqual({ primary: '#0055A4', primaryForeground: '#FFFFFF' });
    expect(brandPrimary(brand, 'dark')).toEqual({ primary: '#7FB2FF', primaryForeground: '#000000' });
  });

  it('uses Qurio green with no Brand', () => {
    expect(brandPrimary(null, 'light')).toEqual({ primary: Colors.light.primary, primaryForeground: Colors.light.primaryForeground });
  });

  it('uses Qurio green for a colour below 3:1 against the background, in that theme only', () => {
    const pale = { primary: { light: '#FFE066', dark: '#7FB2FF' } };
    expect(contrastRatio('#FFE066', Colors.light.background)).toBeLessThan(3);

    expect(brandPrimary(pale, 'light')).toEqual({ primary: Colors.light.primary, primaryForeground: Colors.light.primaryForeground });
    expect(brandPrimary(pale, 'dark').primary).toBe('#7FB2FF');
  });

  it('uses Qurio green for a dark-theme colour that is too dark', () => {
    const dim = { primary: { light: '#0055A4', dark: '#1A2A40' } };
    expect(brandPrimary(dim, 'dark')).toEqual({ primary: Colors.dark.primary, primaryForeground: Colors.dark.primaryForeground });
  });
});

describe('contrastRatio', () => {
  it('matches the WCAG values for black and white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1);
  });
});

describe('loadBrand', () => {
  const originalFetch = globalThis.fetch;
  const NEWER = { primary: { light: '#8B0000', dark: '#FF8080' } };
  const serve = (file: unknown) => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => file }) as typeof fetch;
  };
  const shown = async (tenantHost: string) => {
    const show = jest.fn();
    await loadBrand(tenantHost, show);
    return show.mock.calls.map(([brand]) => brand);
  };

  beforeEach(() => AsyncStorage.clear());
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('shows the hosted Brand and stores it, so the next launch shows it before the network answers', async () => {
    serve(FILE);
    expect(await shown('acme.sg.qlikcloud.com')).toEqual([FILE]);

    serve(NEWER);
    expect(await shown('acme.sg.qlikcloud.com')).toEqual([FILE, NEWER]);
  });

  it('shows the stored Brand offline', async () => {
    serve(FILE);
    await shown('acme.sg.qlikcloud.com');

    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as typeof fetch;
    expect(await shown('acme.sg.qlikcloud.com')).toEqual([FILE]);
    expect(await shown('acme.sg.qlikcloud.com')).toEqual([FILE]);
  });

  it('replaces the stored Brand with a newer one', async () => {
    serve(FILE);
    await shown('acme.sg.qlikcloud.com');
    serve(NEWER);
    await shown('acme.sg.qlikcloud.com');

    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as typeof fetch;
    expect(await shown('acme.sg.qlikcloud.com')).toEqual([NEWER]);
  });

  it('removes the stored Brand when the hostname no longer has a file', async () => {
    serve(FILE);
    await shown('acme.sg.qlikcloud.com');
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as typeof fetch;
    expect(await shown('acme.sg.qlikcloud.com')).toEqual([FILE, null]);

    expect(await AsyncStorage.getItem('qlik.brand')).toBeNull();
  });

  it("removes the old Tenant's Brand after a Tenant change, even offline", async () => {
    serve(FILE);
    await shown('acme.sg.qlikcloud.com');

    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as typeof fetch;
    expect(await shown('other.eu.qlikcloud.com')).toEqual([]);
    expect(await AsyncStorage.getItem('qlik.brand')).toBeNull();
  });
});
