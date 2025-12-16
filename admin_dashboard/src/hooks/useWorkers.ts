import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../api/services';

export const useWorkers = () => {
  return useQuery({
    queryKey: ['workers'],
    queryFn: () => adminAPI.getIPUsers(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useApprovedWorkers = () => {
  return useQuery({
    queryKey: ['workers', 'approved'],
    queryFn: () => adminAPI.getApprovedIPUsers(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useVerifyWorker = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: adminAPI.verifyIPUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workers'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
};
