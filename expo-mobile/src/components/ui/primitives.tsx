import type { ComponentType } from 'react';
import {
  Pressable as RNPressable,
  Text as RNText,
  TextInput as RNTextInput,
  View as RNView,
  type PressableProps,
  type TextInputProps,
  type TextProps,
  type ViewProps,
} from 'react-native';

type WithClassName = {
  className?: string;
};

export const PrimitiveView = RNView as unknown as ComponentType<ViewProps & WithClassName>;
export const PrimitiveText = RNText as unknown as ComponentType<TextProps & WithClassName>;
export const PrimitivePressable = RNPressable as unknown as ComponentType<PressableProps & WithClassName>;
export const PrimitiveTextInput = RNTextInput as unknown as ComponentType<TextInputProps & WithClassName>;
