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
 */
export function BrandLogo({ style }: { style: StyleProp<ImageStyle> }) {
  const { brand } = useBrand();
  const dark = useColorScheme() === 'dark';
  const [failedUris, setFailedUris] = useState<string[]>([]);
  const uri = [dark ? brand?.logoDark : undefined, brand?.logo].find((u) => u && !failedUris.includes(u));

  if (!uri) return <Image source={LOGO} style={style} accessible={false} />;
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
