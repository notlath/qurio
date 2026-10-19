import { jsLiteral } from './escape';
import { tenantOriginOf } from './page';

/** Why an embedded session cannot continue. Each maps to native guidance — never a login inside the WebView. */
export type HostFailure = 'token-unavailable' | 'navigation' | 'load-error';

/**
 * Why the page wants a token: the runtime asked directly, an API call needs a bearer, the
 * runtime's /oauth/token exchange, or that exchange for the engine WebSocket. Asserted by the
 * page; `websocket` only makes the app ask the tenant for a narrower token, never a broader one.
 */
const TOKEN_PURPOSES = ['runtime', 'api', 'exchange', 'websocket'] as const;
export type TokenPurpose = (typeof TOKEN_PURPOSES)[number];

const isTokenPurpose = (value: unknown): value is TokenPurpose => TOKEN_PURPOSES.some((p) => p === value);

export type TokenSource = () => Promise<{ token: string; expiresAtMs: number } | null>;

export type TokenReply =
  | { session: string; id: number; ok: true; token: string; expiresIn: number }
  | { session: string; id: number; ok: false };

/**
 * Our own document loads at about:blank, data:, or the tenant origin root (when baseUrl is set).
 * Anything else at the top frame is Qlik trying to navigate us away — in practice its login page.
 */
export function isOwnPage(url: string, tenantOrigin: string): boolean {
  return url.startsWith('about:') || url.startsWith('data:') || url === tenantOrigin || url === `${tenantOrigin}/`;
}

/** Drops the query string and fragment (a login URL's query carries OAuth state) and reduces a data: URL, which is the whole page, to its scheme. */
export function safeUrl(url: string): string {
  if (url.startsWith('data:')) return 'data:';
  return url.split(/[?#]/)[0];
}

/** Platform error text can embed the URL that failed — scrub any URL in it the same way. */
export function safeText(text: string): string {
  return text.replace(/(?:https?|data):[^\s'"<>]*/g, safeUrl);
}

/** What the page may tell the app: it wants a token, or the Qlik script never loaded. */
export type HostMessage = { kind: 'token-request'; id: number; purpose: TokenPurpose } | { kind: 'load-failed' };

/** The message, or `null` for anything that is not a well-formed message for this session. */
export function parseHostMessage(raw: string, session: string): HostMessage | null {
  let message: unknown;
  try {
    message = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof message !== 'object' || message === null) return null;
  const { v, session: claimed, type, id, purpose } = message as Record<string, unknown>;
  if (v !== 1 || claimed !== session) return null;
  if (type === 'load-failed') return { kind: 'load-failed' };
  if (type !== 'token-request' || !isTokenPurpose(purpose)) return null;
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? { kind: 'token-request', id, purpose } : null;
}

/**
 * Answers one token request with a token from the app's own authority, and its remaining life
 * from the token's real expiry. Anything short of a token with time left is a refusal, which the
 * caller treats as session failure.
 */
export async function answerTokenRequest(
  id: number,
  session: string,
  source: TokenSource,
  now: number = Date.now(),
): Promise<TokenReply> {
  try {
    const current = await source();
    const expiresIn = current ? Math.floor((current.expiresAtMs - now) / 1000) : 0;
    if (!current || expiresIn <= 0) return { session, id, ok: false };
    return { session, id, ok: true, token: current.token, expiresIn };
  } catch {
    return { session, id, ok: false };
  }
}

/** The `clientId` claim of a JWT access token, or undefined when the token is opaque or has no such claim. */
function clientIdClaim(token: string): string | undefined {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.clientId === 'string' ? payload.clientId : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The engine WebSocket (an Analytics App) accepts only a temporary token minted for it by the
 * tenant's token exchange, which is what @qlik/api does in a browser. The page cannot make that
 * call — the tenant rejects its Origin (OAUTH-29) — but a native request carries no Origin.
 * PoC for ticket 20, shown to open an Analytics App on a device. The failure reason carries no token.
 */
export async function exchangeForWebSocketToken(
  config: { tenantHost: string; clientId: string },
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; token: string; expiresIn: number } | { ok: false; reason: string }> {
  const origin = tenantOriginOf(config.tenantHost);
  // Qlik refuses a body client ID that differs from the one in the subject token (OAUTH-31). A Metadata Client
  // gets its own client ID inside the token, which is not the document's address.
  const tokenClientId = clientIdClaim(accessToken);
  try {
    const response = await fetchImpl(`${origin}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subject_token: accessToken,
        subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        purpose: 'websocket',
        redirect_uri: `${origin}/`,
        client_id: tokenClientId ?? config.clientId,
      }),
    });
    const body = await response.json().catch(() => null);
    if (response.ok && typeof body?.access_token === 'string') {
      return { ok: true, token: body.access_token, expiresIn: typeof body.expires_in === 'number' ? body.expires_in : 60 };
    }
    const error = body?.errors?.[0];
    const detail = typeof error?.detail === 'string' ? safeText(error.detail) : '';
    return { ok: false, reason: `http ${response.status} ${error?.code ?? ''} ${detail}${tokenClientId ? ` (token client ${tokenClientId})` : ''}`.replace(/\s+/g, ' ').trim() };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? safeText(e.message) : 'network error' };
  }
}

/** Script injected into the page to deliver a reply. The page only honours its own session. */
export function replyScript(reply: TokenReply): string {
  return `window.__qlikHost && window.__qlikHost.reply(${jsLiteral(reply)}); true;`;
}

export function guidanceFor(failure: HostFailure): { title: string; message: string } {
  switch (failure) {
    case 'token-unavailable':
      return {
        title: 'Please sign in again',
        message: 'Your session has ended. Sign in again from Settings, then come back to the Assistant.',
      };
    case 'navigation':
      return {
        title: 'The Assistant needs you to sign in again',
        message: 'Qlik asked for a separate sign-in, which this app does not do inside the Assistant. Sign in again from Settings, then reopen it.',
      };
    case 'load-error':
      return {
        title: 'The Assistant could not load',
        message: 'Check your connection and try again.',
      };
  }
}
