import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { resolveCurrentTenantConfig, type TenantConfig } from '@/config';
import { useAnswersPort } from '@/qlik/context';
import { agenticTargetFor, type AgenticTarget } from './agentic-target';

export type AgenticAvailability =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'ready'; config: TenantConfig; target: AgenticTarget };

/**
 * Whether the Agentic Assistant can be opened right now. Web never can (ADR-0005). Re-resolves
 * whenever the port is rebuilt, which is what Settings does after a save or a sign-in change.
 */
export function useAgenticAvailability(discoveredId?: string): AgenticAvailability {
  const port = useAnswersPort();
  const [availability, setAvailability] = useState<AgenticAvailability>(
    Platform.OS === 'web' ? { status: 'unavailable' } : { status: 'loading' },
  );

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let current = true;
    resolveCurrentTenantConfig().then(
      (config) => {
        const target = agenticTargetFor(config, discoveredId);
        if (current) setAvailability(config && target ? { status: 'ready', config, target } : { status: 'unavailable' });
      },
      () => current && setAvailability({ status: 'unavailable' }),
    );
    return () => {
      current = false;
    };
  }, [port, discoveredId]);

  return availability;
}
