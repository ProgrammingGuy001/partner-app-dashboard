import * as SecureStore from './secureStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './constants';
import { logger } from './helpers';

/**
 * Debug utility to check token storage
 * Call this after login to verify tokens are saved
 */
export const debugTokenStorage = async () => {
  logger.info('TokenDebug', '=== Starting Token Storage Debug ===');
  
  try {
    // Check if tokens exist in SecureStore
    const authToken = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
    
    logger.info('TokenDebug', `Auth Token: ${authToken ? 'EXISTS (length: ' + authToken.length + ')' : 'NOT FOUND'}`);
    logger.info('TokenDebug', `Refresh Token: ${refreshToken ? 'EXISTS (length: ' + refreshToken.length + ')' : 'NOT FOUND'}`);
    
    if (authToken) {
      logger.info('TokenDebug', `Auth Token preview: ${authToken.substring(0, 20)}...`);
    }
    
    // Check fallback AsyncStorage
    const fallbackAuth = await AsyncStorage.getItem(`secure-store-fallback:${STORAGE_KEYS.AUTH_TOKEN}`);
    const fallbackRefresh = await AsyncStorage.getItem(`secure-store-fallback:${STORAGE_KEYS.REFRESH_TOKEN}`);
    
    logger.info('TokenDebug', `Fallback Auth Token: ${fallbackAuth ? 'EXISTS' : 'NOT FOUND'}`);
    logger.info('TokenDebug', `Fallback Refresh Token: ${fallbackRefresh ? 'EXISTS' : 'NOT FOUND'}`);
    
    // Check cached user profile
    const cachedUser = await AsyncStorage.getItem('cached-user-profile');
    logger.info('TokenDebug', `Cached User Profile: ${cachedUser ? 'EXISTS' : 'NOT FOUND'}`);
    
    logger.info('TokenDebug', '=== Token Storage Debug Complete ===');
    
    return {
      authToken: !!authToken,
      refreshToken: !!refreshToken,
      fallbackAuth: !!fallbackAuth,
      fallbackRefresh: !!fallbackRefresh,
      cachedUser: !!cachedUser,
    };
  } catch (error) {
    logger.error('TokenDebug', 'Error during debug:', error.message);
    return { error: error.message };
  }
};

/**
 * Test token storage by writing and reading test values
 */
export const testTokenStorage = async () => {
  logger.info('TokenTest', '=== Starting Token Storage Test ===');
  
  try {
    const testKey = 'test-token-key';
    const testValue = 'test-token-value-' + Date.now();
    
    // Test write
    logger.info('TokenTest', `Writing test value: ${testValue}`);
    await SecureStore.setItemAsync(testKey, testValue);
    
    // Test read
    const readValue = await SecureStore.getItemAsync(testKey);
    logger.info('TokenTest', `Read value: ${readValue}`);
    
    const success = readValue === testValue;
    logger.info('TokenTest', `Test Result: ${success ? 'SUCCESS ✅' : 'FAILED ❌'}`);
    
    // Cleanup
    await SecureStore.deleteItemAsync(testKey);
    
    logger.info('TokenTest', '=== Token Storage Test Complete ===');
    
    return { success, testValue, readValue };
  } catch (error) {
    logger.error('TokenTest', 'Test failed with error:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Clear all tokens (for debugging)
 */
export const clearAllTokens = async () => {
  logger.info('TokenDebug', 'Clearing all tokens...');
  
  try {
    await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
    await AsyncStorage.removeItem(`secure-store-fallback:${STORAGE_KEYS.AUTH_TOKEN}`);
    await AsyncStorage.removeItem(`secure-store-fallback:${STORAGE_KEYS.REFRESH_TOKEN}`);
    await AsyncStorage.removeItem('cached-user-profile');
    
    logger.info('TokenDebug', 'All tokens cleared successfully');
    return { success: true };
  } catch (error) {
    logger.error('TokenDebug', 'Error clearing tokens:', error.message);
    return { success: false, error: error.message };
  }
};
