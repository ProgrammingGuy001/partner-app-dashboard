import axiosInstance from './axios';
import { clearAdminTokens, persistAdminTokens } from './authStorage';

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

export interface AssignedIPSummary {
  id: number;
  first_name: string;
  last_name: string;
  phone_number: string;
  is_assigned: boolean;
  is_internal: boolean;
}

export interface InvoiceRequest {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  invoice_number: string | null;
  completion_percentage: number | null;
  notes: string | null;
  requested_at: string;
  requested_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  job_id?: number;
  job_name?: string | null;
}

export interface BillingData {
  job_id: number;
  job_name: string;
  job_type: string | null;
  rate: string | null;
  size: number | null;
  state: string | null;
  invoice_request: InvoiceRequest | null;
  invoice_requests?: InvoiceRequest[];
  ip: {
    name: string;
    phone: string;
    city: string | null;
    pan_number: string | null;
    account_number: string | null;
    ifsc_code: string | null;
    account_holder_name: string | null;
  };
}

export interface Job {
  id?: number;
  name: string;
  customer_id?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: number | null;
  job_rate_id?: number | null;
  type?: string | null;
  rate?: number | null;
  size?: number;
  assigned_ip_id?: number;
  assigned_ip_name?: string;
  assigned_ip?: AssignedIPSummary;
  is_ip_available?: boolean;
  start_date?: string;
  delivery_date: string;
  checklist_link?: string;
  checklist_ids?: number[];
  job_checklists?: { checklist_id: number }[];
  google_map_link?: string;
  status: string;
  incentive?: number;
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
  timestamp?: string;
  created_at?: string;
}

export interface JobStageCount {
  status: string;
  count: number;
  total_payout: number;
  total_additional_expense: number;
}

export interface PayoutByIP {
  ip_id: number;
  ip_name: string;
  job_count: number;
  total_payout: number;
  total_additional_expense: number;
}

export interface PayoutSummary {
  period: string;
  start_date: string;
  end_date: string;
  total_jobs: number;
  total_payout: number;
  total_additional_expense: number;
  job_stages: JobStageCount[];
  payout_by_ip: PayoutByIP[];
  // Backward-compatible alias used by older frontend code.
  payout_by_ip_user?: PayoutByIP[];
}

// Backward-compatible type alias.
export type PayoutByIPUser = PayoutByIP;

const JOBS_API_MAX_LIMIT = 200;

export interface IPUser {
  id: number;
  first_name: string;
  last_name: string;
  phone_number: string;
  city: string;
  pincode: number | string;
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

export interface Customer {
  id: number;
  name: string;
  phone_number?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: number | null;
  created_at?: string;
}

export interface JobRate {
  id: number;
  job_type_name: string;
  base_rate: number;
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

export interface SOLookupResult {
  sales_order: string;
  client_order_ref: string;
  amount_total: number;
  order_state: string;
  customer_name: string;
  phone: string;
  email: string;
  address_line_1: string;
  address_line_2: string;
  city: string;
  pincode: string;
  state: string;
  project_name: string;
}

export interface Checklist {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  checklist_items?: ChecklistItem[];
  items?: ChecklistItem[]; // compatibility for existing UI code
}

export interface ChecklistItem {
  id: number;
  text: string;
  position: number;
  checked?: boolean;
  is_completed?: boolean; // compatibility
  name?: string; // compatibility
  status?: ChecklistItemStatus;
}

export interface ChecklistItemStatus {
  id: number;
  checked: boolean;
  is_approved: boolean;
  comment?: string;
  admin_comment?: string;
  document_link?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ChecklistWithStatus {
  id: number;
  name: string;
  description?: string;
  items: ChecklistItem[];
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

const normalizeJob = (job: any): Job => {
  if (!job || typeof job !== 'object') {
    return job;
  }

  const rawIncentive = job.incentive ?? job.additional_expense ?? 0;
  const incentive = Number(rawIncentive) || 0;

  return {
    ...job,
    incentive,
    additional_expense: incentive,
  };
};

const normalizeJobPayload = (job: Partial<Job>) => {
  const incentive = job.incentive ?? job.additional_expense;
  const payload: Record<string, unknown> = { ...job };

  if (incentive !== undefined) {
    payload.incentive = incentive;
  }

  delete payload.additional_expense;
  return payload;
};

// ============ API Functions ============

// Auth APIs
export const authAPI = {
  login: (data: LoginRequest): Promise<any> =>
    axiosInstance.post('/auth/login', data).then(res => {
      persistAdminTokens(res.data);
      return handleResponse(res);
    }),

  signup: (data: SignupRequest): Promise<any> =>
    axiosInstance.post('/auth/signup', data).then(res => handleResponse(res)),

  getCurrentUser: (): Promise<any> =>
    axiosInstance.get('/auth/me').then(res => handleResponse(res)),

  verifyToken: (): Promise<any> =>
    axiosInstance.get('/auth/verify-token').then(res => handleResponse(res)),

  refreshToken: (): Promise<any> =>
    axiosInstance.post('/auth/refresh-token').then(res => {
      persistAdminTokens(res.data);
      return handleResponse(res);
    }),

  logout: (): Promise<any> =>
    axiosInstance.post('/auth/logout').then(res => {
      clearAdminTokens();
      return handleResponse(res);
    }),
};

// Job APIs with pagination support
export const jobAPI = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    search?: string;
  }): Promise<Job[] | PaginatedResponse<Job>> => {
    const { page = 1, limit = 100, ...rest } = params || {};
    const mapJobResponse = (res: Awaited<ReturnType<typeof axiosInstance.get>>) => {
      const data = handleResponse<Job[] | PaginatedResponse<Job>>(res);
      if (Array.isArray(data)) {
        return data.map(normalizeJob);
      }
      return {
        ...data,
        jobs: data.jobs?.map(normalizeJob),
        data: data.data?.map(normalizeJob),
      };
    };

    if (limit <= JOBS_API_MAX_LIMIT) {
      const skip = (page - 1) * limit;
      const response = await axiosInstance.get('/jobs', {
        params: { ...rest, skip, limit }
      });
      return mapJobResponse(response);
    }

    let remaining = limit;
    let skip = (page - 1) * limit;
    const allJobs: Job[] = [];

    while (remaining > 0) {
      const batchLimit = Math.min(remaining, JOBS_API_MAX_LIMIT);
      const response = await axiosInstance.get('/jobs', {
        params: { ...rest, skip, limit: batchLimit }
      });
      const data = mapJobResponse(response);
      const batch = Array.isArray(data) ? data : (data.jobs || data.data || []);
      allJobs.push(...batch);

      if (batch.length < batchLimit) {
        break;
      }

      remaining -= batch.length;
      skip += batch.length;
    }

    return allJobs;
  },

  getById: (id: number): Promise<Job> =>
    axiosInstance.get(`/jobs/${id}`).then(res => normalizeJob(handleResponse(res))),

  getCustomers: (params?: { search?: string; limit?: number }): Promise<Customer[]> =>
    axiosInstance.get('/jobs/customers', { params }).then(res => handleResponse(res)),

  getJobRates: (): Promise<JobRate[]> =>
    axiosInstance.get('/jobs/job-rates').then(res => handleResponse(res)),

  create: (data: Omit<Job, 'id'>): Promise<Job> =>
    axiosInstance.post('/jobs', normalizeJobPayload(data)).then(res => normalizeJob(handleResponse(res))),

  update: (id: number, data: JobUpdate): Promise<Job> =>
    axiosInstance.put(`/jobs/${id}`, normalizeJobPayload(data)).then(res => normalizeJob(handleResponse(res))),

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
    axiosInstance.post(`/jobs/${id}/verify-start-otp`, { otp, notes }).then(res => normalizeJob(handleResponse(res))),

  requestEndOTP: (id: number): Promise<OTPResponse> =>
    axiosInstance.post(`/jobs/${id}/request-end-otp`).then(res => handleResponse(res)),

  verifyEndOTP: (id: number, otp: string, notes?: string): Promise<Job> =>
    axiosInstance.post(`/jobs/${id}/verify-end-otp`, { otp, notes }).then(res => normalizeJob(handleResponse(res))),

  getHistory: (id: number): Promise<JobStatusLog[]> =>
    axiosInstance.get(`/jobs/${id}/history`).then(res => handleResponse(res)),

  uploadFile: (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append("file", file);
    return axiosInstance.post('/jobs/upload-file', formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(res => handleResponse(res));
  },

  lookupSalesOrder: (soNumber: string): Promise<SOLookupResult> =>
    axiosInstance.get(`/jobs/lookup-so/${encodeURIComponent(soNumber)}`).then(res => handleResponse(res)),

  getBilling: (id: number): Promise<BillingData> =>
    axiosInstance.get(`/jobs/${id}/billing`).then(res => handleResponse(res)),

  requestInvoice: (id: number): Promise<{ message: string; invoice_request: InvoiceRequest }> =>
    axiosInstance.post(`/jobs/${id}/invoice-request`).then(res => handleResponse(res)),

  requestAdditionalInvoice: (id: number, data?: { completion_percentage?: number; notes?: string }): Promise<{ message: string; invoice_request: InvoiceRequest }> =>
    axiosInstance.post(`/jobs/${id}/invoice-requests`, data ?? {}).then(res => handleResponse(res)),

  approveInvoice: (id: number): Promise<{ message: string; invoice_request: InvoiceRequest }> =>
    axiosInstance.put(`/jobs/${id}/invoice-request/approve`).then(res => handleResponse(res)),

  rejectInvoice: (id: number, reason?: string): Promise<{ message: string; invoice_request: InvoiceRequest }> =>
    axiosInstance.put(`/jobs/${id}/invoice-request/reject`, null, { params: { reason: reason || '' } }).then(res => handleResponse(res)),

  getPendingInvoiceRequests: (): Promise<{ pending_count: number; requests: InvoiceRequest[] }> =>
    axiosInstance.get('/jobs/invoice-requests/pending').then(res => handleResponse(res)),

  downloadInvoice: async (id: number, jobName?: string | null): Promise<void> => {
    const response = await axiosInstance.get(`/jobs/${id}/invoice-request/download`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `billing_invoice_${jobName || id}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
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
    axiosInstance.get('/analytics/payout', { params }).then(res => {
      const data = handleResponse<PayoutSummary>(res);
      // Normalize legacy/new shapes for callers.
      if (!data.payout_by_ip && data.payout_by_ip_user) {
        data.payout_by_ip = data.payout_by_ip_user;
      }
      if (!data.payout_by_ip_user && data.payout_by_ip) {
        data.payout_by_ip_user = data.payout_by_ip;
      }
      return data;
    }),

  getJobStages: (): Promise<JobStageCount[]> =>
    axiosInstance.get('/analytics/job-stages').then(res => handleResponse(res)),

  getIPPerformance: (): Promise<any> =>
    axiosInstance.get('/analytics/ip-performance').then(res => handleResponse(res)),
};

export interface DailyAttendance {
  id: number;
  job_id: number | null;
  job_name: string | null;
  phone: string;
  latitude: number;
  longitude: number;
  manual_location: string | null;
  photo_url: string | null;
  recorded_at: string;
}

export interface AttendanceListResponse {
  total: number;
  skip: number;
  limit: number;
  completion_summary?: IPAttendanceCompletion[];
  records: DailyAttendance[];
}

export interface AttendanceCompletion {
  registered_at: string;
  total_days: number;
  completed_days: number;
  missing_days: number;
  completion_percentage: number;
}

export interface IPAttendanceCompletion extends AttendanceCompletion {
  ip_id: number;
  name: string;
  phone: string;
}

export interface AdminAttendanceCompletion extends AttendanceCompletion {
  admin_id: number;
  admin_email: string;
}

export const attendanceAPI = {
  getAll: (params?: {
    job_id?: number;
    phone?: string;
    date_from?: string;
    date_to?: string;
    skip?: number;
    limit?: number;
  }): Promise<AttendanceListResponse> =>
    axiosInstance.get('/admin/attendance', { params }).then(res => handleResponse(res)),
};

export interface AdminAttendanceRecord {
  id: number;
  admin_id: number;
  admin_email: string;
  marked_at: string;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  manual_location: string | null;
  photo_url: string | null;
}

export interface AdminAttendanceListResponse {
  total: number;
  completion?: AttendanceCompletion;
  completion_summary?: AdminAttendanceCompletion[];
  records: AdminAttendanceRecord[];
}

export const adminAttendanceAPI = {
  mark: (data: { latitude: number; longitude: number; notes?: string; manual_location?: string; photo: File }): Promise<{ message: string; record: AdminAttendanceRecord }> => {
    const formData = new FormData();
    formData.append('latitude', String(data.latitude));
    formData.append('longitude', String(data.longitude));
    if (data?.notes) formData.append('notes', data.notes);
    if (data?.manual_location) formData.append('manual_location', data.manual_location);
    formData.append('photo', data.photo, data.photo.name);
    return axiosInstance.post('/admin/my-attendance', formData).then(res => handleResponse(res));
  },

  getMine: (params?: { skip?: number; limit?: number }): Promise<AdminAttendanceListResponse> =>
    axiosInstance.get('/admin/my-attendance', { params }).then(res => handleResponse(res)),

  getAll: (params?: {
    admin_id?: number;
    date_from?: string;
    date_to?: string;
    skip?: number;
    limit?: number;
  }): Promise<AdminAttendanceListResponse & { skip: number; limit: number }> =>
    axiosInstance.get('/admin/all-attendance', { params }).then(res => handleResponse(res)),
};

// Checklist APIs
export const checklistAPI = {
  getAll: (): Promise<Checklist[]> =>
    axiosInstance.get('/checklists').then(res => handleResponse(res)),

  create: (data: { name: string }): Promise<Checklist> =>
    axiosInstance.post('/checklists', data).then(res => handleResponse(res)),

  getById: (id: number): Promise<Checklist> =>
    axiosInstance.get(`/checklists/${id}`).then(res => handleResponse(res)),

  createItem: (checklistId: number, data: { text: string }): Promise<ApiResponse> =>
    axiosInstance.post('/checklists/items', { ...data, checklist_id: checklistId }).then(res => handleResponse(res)),

  getJobChecklistsStatus: (jobId: number): Promise<ChecklistWithStatus[]> =>
    axiosInstance.get(`/checklists/jobs/${jobId}/status`).then(res => handleResponse(res)),

  updateJobChecklistItemStatus: (
    jobId: number,
    itemId: number,
    data: { checked?: boolean; is_approved?: boolean; admin_comment?: string | null }
  ): Promise<ApiResponse> =>
    axiosInstance.put(`/checklists/jobs/${jobId}/items/${itemId}/status`, data).then(res => handleResponse(res)),
};
