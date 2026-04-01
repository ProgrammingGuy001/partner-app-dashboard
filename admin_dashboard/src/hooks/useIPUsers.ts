import { useQuery } from '@tanstack/react-query';
import { adminAPI, type IPUser } from '@/api/services';

// Consistent query key for all IP users data - prevents duplicate API calls
export const IP_USERS_QUERY_KEY = ['ip-users'] as const;

/**
 * Hook to fetch all IP users (workers)
 * Uses a consistent query key to enable React Query's automatic deduplication
 */
export const useIPUsers = () => {
  return useQuery<IPUser[]>({
    queryKey: IP_USERS_QUERY_KEY,
    queryFn: () => adminAPI.getIPUsers(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook to fetch only approved/verified IP users
 * Used for assignment dropdowns in job forms
 */
export const useApprovedIPUsers = () => {
  return useQuery<IPUser[]>({
    queryKey: ['ip-users', 'approved'],
    queryFn: () => adminAPI.getApprovedIPUsers(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
