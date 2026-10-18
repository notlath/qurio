import type { TenantConfig } from '@/config';
import type { EmbedSurface } from './page';

export type QlikEmbedHostProps = {
  config: TenantConfig;
  surface: EmbedSurface;
  /** The Qlik object to open — the Agentic Assistant's id for `ai/agentic-assistant`. */
  resourceId: string;
  /** Space the embed keeps clear below its content, e.g. a floating tab bar. Changes apply to the running page. */
  bottomInset?: number;
};
