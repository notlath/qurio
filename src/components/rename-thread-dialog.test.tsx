import { TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { RenameThreadDialog } from '@/components/rename-thread-dialog';
import type { Thread } from '@/domain';

jest.mock('@/global.css', () => ({}));

const thread: Thread = { id: 'thread-1', name: 'Q3 policy changes', createdAt: '', updatedAt: '' };

async function renderDialog(onSave: (name: string) => Promise<boolean> = async () => true) {
  const onClose = jest.fn();
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<RenameThreadDialog thread={thread} onSave={onSave} onClose={onClose} />);
  });
  return { renderer, onClose };
}

const field = (renderer: TestRenderer.ReactTestRenderer) => renderer.root.findByType(TextInput);
const button = (renderer: TestRenderer.ReactTestRenderer, label: string) =>
  renderer.root.findAllByProps({ accessibilityLabel: label })[0];
const type = async (renderer: TestRenderer.ReactTestRenderer, text: string) => {
  await act(async () => field(renderer).props.onChangeText(text));
};

describe('RenameThreadDialog', () => {
  it('starts with the current name, and Save disabled because nothing changed', async () => {
    const { renderer } = await renderDialog();

    expect(field(renderer).props.value).toBe('Q3 policy changes');
    expect(button(renderer, 'Save').props.disabled).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['the current name with spaces around it', '  Q3 policy changes '],
  ])('keeps Save disabled for a name that is %s', async (_, text) => {
    const { renderer } = await renderDialog();

    await type(renderer, text);
    expect(button(renderer, 'Save').props.disabled).toBe(true);
  });

  it('saves the new name without the spaces around it, then closes', async () => {
    const onSave = jest.fn().mockResolvedValue(true);
    const { renderer, onClose } = await renderDialog(onSave);

    await type(renderer, ' Travel policy ');
    expect(button(renderer, 'Save').props.disabled).toBe(false);
    await act(async () => button(renderer, 'Save').props.onPress());
    expect(onSave).toHaveBeenCalledWith('Travel policy');
    expect(onClose).toHaveBeenCalled();
  });

  it('stays open with the draft when the save fails', async () => {
    const { renderer, onClose } = await renderDialog(async () => false);

    await type(renderer, 'Travel policy');
    await act(async () => button(renderer, 'Save').props.onPress());
    expect(onClose).not.toHaveBeenCalled();
    expect(field(renderer).props.value).toBe('Travel policy');
    expect(button(renderer, 'Save').props.disabled).toBe(false);
  });

  it('closes on Cancel without saving', async () => {
    const onSave = jest.fn();
    const { renderer, onClose } = await renderDialog(onSave);

    await type(renderer, 'Travel policy');
    await act(async () => button(renderer, 'Cancel').props.onPress());
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
