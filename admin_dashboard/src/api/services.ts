import axiosInstance from './axios';

// ============ Types ============
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

// Proper API response structure
export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  success: boolean;
  status?: number;
}

export interface PaginatedResponse<T = unknown> {
  data?: T[];
  jobs?: T[]; // Backend returns 'jobs'
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  message?: string;
}

export interface Job {
  id?: number;
  name: string;
  customer_name: string;
  customer_phone?: string;
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
  status: string;
  additional_expense?: number;
  start_otp_verified?: boolean;
  end_otp_verified?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type JobUpdate = Partial<Omit<Job, 'id'>>;

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

export interface IPUser {
  id: number;
  first_name: string;
  last_name: string;
  phone_number: string;
  city: string;
  pincode: string;
  is_assigned: boolean;
  is_verified: boolean;
  is_pan_verified: boolean;
  is_bank_details_verified: boolean;
  is_id_verified: boolean;
  pan_number?: string;
  pan_name?: string;
  account_number?: string;
  ifsc_code?: string;
  account_holder_name?: string;
  registered_at: string;
  verified_at?: string;
  assigned_admin_ids?: number[];
}

export interface AdminUser {
  id: number;
  email: string;
  isActive: boolean;
  isApproved: boolean;
  is_superadmin: boolean;
}

export interface User {
  id: number;
  email: string;
  isActive: boolean;
  isApproved: boolean;
  is_superadmin: boolean;
}

export interface OTPResponse {
  success: boolean;
  message: string;
}

export interface Checklist {
  id: number;
  name: string;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: number;
  name: string;
  is_completed: boolean;
}

// ============ API Response Helpers ============
const handleResponse = <T>(response: any): T => {
  // Check if response has data property (consistent API structure)
  if (response.data !== undefined) {
    return response.data;
  }
  // Fallback to the entire response
  return response;
};

// ============ API Functions ============

// Auth APIs
export const authAPI = {
  login: (data: LoginRequest): Promise<any> =>
    axiosInstance.post('/auth/login', data).then(res => handleResponse(res)),

  signup: (data: SignupRequest): Promise<any> =>
    axiosInstance.post('/auth/signup', data).then(res => handleResponse(res)),

  getCurrentUser: (): Promise<any> =>
    axiosInstance.get('/auth/me').then(res => handleResponse(res)),

  logout: (): Promise<any> =>
    axiosInstance.post('/auth/logout').then(res => {
      localStorage.removeItem('access_token');
      return handleResponse(res);
    }),
};

// Job APIs with pagination support
export const jobAPI = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    search?: string;
  }): Promise<Job[] | PaginatedResponse<Job>> => {
    const { page = 1, limit = 100, ...rest } = params || {};
    const skip = (page - 1) * limit;
    return axiosInstance.get('/jobs', {
      params: { ...rest, skip, limit }
    }).then(res => handleResponse(res));
  },

  getById: (id: number): Promise<Job> =>
    axiosInstance.get(`/jobs/${id}`).then(res => handleResponse(res)),

  create: (data: Omit<Job, 'id'>): Promise<Job> =>
    axiosInstance.post('/jobs', data).then(res => handleResponse(res)),

  update: (id: number, data: JobUpdate): Promise<Job> =>
    axiosInstance.put(`/jobs/${id}`, data).then(res => handleResponse(res)),

  delete: (id: number): Promise<ApiResponse> =>
    axiosInstance.delete(`/jobs/${id}`).then(res => handleResponse(res)),

  start: (id: number, notes?: string): Promise<ApiResponse> =>
    axiosInstance.post(`/jobs/${id}/start`, { notes }).then(res => handleResponse(res)),

  pause: (id: number, notes?: string): Promise<ApiResponse> =>
    axiosInstance.post(`/jobs/${id}/pause`, { notes }).then(res => handleResponse(res)),

  finish: (id: number, notes?: string): Promise<ApiResponse> =>
    axiosInstance.post(`/jobs/${id}/finish`, { notes }).then(res => handleResponse(res)),

  // OTP-based job start/finish
  requestStartOTP: (id: number): Promise<OTPResponse> =>
    axiosInstance.post(`/jobs/${id}/request-start-otp`).then(res => handleResponse(res)),

  verifyStartOTP: (id: number, otp: string, notes?: string): Promise<Job> =>
    axiosInstance.post(`/jobs/${id}/verify-start-otp`, { otp, notes }).then(res => handleResponse(res)),

  requestEndOTP: (id: number): Promise<OTPResponse> =>
    axiosInstance.post(`/jobs/${id}/request-end-otp`).then(res => handleResponse(res)),

  verifyEndOTP: (id: number, otp: string, notes?: string): Promise<Job> =>
    axiosInstance.post(`/jobs/${id}/verify-end-otp`, { otp, notes }).then(res => handleResponse(res)),

  getHistory: (id: number): Promise<JobStatusLog[]> =>
    axiosInstance.get(`/jobs/${id}/history`).then(res => handleResponse(res)),
};

// Admin APIs
export const adminAPI = {
  getIPUsers: (): Promise<IPUser[]> =>
    axiosInstance.get('/admin/ips').then(res => handleResponse(res)),

  getApprovedIPUsers: (): Promise<IPUser[]> =>
    axiosInstance.get('/admin/ips/approved').then(res => handleResponse(res)),

  verifyIPUser: (phoneNumber: string, adminIds?: number[]): Promise<ApiResponse> =>
    axiosInstance.post(`/admin/verify-ip/${phoneNumber}`, { admin_ids: adminIds }).then(res => handleResponse(res)),

  getAdminUsers: (): Promise<AdminUser[]> =>
    axiosInstance.get('/admin/admin-users').then(res => handleResponse(res)),

  assignAdminsToIP: (ipId: number, adminIds: number[]): Promise<ApiResponse> =>
    axiosInstance.post(`/admin/ips/${ipId}/assign-admins`, { admin_ids: adminIds }).then(res => handleResponse(res)),

  getIPAdmins: (ipId: number): Promise<AdminUser[]> =>
    axiosInstance.get(`/admin/ips/${ipId}/admins`).then(res => handleResponse(res)),
};

// Analytics APIs
export const analyticsAPI = {
  getPayoutReport: (params: {
    period: string;
    year?: number;
    month?: number;
    quarter?: number;
  }): Promise<PayoutSummary> =>
    axiosInstance.get('/analytics/payout', { params }).then(res => handleResponse(res)),

  getJobStages: (): Promise<JobStageCount[]> =>
    axiosInstance.get('/analytics/job-stages').then(res => handleResponse(res)),

  getIPPerformance: (): Promise<any> =>
    axiosInstance.get('/analytics/ip-performance').then(res => handleResponse(res)),
};

// Checklist APIs
export const checklistAPI = {
  getAll: (): Promise<Checklist[]> =>
    axiosInstance.get('/checklists').then(res => handleResponse(res)),

  create: (data: { name: string }): Promise<Checklist> =>
    axiosInstance.post('/checklists', data).then(res => handleResponse(res)),

  getById: (id: number): Promise<Checklist> =>
    axiosInstance.get(`/checklists/${id}`).then(res => handleResponse(res)),

  createItem: (checklistId: number, data: { name: string }): Promise<ApiResponse> =>
    axiosInstance.post('/checklists/items', { ...data, checklist_id: checklistId }).then(res => handleResponse(res)),

  getJobChecklistsStatus: (jobId: number): Promise<ApiResponse> =>
    axiosInstance.get(`/checklists/jobs/${jobId}/status`).then(res => handleResponse(res)),

  updateJobChecklistItemStatus: (
    jobId: number,
    itemId: number,
    data: { is_approved?: boolean; admin_comment?: string }
  ): Promise<ApiResponse> =>
    axiosInstance.put(`/checklists/jobs/${jobId}/items/${itemId}/status`, data).then(res => handleResponse(res)),
};