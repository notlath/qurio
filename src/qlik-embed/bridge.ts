import { jsLiteral } from './escape';

/** Why an embedded session cannot continue. Each maps to native guidance — never a login inside the WebView. */
export type HostFailure = 'token-unavailable' | 'navigation' | 'load-error';

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

/** The request id, or `null` for anything that is not a well-formed token request for this session. */
export function parseTokenRequest(raw: string, session: string): number | null {
  let message: unknown;
  try {
    message = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof message !== 'object' || message === null) return null;
  const { v, session: claimed, type, id } = message as Record<string, unknown>;
  if (v !== 1 || type !== 'token-request' || claimed !== session) return null;
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? id : null;
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
