import { useState } from 'react';
import { Linking, PixelRatio, ScrollView, StyleSheet, View, type TextStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Radius, Shape, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { parseAnswerMarkdown, type AnswerRenderBlock, type InlineSpan } from './answer-markdown';

/**
 * Each span is its own ThemedText, which sets the body font again. So the block's own style (a
 * heading's weight) is passed down to every span: set only on the outer text, headings rendered in
 * the regular weight. A link keeps the size of the text around it and adds only colour and underline.
 */
function Spans({ spans, style, header }: { spans: InlineSpan[]; style?: TextStyle; header?: boolean }) {
  const theme = useTheme();

  return (
    <ThemedText selectable accessibilityRole={header ? 'header' : undefined} style={style}>
      {spans.map((span, index) =>
        span.href ? (
          <ThemedText
            key={index}
            accessibilityRole="link"
            style={[style, styles.link, { color: theme.primary }]}
            onPress={() => Linking.openURL(span.href!)}>
            {span.text}
          </ThemedText>
        ) : (
          <ThemedText key={index} style={[style, span.bold && styles.bold, span.italic && styles.italic]}>
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
      return <Spans spans={block.spans} style={styles.heading} header />;
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
      return <Table rows={block.rows} />;
    case 'code':
      return (
        // The page colour, not the bubble's: on the same fill only a hairline showed where the code began.
        <ThemedView testID="code-block" type="background" style={[styles.codeBlock, Shape.continuous, { borderColor: theme.border }]}>
          {/* Sideways, never wrapped: a wrapped expression split inside tokens and could not be read as written. */}
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.codeScroll}>
            <ThemedText type="code" selectable>
              {block.text}
            </ThemedText>
          </ScrollView>
        </ThemedView>
      );
  }
}

/** Average Body glyph width, used to size a column from its longest cell before layout. */
const CHAR_WIDTH = 8;
const COLUMN_MIN = 96;
const COLUMN_MAX = 240;

/**
 * One width per column, from its longest cell, so every row lines up. A fixed width per cell cut
 * columns off at the bubble edge, and the numbers in them mid-figure. Scales with the text size.
 */
function columnWidths(rows: InlineSpan[][][]): number[] {
  const columns = Math.max(...rows.map((row) => row.length));
  const scale = PixelRatio.getFontScale();
  return Array.from({ length: columns }, (_, column) => {
    const longest = Math.max(0, ...rows.map((row) => (row[column] ?? []).reduce((length, span) => length + span.text.length, 0)));
    return Math.min(COLUMN_MAX * scale, Math.max(COLUMN_MIN * scale, longest * CHAR_WIDTH * scale + Spacing.two * 2));
  });
}

/**
 * A table scrolls sideways across the full bubble, edge to edge. When it is wider than the bubble,
 * the scroll bar shows and a line below says so: hidden columns gave no sign that they existed.
 */
function Table({ rows }: { rows: InlineSpan[][][] }) {
  const theme = useTheme();
  const [viewWidth, setViewWidth] = useState(0);
  const widths = columnWidths(rows);
  const tableWidth = widths.reduce((sum, width) => sum + width, StyleSheet.hairlineWidth * 2);
  // The table starts one inset in from the bubble's left edge, and may run to its right edge.
  const overflows = viewWidth > 0 && tableWidth > viewWidth - BUBBLE_INSET;

  return (
    <View style={styles.tableBlock}>
      <ScrollView
        testID="table-scroll"
        horizontal
        showsHorizontalScrollIndicator
        onLayout={(event) => setViewWidth(event.nativeEvent.layout.width)}
        style={styles.tableBleed}
        contentContainerStyle={styles.tableScroll}>
        <View style={[styles.table, Shape.continuous, { borderColor: theme.border }]}>
          {rows.map((row, rowIndex) => (
            <View
              key={rowIndex}
              style={[
                styles.tableRow,
                rowIndex > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
                // The parser emits the header row first; it gets the tinted band.
                rowIndex === 0 && { backgroundColor: theme.backgroundSelected },
              ]}>
              {widths.map((width, cellIndex) => (
                <View key={cellIndex} testID="table-cell" style={[styles.tableCell, { width }]}>
                  <Spans spans={row[cellIndex] ?? []} />
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      {overflows && (
        <ThemedText type="small" themeColor="textSecondary">
          {`Scroll sideways to see all ${widths.length} columns`}
        </ThemedText>
      )}
    </View>
  );
}

/** The Answer bubble's horizontal padding (AnswerBubble), which a table bleeds through to the edge. */
const BUBBLE_INSET = Spacing.three;

// Weight is the font family, not `fontWeight`: Android renders a custom family's `fontWeight: 700`
// as Regular, so bold spans and headings in answers silently lost their emphasis there.
const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  bold: { fontFamily: Fonts.bold },
  // Every heading level is the body size in semibold: inside an Answer, weight marks a heading.
  // At 20pt, headings outshouted the text they introduce.
  heading: { fontFamily: Fonts.semibold, fontSize: 16, lineHeight: 24 },
  italic: { fontStyle: 'italic' },
  link: { textDecorationLine: 'underline' },
  listItem: { flexDirection: 'row', gap: Spacing.two },
  marker: { minWidth: Spacing.three, fontFamily: Fonts.semibold },
  listItemContent: { flex: 1 },
  tableBlock: { gap: Spacing.one },
  tableBleed: { marginHorizontal: -BUBBLE_INSET },
  tableScroll: { paddingHorizontal: BUBBLE_INSET },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.small, overflow: 'hidden' },
  tableRow: { flexDirection: 'row' },
  tableCell: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.two },
  codeBlock: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.small, overflow: 'hidden' },
  codeScroll: { padding: Spacing.three },
});
