import { gridLayout, MIN_CARD_WIDTH } from '@/components/apps-grid';

jest.mock('@/global.css', () => ({}));

describe('gridLayout', () => {
  it.each([
    [300, 1],
    [328, 2], // 360px phone
    [416, 2], // 768px window beside the docked panel
    [672, 4], // 1024px window beside the docked panel
    [1088, 4], // 1440px window beside the docked panel
    [520, 3],
  ])('fits %ipx of content in %i columns', (width, columns) => {
    expect(gridLayout(width).columns).toBe(columns);
  });

  it('narrows the gap before it drops a column', () => {
    expect(gridLayout(4 * MIN_CARD_WIDTH + 3 * 8).columns).toBe(4);
    expect(gridLayout(4 * MIN_CARD_WIDTH + 3 * 8).gap).toBe(8);
    expect(gridLayout(4 * MIN_CARD_WIDTH + 3 * 16).gap).toBe(16);
  });

  it('never overflows the content width', () => {
    for (let width = 200; width <= 1600; width += 7) {
      const { columns, gap, cardWidth } = gridLayout(width);
      expect(columns * cardWidth + (columns - 1) * gap).toBeLessThanOrEqual(width);
    }
  });
});
