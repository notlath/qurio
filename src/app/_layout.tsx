import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Link, Stack, ThemeProvider } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';

import { AppPressable } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { LockGate } from '@/components/lock-gate';
import { IS_INTERNAL_BUILD } from '@/config';
import { AnswersPortProvider } from '@/qlik/context';

SplashScreen.preventAutoHideAsync();

function HeaderNav() {
  return (
    <View style={styles.headerNav}>
      {IS_INTERNAL_BUILD && Platform.OS !== 'web' && (
        <Link href="/agentic-spike" asChild>
          <AppPressable accessibilityLabel="Open agentic assistant spike" style={styles.headerAction}>
            <ThemedText type="link" themeColor="primary">
              Spike
            </ThemedText>
          </AppPressable>
        </Link>
      )}
      <Link href="/history" asChild>
        <AppPressable accessibilityLabel="Open conversation history" style={styles.headerAction}>
          <ThemedText type="link" themeColor="primary">
            History
          </ThemedText>
        </AppPressable>
      </Link>
      <Link href="/settings" asChild>
        <AppPressable accessibilityLabel="Open settings" style={styles.headerAction}>
          <ThemedText type="link" themeColor="primary">
            Settings
          </ThemedText>
        </AppPressable>
      </Link>
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
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
    // expo-screen-capture has no web implementation — calling it throws (ERR_UNAVAILABLE) rather
    // than no-op, confirmed live. Version-gated on iOS: 11+ for recording, 13+ for screenshots.
    if (Platform.OS === 'web') return;
    ScreenCapture.preventScreenCaptureAsync();
    return () => {
      ScreenCapture.allowScreenCaptureAsync();
    };
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnswersPortProvider>
        <LockGate>
          <Stack>
            <Stack.Screen name="index" options={{ title: 'QlikAnswersApp', headerRight: HeaderNav }} />
            <Stack.Screen name="history" options={{ title: 'History' }} />
            <Stack.Screen name="settings" options={{ title: 'Settings' }} />
            <Stack.Screen name="thread/[id]" options={{ title: 'Thread' }} />
            <Stack.Screen name="agentic-spike" options={{ title: 'Agentic spike' }} />
          </Stack>
        </LockGate>
      </AnswersPortProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  headerNav: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingRight: Spacing.one,
  },
  headerAction: { justifyContent: 'center' },
});
