import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { resolveCurrentTenantConfig, type TenantConfig } from '@/config';
import type { AppError, Assistant } from '@/domain';

import { createAnswersPort } from './adapter';
import { loadAssistantChoice, rememberAssistantChoice } from './assistant-choice';
import { AnswersScope, useAnswersPort } from './context';
import type { AnswersPort } from './port';

type Selection = {
  assistants: Assistant[];
  selected: Assistant | null;
  /** Discovered Agentic Assistants; opened in the embed, never chosen for classic Threads. */
  agentic: Assistant[];
  loading: boolean;
  error: AppError | null;
  choose(assistant: Assistant): Promise<void>;
  portFor(id?: string): AnswersPort;
};
const SelectionContext = createContext<Selection | null>(null);

export function AssistantSelectionProvider({ children }: { children: ReactNode }) {
  const base = useAnswersPort();
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [choice, setChoice] = useState<{ assistants: Assistant[]; selected: Assistant | null; agentic: Assistant[] } | null>(null);
  const [error, setError] = useState<AppError | null>(null);

  useEffect(() => {
    let current = true;
    async function load() {
      const resolved = Platform.OS === 'web' ? null : await resolveCurrentTenantConfig();
      const result = await loadAssistantChoice(base, resolved?.tenantHost ?? 'web-preview');
      if (current) {
        setConfig(resolved);
        setChoice(result);
      }
    }
    load().catch((failure: unknown) => {
      if (current) {
        setError(
          typeof failure === 'object' && failure !== null && 'kind' in failure
            ? failure as AppError
            : { kind: 'ServiceUnavailable' },
        );
      }
    });
    return () => {
      current = false;
    };
  }, [base]);

  const portFor = useCallback(
    (id?: string): AnswersPort => config ? createAnswersPort({ ...config, assistantId: id }) : base,
    [config, base],
  );
  const value = useMemo<Selection>(() => ({
    assistants: choice?.assistants ?? [],
    selected: choice?.selected ?? null,
    agentic: choice?.agentic ?? [],
    loading: !choice && !error,
    error,
    async choose(assistant) {
      await rememberAssistantChoice(config?.tenantHost ?? 'web-preview', assistant.id);
      setChoice((previous) => previous && { ...previous, selected: assistant });
    },
    portFor,
  }), [config, choice, error, portFor]);
  const selectedId = value.selected?.id;
  const selectedPort = useMemo(() => portFor(selectedId), [portFor, selectedId]);

  return (
    <SelectionContext.Provider value={value}>
      <AnswersScope port={selectedPort}>{children}</AnswersScope>
    </SelectionContext.Provider>
  );
}

export function useAssistantSelection(): Selection {
  const selection = useContext(SelectionContext);
  if (!selection) throw new Error('AssistantSelectionProvider is missing');
  return selection;
}
