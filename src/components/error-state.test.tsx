import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { ErrorState } from '@/components/error-state';
import { errorMessageFor } from '@/domain';

jest.mock('@/global.css', () => ({}));

function render() {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <ErrorState error={{ kind: 'ServiceUnavailable' }} erroredAt={0} onRetry={jest.fn()} onDismiss={jest.fn()} />,
    );
  });
  return renderer;
}

it('lets the error title and message be selected, so they can be copied into a support request', () => {
  const { title, message } = errorMessageFor({ kind: 'ServiceUnavailable' });
  const texts = render().root.findAllByType(Text);
  const byContent = (content: string) => texts.find((node) => node.props.children === content);

  expect(byContent(title)?.props.selectable).toBe(true);
  expect(byContent(message)?.props.selectable).toBe(true);
});

it('is announced as an alert when it appears', () => {
  const alert = render().root.findAll((node) => node.props.accessibilityRole === 'alert');

  expect(alert.length).toBeGreaterThan(0);
});
