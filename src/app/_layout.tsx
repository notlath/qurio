import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { FixtureDataSwitch } from '@/components/fixture-data-switch';
import { BubbleVariantSwitcher } from '@/components/prototype-bubble-variant';
import { LockGate } from '@/components/lock-gate';
import { TenantEntryGate } from '@/components/tenant-entry';
import { TenantConfigProvider } from '@/config/context';
import { applyScreenCapture } from '@/config/screen-capture';
import { Colors } from '@/constants/theme';
import { useStackScreenOptions } from '@/hooks/use-stack-options';
import { AnswersPortProvider } from '@/qlik/context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const screenOptions = useStackScreenOptions();
  // Loaded at runtime rather than embedded by the expo-font config plugin: the plugin needs a
  // native rebuild, which would strand every dev client already installed. See docs/dev-build-runbook.md.
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    // Held until the type is ready, so the first frame is never the fallback font reflowing
    // into Plus Jakarta Sans. A font failure still releases the splash — falling back to the
    // system face is far better than never showing the app.
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    // Protected unless an internal build's Settings switch says otherwise (src/config/screen-capture.ts).
    // Version-gated on iOS: 11+ for recording, 13+ for screenshots.
    applyScreenCapture();
    return () => {
      if (Platform.OS !== 'web') ScreenCapture.allowScreenCaptureAsync();
    };
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    // Gesture Handler needs one root view above every gesture, such as History's swipe to delete.
    <GestureHandlerRootView style={styles.root}>
      {/* iOS only: Android already lifts the chat above the keyboard natively (NativeTabs'
          tabBarRespectsIMEInsets); letting the library take the IME insets too would double the offset. */}
      <KeyboardProvider enabled={process.env.EXPO_OS === 'ios'}>
        <ThemeProvider value={navigationTheme(colorScheme === 'dark' ? 'dark' : 'light')}>
          <TenantConfigProvider>
            <AnswersPortProvider>
              <LockGate>
                <TenantEntryGate>
                  <Stack screenOptions={screenOptions}>
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="apps/[id]" options={{ title: 'Analytics App' }} />
                  </Stack>
                </TenantEntryGate>
              </LockGate>
            </AnswersPortProvider>
          </TenantConfigProvider>
        </ThemeProvider>
      </KeyboardProvider>
      <FixtureDataSwitch />
      <BubbleVariantSwitcher />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });

/**
 * The navigator paints every screen's background, tab bar and header from this theme — left at
 * React Navigation's defaults, screens sat on #F2F2F2 / #000 instead of the brand surfaces.
 */
function navigationTheme(scheme: 'light' | 'dark') {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const colors = Colors[scheme];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
  };
}
