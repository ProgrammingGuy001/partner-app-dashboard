import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobAPI, jobRateAPI, type CompletionDocumentLinks, type Job, type JobRateCreate, type JobUpdate } from '@/api/services';
import { toast } from 'sonner';
import { getApiErrorMessage as getJobErrorMessage } from '@/lib/apiError';

export const useJobs = (filters?: {
  status?: string;
  type?: string;
  search?: string;
  page?: number;
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
    // The list endpoint returns a bare array with no total, so paging keeps the
    // previous page on screen instead of flashing an empty table between fetches.
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const usePendingApprovalJobs = (enabled = true) => {
  return useQuery({
    queryKey: ['jobs', 'pending-approval'],
    queryFn: () => jobAPI.getPendingApprovalJobs(),
    enabled,
    staleTime: 1000 * 60,
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

export const useJobRates = () => {
  return useQuery({
    queryKey: ['job-rates'],
    queryFn: () => jobRateAPI.getAll(),
    staleTime: 1000 * 60 * 5,
  });
};

export const useCreateJobRate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: JobRateCreate) => jobRateAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-rates'] });
      toast.success("Rate card added");
    },
    onError: (error: unknown) => {
      toast.error(getJobErrorMessage(error, "Failed to add rate card"));
    },
  });
};

export const useCreateJob = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<Job, 'id'>) => jobAPI.create(data),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', 'pending-approval'] });
      toast.success(job.status === 'pending_approval' ? "Job sent for superadmin approval" : "Job created successfully");
    },
    onError: (error: unknown) => {
      toast.error(getJobErrorMessage(error, "Failed to create job"));
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
      // Only invalidate the jobs list queries - the specific job is already updated above
      // Using refetchType: 'none' to only mark as stale without immediate refetch
      queryClient.invalidateQueries({ 
        queryKey: ['jobs'],
        refetchType: 'active'  // Only refetch if actively being rendered
      });

      toast.success("Job updated successfully");
    },
    onError: (error: unknown) => {
      toast.error(getJobErrorMessage(error, "Failed to update job"));

    },

  });
}

export const useDeleteJob = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => jobAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', 'pending-approval'] });
      toast.success("Job deleted successfully");
    },
    onError: (error: unknown) => {
      toast.error(getJobErrorMessage(error, "Failed to delete job"));
    },
  });
};

export const useApproveJobCreation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => jobAPI.approveJobCreation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', 'pending-approval'] });
      toast.success("Job approved — now active");
    },
    onError: (error: unknown) => {
      toast.error(getJobErrorMessage(error, "Failed to approve job"));
    },
  });
};

export const useRejectJobCreation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => jobAPI.rejectJobCreation(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', 'pending-approval'] });
      toast.success("Job rejected");
    },
    onError: (error: unknown) => {
      toast.error(getJobErrorMessage(error, "Failed to reject job"));
    },
  });
};

// ── Superadmin approval — the fallback when the customer OTP can't be used ──

export const useJobApprovalRequests = (id?: number) => {
  return useQuery({
    queryKey: ['jobs', id, 'approval-requests'],
    queryFn: () => jobAPI.getApprovalRequests(id!),
    enabled: !!id,
    staleTime: 1000 * 30,
  });
};

export const usePendingJobApprovalRequests = (enabled = true) => {
  return useQuery({
    queryKey: ['jobs', 'approval-requests', 'pending'],
    queryFn: () => jobAPI.getPendingApprovalRequests(),
    enabled,
    staleTime: 1000 * 60,
  });
};

const invalidateApprovalQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ['jobs'] });
};

export const useCreateJobApprovalRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, reason, documents }: {
      id: number;
      action: 'start' | 'finish';
      reason: string;
      documents?: CompletionDocumentLinks;
    }) => jobAPI.createApprovalRequest(id, { action, reason, ...documents }),
    onSuccess: (request) => {
      invalidateApprovalQueries(queryClient);
      toast.success(
        request.status === 'approved'
          ? `Job ${request.action === 'start' ? 'started' : 'completed'} without customer OTP`
          : 'Sent to superadmin for approval',
      );
    },
    onError: (error: unknown) => {
      toast.error(getJobErrorMessage(error, "Failed to request approval"));
    },
  });
};

export const useApproveJobApprovalRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: number) => jobAPI.approveApprovalRequest(requestId),
    onSuccess: (request) => {
      invalidateApprovalQueries(queryClient);
      toast.success(`Job ${request.action === 'start' ? 'started' : 'completed'}`);
    },
    onError: (error: unknown) => {
      toast.error(getJobErrorMessage(error, "Failed to approve request"));
    },
  });
};

export const useRejectJobApprovalRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, reason }: { requestId: number; reason?: string }) =>
      jobAPI.rejectApprovalRequest(requestId, reason),
    onSuccess: () => {
      invalidateApprovalQueries(queryClient);
      toast.success("Request rejected");
    },
    onError: (error: unknown) => {
      toast.error(getJobErrorMessage(error, "Failed to reject request"));
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
    mutationFn: async ({ id, action, notes, documents }: { id: number; action: 'start' | 'pause' | 'finish'; notes?: string; documents?: CompletionDocumentLinks }) => {
      switch (action) {
        case 'start': return jobAPI.start(id, notes);
        case 'pause': return jobAPI.pause(id, notes);
        case 'finish':
          if (!documents) throw new Error('Completion documents are required');
          return jobAPI.finish(id, notes, documents);
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
    onError: (error: unknown) => {
      toast.error(getJobErrorMessage(error, "Action failed"));
    },
  });
};
