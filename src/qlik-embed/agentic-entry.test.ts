import { agenticRows } from './agentic-entry';

jest.mock('@/global.css', () => ({}));
jest.mock('@/qlik/assistant-selection', () => ({ useAssistantSelection: jest.fn() }));
jest.mock('./use-agentic-target', () => ({ useAgenticAvailability: jest.fn() }));

const ready = {
  status: 'ready',
  config: { tenantHost: 'acme.sg.qlikcloud.com', clientId: 'c', assistantId: 'a', agenticAssistantId: 'g' },
  target: { surface: 'ai/agentic-assistant', resourceId: 'g' },
} as const;
const unavailable = { status: 'unavailable' } as const;
const clock = { id: 'clock', kind: 'agentic', name: 'ClockSense AI', description: '' } as const;
const configured = { id: 'g', kind: 'agentic', name: 'Configured', description: 'Sales questions' } as const;
const loaded = { assistants: [], agentic: [clock, configured], loading: false, error: null };

it('names the configured Agentic Assistant when the list has it, and shows only that one', () => {
  const { rows, noAccess } = agenticRows(ready, loaded);

  expect(noAccess).toBe(false);
  expect(rows).toEqual([
    { key: 'g', title: 'Configured', href: { pathname: '/assistant/agentic', params: { id: 'g' } } },
  ]);
});

it('lists every discovered Agentic Assistant, each opened by its id, when none is configured', () => {
  const { rows } = agenticRows(unavailable, loaded);

  expect(rows.map((row) => row.title)).toEqual(['ClockSense AI', 'Configured']);
  expect(rows[0].href).toEqual({ pathname: '/assistant/agentic', params: { id: 'clock' } });
});

describe('a Qlik User who cannot see the configured Agentic Assistant (#16)', () => {
  it('gets the no-access message instead of an embed that shows "No context selected"', () => {
    const result = agenticRows(ready, { ...loaded, agentic: [clock] });

    expect(result).toEqual({ rows: [], noAccess: true });
  });

  it('still opens the embed when the configured Assistant is in the list as a classic Assistant', () => {
    const { rows, noAccess } = agenticRows(ready, { ...loaded, assistants: [{ ...configured, kind: 'classic' }], agentic: [] });

    expect(noAccess).toBe(false);
    expect(rows).toEqual([{ key: 'g', title: 'Open the Agentic Assistant', href: '/assistant/agentic' }]);
  });

  it('still opens the embed while the list loads, because the app cannot tell yet', () => {
    const { rows, noAccess } = agenticRows(ready, { assistants: [], agentic: [], loading: true, error: null });

    expect(noAccess).toBe(false);
    expect(rows).toHaveLength(1);
  });

  it('still opens the embed when the list failed to load, so a network error does not block the Qlik User', () => {
    const { rows, noAccess } = agenticRows(ready, { assistants: [], agentic: [], loading: false, error: { kind: 'ServiceUnavailable' } });

    expect(noAccess).toBe(false);
    expect(rows).toHaveLength(1);
  });
});

it('shows nothing when no Agentic Assistant is configured and none is discovered', () => {
  const result = agenticRows(unavailable, { assistants: [{ ...clock, kind: 'classic' }], agentic: [], loading: false, error: null });

  expect(result).toEqual({ rows: [], noAccess: false });
});
