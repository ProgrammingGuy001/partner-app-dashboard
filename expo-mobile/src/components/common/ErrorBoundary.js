import React from 'react';
import { View } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Text } from '@/components/ui';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '@/components/ui/button';
import { spacing, typography } from '../../theme/designSystem';

/**
 * Theme-aware fallback UI component, used by ErrorBoundary.
 */
const ErrorFallback = ({ error, onRetry }) => {
  const { colors } = useTheme();

  return (
    <View className="flex-1 justify-center items-center p-6 bg-background">
      <View className="items-center" style={{ maxWidth: spacing.xl * 10 }}>
        <View className="rounded-full bg-destructive-muted justify-center items-center mb-6" style={{ width: spacing.xl * 4 - spacing.xs, height: spacing.xl * 4 - spacing.xs }}>
          <Ionicons name="warning-outline" size={64} color={colors.danger} />
        </View>
        <Text style={{ fontSize: typography.title2.fontSize, lineHeight: typography.title2.lineHeight }} className="font-bold text-foreground mb-3 text-center">
          Something went wrong
        </Text>
        <Text style={{ fontSize: typography.callout.fontSize, lineHeight: (typography.callout.lineHeight + typography.body.lineHeight) / 2 }} className="text-muted-foreground text-center mb-8">
          {__DEV__ && error?.message
            ? error.message
            : 'An unexpected error occurred. Please try again.'}
        </Text>
        <Button
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Ionicons name="refresh-outline" size={20} color={colors.primaryForeground} />
          <Text className="text-base font-semibold" style={{ color: colors.primaryForeground }}>Try Again</Text>
        </Button>
      </View>
    </View>
  );
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (!__DEV__) {
      // TODO: Send to error tracking service (Sentry, Crashlytics, etc.)
      console.error('ErrorBoundary caught:', error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
