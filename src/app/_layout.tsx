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
import { Platform, useColorScheme } from 'react-native';

import { LockGate } from '@/components/lock-gate';
import { AnswersPortProvider } from '@/qlik/context';

SplashScreen.preventAutoHideAsync();

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
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="agentic-spike" options={{ title: 'Agentic spike' }} />
          </Stack>
        </LockGate>
      </AnswersPortProvider>
    </ThemeProvider>
  );
}
