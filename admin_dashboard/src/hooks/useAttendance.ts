import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminAttendanceAPI, attendanceAPI } from '@/api/services';
import { toast } from 'sonner';

type ApiErrorLike = {
  response?: {
    data?: {
      detail?: string;
    };
  };
};

export const useAttendance = (filters?: {
  job_id?: number;
  phone?: string;
  date_from?: string;
  date_to?: string;
  skip?: number;
  limit?: number;
}) => {
  return useQuery({
    queryKey: ['ip-attendance', filters],
    queryFn: () => attendanceAPI.getAll(filters),
    staleTime: 1000 * 60 * 2,
  });
};

export const useMyAdminAttendance = (params?: { skip?: number; limit?: number }) => {
  return useQuery({
    queryKey: ['admin-attendance', 'mine', params],
    queryFn: () => adminAttendanceAPI.getMine(params),
    staleTime: 1000 * 60 * 2,
  });
};

export const useAllAdminAttendance = (filters?: {
  admin_id?: number;
  date_from?: string;
  date_to?: string;
  skip?: number;
  limit?: number;
}) => {
  return useQuery({
    queryKey: ['admin-attendance', 'all', filters],
    queryFn: () => adminAttendanceAPI.getAll(filters),
    staleTime: 1000 * 60 * 2,
  });
};

export const useMarkAdminAttendance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { latitude: number; longitude: number; notes?: string; manual_location?: string; photo: File }) => adminAttendanceAPI.mark(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-attendance'] });
      toast.success('Attendance marked successfully');
    },
    onError: (error: unknown) => {
      toast.error((error as ApiErrorLike).response?.data?.detail || 'Failed to mark attendance');
    },
  });
};
