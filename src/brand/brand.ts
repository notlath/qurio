import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors } from '@/constants/theme';

type Scheme = 'light' | 'dark';

/** A Customer's Brand, as its hosted file holds it (ADR-0013). */
export type Brand = {
  name?: string;
  logo?: string; // PNG URL, transparent background
  logoDark?: string; // optional PNG URL for dark mode
  primary: Record<Scheme, string>; // "#RRGGBB"
};

/**
 * One Brand file per tenant hostname, next to the Client ID Metadata Document.
 * ponytail: GitHub Pages under a personal account is beta only. Move it with the metadata file (#55).
 */
const BRAND_FILES = 'https://notlath.github.io/qurio-oauth/brands/';
const HEX = /^#[0-9a-f]{6}$/i;
const URL_FIELD = /^https:\/\//i;

function optionalString(value: unknown, pattern?: RegExp): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || (pattern && !pattern.test(value))) return null;
  return value;
}

/** The Brand in a parsed file, or null when any field is missing or has the wrong form. */
export function parseBrand(json: unknown): Brand | null {
  if (typeof json !== 'object' || json === null) return null;
  const file = json as Record<string, unknown>;
  const primary = file.primary as Record<string, unknown> | undefined;
  const light = primary?.light;
  const dark = primary?.dark;
  if (typeof light !== 'string' || !HEX.test(light) || typeof dark !== 'string' || !HEX.test(dark)) return null;
  const name = optionalString(file.name);
  const logo = optionalString(file.logo, URL_FIELD);
  const logoDark = optionalString(file.logoDark, URL_FIELD);
  if (name === null || logo === null || logoDark === null) return null;
  return { name, logo, logoDark, primary: { light, dark } };
}

/**
 * The tenant hostname's Brand, or null when it has no file or the file is malformed.
 * Throws when the request fails, so the caller keeps the Brand it has.
 */
export async function fetchBrand(tenantHost: string): Promise<Brand | null> {
  const response = await fetch(`${BRAND_FILES}${encodeURIComponent(tenantHost)}.json`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Brand file request failed: ${response.status}`);
  return parseBrand(await response.json().catch(() => null));
}

// The device keeps one Brand: the Tenant's. A Brand is not Answer content, so ADR-0007 does not apply.
const BRAND_KEY = 'qlik.brand';

async function readStoredBrand(): Promise<{ tenantHost: string; brand: Brand } | null> {
  try {
    const stored: { tenantHost?: unknown; brand?: unknown } | null = JSON.parse((await AsyncStorage.getItem(BRAND_KEY)) ?? 'null');
    const brand = parseBrand(stored?.brand);
    return typeof stored?.tenantHost === 'string' && brand ? { tenantHost: stored.tenantHost, brand } : null;
  } catch {
    return null;
  }
}

/**
 * Shows the stored Brand of the tenant hostname at once, then the hosted Brand, which replaces the stored one.
 * Another Tenant's stored Brand is removed. When the request fails, the stored Brand stays.
 */
export async function loadBrand(tenantHost: string, show: (brand: Brand | null) => void): Promise<void> {
  const stored = await readStoredBrand();
  if (stored?.tenantHost === tenantHost) show(stored.brand);
  else if (stored) await AsyncStorage.removeItem(BRAND_KEY).catch(() => {});

  let brand: Brand | null;
  try {
    brand = await fetchBrand(tenantHost);
  } catch {
    return;
  }
  show(brand);
  await (brand
    ? AsyncStorage.setItem(BRAND_KEY, JSON.stringify({ tenantHost, brand }))
    : AsyncStorage.removeItem(BRAND_KEY)
  ).catch(() => {});
}

/** WCAG 2 relative luminance of a "#RRGGBB" colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/**
 * The `primary` pair for one theme. The text colour is white or black, whichever reads better on the
 * Brand colour. Qurio green replaces a Brand colour below 3:1 against the background or 4.5:1 with its text.
 */
export function brandPrimary(brand: Brand | null, scheme: Scheme): { primary: string; primaryForeground: string } {
  const qurio = { primary: Colors[scheme].primary, primaryForeground: Colors[scheme].primaryForeground };
  if (!brand) return qurio;
  const primary = brand.primary[scheme];
  const primaryForeground = contrastRatio(primary, '#FFFFFF') >= contrastRatio(primary, '#000000') ? '#FFFFFF' : '#000000';
  if (contrastRatio(primary, Colors[scheme].background) < 3 || contrastRatio(primary, primaryForeground) < 4.5) return qurio;
  return { primary, primaryForeground };
}
