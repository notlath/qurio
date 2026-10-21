import { Spacing } from '@/constants/theme';

/** The narrowest card that keeps a two-line name and the cover readable. */
export const MIN_CARD_WIDTH = 160;
const MAX_COLUMNS = 4;
// Wider gaps first. A column drops only when even the narrowest gap leaves cards under the minimum.
const GAPS = [Spacing.three, Spacing.two] as const;

/** The most columns, up to four, whose cards fit `contentWidth` at `MIN_CARD_WIDTH` or wider. */
export function gridLayout(contentWidth: number): { columns: number; gap: number; cardWidth: number } {
  for (let columns = MAX_COLUMNS; columns > 1; columns--) {
    for (const gap of GAPS) {
      const cardWidth = Math.floor((contentWidth - gap * (columns - 1)) / columns);
      if (cardWidth >= MIN_CARD_WIDTH) return { columns, gap, cardWidth };
    }
  }
  return { columns: 1, gap: Spacing.two, cardWidth: Math.max(0, Math.floor(contentWidth)) };
}
