import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoSecureStore from 'expo-secure-store';
import { logger } from './helpers';

const FALLBACK_PREFIX = 'secure-store-fallback:';

/**
 * True after any token has been stored in the unencrypted AsyncStorage fallback.
 * The app should warn the user that their device does not support secure storage.
 */
let _fallbackActive = false;
export const isFallbackActive = () => _fallbackActive;

const getFallbackKey = (key) => `${FALLBACK_PREFIX}${key}`;

const getErrorMessage = (error) => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error.message === 'string') return error.message;
  return String(error);
};

const isRecoverableSecureStoreError = (error) => {
  const message = getErrorMessage(error);

  return [
    'ExpoSecureStore',
    'SecureStoreOptions',
    'ReadableNativeMap',
    'cannot be cast',
    'Native module',
    'Cannot find native module',
    'has not been exported',
  ].some((fragment) => message.includes(fragment));
};

const logFallback = (operation, key, error) => {
  logger.warn('secureStore', `${operation} fell back to AsyncStorage for "${key}"`, getErrorMessage(error));
};

const trySecureStore = async (operation, key, action) => {
  try {
    return {
      didFallback: false,
      value: await action(),
    };
  } catch (error) {
    if (!isRecoverableSecureStoreError(error)) {
      throw error;
    }

    logFallback(operation, key, error);
    return {
      didFallback: true,
      value: null,
    };
  }
};

export const getItemAsync = async (key, options) => {
  logger.info('secureStore', `Attempting to read key: "${key}"`);

  const { didFallback, value: secureValue } = await trySecureStore('getItemAsync', key, () =>
    ExpoSecureStore.getItemAsync(key, options)
  );

  if (secureValue !== null && secureValue !== undefined) {
    logger.info('secureStore', `Found in SecureStore: "${key}" (length: ${secureValue.length})`);
    return secureValue;
  }

  const fallbackKey = getFallbackKey(key);
  const fallbackValue = await AsyncStorage.getItem(fallbackKey);

  if (fallbackValue === null || didFallback) {
    logger.info('secureStore', `${fallbackValue ? 'Found in fallback' : 'Not found'}: "${key}"`);
    return fallbackValue;
  }

  try {
    await ExpoSecureStore.setItemAsync(key, fallbackValue, options);
    await AsyncStorage.removeItem(fallbackKey);
    logger.info('secureStore', `Migrated "${key}" from fallback to SecureStore`);
  } catch (error) {
    if (isRecoverableSecureStoreError(error)) {
      logFallback('setItemAsync(migrate)', key, error);
    } else {
      throw error;
    }
  }

  return fallbackValue;
};

export const setItemAsync = async (key, value, options) => {
  // Validate inputs
  if (!key || typeof key !== 'string') {
    throw new Error(`Invalid key for SecureStore.setItemAsync: ${key}`);
  }
  if (value === null || value === undefined || typeof value !== 'string') {
    throw new Error(`Invalid value for SecureStore.setItemAsync (key: ${key}): ${value}`);
  }

  logger.info('secureStore', `Attempting to store key: "${key}" (value length: ${value.length})`);

  const { didFallback } = await trySecureStore('setItemAsync', key, () =>
    ExpoSecureStore.setItemAsync(key, value, options)
  );

  const fallbackKey = getFallbackKey(key);

  if (!didFallback) {
    logger.info('secureStore', `Successfully stored in SecureStore: "${key}"`);
    await AsyncStorage.removeItem(fallbackKey);
    return;
  }

  _fallbackActive = true;
  logger.warn('secureStore', `⚠️ Secure storage unavailable — storing "${key}" in unencrypted AsyncStorage fallback`);
  await AsyncStorage.setItem(fallbackKey, value);
};

export const deleteItemAsync = async (key, options) => {
  await trySecureStore('deleteItemAsync', key, () =>
    ExpoSecureStore.deleteItemAsync(key, options)
  );

  await AsyncStorage.removeItem(getFallbackKey(key));
};
