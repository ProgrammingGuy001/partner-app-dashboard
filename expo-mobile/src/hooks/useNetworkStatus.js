import { useEffect, useState, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Hook to detect and monitor network connectivity status.
 * Returns isOnline status and a refresh function.
 */
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Initial check
    NetInfo.fetch().then((state) => {
      setIsOnline(state.isConnected ?? true);
      setIsChecking(false);
    });

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? true);
    });

    return () => unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    setIsChecking(true);
    const state = await NetInfo.fetch();
    setIsOnline(state.isConnected ?? true);
    setIsChecking(false);
    return state.isConnected ?? true;
  }, []);

  return { isOnline, isChecking, refresh };
};

export default useNetworkStatus;
