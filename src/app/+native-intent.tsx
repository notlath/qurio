import { Dimensions } from 'react-native';

import { isDocked, settingsHref } from '@/components/side-panel-layout';

/**
 * The OAuth redirect (`qlikanswers://auth?code=…`) is consumed by expo-auth-session's Linking
 * listener, not by a screen. Without this, Expo Router also treats it as navigation to a `/auth`
 * route that does not exist and shows "Unmatched Route" over the app. Sign-in starts from
 * Settings, so that is where the redirect returns: the root stack, or beside the docked side panel.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  if (/^(qlikanswers:\/\/)?\/?auth(\?|$)/.test(path)) return settingsHref(isDocked(Dimensions.get('window').width));
  return path;
}
