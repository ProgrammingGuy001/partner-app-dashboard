import { useEffect, useState, useCallback } from 'react';
import * as Updates from 'expo-updates';
import { logger } from '../util/helpers';

/**
 * Hook to manage OTA updates in the app
 * @param {Object} options - Configuration options
 * @param {boolean} options.checkOnMount - Whether to check for updates when component mounts
 * @param {boolean} options.autoReload - Whether to automatically reload after downloading update
 * @returns {Object} Update state and control functions
 */
export const useOTAUpdates = ({ checkOnMount = false, autoReload = true } = {}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [error, setError] = useState(null);

  const checkForUpdates = useCallback(async () => {
    // Skip in development mode
    if (__DEV__) {
      logger.info('useOTAUpdates', 'Development mode - skipping update check');
      return { isAvailable: false };
    }

    setIsChecking(true);
    setError(null);

    try {
      logger.info('useOTAUpdates', 'Checking for updates...');
      const update = await Updates.checkForUpdateAsync();
      
      setIsUpdateAvailable(update.isAvailable);
      logger.info('useOTAUpdates', `Update available: ${update.isAvailable}`);
      
      return update;
    } catch (err) {
      const message = err?.message || 'Failed to check for updates';
      logger.error('useOTAUpdates', message);
      setError(message);
      return { isAvailable: false, error: message };
    } finally {
      setIsChecking(false);
    }
  }, []);

  const downloadUpdate = useCallback(async () => {
    setIsDownloading(true);
    setError(null);

    try {
      logger.info('useOTAUpdates', 'Downloading update...');
      const result = await Updates.fetchUpdateAsync();
      logger.info('useOTAUpdates', 'Update downloaded successfully');
      return result;
    } catch (err) {
      const message = err?.message || 'Failed to download update';
      logger.error('useOTAUpdates', message);
      setError(message);
      throw err;
    } finally {
      setIsDownloading(false);
    }
  }, []);

  const reloadApp = useCallback(async () => {
    try {
      logger.info('useOTAUpdates', 'Reloading app...');
      await Updates.reloadAsync();
    } catch (err) {
      const message = err?.message || 'Failed to reload app';
      logger.error('useOTAUpdates', message);
      setError(message);
    }
  }, []);

  const checkAndApplyUpdate = useCallback(async () => {
    try {
      const update = await checkForUpdates();
      
      if (update.isAvailable) {
        await downloadUpdate();
        
        if (autoReload) {
          await reloadApp();
        }
        
        return true;
      }
      
      return false;
    } catch (err) {
      logger.error('useOTAUpdates', `Update flow failed: ${err?.message}`);
      return false;
    }
  }, [checkForUpdates, downloadUpdate, reloadApp, autoReload]);

  useEffect(() => {
    if (checkOnMount) {
      checkAndApplyUpdate();
    }
  }, [checkOnMount]);

  return {
    isChecking,
    isDownloading,
    isUpdateAvailable,
    error,
    checkForUpdates,
    downloadUpdate,
    reloadApp,
    checkAndApplyUpdate,
  };
};
