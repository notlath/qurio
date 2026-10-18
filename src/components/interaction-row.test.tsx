import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { PendingAnswer } from '@/components/composer';
import { InteractionRow } from '@/components/interaction-row';
import { Colors, Fonts } from '@/constants/theme';
import type { Feedback, Interaction } from '@/domain';

jest.mock('@/global.css', () => ({}));
jest.mock('@/qlik/context', () => ({
  useAnswersPort: () => ({ submitFeedback: jest.fn() }),
}));
// Reanimated's worklets do not load under Jest, so each library's own mock stands in.
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
// Its mock has no useReducedMotion, so the tests run with Reduce Motion off.
jest.mock('react-native-reanimated', () => ({ ...jest.requireActual('react-native-reanimated/mock'), useReducedMotion: () => false }));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardChatScrollView: () => null,
  KeyboardStickyView: () => null,
}));

const interaction = (markdown: string, feedback?: Feedback): Interaction => ({
  id: 'interaction-1',
  threadId: 'thread-1',
  question: 'Question text',
  answer: {
    blocks: [{ kind: 'text', markdown }],
    citations: [{ documentId: 'd', knowledgeBaseId: 'k', documentPath: 'Handbook.pdf', excerpts: [] }],
  },
  feedback,
  createdAt: '2026-09-07T00:00:00Z',
});

function render(element: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer;
}

const style = (node: TestRenderer.ReactTestInstance | undefined) => StyleSheet.flatten(node?.props.style);
const textNode = (renderer: TestRenderer.ReactTestRenderer, text: string) =>
  renderer.root.findAllByType(Text).find((node) => node.props.children === text);
const bubble = (renderer: TestRenderer.ReactTestRenderer) => renderer.root.findByProps({ testID: 'answer-bubble' });

it('sets the question at the same size as the Answer, in the regular weight', () => {
  const renderer = render(<InteractionRow interaction={interaction('Answer text')} />);

  expect(style(textNode(renderer, 'Question text')).fontSize).toBe(16);
  expect(style(textNode(renderer, 'Question text')).fontFamily).toBe(Fonts.regular);
  expect(style(textNode(renderer, 'Answer text')).fontSize).toBe(16);
});

it('puts only the Answer text in the bubble, with Sources and Feedback below it', () => {
  const renderer = render(<InteractionRow interaction={interaction('Answer text')} />);

  expect(bubble(renderer).findAll((node) => node.props.children === 'Answer text').length).toBeGreaterThan(0);
  expect(bubble(renderer).findAllByProps({ accessibilityLabel: 'Helpful' })).toHaveLength(0);
  expect(bubble(renderer).findAllByProps({ accessibilityLabel: 'Show 1 source' })).toHaveLength(0);
});

it('lets a short Answer hug its text, up to 85% of the column', () => {
  const renderer = render(<InteractionRow interaction={interaction('Answer text')} />);

  expect(style(bubble(renderer))).toMatchObject({ alignSelf: 'flex-start', maxWidth: '85%' });
});

it.each([
  ['a table', '| A | B |\n|---|---|\n| 1 | 2 |'],
  ['a code block', '```\ncode\n```'],
  ['several paragraphs', 'First paragraph.\n\nSecond paragraph.'],
])('gives an Answer with %s the full column', (_, markdown) => {
  const renderer = render(<InteractionRow interaction={interaction(markdown)} />);

  expect(style(bubble(renderer)).maxWidth).toBeUndefined();
  expect(style(bubble(renderer)).alignSelf).toBe('stretch');
});

it('says when there is no Answer, and offers no Feedback for it', () => {
  const stopped = { ...interaction(''), answer: { blocks: [{ kind: 'text' as const, markdown: '' }], citations: [] } };
  const renderer = render(<InteractionRow interaction={stopped} />);

  expect(bubble(renderer).findAll((node) => node.props.children === 'No Answer was given. It may have been stopped before it started.').length).toBeGreaterThan(0);
  expect(renderer.root.findAllByProps({ accessibilityLabel: 'Helpful' })).toHaveLength(0);
});

const WIDE_TABLE = [
  '| Office | Per diem (SGD) | Approver |',
  '|---|---|---|',
  '| Jakarta | 1,284,500.00 IDR | Regional Head of People & Culture |',
].join('\n');

it('sizes each table column to its longest cell, the same width in every row', () => {
  const renderer = render(<InteractionRow interaction={interaction(WIDE_TABLE)} />);
  const widthOf = (text: string) =>
    style(renderer.root.findAll((node) => node.props.testID === 'table-cell' && node.findAll((n) => n.props.children === text).length > 0)[0]).width;

  expect(widthOf('Office')).toBe(widthOf('Jakarta'));
  expect(widthOf('Approver')).toBe(widthOf('Regional Head of People & Culture'));
  expect(widthOf('Approver')).toBeGreaterThan(widthOf('Office') as number);
});

it('shows the scroll bar and says how many columns there are when a table is wider than the bubble', () => {
  const renderer = render(<InteractionRow interaction={interaction(WIDE_TABLE)} />);
  const table = renderer.root.findByProps({ testID: 'table-scroll' });
  expect(table.props.showsHorizontalScrollIndicator).toBe(true);

  act(() => {
    table.props.onLayout({ nativeEvent: { layout: { width: 200, height: 100, x: 0, y: 0 } } });
  });

  expect(renderer.root.findAll((node) => node.props.children === 'Scroll sideways to see all 3 columns').length).toBeGreaterThan(0);
});

it('says nothing about scrolling when the whole table is in view', () => {
  const renderer = render(<InteractionRow interaction={interaction('| Aspect | Description |\n|---|---|\n| Nature | Small changes |')} />);

  act(() => {
    renderer.root.findByProps({ testID: 'table-scroll' }).props.onLayout({ nativeEvent: { layout: { width: 440, height: 100, x: 0, y: 0 } } });
  });

  expect(renderer.root.findAll((node) => typeof node.props.children === 'string' && node.props.children.startsWith('Scroll sideways'))).toHaveLength(0);
});

it('scrolls a code block sideways instead of wrapping its lines', () => {
  const renderer = render(<InteractionRow interaction={interaction('```\nSum({<Year={2026}>}Amount)\n```')} />);
  const scroller = renderer.root.findAllByType(ScrollView).find((node) => node.findAll((n) => n.props.children === 'Sum({<Year={2026}>}Amount)').length > 0);

  expect(scroller?.props.horizontal).toBe(true);
  expect(scroller?.props.showsHorizontalScrollIndicator).toBe(true);
});

it('sets Answer headings in the body size, in semibold', () => {
  const renderer = render(<InteractionRow interaction={interaction('# Core Concept')} />);

  expect(style(textNode(renderer, 'Core Concept'))).toMatchObject({ fontSize: 16, fontFamily: Fonts.semibold });
});

it('sets a link inside an Answer at the size of the text around it', () => {
  const renderer = render(<InteractionRow interaction={interaction('See [the site](https://example.com) now')} />);

  expect(style(textNode(renderer, 'the site')).fontSize).toBe(16);
});

it('keeps the Feedback text at the 14pt secondary size', () => {
  const done = render(<InteractionRow interaction={interaction('Answer text', { vote: 1 })} />);
  expect(style(textNode(done, 'You marked this helpful.')).fontSize).toBe(14);

  const open = render(<InteractionRow interaction={interaction('Answer text')} />);
  act(() => {
    open.root.findByProps({ accessibilityLabel: 'Not helpful' }).props.onPress();
  });
  expect(style(textNode(open, 'Cancel')).fontSize).toBe(14);
  expect(style(textNode(open, 'Submit feedback')).fontSize).toBe(14);
});

it('shows a waiting Answer in the same bubble, with dots and what it is doing', () => {
  const renderer = render(<PendingAnswer question="Question text" partialAnswer="" />);

  expect(bubble(renderer).findAll((node) => node.props.children === 'Searching your knowledge base…').length).toBeGreaterThan(0);
  expect(bubble(renderer).findAllByProps({ testID: 'typing-dots' }).length).toBeGreaterThan(0);
});

it('streams the partial Answer into that same bubble', () => {
  const renderer = render(<PendingAnswer question="Question text" partialAnswer="Partial answer" />);

  expect(bubble(renderer).findAll((node) => node.props.children === 'Partial answer').length).toBeGreaterThan(0);
});

describe('the polish pass', () => {
  const question = (renderer: TestRenderer.ReactTestRenderer) => renderer.root.findByProps({ testID: 'question-bubble' });

  it('gives the question and Answer bubbles one padding, one corner radius and one width cap', () => {
    const renderer = render(<InteractionRow interaction={interaction('Answer text')} />);
    const q = style(question(renderer));
    const a = style(bubble(renderer));

    expect(q.paddingVertical).toBe(a.paddingVertical);
    expect(q.paddingHorizontal).toBe(a.paddingHorizontal);
    expect(q.borderRadius).toBe(a.borderRadius);
    expect(q.maxWidth).toBe('85%');
    expect(a.maxWidth).toBe('85%');
  });

  it('draws the waiting question with the same bubble as a sent one', () => {
    const pending = render(<PendingAnswer question="Question text" partialAnswer="" />);
    const sent = render(<InteractionRow interaction={interaction('Answer text')} />);

    expect(style(question(pending))).toEqual(style(question(sent)));
  });

  it('puts the Sources toggle and the Feedback buttons in one row under the Answer', () => {
    const renderer = render(<InteractionRow interaction={interaction('Answer text')} />);
    const actions = renderer.root.findByProps({ testID: 'answer-actions' });

    expect(style(actions).flexDirection).toBe('row');
    expect(actions.findAllByProps({ accessibilityLabel: 'Show 1 source' }).length).toBeGreaterThan(0);
    expect(actions.findAllByProps({ accessibilityLabel: 'Helpful' }).length).toBeGreaterThan(0);
  });

  it('opens the Sources below that row', () => {
    const renderer = render(<InteractionRow interaction={interaction('Answer text')} />);
    act(() => {
      renderer.root.findAllByProps({ accessibilityLabel: 'Show 1 source' })[0].props.onPress();
    });

    expect(textNode(renderer, 'Handbook.pdf')).toBeDefined();
    expect(renderer.root.findByProps({ testID: 'answer-actions' }).findAll((node) => node.props.children === 'Handbook.pdf')).toHaveLength(0);
  });

  it('sets a code block on the page colour, so it reads as a well inside the bubble', () => {
    const renderer = render(<InteractionRow interaction={interaction('```\ncode\n```')} />);

    // The innermost node with the test ID is the View that ThemedView paints.
    const block = renderer.root.findAll((node) => node.props.testID === 'code-block').pop();

    expect(style(block).backgroundColor).toBe(Colors.light.background);
  });
});

describe('motion', () => {
  it('pulses three dots while the Answer is on its way, hidden from screen readers, which hear the text', () => {
    const renderer = render(<PendingAnswer question="Question text" partialAnswer="" />);
    const dots = renderer.root.findAll((node) => node.props.testID === 'typing-dot');

    expect(dots.length).toBeGreaterThanOrEqual(3);
    expect(renderer.root.findAll((node) => node.props.testID === 'typing-dots').pop()?.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('brings the sent question in with an entrance', () => {
    const renderer = render(<PendingAnswer question="Question text" partialAnswer="" />);

    expect(renderer.root.findByProps({ testID: 'pending-question' }).props.entering).toBeDefined();
  });

  it('gives a streaming Answer the full column from its first word, so it never widens mid-sentence', () => {
    const renderer = render(<PendingAnswer question="Question text" partialAnswer="Yes" />);

    expect(style(bubble(renderer)).alignSelf).toBe('stretch');
  });
});
