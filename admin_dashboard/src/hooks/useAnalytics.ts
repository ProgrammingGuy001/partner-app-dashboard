import { useQuery } from '@tanstack/react-query';
import { analyticsAPI } from '../api/services';

interface PayoutParams {
  period: string;
  year?: number;
  month?: number;
  quarter?: number;
  week?: number;
}

export const usePayoutReport = (params: PayoutParams) => {
  return useQuery({
    queryKey: ['analytics', 'payout', params],
    queryFn: () => analyticsAPI.getPayoutReport(params),
    staleTime: 15 * 60 * 1000, // 15 minutes - analytics can be cached longer
  });
};

export const useJobStages = () => {
  return useQuery({
    queryKey: ['analytics', 'job-stages'],
    queryFn: () => analyticsAPI.getJobStages(),
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
};

export const useIPPerformance = () => {
  return useQuery({
    queryKey: ['analytics', 'ip-performance'],
    queryFn: () => analyticsAPI.getIPPerformance(),
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
};
