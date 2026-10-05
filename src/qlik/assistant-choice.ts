import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Assistant } from '@/domain';
import type { AnswersPort } from './port';

const key = (tenantHost: string) => `qlik.lastAssistant.${tenantHost}`;

export async function rememberAssistantChoice(tenantHost: string, id: string): Promise<void> {
  await AsyncStorage.setItem(key(tenantHost), id);
}

export async function loadAssistantChoice(port: AnswersPort, tenantHost: string): Promise<{ assistants: Assistant[]; selected: Assistant | null }> {
  const [available, remembered] = await Promise.all([port.listAssistants(), AsyncStorage.getItem(key(tenantHost))]);
  const assistants = available.filter((assistant) => assistant.kind !== 'agentic');
  const selected = assistants.find((assistant) => assistant.id === remembered) ?? (assistants.length === 1 ? assistants[0] : null);
  if (selected) await rememberAssistantChoice(tenantHost, selected.id);
  return { assistants, selected };
}
