import { useQuery } from '@tanstack/react-query';
import { jobAPI, type Customer, type JobRate } from '@/api/services';

/**
 * Hook to fetch customers list
 */
export const useCustomers = (limit = 500) => {
  return useQuery<Customer[]>({
    queryKey: ['customers', limit],
    queryFn: async () => {
      const data = await jobAPI.getCustomers({ limit });
      return data || [];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes - customers don't change often
  });
};

/**
 * Hook to fetch job rates
 */
export const useJobRates = () => {
  return useQuery<JobRate[]>({
    queryKey: ['job-rates'],
    queryFn: async () => {
      const data = await jobAPI.getJobRates();
      return data || [];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes - rates don't change often
  });
};
