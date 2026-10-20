export type TenantConfig = {
  tenantHost: string; // "acme.eu.qlikcloud.com" — no scheme, no trailing slash
  clientId: string; // Native OAuth client in that tenant
  assistantId?: string; // absent until the Assistant is chosen after sign-in (ADR-0010)
  agenticAssistantId?: string; // Agentic Assistant for the embedded surface; absent hides it. Not the classic assistantId
  biometricTimeoutMs?: number;
};

/** Each way a configuration source can fail to resolve has its own result, so each gets its own message. */
export type TenantResolution =
  | { kind: 'resolved'; config: TenantConfig }
  | { kind: 'not-configured' }
  | { kind: 'custom-domain'; tenantHost: string }; // no region in the hostname, and no client ID supplied
