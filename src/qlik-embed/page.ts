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
};

export const tenantOriginOf = (tenantHost: string): string => `https://${tenantHost}`;

/** Generated in memory for each load and never written anywhere. */
export function embedPageHtml({ tenantHost, clientId, surface, resourceId, session }: EmbedPageInput): string {
  const tenantOrigin = tenantOriginOf(tenantHost);
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script>${runtimeScript({ session, tenantOrigin })}</script>
<script crossorigin="anonymous" type="application/javascript"
  src="https://cdn.jsdelivr.net/npm/@qlik/embed-web-components@1/dist/index.min.js"
  onerror=${quotedAttr(
    `window.ReactNativeWebView.postMessage(JSON.stringify({v:1,session:${jsLiteral(session)},type:'load-failed'}))`,
  )}
  data-host=${quotedAttr(tenantOrigin)}
  data-client-id=${quotedAttr(clientId)}
  data-get-access-token="getAccessToken"></script>
<style>html,body,qlik-embed{margin:0;height:100%;display:block}</style>
</head><body>
<qlik-embed ui=${quotedAttr(surface)} ${ID_ATTRIBUTE[surface]}=${quotedAttr(resourceId)}></qlik-embed>
</body></html>`;
}
