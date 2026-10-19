import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * How far content centred above the Composer rises while the keyboard is up: half the distance the
 * Composer rises, so the content stays centred in the space left above it. Never more than the room
 * above the content, so on a small screen its top stays in view and the rest scrolls.
 */
export function welcomeLift(keyboardHeight: number, bottomInset: number, roomAbove: number): number {
  'worklet';
  return Math.min(Math.max(keyboardHeight - bottomInset, 0) / 2, Math.max(roomAbove, 0));
}

/**
 * Content centred in the space above the Composer, kept centred there as the keyboard opens and
 * closes. A transform on the UI thread, frame by frame with the keyboard: no layout pass, no re-render.
 */
export function KeyboardCentered({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { bottom } = useSafeAreaInsets();
  const { height, progress } = useReanimatedKeyboardAnimation();
  const reduceMotion = useReducedMotion();
  // The space between the content's top and its centred parent's top, measured with the keyboard down.
  const roomAbove = useSharedValue(0);

  const lift = useAnimatedStyle(() => {
    // `height` is negative while the keyboard is up. Reduce Motion: the content does not travel with
    // the keyboard. It moves once the keyboard is fully up, and back as soon as it starts to hide.
    const keyboard = reduceMotion && progress.value < 1 ? 0 : -height.value;
    return { transform: [{ translateY: -welcomeLift(keyboard, bottom, roomAbove.value) }] };
  });

  return (
    <Animated.View
      onLayout={(event) => {
        roomAbove.set(event.nativeEvent.layout.y);
      }}
      style={[style, lift]}>
      {children}
    </Animated.View>
  );
}
