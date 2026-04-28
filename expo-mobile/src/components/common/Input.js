import React from 'react';
import { Text, TextInput, View } from 'react-native';

const Input = React.forwardRef(
  (
    {
      label,
      error,
      helperText,
      required = false,
      disabled = false,
      leftIcon,
      rightIcon,
      containerClassName = '',
      containerStyle,
      className = '',
      style,
      accessibilityLabel,
      accessibilityHint,
      ...props
    },
    ref
  ) => {
    // Auto-generate accessibility label from label prop if not provided
    const a11yLabel = accessibilityLabel || label || props.placeholder;
    const a11yHint = accessibilityHint || helperText;

    return (
      <View className={`mb-3.5 ${containerClassName}`} style={containerStyle}>
        {label ? (
          <Text className="mb-1.5 text-sm font-medium text-foreground">
            {label}
            {required ? <Text className="text-destructive"> *</Text> : null}
          </Text>
        ) : null}

        <View
          className={`min-h-11 justify-center rounded-xl border bg-card ${error ? 'border-destructive' : 'border-input'} ${disabled ? 'bg-muted/70' : ''}`}
        >
          {leftIcon ? <View className="absolute left-3 z-10">{leftIcon}</View> : null}
          <TextInput
            ref={ref}
            editable={!disabled}
            placeholderTextColor="#7c685f"
            accessible={true}
            accessibilityRole="text"
            accessibilityLabel={a11yLabel}
            accessibilityHint={a11yHint}
            accessibilityState={{ disabled }}
            className={`px-3 py-2.5 text-[15px] text-foreground ${leftIcon ? 'pl-10' : ''} ${rightIcon ? 'pr-10' : ''} ${className}`}
            style={style}
            {...props}
          />
          {rightIcon ? <View className="absolute right-3 z-10">{rightIcon}</View> : null}
        </View>

        {error ? <Text className="mt-1 text-xs text-destructive">{error}</Text> : null}
        {!error && helperText ? <Text className="mt-1 text-xs text-muted-foreground">{helperText}</Text> : null}
      </View>
    );
  }
);

Input.displayName = 'Input';

export default Input;
