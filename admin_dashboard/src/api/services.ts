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
  checklist_ids?: number[];
  job_checklists?: { checklist_id: number }[];
  google_map_link?: string;
  status?: string;
  additional_expense?: number;
}

export interface JobUpdate extends Partial<Job> {}

export interface JobStatusLog {
  id: number;
  job_id: number;
  status: string;
  notes?: string;
  timestamp: string;
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

export interface PayoutSummary {
  period: string;
  start_date: string;
  end_date: string;
  total_jobs: number;
  total_payout: number;
  total_additional_expense: number;
  avg_rate_per_unit: number;
  job_stages: JobStageCount[];
  payout_by_ip_user: PayoutByIPUser[];
  payout_by_project?: Array<{
    project_id: number;
    project_name: string;
    job_count: number;
    total_payout: number;
    total_additional_expense: number;
  }>;
}

// Auth APIs
export const authAPI = {
  login: (data: LoginRequest): Promise<any> => 
    axiosInstance.post('/auth/login', data).then(res => res.data),
  signup: (data: SignupRequest): Promise<any> => 
    axiosInstance.post('/auth/signup', data).then(res => res.data),
};

// Job APIs
export const jobAPI = {
  getAll: (params?: any): Promise<Job[]> =>
    axiosInstance.get('/jobs', { params }).then(res => res.data),

  getById: (id: number): Promise<Job> =>
    axiosInstance.get(`/jobs/${id}`).then(res => res.data),

  create: (data: Job): Promise<Job> =>
    axiosInstance.post('/jobs', data).then(res => res.data),

  update: (id: number, data: JobUpdate): Promise<Job> =>
    axiosInstance.put(`/jobs/${id}`, data).then(res => res.data),

  delete: (id: number): Promise<any> =>
    axiosInstance.delete(`/jobs/${id}`).then(res => res.data),

  start: (id: number, notes?: string): Promise<any> =>
    axiosInstance.post(`/jobs/${id}/start`, { notes }).then(res => res.data),

  pause: (id: number, notes?: string): Promise<any> =>
    axiosInstance.post(`/jobs/${id}/pause`, { notes }).then(res => res.data),

  finish: (id: number, notes?: string): Promise<any> =>
    axiosInstance.post(`/jobs/${id}/finish`, { notes }).then(res => res.data),

  getHistory: (id: number): Promise<JobStatusLog[]> =>
    axiosInstance.get(`/jobs/${id}/history`).then(res => res.data),
};

// Admin APIs
export const adminAPI = {
  getIPUsers: (): Promise<any> =>
    axiosInstance.get('/admin/ips').then(res => res.data),

  getApprovedIPUsers: (): Promise<any> =>
    axiosInstance.get('/admin/ips/approved').then(res => res.data),

  verifyIPUser: (phoneNumber: string): Promise<any> =>
    axiosInstance.post(`/admin/verify-ip/${phoneNumber}`).then(res => res.data),
};

// Analytics APIs
export const analyticsAPI = {
  getPayoutReport: (params: any): Promise<PayoutSummary> =>
    axiosInstance.get('/analytics/payout', { params }).then(res => res.data),

  getJobStages: (): Promise<JobStageCount[]> =>
    axiosInstance.get('/analytics/job-stages').then(res => res.data),

  getIPPerformance: (): Promise<any> =>
    axiosInstance.get('/analytics/ip-performance').then(res => res.data),
};

export const checklistAPI = {
  getAll: (): Promise<any> => axiosInstance.get('/checklists').then(res => res.data),

  create: (data: any): Promise<any> => axiosInstance.post('/checklists', data).then(res => res.data),

  getById: (id: number): Promise<any> =>
    axiosInstance.get(`/checklists/${id}`).then(res => res.data),

  createItem: (checklistId: number, data: any): Promise<any> =>
    axiosInstance.post('/checklists/items', { ...data, checklist_id: checklistId }).then(res => res.data),

  getJobChecklistsStatus: (jobId: number): Promise<any> =>
    axiosInstance.get(`/checklists/jobs/${jobId}/status`).then(res => res.data),

  updateJobChecklistItemStatus: (
    jobId: number,
    itemId: number,
    data: { is_approved?: boolean; admin_comment?: string }
  ): Promise<any> =>
    axiosInstance.put(
      `/checklists/jobs/${jobId}/items/${itemId}/status`,
      data
    ).then(res => res.data),
};



