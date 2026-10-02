import { consumeStream } from './stream-session';

function fakeReader(chunks: string[]) {
  let i = 0;
  return {
    async read() {
      if (i < chunks.length) return { done: false as const, value: chunks[i++] };
      return { done: true as const, value: undefined };
    },
  };
}

describe('consumeStream', () => {
  it('accumulates delta text across chunks and returns the sources object', async () => {
    const reader = fakeReader(['{"output": "hello "}', '{"output": "world"}{"sources": []}']);
    const deltas: string[] = [];

    const result = await consumeStream(reader, { onDelta: (t) => deltas.push(t) });

    expect(deltas).toEqual(['hello ', 'world']);
    expect(result).toEqual({ text: 'hello world', rawSources: [], stopped: false });
  });

  it('stop preserves the partial answer accumulated so far, rather than deleting it', async () => {
    const controller = new AbortController();
    const reader = {
      read: jest
        .fn()
        // the abort happens concurrently with an in-flight read, same as a real Stop tap
        .mockImplementationOnce(async () => {
          controller.abort();
          return { done: false, value: '{"output": "partial"}' };
        })
        .mockImplementation(async () => {
          throw new Error('read() must not be called again once the signal is aborted');
        }),
    };

    const result = await consumeStream(reader, { onDelta: () => {}, signal: controller.signal });

    expect(result).toEqual({ text: 'partial', rawSources: [], stopped: true });
    expect(reader.read).toHaveBeenCalledTimes(1);
  });

  it('a truncated tail (connection closed mid-object, not stopped by the user) throws ServiceUnavailable', async () => {
    const reader = fakeReader(['{"output": "complete"}{"output": "cut off mid-ob']);

    await expect(consumeStream(reader, { onDelta: () => {} })).rejects.toEqual({
      kind: 'ServiceUnavailable',
    });
  });

  it('a clean end of stream with no trailing fragment does not throw', async () => {
    const reader = fakeReader(['{"output": "complete"}']);

    const result = await consumeStream(reader, { onDelta: () => {} });

    expect(result).toEqual({ text: 'complete', rawSources: [], stopped: false });
  });
});
