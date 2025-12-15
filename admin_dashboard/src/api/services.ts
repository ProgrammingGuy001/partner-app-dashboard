import axiosInstance from './axios';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  isActive?: boolean;
  isApproved?: boolean;
}

export interface Job {
  id?: number;
  name: string;
  customer_name: string;
  address?: string;
  city: string;
  pincode: number;
  type: string;
  rate: number;
  size?: number;
  assigned_ip_id?: number;
  assigned_ip_name?: string;
  is_ip_available?: boolean;
  delivery_date: string;
  checklist_link?: string;
  google_map_link?: string;
  status?: string;
  additional_expense?: number;
}

export interface JobUpdate {
  name?: string;
  customer_name?: string;
  address?: string;
  city?: string;
  pincode?: number;
  type?: string;
  rate?: number;
  size?: number;
  assigned_ip_id?: number;
  status?: string;
  delivery_date?: string;
  checklist_link?: string;
  google_map_link?: string;
  additional_expense?: number;
}

export interface JobStatusLog {
  id: number;
  job_id: number;
  status: string;
  notes?: string;
  timestamp: string;
}

export interface PayoutSummary {
  period: string;
  start_date: string;
  end_date: string;
  total_jobs: number;
  total_payout: number;
  total_additional_expense: number;
  avg_rate_per_unit: number;
  job_stages: Array<{
    status: string;
    count: number;
    total_payout: number;
    total_additional_expense: number;
  }>;
  payout_by_ip_user: Array<{
    ip_user_id: number;
    ip_user_name: string;
    job_count: number;
    total_payout: number;
    total_additional_expense: number;
    avg_rate_per_unit: number;
  }>;
  payout_by_project?: Array<{
    project_id: number;
    project_name: string;
    job_count: number;
    total_payout: number;
    total_additional_expense: number;
  }>;
}

export interface JobStageCount {
  status: string;
  count: number;
  total_payout: number;
  total_additional_expense: number;
}

export interface PayoutByIPUser {
  ip_user_id: number;
  ip_user_name: string;
  job_count: number;
  total_payout: number;
  total_additional_expense: number;
  avg_rate_per_unit: number;
}

// Auth APIs
export const authAPI = {
  login: (data: LoginRequest) => axiosInstance.post('/auth/login', data),
  signup: (data: SignupRequest) => axiosInstance.post('/auth/signup', data),
};

// Job APIs
export const jobAPI = {
  getAll: (params?: { skip?: number; limit?: number; status?: string; type?: string; search?: string }) =>
    axiosInstance.get('/jobs/', { params }),
  getById: (id: number) => axiosInstance.get(`/jobs/${id}`),
  create: (data: Job) => axiosInstance.post('/jobs/', data),
  update: (id: number, data: JobUpdate) => axiosInstance.put(`/jobs/${id}`, data),
  delete: (id: number) => axiosInstance.delete(`/jobs/${id}`),
  start: (id: number, notes?: string) =>
    axiosInstance.post(`/jobs/${id}/start`, { notes }),
  pause: (id: number, notes?: string) =>
    axiosInstance.post(`/jobs/${id}/pause`, { notes }),
  finish: (id: number, notes?: string) =>
    axiosInstance.post(`/jobs/${id}/finish`, { notes }),
  getHistory: (id: number) => axiosInstance.get(`/jobs/${id}/history`),
};

// Admin APIs
export const adminAPI = {
  getIPUsers: () => axiosInstance.get('/admin/ips'),
  getApprovedIPUsers: () => axiosInstance.get('/admin/ips/approved'),
  verifyIPUser: (phoneNumber: string) =>
    axiosInstance.post(`/admin/verify-ip/${phoneNumber}`),
};

// Analytics APIs
export const analyticsAPI = {
  getPayoutReport: (params: {
    period: string;
    year?: number;
    month?: number;
    quarter?: number;
    week?: number;
  }) => axiosInstance.get<PayoutSummary>('/analytics/payout', { params }),
  getJobStages: () => axiosInstance.get<JobStageCount[]>('/analytics/job-stages'),
  getIPPerformance: () => axiosInstance.get<PayoutByIPUser[]>('/analytics/ip-performance'),
};
