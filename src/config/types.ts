export type TenantConfig = {
  tenantHost: string; // "acme.eu.qlikcloud.com" — no scheme, no trailing slash
  clientId: string; // Native OAuth client in that tenant
  assistantId: string;
  agenticAssistantId?: string; // Agentic Assistant for the embedded surface; absent hides it. Not the classic assistantId
  biometricTimeoutMs?: number;
};

/** What sign-in needs. The Assistant is chosen after sign-in, so its ID may not be known yet (ADR-0010). */
export type ResolvedTenantConfig = Omit<TenantConfig, 'assistantId'> & { assistantId?: string };

/** Each way a configuration source can fail to resolve has its own result, so each gets its own message. */
export type TenantResolution =
  | { kind: 'resolved'; config: ResolvedTenantConfig }
  | { kind: 'not-configured' }
  | { kind: 'custom-domain'; tenantHost: string } // no region in the hostname, and no client ID supplied
  | { kind: 'unsupported-region'; tenantHost: string; region: string }; // MTC publishes no client there yet
