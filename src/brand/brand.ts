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

/** The tenant hostname's Brand, or null when it has no file, the request fails, or the file is malformed. */
export async function fetchBrand(tenantHost: string): Promise<Brand | null> {
  try {
    const response = await fetch(`${BRAND_FILES}${encodeURIComponent(tenantHost)}.json`);
    if (!response.ok) return null;
    return parseBrand(await response.json());
  } catch {
    return null;
  }
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
