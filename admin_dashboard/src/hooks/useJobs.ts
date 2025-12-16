import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobAPI } from '../api/services';

interface JobFilters {
  limit?: number;
  status?: string;
  type?: string;
  search?: string;
}

export const useJobs = (filters: JobFilters = {}) => {
  return useQuery({
    queryKey: ['jobs', filters],
    queryFn: () => jobAPI.getAll(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useJob = (id: number) => {
  return useQuery({
    queryKey: ['job', id],
    queryFn: () => jobAPI.getById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCreateJob = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: jobAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
};

export const useUpdateJob = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => jobAPI.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
};

export const useDeleteJob = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: jobAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
};

export const useJobHistory = (id: number) => {
  return useQuery({
    queryKey: ['job-history', id],
    queryFn: () => jobAPI.getHistory(id),
    enabled: !!id,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};
