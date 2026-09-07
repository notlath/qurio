import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { resolveCurrentTenantConfig } from '@/config';
import type { AppError } from '@/domain';

import { createAnswersPort } from './adapter';
import { createFixtureAnswersPort } from './fixtures/port';
import type { AnswersPort } from './port';

const AnswersPortContext = createContext<AnswersPort | null>(null);

/**
 * Every call fails the same curated way when no TenantConfig resolved, rather than the
 * provider withholding the whole app: Settings and History stay reachable, so an internal
 * build can still be pointed at a tenant (ticket 14 does the same for MDM).
 */
const fail = async (): Promise<never> => {
  throw { kind: 'ConfigMissing' } satisfies AppError;
};

function createUnconfiguredPort(): AnswersPort {
  return {
    capabilities: { streaming: false, analyticsInsights: false },
    listThreads: fail,
    createThread: fail,
    getThread: fail,
    deleteThread: fail,
    ask: fail,
    listInteractions: fail,
    submitFeedback: fail,
    listStarters: fail,
  };
}

/**
 * Web has no Qlik transport at all (ADR-0005) and keeps the fixture port so the
 * layout stays previewable; native talks to the real tenant as soon as a config
 * resolves. Resolving is async, so children mount once — with the port they will
 * keep — rather than starting against a placeholder.
 */
export async function resolveAnswersPort(): Promise<AnswersPort> {
  if (Platform.OS === 'web') return createFixtureAnswersPort();
  const config = await resolveCurrentTenantConfig();
  return config ? createAnswersPort(config) : createUnconfiguredPort();
}

export function AnswersPortProvider({ children }: { children: ReactNode }) {
  const [port, setPort] = useState<AnswersPort | null>(null);

  useEffect(() => {
    resolveAnswersPort().then(setPort);
  }, []);

  if (!port) return null;
  return <AnswersPortContext.Provider value={port}>{children}</AnswersPortContext.Provider>;
}

export function useAnswersPort(): AnswersPort {
  const port = useContext(AnswersPortContext);
  if (!port) throw new Error('useAnswersPort must be used within an AnswersPortProvider');
  return port;
}
