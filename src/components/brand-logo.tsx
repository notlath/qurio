import { Image, type ImageStyle } from 'expo-image';
import { useState } from 'react';
import type { StyleProp } from 'react-native';

import { useBrand } from '@/brand/context';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Relative, not `@/`: Jest maps `@/` to `src/` only.
const LOGO = require('../../assets/images/logo.svg');

/**
 * Shows the Customer's Brand logo. A screen reader announces the Customer's name. Dark mode uses `logoDark`
 * when the Brand has one, and `logo` when it does not or `logoDark` fails to load.
 * With no Brand logo, or when it fails to load, Qurio's logo shows and the screen reader skips it.
 * `mark` shows the Brand's symbol with no text, for places too small to read the text. It falls back to the logo.
 */
export function BrandLogo({ style, mark = false }: { style: StyleProp<ImageStyle>; mark?: boolean }) {
  const { brand } = useBrand();
  const dark = useColorScheme() === 'dark';
  const [failedUris, setFailedUris] = useState<string[]>([]);
  const uri = [mark ? brand?.mark : undefined, dark ? brand?.logoDark : undefined, brand?.logo].find(
    (u) => u && !failedUris.includes(u),
  );

  if (!uri) return <Image source={LOGO} style={style} contentFit="contain" accessible={false} />;
  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit="contain"
      onError={() => setFailedUris((failed) => [...failed, uri])}
      accessible={Boolean(brand?.name)}
      accessibilityRole="image"
      accessibilityLabel={brand?.name}
    />
  );
}
