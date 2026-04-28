import { useToastContext } from '../context/ToastContext';

export const useToast = () => {
  const { show } = useToastContext();

  return {
    success: (message) => show('success', message),
    error: (message) => show('error', message),
    info: (message) => show('info', message),
    warning: (message) => show('warning', message),
  };
};
