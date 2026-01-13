import { useQuery } from '@tanstack/react-query';
import { analyticsAPI } from '@/api/services';

interface PayoutReportParams {
  period: string;
  year?: number;
  month?: number;
  quarter?: number;
}

export const usePayoutReport = (params: PayoutReportParams) => {
  return useQuery({
    queryKey: ['analytics', 'payout', params],
    queryFn: () => analyticsAPI.getPayoutReport(params),
    staleTime: 10 * 60 * 1000, // 10 minutes
    // Only fetch if params are valid (e.g. month requires year)
    enabled: !!params.period,
  });
};

export const useJobStages = () => {
  return useQuery({
    queryKey: ['analytics', 'job-stages'],
    queryFn: () => analyticsAPI.getJobStages(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useIPPerformance = () => {
  return useQuery({
    queryKey: ['analytics', 'ip-performance'],
    queryFn: () => analyticsAPI.getIPPerformance(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};
