import { normalizeManagedConfig } from './managed';

test('undefined input normalises to undefined', () => {
  expect(normalizeManagedConfig(undefined)).toBeUndefined();
});

test('missing keys are omitted from the result rather than failing', () => {
  expect(normalizeManagedConfig({ tenantHost: 'acme.eu.qlikcloud.com' })).toEqual({
    tenantHost: 'acme.eu.qlikcloud.com',
  });
});

test('a wrong-typed field is dropped, not coerced', () => {
  expect(normalizeManagedConfig({ tenantHost: 12345, clientId: 'client-123' })).toEqual({
    clientId: 'client-123',
  });
});

test('an empty-string field is treated as absent', () => {
  expect(normalizeManagedConfig({ tenantHost: '', clientId: 'client-123' })).toEqual({
    clientId: 'client-123',
  });
});

test('biometricTimeoutMs delivered as a numeric string is coerced to a number', () => {
  expect(normalizeManagedConfig({ biometricTimeoutMs: '300000' })).toEqual({ biometricTimeoutMs: 300000 });
});

test('an invalid biometricTimeoutMs (non-numeric, zero, or negative) is dropped', () => {
  expect(normalizeManagedConfig({ biometricTimeoutMs: 'not-a-number' })).toEqual({});
  expect(normalizeManagedConfig({ biometricTimeoutMs: 0 })).toEqual({});
  expect(normalizeManagedConfig({ biometricTimeoutMs: -1 })).toEqual({});
});

test('a complete, well-typed raw object normalises to the same values', () => {
  expect(
    normalizeManagedConfig({
      tenantHost: 'acme.eu.qlikcloud.com',
      clientId: 'client-123',
      assistantId: 'assistant-456',
      biometricTimeoutMs: 300000,
    }),
  ).toEqual({
    tenantHost: 'acme.eu.qlikcloud.com',
    clientId: 'client-123',
    assistantId: 'assistant-456',
    biometricTimeoutMs: 300000,
  });
});

describe('agenticAssistantId', () => {
  it('is kept when delivered as a non-empty string', () => {
    expect(normalizeManagedConfig({ agenticAssistantId: 'agentic-789' })).toEqual({
      agenticAssistantId: 'agentic-789',
    });
  });

  it('is dropped, not coerced, when it has the wrong type', () => {
    expect(normalizeManagedConfig({ agenticAssistantId: 42 })).toEqual({});
    expect(normalizeManagedConfig({ agenticAssistantId: { id: 'x' } })).toEqual({});
    expect(normalizeManagedConfig({ agenticAssistantId: null })).toEqual({});
  });

  it('is treated as absent when blank', () => {
    expect(normalizeManagedConfig({ agenticAssistantId: '' })).toEqual({});
    expect(normalizeManagedConfig({ agenticAssistantId: '   ' })).toEqual({});
  });

  it('does not disturb an older payload that never mentions it', () => {
    expect(
      normalizeManagedConfig({ tenantHost: 'acme.eu.qlikcloud.com', clientId: 'c', assistantId: 'a' }),
    ).toEqual({ tenantHost: 'acme.eu.qlikcloud.com', clientId: 'c', assistantId: 'a' });
  });
});
