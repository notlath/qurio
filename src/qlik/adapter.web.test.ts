import { createAnswersPort } from './adapter.web';

describe('createAnswersPort on web', () => {
  it('throws because the Qlik transport is native-only (ADR-0005)', () => {
    expect(() => createAnswersPort()).toThrow(/native-only/i);
  });
});
