// Prints the /oauth/authorize link a Tenant admin opens in a signed-in browser to give Tenant Approval outside the app.
// Usage: node scripts/authorize-url.mjs <tenant-host> <client-id>
// After Approve, the browser fails to open qlikanswers://auth. That is expected: Qlik has saved the approval.
const [host, clientId] = process.argv.slice(2);
if (!clientId) {
  console.error('Usage: node scripts/authorize-url.mjs <tenant-host> <client-id>');
  process.exit(1);
}

const url = new URL(`https://${host}/oauth/authorize`);
// Qlik rejects a request without state (OAUTH-26). The code is never exchanged, so a fixed challenge is enough.
url.search = new URLSearchParams({
  client_id: clientId,
  response_type: 'code',
  redirect_uri: 'qlikanswers://auth',
  scope: 'user_default offline_access',
  state: 'approve',
  code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  code_challenge_method: 'S256',
}).toString();
console.log(url.toString());
