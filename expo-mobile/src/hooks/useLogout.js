import { useCallback, useRef, useState } from 'react';
import { authApi } from '../api/authApi';
import { useAuthStore } from '../store/authStore';
import { useVerificationStore } from '../store/verificationStore';
import useChecklistStore from '../store/checklistStore';
import { useDashboardStore } from '../store/dashboardStore';
import useRequisiteStore from '../store/requisiteStore';
import { useToast } from './useToast';

export const useLogout = () => {
  const toast = useToast();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const resetVerification = useVerificationStore((state) => state.resetVerification);
  const [loggingOut, setLoggingOut] = useState(false);
  const loggingOutRef = useRef(false);

  const logout = useCallback(async () => {
    if (loggingOutRef.current) return;

    loggingOutRef.current = true;
    setLoggingOut(true);
    try {
      await authApi.logout();
    } catch {
      // Force local logout even if API logout fails.
    } finally {
      resetVerification();
      useChecklistStore.getState().resetStore();
      useDashboardStore.getState().resetDashboard();
      useRequisiteStore.getState().clearBucket();
      await clearAuth();
      toast.info('You have been logged out.');
      loggingOutRef.current = false;
      setLoggingOut(false);
    }
  }, [clearAuth, resetVerification, toast]);

  return { logout, loggingOut };
};
