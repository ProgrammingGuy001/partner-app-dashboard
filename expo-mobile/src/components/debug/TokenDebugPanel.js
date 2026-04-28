import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from '@/components/ui/text';
import { debugTokenStorage, testTokenStorage, clearAllTokens } from '../../util/tokenDebug';
import { useTheme } from '../../hooks/useTheme';

const TokenDebugPanel = () => {
  const { colors } = useTheme();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleDebug = async () => {
    setLoading(true);
    const result = await debugTokenStorage();
    setResults({ type: 'debug', data: result });
    setLoading(false);
  };

  const handleTest = async () => {
    setLoading(true);
    const result = await testTokenStorage();
    setResults({ type: 'test', data: result });
    setLoading(false);
  };

  const handleClear = async () => {
    setLoading(true);
    const result = await clearAllTokens();
    setResults({ type: 'clear', data: result });
    setLoading(false);
  };

  return (
    <View
      className="bg-surface rounded-2xl p-4 my-3 border border-border"
    >
      <Text className="text-base font-bold text-foreground mb-3">
       Token Debug Panel
      </Text>

      <View className="gap-2">
        <TouchableOpacity
          onPress={handleDebug}
          disabled={loading}
          className="bg-primary py-3 px-4 rounded-lg"
          style={{ opacity: loading ? 0.6 : 1 }}
        >
          <Text className="text-white font-semibold text-center">
            Check Token Storage
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleTest}
          disabled={loading}
          className="py-3 px-4 rounded-lg"
          style={{ backgroundColor: colors.info, opacity: loading ? 0.6 : 1 }}
        >
          <Text className="text-white font-semibold text-center">
            Test Storage Write/Read
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleClear}
          disabled={loading}
          className="py-3 px-4 rounded-lg"
          style={{ backgroundColor: colors.danger, opacity: loading ? 0.6 : 1 }}
        >
          <Text className="text-white font-semibold text-center">
            Clear All Tokens
          </Text>
        </TouchableOpacity>
      </View>

      {results && (
        <ScrollView
          className="mt-3 bg-background rounded-lg p-3 max-h-[200px]"
        >
          <Text className="text-xs text-muted-foreground font-mono">
            {JSON.stringify(results, null, 2)}
          </Text>
        </ScrollView>
      )}

      <Text className="text-[11px] text-muted-foreground mt-2 italic">
        Check console logs for detailed debug output
      </Text>
    </View>
  );
};

export default TokenDebugPanel;
