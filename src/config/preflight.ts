export type PreflightResult = { ok: true } | { ok: false; field: 'tenantHost'; message: string };

/**
 * Unauthenticated GET against the tenant's RFC 8414 OAuth authorization-server
 * metadata document (technical-proposal.md §3.1) — Qlik publishes no OIDC
 * discovery document, but this one is public, stable, and exists precisely
 * to make a typo'd or unreachable tenantHost surface here, not as a mystery
 * login failure later.
 */
export async function validateTenantHost(tenantHost: string): Promise<PreflightResult> {
  let response: Response;
  try {
    response = await fetch(`https://${tenantHost}/.well-known/oauth-authorization-server`);
  } catch {
    return {
      ok: false,
      field: 'tenantHost',
      message: `Could not reach "${tenantHost}". Check the hostname and your connection.`,
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      field: 'tenantHost',
      message: `Tenant "${tenantHost}" was not found (HTTP ${response.status}). Check the hostname.`,
    };
  }
  return { ok: true };
}
