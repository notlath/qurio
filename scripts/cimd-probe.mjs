// Probe: does a Qlik Cloud Tenant accept a CIMD client and each redirect URI in its metadata document?
// Usage: node scripts/cimd-probe.mjs <metadata-url> <redirect-uri>[,<redirect-uri>...] <tenant-host>[,<tenant-host>...]
// Sends unauthenticated GET /oauth/authorize requests. A 302 to login means accepted. A 400 OAUTH-1 means rejected.
const [clientId, redirects, hosts] = process.argv.slice(2);
if (!hosts) {
  console.error('Usage: node scripts/cimd-probe.mjs <metadata-url> <redirect-uri,...> <tenant-host,...>');
  process.exit(1);
}

for (const host of hosts.split(',')) {
  for (const redirect of redirects.split(',')) {
    const url = new URL(`https://${host}/oauth/authorize`);
    url.search = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirect,
      scope: 'user_default offline_access',
      state: 'probe',
      code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      code_challenge_method: 'S256',
    }).toString();
    try {
      const response = await fetch(url, { redirect: 'manual' });
      const detail = response.status >= 300 && response.status < 400
        ? `-> ${(response.headers.get('location') ?? '').slice(0, 90)}`
        : (await response.text()).replace(/\s+/g, ' ').slice(0, 160);
      console.log(`${host}  ${redirect}  ${response.status} ${detail}`);
    } catch (error) {
      console.log(`${host}  ${redirect}  ERROR ${error instanceof Error ? error.message : error}`);
    }
  }
}
