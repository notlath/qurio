/**
 * The OAuth redirect (`qlikanswers://auth?code=…`) is consumed by expo-auth-session's Linking
 * listener, not by a screen. Without this, Expo Router also treats it as navigation to a `/auth`
 * route that does not exist and shows "Unmatched Route" over the app.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (/^(qlikanswers:\/\/)?\/?auth(\?|$)/.test(path)) return '/';
  return path;
}
