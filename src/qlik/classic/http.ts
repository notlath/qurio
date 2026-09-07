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

export function assistantUrl(config: TenantConfig, path: string): string {
  if (path.startsWith('https://')) return path;
  return `https://${config.tenantHost}/api/v1/assistants/${config.assistantId}${path}`;
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
  const token = await deps.getToken();
  if (!token) throw { kind: 'SessionExpired' } satisfies AppError;

  let response: R;
  try {
    response = await deps.fetch(assistantUrl(config, path), {
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

  if (!response.ok) throw toDomainError(response);
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
