import type { TenantConfig } from '@/config';
import type { EmbedSurface } from './page';

export type AgenticTarget = { surface: EmbedSurface; resourceId: string };

/**
 * What the Assistant tab embeds, or `null` when this Tenant has no Agentic Assistant. Only
 * `agenticAssistantId` counts: the classic `assistantId` is a different object that the embed
 * cannot open, so it is never a fallback.
 */
export function agenticTargetFor(config: TenantConfig | null): AgenticTarget | null {
  const resourceId = config?.agenticAssistantId?.trim();
  return resourceId ? { surface: 'ai/agentic-assistant', resourceId } : null;
}
