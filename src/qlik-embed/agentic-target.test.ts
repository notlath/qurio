import { agenticTargetFor } from './agentic-target';

const base = { tenantHost: 'acme.sg.qlikcloud.com', clientId: 'client-1', assistantId: 'classic-assistant' };

describe('agenticTargetFor', () => {
  it('embeds the Agentic Assistant by its own identifier', () => {
    expect(agenticTargetFor({ ...base, agenticAssistantId: 'agentic-1' })).toEqual({
      surface: 'ai/agentic-assistant',
      resourceId: 'agentic-1',
    });
  });

  it('is null when no Agentic Assistant is configured — it never falls back to the classic assistantId', () => {
    expect(agenticTargetFor(base)).toBeNull();
    expect(agenticTargetFor({ ...base, agenticAssistantId: '' })).toBeNull();
    expect(agenticTargetFor({ ...base, agenticAssistantId: '   ' })).toBeNull();
  });

  it('opens a discovered Agentic Assistant when none is configured', () => {
    expect(agenticTargetFor(base, 'discovered-1')).toEqual({ surface: 'ai/agentic-assistant', resourceId: 'discovered-1' });
  });

  it('keeps a configured Agentic Assistant over a discovered one', () => {
    expect(agenticTargetFor({ ...base, agenticAssistantId: 'agentic-1' }, 'discovered-1')?.resourceId).toBe('agentic-1');
  });

  it('is null when there is no configuration at all', () => {
    expect(agenticTargetFor(null)).toBeNull();
  });
});
