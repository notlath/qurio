import type { Href } from 'expo-router';
import { Platform } from 'react-native';

import { useAssistantSelection } from '@/qlik/assistant-selection';
import { useAgenticAvailability, type AgenticAvailability } from './use-agentic-target';

type Selection = Pick<ReturnType<typeof useAssistantSelection>, 'assistants' | 'agentic' | 'loading' | 'error'>;

export type AgenticRow = { key: string; title: string; href: Href };

export const AGENTIC_NO_ACCESS =
  "You don't have access to the Agentic Assistant that your administrator set up. Ask your Tenant admin to give you access to its space.";

const opens = (id: string): Href => ({ pathname: '/assistant/agentic', params: { id } });

/**
 * What the selector offers for Agentic Assistants: the configured one, or else one row per
 * discovered one (ticket 10). Never on web (ADR-0005).
 */
export function agenticRows(availability: AgenticAvailability, selection: Selection): { rows: AgenticRow[]; noAccess: boolean } {
  const { assistants, agentic, loading, error } = selection;
  if (availability.status === 'ready') {
    // The list holds only the Assistants the Qlik User can view (#9). Once it has loaded without the
    // configured one, the embed would only show "No context selected" (#16). While it loads, or if it
    // fails, the app cannot tell, so it still offers the embed.
    const configuredId = availability.target.resourceId;
    const named = agentic.find(({ id }) => id === configuredId);
    if (named) {
      return { rows: [{ key: named.id, title: named.name, href: opens(named.id) }], noAccess: false };
    }
    const cannotView = !loading && !error && !assistants.some(({ id }) => id === configuredId);
    if (cannotView) return { rows: [], noAccess: true };
    return { rows: [{ key: configuredId, title: 'Open the Agentic Assistant', href: '/assistant/agentic' }], noAccess: false };
  }
  if (Platform.OS === 'web') return { rows: [], noAccess: false };
  return {
    rows: agentic.map((assistant) => ({
      key: assistant.id,
      title: assistant.name,
      href: opens(assistant.id),
    })),
    noAccess: false,
  };
}

export function useAgenticRows(): { rows: AgenticRow[]; noAccess: boolean } {
  return agenticRows(useAgenticAvailability(), useAssistantSelection());
}
