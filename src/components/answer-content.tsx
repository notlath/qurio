import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Radius, Shape, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { parseAnswerMarkdown, type AnswerRenderBlock, type InlineSpan } from './answer-markdown';

function Spans({ spans }: { spans: InlineSpan[] }) {
  return (
    <ThemedText selectable>
      {spans.map((span, index) =>
        span.href ? (
          <ThemedText
            key={index}
            type="linkPrimary"
            accessibilityRole="link"
            style={styles.link}
            onPress={() => Linking.openURL(span.href!)}>
            {span.text}
          </ThemedText>
        ) : (
          <ThemedText key={index} style={[span.bold && styles.bold, span.italic && styles.italic]}>
            {span.text}
          </ThemedText>
        ),
      )}
    </ThemedText>
  );
}

function numberedIndicesFor(blocks: AnswerRenderBlock[]): number[] {
  const indices: number[] = [];
  let count = 0;
  for (const block of blocks) {
    count = block.kind === 'numberedListItem' ? count + 1 : 0;
    indices.push(count);
  }
  return indices;
}

export function AnswerContent({ markdown }: { markdown: string }) {
  const blocks = parseAnswerMarkdown(markdown);
  const numberedIndices = numberedIndicesFor(blocks);

  return (
    <View style={styles.container}>
      {blocks.map((block, index) => (
        <Block key={index} block={block} numberedIndex={numberedIndices[index]} />
      ))}
    </View>
  );
}

function Block({ block, numberedIndex }: { block: AnswerRenderBlock; numberedIndex: number }) {
  const theme = useTheme();

  switch (block.kind) {
    case 'paragraph':
      return <Spans spans={block.spans} />;
    case 'heading':
      return (
        <ThemedText accessibilityRole="header" style={HEADING_LEVEL_STYLE[block.level]}>
          <Spans spans={block.spans} />
        </ThemedText>
      );
    case 'numberedListItem':
      return (
        <View style={styles.listItem}>
          <ThemedText style={styles.marker}>{numberedIndex}.</ThemedText>
          <View style={styles.listItemContent}>
            <Spans spans={block.spans} />
          </View>
        </View>
      );
    case 'bulletListItem':
      return (
        <View style={styles.listItem}>
          <ThemedText style={styles.marker}>{'•'}</ThemedText>
          <View style={styles.listItemContent}>
            <Spans spans={block.spans} />
          </View>
        </View>
      );
    case 'table':
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScroll}>
          <View style={[styles.table, Shape.continuous, { borderColor: theme.border }]}>
            {block.rows.map((row, rowIndex) => (
              <View
                key={rowIndex}
                style={[
                  styles.tableRow,
                  rowIndex > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                  // The parser emits the header row first; it gets the tinted band.
                  rowIndex === 0 && { backgroundColor: theme.backgroundSelected },
                ]}>
                {row.map((cell, cellIndex) => (
                  <View key={cellIndex} style={styles.tableCell}>
                    <Spans spans={cell} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      );
    case 'code':
      return (
        <ThemedView type="backgroundElement" style={[styles.codeBlock, Shape.continuous, { borderColor: theme.border }]}>
          <ThemedText type="code" selectable>
            {block.text}
          </ThemedText>
        </ThemedView>
      );
  }
}

// Weight is the font family, not `fontWeight`: Android renders a custom family's `fontWeight: 700`
// as Regular, so bold spans and headings in answers silently lost their emphasis there.
const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  bold: { fontFamily: Fonts.bold },
  italic: { fontStyle: 'italic' },
  link: { textDecorationLine: 'underline' },
  listItem: { flexDirection: 'row', gap: Spacing.two },
  marker: { minWidth: Spacing.three, fontFamily: Fonts.semibold },
  listItemContent: { flex: 1 },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.small, overflow: 'hidden' },
  tableScroll: { minWidth: '100%' },
  tableRow: { flexDirection: 'row' },
  // A floor on cell width: `flex: 1` alone squeezed wide tables into one-word columns.
  tableCell: { flex: 1, minWidth: 120, paddingHorizontal: Spacing.two, paddingVertical: Spacing.two },
  codeBlock: { padding: Spacing.three, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.small },
});

const HEADING_LEVEL_STYLE = {
  1: { fontFamily: Fonts.bold, fontSize: 20, lineHeight: 28 },
  2: { fontFamily: Fonts.bold, fontSize: 18, lineHeight: 26 },
  3: { fontFamily: Fonts.semibold, fontSize: 16, lineHeight: 24 },
};
