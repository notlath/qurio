import { useQlikAuth } from './session.web';

describe('useQlikAuth on web', () => {
  it('throws because Qlik authentication is native-only (ADR-0005)', () => {
    expect(() => useQlikAuth()).toThrow(/native-only/i);
  });
});
