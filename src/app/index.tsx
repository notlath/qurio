import { Redirect } from 'expo-router';

// The app opens on the Assistant (ADR-0011). `/` has no screen of its own.
export default function OpeningScreen() {
  return <Redirect href="/assistant" />;
}
