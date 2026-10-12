import { jsLiteral, quotedAttr } from './escape';
import { runtimeScript } from './runtime-script';

/** What the host can embed. `classic/app` is a PoC (ticket 20): opens on a device, not yet hardened. */
export type EmbedSurface = 'ai/agentic-assistant' | 'classic/app';

const ID_ATTRIBUTE: Record<EmbedSurface, string> = { 'ai/agentic-assistant': 'assistant-id', 'classic/app': 'app-id' };

export type EmbedPageInput = {
  tenantHost: string;
  clientId: string;
  surface: EmbedSurface;
  resourceId: string;
  session: string;
  /** Space kept clear below the embed, e.g. a floating tab bar (#13). Defaults to none. */
  bottomInset?: number;
};

export const tenantOriginOf = (tenantHost: string): string => `https://${tenantHost}`;

/**
 * Qlik's composer sits at the end of a scrollable container, not pinned to the page. When the
 * keyboard shrinks the page, the composer ends up below the visible part and the Android WebView
 * does not scroll that container to the focused field. So scroll the field's form into view once
 * the page has resized (#18). It needs no Qlik class names: it only reads the focused element.
 */
export const keyboardRevealScript = `(function(){
function reveal(){
var el=document.activeElement;
if(!el||!(el.tagName==='TEXTAREA'||el.tagName==='INPUT'||el.isContentEditable))return;
(el.closest('form')||el).scrollIntoView({block:'end'});
}
function soon(){setTimeout(reveal,150);}
window.addEventListener('resize',soon);
window.addEventListener('focusin',soon);
})();`;

/** A whole, non-negative number of pixels; anything else becomes 0. */
const insetPx = (inset: number | undefined): string => `${Math.max(0, Math.round(inset ?? 0)) || 0}px`;

/**
 * Changes the inset of a page that is already running, so the tab bar can move out of the way of
 * the keyboard without a reload. The WebView frame stays full-size: resizing it fights the
 * WebView's own keyboard handling on iOS (#13, #18). The resize event makes keyboardRevealScript
 * check the focused field again: a new inset moves the composer, and nothing else would. The
 * trailing true keeps the result quiet.
 */
export const bottomInsetScript = (inset: number): string =>
  `document.documentElement.style.setProperty('--bottom-inset','${insetPx(inset)}');window.dispatchEvent(new Event('resize'));true;`;

/** Generated in memory for each load and never written anywhere. */
export function embedPageHtml({ tenantHost, clientId, surface, resourceId, session, bottomInset }: EmbedPageInput): string {
  const tenantOrigin = tenantOriginOf(tenantHost);
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, interactive-widget=resizes-content" />
<script>${runtimeScript({ session, tenantOrigin })}
${keyboardRevealScript}</script>
<script crossorigin="anonymous" type="application/javascript"
  src="https://cdn.jsdelivr.net/npm/@qlik/embed-web-components@1/dist/index.min.js"
  onerror=${quotedAttr(
    `window.ReactNativeWebView.postMessage(JSON.stringify({v:1,session:${jsLiteral(session)},type:'load-failed'}))`,
  )}
  data-host=${quotedAttr(tenantOrigin)}
  data-client-id=${quotedAttr(clientId)}
  data-get-access-token="getAccessToken"></script>
<style>:root{--bottom-inset:${insetPx(bottomInset)}}html,body,qlik-embed{margin:0;height:100%;display:block}body{box-sizing:border-box;padding-bottom:var(--bottom-inset)}</style>
</head><body>
<qlik-embed ui=${quotedAttr(surface)} ${ID_ATTRIBUTE[surface]}=${quotedAttr(resourceId)}></qlik-embed>
</body></html>`;
}
