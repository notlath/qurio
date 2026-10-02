import { IS_INTERNAL_BUILD } from '@/config';

/**
 * Device-validation trace, visible in the Metro terminal while a development client is attached
 * (ticket 19/21 evidence). Internal builds only; callers pass no tokens, no Answer content and
 * only `safeUrl`ed URLs.
 */
export function hostTrace(event: string): void {
  if (IS_INTERNAL_BUILD) console.warn(`[qlik-embed] ${event}`);
}
