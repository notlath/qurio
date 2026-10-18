import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import type { AnalyticsApp } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useAnswersPort } from '@/qlik/context';
import type { ThumbnailImage } from '@/qlik/port';

const BAR_COUNT = 5;

/** Bar heights (0–1) derived from the app id: stable for one app, different between apps. */
function sketchHeights(id: string): number[] {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return Array.from({ length: BAR_COUNT }, (_, i) => 0.3 + (((hash >>> (i * 5)) & 31) / 31) * 0.7);
}

/**
 * Most Qlik apps never get a thumbnail. Instead of one grey placeholder repeated down the grid,
 * each gets its own small bar chart — the same mark the app icon uses, so it reads as ours.
 */
function ChartSketch({ id }: { id: string }) {
  const theme = useTheme();
  const heights = sketchHeights(id);
  const peak = heights.indexOf(Math.max(...heights));

  // Quiet bars with one in full accent, as a chart highlights its key value: the cover gives each
  // app a recognisable shape without outshouting the app's name beneath it.
  return (
    <View style={[styles.sketch, { backgroundColor: theme.backgroundSelected }]}>
      {heights.map((height, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            { height: `${Math.round(height * 100)}%`, backgroundColor: theme.primary, opacity: i === peak ? 1 : 0.22 },
          ]}
        />
      ))}
    </View>
  );
}

/** A 16:10 cover for the grid: the app's own thumbnail when it has one, else its chart sketch. */
export function AppCover({ app }: { app: AnalyticsApp }) {
  const port = useAnswersPort();
  const [image, setImage] = useState<ThumbnailImage | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!app.hasThumbnail) return;
    let current = true;
    port.thumbnailImage(app.id).then(
      (next) => current && setImage(next),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [port, app.id, app.hasThumbnail]);

  return (
    <View style={styles.cover}>
      <ChartSketch id={app.id} />
      {image && !failed && (
        <Image
          source={image}
          // Memory only: Qlik content is never written to the device (ADR-0007).
          cachePolicy="memory"
          contentFit="cover"
          transition={150}
          recyclingKey={app.id}
          onError={() => setFailed(true)}
          style={StyleSheet.absoluteFill}
          accessible={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { aspectRatio: 16 / 10, overflow: 'hidden' },
  sketch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
  },
  bar: { flex: 1, borderTopLeftRadius: Radius.small, borderTopRightRadius: Radius.small },
});
