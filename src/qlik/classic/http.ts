import type { TenantConfig } from '@/config';
import type { AppError } from '@/domain';

import { classifyFetchFailure, toDomainError } from './errors';

/** The subset of a fetch Response this module needs — satisfied by both `expo/fetch` and a test double. */
export type HttpResponse = {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
};

export type HttpInit = {
  method?: string;
  body?: unknown; // serialised here, so callers pass plain objects
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export type HttpDeps<R extends HttpResponse = HttpResponse> = {
  fetch(url: string, init: { method?: string; body?: string; headers: Record<string, string>; signal?: AbortSignal }): Promise<R>;
  getToken(): Promise<string | null>;
};

/** Qlik's list envelope — `links.next.href` is a whole URL, not a bare cursor (ticket-01 fixture 04). */
export type QlikList<T> = { data: T[]; links?: { next?: { href?: string } } };

/**
 * Resolves what a caller asked for to a URL on the configured Tenant: an `/api/` path is
 * tenant-level, any other relative path belongs to the Assistant, and an absolute URL (Qlik's
 * `links.next.href`) is accepted only if it stays on the Tenant. Every request carries a bearer
 * token, so a href pointing anywhere else must never be followed. A plain prefix check, because
 * parsing a URL for its host would need a URL implementation this runtime does not guarantee.
 */
export function qlikUrl(config: TenantConfig, path: string): string {
  const tenantOrigin = `https://${config.tenantHost}`;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) {
    if (path.startsWith(`${tenantOrigin}/`)) return path;
    throw { kind: 'ServiceUnavailable' } satisfies AppError;
  }
  if (path.startsWith('/api/')) return `${tenantOrigin}${path}`;
  if (!config.assistantId) throw { kind: 'AssistantNotChosen' } satisfies AppError;
  return `${tenantOrigin}/api/v1/assistants/${config.assistantId}${path}`;
}

export function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

/**
 * Every authenticated call to Qlik goes through here, so the token check and the
 * HTTP-status-to-AppError mapping exist once rather than per endpoint. Returns the
 * response rather than its body: the streaming ask needs the stream itself, and a
 * DELETE has no body to parse.
 */
export async function qlikFetch<R extends HttpResponse>(
  deps: HttpDeps<R>,
  config: TenantConfig,
  path: string,
  init: HttpInit = {},
): Promise<R> {
  // Resolved before the token is fetched: an off-tenant URL must not even cost a token refresh.
  const url = qlikUrl(config, path);
  // The Assistants list counts as an Assistant call: its 403 is a missing Answers Entitlement too.
  const scope = url.startsWith(`https://${config.tenantHost}/api/v1/assistants`) ? 'assistant' : 'tenant';

  const token = await deps.getToken();
  if (!token) throw { kind: 'SessionExpired' } satisfies AppError;

  let response: R;
  try {
    response = await deps.fetch(url, {
      method: init.method,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      headers: { ...authHeaders(token), ...init.headers },
      signal: init.signal,
    });
  } catch (error) {
    const domainError = classifyFetchFailure(error);
    if (!domainError) throw error; // a deliberate abort — the caller decides what that means
    throw domainError;
  }

  if (!response.ok) throw toDomainError(response, scope);
  return response;
}

export async function qlikJson<T, R extends HttpResponse = HttpResponse>(
  deps: HttpDeps<R>,
  config: TenantConfig,
  path: string,
  init: HttpInit = {},
): Promise<T> {
  const response = await qlikFetch(deps, config, path, init);
  return (await response.json()) as T;
}
