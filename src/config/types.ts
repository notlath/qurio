export type TenantConfig = {
  tenantHost: string; // "acme.eu.qlikcloud.com" — no scheme, no trailing slash
  clientId: string; // Native OAuth client in that tenant
  assistantId: string;
  agenticAssistantId?: string; // Agentic Assistant for the embedded surface; absent hides it. Not the classic assistantId
  biometricTimeoutMs?: number;
};
