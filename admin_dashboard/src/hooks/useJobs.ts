import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobAPI, type Job, type JobUpdate } from '@/api/services';
import { toast } from 'sonner';

export const useJobs = (filters?: {
  status?: string;
  type?: string;
  search?: string;
  limit?: number;
}) => {
  return useQuery({
    queryKey: ['jobs', filters],
    queryFn: async () => {
      const response = await jobAPI.getAll({
        limit: filters?.limit || 100,
        ...filters
      });

      // Handle array response (direct list)
      if (Array.isArray(response)) {
        return response;
      }

      // Handle object response (paginated wrapper)
      return response.jobs || response.data || [];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useJob = (id?: number) => {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: () => jobAPI.getById(id!),
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes for single job
  });
};

export const useCreateJob = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<Job, 'id'>) => jobAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success("Job created successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to create job");
    },
  });
};

export const useUpdateJob = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: JobUpdate }) => jobAPI.update(id, data),
    onSuccess: (data, variables) => {
      // Update cache for specific job
      queryClient.setQueryData(['jobs', variables.id], data);
      // Invalidate all jobs queries
      queryClient.invalidateQueries({ queryKey: ['jobs'] });

      toast.success("Job updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update job");

    },

  });
}

export const useDeleteJob = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => jobAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success("Job deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to delete job");
    },
  });
};

export const useJobHistory = (id?: number) => {
  return useQuery({
    queryKey: ['jobs', id, 'history'],
    queryFn: () => jobAPI.getHistory(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useJobAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, action, notes }: { id: number; action: 'start' | 'pause' | 'finish'; notes?: string }) => {
      switch (action) {
        case 'start': return jobAPI.start(id, notes);
        case 'pause': return jobAPI.pause(id, notes);
        case 'finish': return jobAPI.finish(id, notes);
      }
    },
    onSuccess: (_, variables) => {
      // Invalidate list and specific job query
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', variables.id] });
      // Invalidate history
      queryClient.invalidateQueries({ queryKey: ['jobs', variables.id, 'history'] });

      toast.success(`Job ${variables.action}ed successfully`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Action failed");
    },
  });
};