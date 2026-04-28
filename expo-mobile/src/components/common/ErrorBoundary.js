import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Text } from '@/components/ui';

/**
 * Theme-aware fallback UI component, used by ErrorBoundary.
 */
const ErrorFallback = ({ error, onRetry }) => {
  return (
    <View className="flex-1 justify-center items-center p-6 bg-background">
      <View className="items-center max-w-[320px]">
        <View className="w-[120px] h-[120px] rounded-full bg-destructive-muted justify-center items-center mb-6">
          <Ionicons name="warning-outline" size={64} color="#e11d48" />
        </View>
        <Text className="text-[22px] font-bold text-foreground mb-3 text-center">
          Something went wrong
        </Text>
        <Text className="text-[15px] text-muted-foreground text-center leading-[22px] mb-8">
          {__DEV__ && error?.message
            ? error.message
            : 'An unexpected error occurred. Please try again.'}
        </Text>
        <TouchableOpacity
          className="flex-row items-center bg-primary py-3.5 px-7 rounded-xl gap-2"
          onPress={onRetry}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh-outline" size={20} color="#fff" />
          <Text className="text-white text-base font-semibold">Try Again</Text>
        </TouchableOpacity>
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
