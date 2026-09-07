import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { StyleSheet, Text } from 'react-native';

import { InteractionRow } from '@/components/interaction-row';

jest.mock('@/global.css', () => ({}));
jest.mock('@/qlik/context', () => ({
  useAnswersPort: () => ({ submitFeedback: jest.fn() }),
}));

it('renders the question larger than the answer body', () => {
  let renderer!: TestRenderer.ReactTestRenderer;

  act(() => {
    renderer = TestRenderer.create(
      <InteractionRow
        interaction={{
          id: 'interaction-1',
          threadId: 'thread-1',
          question: 'Question text',
          answer: { blocks: [{ kind: 'text', markdown: 'Answer text' }], citations: [] },
          createdAt: '2026-09-07T00:00:00Z',
        }}
      />,
    );
  });

  const textNodes = renderer.root.findAllByType(Text);
  const question = textNodes.find((node) => node.props.children === 'Question text');
  const answer = textNodes.find((node) => node.props.children === 'Answer text');

  expect(StyleSheet.flatten(question?.props.style).fontSize).toBeGreaterThan(
    StyleSheet.flatten(answer?.props.style).fontSize,
  );
});
