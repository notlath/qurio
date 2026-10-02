import { jsLiteral } from './escape';

/**
 * The script that runs in the page before `qlik-embed` loads. Three parts, all demonstrated by the
 * spike (ADR-0009): a `getAccessToken` that asks the app for a token, a bearer on the runtime's
 * same-origin `fetch` calls except under `/oauth/`, and a locally answered `POST /oauth/token`.
 *
 * Tokens are pulled from the app on every use, never cached here, so each call sees the app's
 * current token and expiry. Only `fetch` is wrapped — the runtime's WebSocket or XHR traffic is
 * not covered (ticket 19).
 */
export function runtimeScript({ session, tenantOrigin }: { session: string; tenantOrigin: string }): string {
  return `(function () {
  var SESSION = ${jsLiteral(session)};
  var ORIGIN = ${jsLiteral(tenantOrigin)};
  var REPLY_TIMEOUT_MS = 20000;
  var pending = {};
  var seq = 0;

  function requestToken() {
    return new Promise(function (resolve, reject) {
      var id = ++seq;
      var timer = setTimeout(function () {
        delete pending[id];
        reject(new Error('token-timeout'));
      }, REPLY_TIMEOUT_MS);
      pending[id] = { resolve: resolve, reject: reject, timer: timer };
      window.ReactNativeWebView.postMessage(JSON.stringify({ v: 1, session: SESSION, type: 'token-request', id: id }));
    });
  }

  // Replies are accepted only for a request this page made, in this session.
  Object.defineProperty(window, '__qlikHost', {
    value: Object.freeze({
      reply: function (m) {
        if (!m || m.session !== SESSION) return;
        var p = pending[m.id];
        if (!p) return;
        delete pending[m.id];
        clearTimeout(p.timer);
        if (m.ok === true && typeof m.token === 'string' && typeof m.expiresIn === 'number') p.resolve(m);
        else p.reject(new Error('token-unavailable'));
      },
    }),
  });

  window.getAccessToken = function () {
    return requestToken().then(function (r) { return r.token; });
  };

  function jsonResponse(status, body) {
    return new Response(JSON.stringify(body), { status: status, headers: { 'content-type': 'application/json' } });
  }

  var originalFetch = window.fetch;
  window.fetch = function (input, init) {
    var target;
    try {
      target = new URL(String(input && input.url ? input.url : input), location.href);
    } catch (e) {
      return originalFetch(input, init);
    }
    if (target.origin !== ORIGIN) return originalFetch(input, init);

    var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();

    // The runtime's token exchange: the tenant rejects its browser Origin (OAUTH-29), so answer
    // it ourselves with the app's current token and that token's real remaining lifetime.
    if (target.pathname === '/oauth/token' && method === 'POST') {
      return requestToken().then(
        function (r) {
          return jsonResponse(200, {
            access_token: r.token,
            issued_token_type: 'urn:ietf:params:oauth:token-type:access_token',
            token_type: 'Bearer',
            expires_in: r.expiresIn,
          });
        },
        function () { return jsonResponse(503, { error: 'temporarily_unavailable' }); },
      );
    }

    // Never the rest of /oauth/: the token endpoint wants Basic credentials and answers a Bearer with OAUTH-16.
    if (target.pathname.indexOf('/oauth/') === 0) return originalFetch(input, init);

    var existing = (init && init.headers) || (input && input.headers);
    var present = existing && (existing.get ? existing.get('authorization') : existing.Authorization || existing.authorization);
    if (present) return originalFetch(input, init);

    return requestToken().then(function (r) {
      var headers = new Headers(existing || {});
      headers.set('Authorization', 'Bearer ' + r.token);
      return originalFetch(input, Object.assign({}, init, { headers: headers }));
    });
  };
})();`;
}
