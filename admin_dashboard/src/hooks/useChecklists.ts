import { useQuery } from '@tanstack/react-query';
import { checklistAPI, type Checklist } from '@/api/services';

// Consistent query key for checklists - prevents duplicate API calls
export const CHECKLISTS_QUERY_KEY = ['checklists'] as const;

/**
 * Hook to fetch all checklists
 * Uses getAll() which returns all checklists - no N+1 problem
 */
export const useChecklists = () => {
  return useQuery<Checklist[]>({
    queryKey: CHECKLISTS_QUERY_KEY,
    queryFn: () => checklistAPI.getAll(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook to fetch a single checklist by ID
 */
export const useChecklist = (id?: number) => {
  return useQuery<Checklist>({
    queryKey: ['checklists', id],
    queryFn: () => checklistAPI.getById(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });
};

/**
 * Hook to fetch checklist status for a specific job
 */
export const useJobChecklists = (jobId?: number) => {
  return useQuery({
    queryKey: ['checklists', 'job', jobId],
    queryFn: () => checklistAPI.getJobChecklistsStatus(jobId!),
    enabled: !!jobId,
    staleTime: 1000 * 60 * 2, // 2 minutes - more frequent updates for job-specific data
  });
};
