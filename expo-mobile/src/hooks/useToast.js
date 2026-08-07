import { useCallback, useMemo } from 'react';
import { useToastContext } from '../context/ToastContext';

export const useToast = () => {
  const { show } = useToastContext();
  const success = useCallback((message) => show('success', message), [show]);
  const error = useCallback((message) => show('error', message), [show]);
  const info = useCallback((message) => show('info', message), [show]);
  const warning = useCallback((message) => show('warning', message), [show]);

  return useMemo(() => ({ success, error, info, warning }), [success, error, info, warning]);
};
