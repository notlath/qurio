import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

import { parseAnswerMarkdown, type AnswerRenderBlock, type InlineSpan } from './answer-markdown';

function Spans({ spans }: { spans: InlineSpan[] }) {
  return (
    <ThemedText>
      {spans.map((span, index) =>
        span.href ? (
          <ThemedText key={index} type="linkPrimary" onPress={() => Linking.openURL(span.href!)}>
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
    <ThemedView style={styles.container}>
      {blocks.map((block, index) => (
        <Block key={index} block={block} numberedIndex={numberedIndices[index]} />
      ))}
    </ThemedView>
  );
}

function Block({ block, numberedIndex }: { block: AnswerRenderBlock; numberedIndex: number }) {
  switch (block.kind) {
    case 'paragraph':
      return <Spans spans={block.spans} />;
    case 'heading':
      return (
        <ThemedText style={HEADING_LEVEL_STYLE[block.level]}>
          <Spans spans={block.spans} />
        </ThemedText>
      );
    case 'numberedListItem':
      return (
        <View style={styles.listItem}>
          <ThemedText>{numberedIndex}.</ThemedText>
          <View style={styles.listItemContent}>
            <Spans spans={block.spans} />
          </View>
        </View>
      );
    case 'bulletListItem':
      return (
        <View style={styles.listItem}>
          <ThemedText>{'•'}</ThemedText>
          <View style={styles.listItemContent}>
            <Spans spans={block.spans} />
          </View>
        </View>
      );
    case 'table':
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScroll}>
          <View style={styles.table}>
          {block.rows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.tableRow}>
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
        <ThemedView type="backgroundElement" style={styles.codeBlock}>
          <ThemedText type="code">{block.text}</ThemedText>
        </ThemedView>
      );
  }
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  listItem: { flexDirection: 'row', gap: Spacing.one },
  listItemContent: { flex: 1 },
  table: { gap: Spacing.half },
  tableScroll: { minWidth: '100%' },
  tableRow: { flexDirection: 'row', gap: Spacing.two },
  tableCell: { flex: 1 },
  codeBlock: { padding: Spacing.two, borderRadius: Spacing.one },
});

const HEADING_LEVEL_STYLE = {
  1: { fontSize: 20, fontWeight: '700' as const },
  2: { fontSize: 18, fontWeight: '700' as const },
  3: { fontSize: 16, fontWeight: '700' as const },
};
