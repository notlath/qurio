import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { StyleSheet, Text } from 'react-native';

import { PendingAnswer } from '@/components/composer';
import { InteractionRow } from '@/components/interaction-row';
import { Fonts } from '@/constants/theme';
import type { Feedback, Interaction } from '@/domain';

jest.mock('@/global.css', () => ({}));
jest.mock('@/qlik/context', () => ({
  useAnswersPort: () => ({ submitFeedback: jest.fn() }),
}));
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
])('gives an Answer with %s the full column', (_, markdown) => {
  const renderer = render(<InteractionRow interaction={interaction(markdown)} />);

  expect(style(bubble(renderer)).maxWidth).toBeUndefined();
  expect(style(bubble(renderer)).alignSelf).toBe('stretch');
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
