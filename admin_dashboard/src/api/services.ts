import axiosInstance from './axios';
import type { AxiosResponse } from 'axios';

// ============ Types ============
export interface LoginRequest {
  email: string;
  password: string;
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

export interface JobApprovalRequest {
  id: number;
  job_id: number;
  action: 'start' | 'finish';
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  requested_by_id: number | null;
  requested_at: string | null;
  reviewed_by_id: number | null;
  reviewed_at: string | null;
  review_notes: string | null;
  job_name: string | null;
  requested_by_name: string | null;
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
  // Read-only: the server serves the customer's name. Never send this.
  name?: string | null;
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
  // null on write clears the assignment, e.g. when a job moves from an IP to a supervisor.
  assigned_ip_id?: number | null;
  assigned_ip_name?: string;
  assigned_ip?: AssignedIPSummary;
  is_ip_available?: boolean;
  start_date?: string;
  delivery_date: string;
  checklist_ids?: number[];
  job_checklists?: { checklist_id: number }[];
  // Read-only: derived server-side from latitude/longitude. Never send this.
  google_map_link?: string;
  latitude?: number | null;
  longitude?: number | null;
  geofence_radius?: number | null;
  status: string;
  incentive?: number;
  additional_expense?: number;
  start_otp_verified?: boolean;
  end_otp_verified?: boolean;
  handover_document_link?: string | null;
  ncr_document_link?: string | null;
  project_report_document_link?: string | null;
  drawing_document_link?: string | null;
  sales_order?: string | null;
  // Optional attendance slot as "HH:MM:SS". When set, check-in opens at slot_start and
  // closes 30 min later instead of the 10:30 cutoff. slot_end is informational.
  slot_start?: string | null;
  slot_end?: string | null;
  user_id?: number | null;
  assigned_admin_name?: string | null;
  // Write-side alias of user_id: the supervisor who owns the site.
  admin_assigned?: number | null;
  created_at?: string;
  updated_at?: string;
}

export type JobUpdate = Partial<Omit<Job, 'id'>>;

// A rate card. Superadmins create them; any admin picks one on a job, which
// stamps the card's type and rate onto that job.
export interface JobRate {
  id: number;
  job_type_name: string;
  base_rate: number;
  location: string;
  description?: string | null;
}

export type JobRateCreate = Omit<JobRate, 'id'>;

export interface ResolvedMapUrl {
  latitude: number | null;
  longitude: number | null;
  // Set when the link named a place but carried no pin — fall back to address search.
  place_name: string | null;
}

export interface CompletionDocumentLinks {
  handover_document_link: string;
  ncr_document_link: string;
  project_report_document_link: string;
}

export interface NcrDocumentRow {
  sales_order: string;
  part_no: string;
  part_description: string;
  qty: string;
  issue_description: string;
  disposition: string;
}

export interface ProjectDocumentRequest {
  data_source: 'manual' | 'app';
  project_name: string;
  sales_order: string;
  project_rating?: string;
  accomplishment?: string;
  total_expense?: string;
  scope_summary?: string;
  design_perspective?: string;
  product?: string;
  quality?: string;
  operation?: string;
  fulfillment?: string;
  learning?: string;
  ncr_document_number: string;
  ncr_revision: string;
  city_operation_in_charge: string;
  project_marshal: string;
  customer_quality_lead: string;
  no_ncr_reported: boolean;
  ncr_rows: NcrDocumentRow[];
}

export interface MonthlyProjectRow {
  job_id: number | null;
  project_id: string;
  project_name: string;
  handover_date: string;
  days_taken: string;
  learning: string;
}

export interface MonthlyDocumentRequest {
  data_source: 'manual' | 'app';
  month_year: string;
  experience_centre: string;
  ops_manager: string;
  team_needed: string;
  trained_team: string;
  training_needed: string;
  projects: MonthlyProjectRow[];
}

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
  is_internal: boolean;
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

export interface AdminUser {
  id: number;
  email: string;
  isActive: boolean;
  isApproved: boolean;
  is_superadmin: boolean;
  is_dev?: boolean;
  name?: string | null;
}

export interface User {
  id: number;
  email: string;
  isActive: boolean;
  isApproved: boolean;
  is_superadmin: boolean;
  is_dev: boolean;
  name?: string | null;
}

export interface PurchaseVendor {
  id: number;
  name: string;
}

export interface PurchaseOrderRequest {
  id: number;
  po_number: string | null;
  vendor_id: number;
  vendor_name: string;
  sales_order: string | null;
  poc_name: string | null;
  service_type: 'b2b' | 'b2c';
  product_name: string;
  quantity: number;
  unit_price: number;
  status: 'pending' | 'approved';
  requested_at: string;
  requested_by_email?: string | null;
  approved_at?: string | null;
  approved_by_email?: string | null;
  odoo_purchase_order_id?: number | null;
  odoo_purchase_order_name?: string | null;
  odoo_sync_error?: string | null;
  odoo_purchase_order_state?: string | null;
  odoo_invoice_status?: string | null;
  odoo_status_error?: string | null;
  bill_status: 'not_requested' | 'pending' | 'approved';
  bill_requested_at?: string | null;
  bill_requested_by_email?: string | null;
  bill_approved_at?: string | null;
  bill_approved_by_email?: string | null;
  odoo_vendor_bill_id?: number | null;
  odoo_vendor_bill_name?: string | null;
  odoo_vendor_bill_state?: string | null;
  bill_sync_error?: string | null;
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
}

export interface ChecklistItem {
  id: number;
  text: string;
  position: number;
  status?: ChecklistItemStatus;
}

export interface ChecklistItemStatus {
  id: number;
  checked: boolean;
  is_approved: boolean;
  review_status: 'pending' | 'approved' | 'rejected';
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
  document_link?: string | null;
  template_available?: boolean;
  items: ChecklistItem[];
}

// ============ API Response Helpers ============
const handleResponse = <T>(response: AxiosResponse<T> | T): T => {
  // Check if response has data property (consistent API structure)
  if (
    response &&
    typeof response === 'object' &&
    'data' in response &&
    (response).data !== undefined
  ) {
    return response.data;
  }
  // Fallback to the entire response
  return response as T;
};

const getAllPages = async <T>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  maxPages = 50,
): Promise<T[]> => {
  const items: T[] = [];
  let offset = 0;

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const response = await axiosInstance.get(path, {
      params: { ...params, offset, limit: JOBS_API_MAX_LIMIT },
    });
    const page = handleResponse<T[]>(response);
    if (!Array.isArray(page) || page.length === 0) return items;
    items.push(...page);
    if (page.length < JOBS_API_MAX_LIMIT) return items;
    offset += page.length;
  }

  throw new Error('Could not load all results. Narrow the filters and try again.');
};

const downloadAttachment = (response: AxiosResponse<Blob>, fallback: string) => {
  const disposition = String(response.headers['content-disposition'] || '');
  const filename = disposition.match(/filename="?([^";]+)/i)?.[1] || fallback;
  const url = globalThis.URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => globalThis.URL.revokeObjectURL(url), 10000);
};

const normalizeJob = (job: unknown): Job => {
  if (!job || typeof job !== 'object') {
    return job as Job;
  }

  const source = job as Job;
  const rawIncentive = source.incentive ?? source.additional_expense ?? 0;
  const incentive = Number(rawIncentive) || 0;

  return {
    ...source,
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
  // Tokens arrive as HttpOnly cookies; the copies in the body are deliberately ignored.
  login: (data: LoginRequest): Promise<unknown> =>
    axiosInstance.post('/auth/login', data).then(res => handleResponse(res)),

  getCurrentUser: (): Promise<User> =>
    axiosInstance.get('/auth/me').then(res => handleResponse(res)),

  verifyToken: (): Promise<unknown> =>
    axiosInstance.get('/auth/verify-token').then(res => handleResponse(res)),

  refreshToken: (): Promise<unknown> =>
    axiosInstance.post('/auth/refresh-token').then(res => handleResponse(res)),

  logout: (): Promise<unknown> =>
    axiosInstance.post('/auth/logout').then(res => handleResponse(res)),

  // Superadmin-only: reset another admin's password.
  resetPassword: (email: string, newPassword: string): Promise<{ message: string; email: string }> =>
    axiosInstance
      .post('/auth/admin/reset-password', { email, new_password: newPassword })
      .then(res => handleResponse(res)),

  updateProfile: (data: { name: string }): Promise<User> =>
    axiosInstance.put('/auth/me', data).then(res => handleResponse(res)),
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
    const mapJobResponse = (res: AxiosResponse<Job[] | PaginatedResponse<Job>>) => {
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

  // Short links (maps.app.goo.gl) can only be followed server-side — CORS hides the
  // Location header from the browser.
  resolveMapUrl: (url: string): Promise<ResolvedMapUrl> =>
    axiosInstance.post('/jobs/resolve-map-url', { url }).then(res => handleResponse(res)),

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

  finish: (id: number, notes: string | undefined, documents: CompletionDocumentLinks): Promise<ApiResponse> =>
    axiosInstance.post(`/jobs/${id}/finish`, { notes, ...documents }).then(res => handleResponse(res)),

  // OTP-based job start/finish
  requestStartOTP: (id: number): Promise<OTPResponse> =>
    axiosInstance.post(`/jobs/${id}/request-start-otp`).then(res => handleResponse(res)),

  verifyStartOTP: (id: number, otp: string, notes?: string): Promise<Job> =>
    axiosInstance.post(`/jobs/${id}/verify-start-otp`, { otp, notes }).then(res => normalizeJob(handleResponse(res))),

  requestEndOTP: (id: number): Promise<OTPResponse> =>
    axiosInstance.post(`/jobs/${id}/request-end-otp`).then(res => handleResponse(res)),

  verifyEndOTP: (id: number, otp: string, notes: string | undefined, documents: CompletionDocumentLinks): Promise<Job> =>
    axiosInstance.post(`/jobs/${id}/verify-end-otp`, { otp, notes, ...documents }).then(res => normalizeJob(handleResponse(res))),

  // Superadmin approval — the fallback when the customer OTP can't be used
  createApprovalRequest: (
    id: number,
    data: { action: 'start' | 'finish'; reason: string } & Partial<CompletionDocumentLinks>,
  ): Promise<JobApprovalRequest> =>
    axiosInstance.post(`/jobs/${id}/approval-requests`, data).then(res => handleResponse(res)),

  getApprovalRequests: (id: number): Promise<JobApprovalRequest[]> =>
    axiosInstance.get(`/jobs/${id}/approval-requests`).then(res => handleResponse(res)),

  getPendingApprovalRequests: (): Promise<JobApprovalRequest[]> =>
    axiosInstance.get('/jobs/approval-requests/pending').then(res => handleResponse(res)),

  approveApprovalRequest: (requestId: number): Promise<JobApprovalRequest> =>
    axiosInstance.put(`/jobs/approval-requests/${requestId}/approve`).then(res => handleResponse(res)),

  rejectApprovalRequest: (requestId: number, reason?: string): Promise<JobApprovalRequest> =>
    axiosInstance.put(`/jobs/approval-requests/${requestId}/reject`, null, { params: { reason: reason || '' } })
      .then(res => handleResponse(res)),

  getHistory: (id: number): Promise<JobStatusLog[]> =>
    axiosInstance.get(`/jobs/${id}/history`).then(res => handleResponse(res)),

  uploadFile: (file: File, completion?: { jobId: number; documentType: 'handover' | 'ncr' | 'project_report' }): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append("file", file);
    if (completion) {
      formData.append("job_id", String(completion.jobId));
      formData.append("document_type", completion.documentType);
    }
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

  getPendingApprovalJobs: (): Promise<Job[]> =>
    getAllPages<Job>('/jobs/pending-approval'),

  approveJobCreation: (id: number): Promise<Job> =>
    axiosInstance.post(`/jobs/${id}/approve-creation`).then(res => normalizeJob(handleResponse(res))),

  rejectJobCreation: (id: number, reason?: string): Promise<Job> =>
    axiosInstance.post(`/jobs/${id}/reject-creation`, null, { params: { reason: reason || '' } }).then(res => normalizeJob(handleResponse(res))),

  generateNcr: async (id: number, data: ProjectDocumentRequest): Promise<{ url: string; filename: string } | null> => {
    const response = await axiosInstance.post<Blob>(`/jobs/${id}/documents/project-ncr`, data, { responseType: 'blob' });
    if (String(response.headers['content-type']).includes('application/json')) {
      return JSON.parse(await response.data.text());
    }
    downloadAttachment(response, `level-2-ncr-job-${id}.pdf`);
    return null;
  },

  downloadNcr: async (data: ProjectDocumentRequest): Promise<void> => {
    const response = await axiosInstance.post('/jobs/documents/ncr', data, { responseType: 'blob' });
    downloadAttachment(response, 'level-2-ncr.pdf');
  },

  generateProjectReport: async (id: number, data: MonthlyDocumentRequest): Promise<{ url: string; filename: string } | null> => {
    const response = await axiosInstance.post<Blob>(`/jobs/${id}/documents/project-report`, data, { responseType: 'blob' });
    if (String(response.headers['content-type']).includes('application/json')) {
      return JSON.parse(await response.data.text());
    }
    downloadAttachment(response, `project-report-job-${id}.xlsx`);
    return null;
  },

  downloadMonthlyProjects: async (data: MonthlyDocumentRequest): Promise<void> => {
    const response = await axiosInstance.post('/jobs/documents/monthly', data, { responseType: 'blob' });
    downloadAttachment(response, `monthly-executed-projects-${data.month_year}.xlsx`);
  },

  downloadInvoice: async (id: number, jobName?: string | null, invoiceRequestId?: number): Promise<void> => {
    const path = invoiceRequestId
      ? `/jobs/${id}/invoice-requests/${invoiceRequestId}/download`
      : `/jobs/${id}/invoice-request/download`;
    const response = await axiosInstance.get(path, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `billing_invoice_${jobName || id}_${invoiceRequestId || 'latest'}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link?.remove();
    globalThis.URL.revokeObjectURL(url);
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

export const purchaseOrderAPI = {
  searchVendors: (search: string): Promise<PurchaseVendor[]> =>
    axiosInstance.get('/admin/purchase-orders/vendors', { params: { search } }).then(res => handleResponse(res)),

  list: (): Promise<PurchaseOrderRequest[]> =>
    getAllPages<PurchaseOrderRequest>('/admin/purchase-orders'),

  create: (data: {
    vendor_id: number;
    sales_order: string;
    poc_name: string;
    service_type: 'b2b' | 'b2c';
    quantity: number;
    unit_price: number;
  }): Promise<PurchaseOrderRequest> =>
    axiosInstance.post('/admin/purchase-orders', data).then(res => handleResponse(res)),

  approve: (id: number): Promise<PurchaseOrderRequest> =>
    axiosInstance.post(`/admin/purchase-orders/${id}/approve`).then(res => handleResponse(res)),

  requestBill: (id: number): Promise<PurchaseOrderRequest> =>
    axiosInstance.post(`/admin/purchase-orders/${id}/bill-request`).then(res => handleResponse(res)),

  approveBill: (id: number): Promise<PurchaseOrderRequest> =>
    axiosInstance.post(`/admin/purchase-orders/${id}/bill-request/approve`).then(res => handleResponse(res)),
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

  getIPPerformance: (): Promise<PayoutByIP[]> =>
    axiosInstance.get('/analytics/ip-performance').then(res => handleResponse(res)),
};

export interface DailyAttendance {
  id: number;
  job_id: number | null;
  job_name: string | null;
  phone: string;
  attendance_type: 'check_in' | 'check_out';
  latitude: number;
  longitude: number;
  // null means the job had no map pin to measure against, not "outside the fence".
  distance_meters: number | null;
  within_geofence: boolean | null;
  manual_location: string | null;
  photo_url: string | null;
  report_document_url: string | null;
  report_status: 'submitted' | 'submitted_late' | 'auto_closed' | null;
  checkout_source: 'manual' | 'auto' | null;
  recorded_at: string;
}

export interface AttendanceListResponse {
  total: number;
  skip: number;
  limit: number;
  completion_summary?: IPAttendanceCompletion[];
  missing_reports?: Array<{
    ip_user_id: number | null;
    phone: string;
    job_id: number | null;
    job_name: string | null;
    attendance_date: string;
    status: 'missing' | 'overdue';
  }>;
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

  exportXlsx: async (params?: {
    job_id?: number;
    phone?: string;
    admin_id?: number;
    date_from?: string;
    date_to?: string;
  }): Promise<void> => {
    const response = await axiosInstance.get<Blob>('/admin/attendance/export', {
      params,
      responseType: 'blob',
    });
    downloadAttachment(response, 'attendance.xlsx');
  },
};

export interface AdminAttendanceRecord {
  id: number;
  admin_id: number;
  admin_email: string;
  marked_at: string;
  latitude: number | null;
  longitude: number | null;
  // Supervisors don't name a site, so the fix is matched to the nearest pinned job.
  matched_job_id: number | null;
  matched_job_name: string | null;
  distance_meters: number | null;
  within_geofence: boolean | null;
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

export interface SundayWorkRequestIP {
  id: number;
  first_name: string | null;
  last_name: string | null;
  phone_number: string;
}

export interface SundayWorkRequestAdmin {
  id: number;
  name: string | null;
  email: string;
}

export interface SundayWorkRequest {
  id: number;
  ip_user_id: number | null;
  admin_id: number | null;
  requester_type: 'ip' | 'supervisor';
  request_date: string;
  status: 'pending' | 'approved' | 'rejected';
  reason: string | null;
  reviewed_by_admin_id: number | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  ip_user: SundayWorkRequestIP | null;
  admin: SundayWorkRequestAdmin | null;
}

// IPs submit from the mobile app, supervisors from this dashboard; only superadmins approve.
export const sundayWorkRequestAPI = {
  list: (status?: string): Promise<SundayWorkRequest[]> =>
    getAllPages<SundayWorkRequest>('/admin/sunday-requests', { status }),

  create: (data: { request_date: string; reason?: string }): Promise<SundayWorkRequest> =>
    axiosInstance.post('/admin/sunday-requests', data).then(res => handleResponse(res)),

  approve: (id: number, reviewNotes?: string): Promise<SundayWorkRequest> =>
    axiosInstance.put(`/admin/sunday-requests/${id}/approve`, { review_notes: reviewNotes }).then(res => handleResponse(res)),

  reject: (id: number, reviewNotes?: string): Promise<SundayWorkRequest> =>
    axiosInstance.put(`/admin/sunday-requests/${id}/reject`, { review_notes: reviewNotes }).then(res => handleResponse(res)),
};

// Checklist APIs
export const jobRateAPI = {
  getAll: (): Promise<JobRate[]> =>
    axiosInstance.get('/job-rates').then(res => handleResponse(res)),

  create: (data: JobRateCreate): Promise<JobRate> =>
    axiosInstance.post('/job-rates', data).then(res => handleResponse(res)),
};

export const checklistAPI = {
  getAll: (): Promise<Checklist[]> =>
    axiosInstance.get('/checklists').then(res => handleResponse(res)),

  create: (data: { name: string; description?: string }): Promise<Checklist> =>
    axiosInstance.post('/checklists', data).then(res => handleResponse(res)),

  update: (id: number, data: { name: string; description?: string }): Promise<Checklist> =>
    axiosInstance.put(`/checklists/${id}`, data).then(res => handleResponse(res)),

  delete: (id: number): Promise<Checklist> =>
    axiosInstance.delete(`/checklists/${id}`).then(res => handleResponse(res)),

  getById: (id: number): Promise<Checklist> =>
    axiosInstance.get(`/checklists/${id}`).then(res => handleResponse(res)),

  createItem: (checklistId: number, data: { text: string; position?: number }): Promise<ChecklistItem> =>
    axiosInstance.post('/checklists/items', { ...data, checklist_id: checklistId }).then(res => handleResponse(res)),

  updateItem: (itemId: number, data: { text: string; position: number }): Promise<ChecklistItem> =>
    axiosInstance.put(`/checklists/items/${itemId}`, data).then(res => handleResponse(res)),

  deleteItem: (itemId: number): Promise<ChecklistItem> =>
    axiosInstance.delete(`/checklists/items/${itemId}`).then(res => handleResponse(res)),

  getJobChecklistsStatus: (jobId: number): Promise<ChecklistWithStatus[]> =>
    axiosInstance.get(`/checklists/jobs/${jobId}/status`).then(res => handleResponse(res)),

  updateJobChecklistItemStatus: (
    jobId: number,
    itemId: number,
    data: { checked?: boolean; is_approved?: boolean; review_status?: 'pending' | 'approved' | 'rejected'; admin_comment?: string | null; document_link?: string | null }
  ): Promise<ApiResponse> =>
    axiosInstance.put(`/checklists/jobs/${jobId}/items/${itemId}/status`, data).then(res => handleResponse(res)),

  downloadJobChecklistTemplate: async (jobId: number, checklistId: number): Promise<void> => {
    const response = await axiosInstance.get<Blob>(`/checklists/jobs/${jobId}/${checklistId}/template`, { responseType: 'blob' });
    downloadAttachment(response, 'All Check-list.xlsx');
  },

  exportJobChecklist: async (jobId: number, checklistId: number, checklistName: string): Promise<void> => {
    const response = await axiosInstance.get<Blob>(`/checklists/jobs/${jobId}/${checklistId}/export`, { responseType: 'blob' });
    downloadAttachment(response, `Job-${jobId}-${checklistName}.pdf`);
  },

  uploadJobChecklistDocument: (jobId: number, checklistId: number, file: File): Promise<{ document_link: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosInstance
      .post(`/checklists/jobs/${jobId}/${checklistId}/document`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(res => handleResponse(res));
  },
};

// ─── Site GRN Types ───────────────────────────────────────────────────────────

export interface GRNPackage {
  id: number;
  odoo_package_id: number | null;
  package_name: string;
  is_received: boolean;
}

export interface GRNIPUser {
  id: number;
  first_name: string | null;
  last_name: string | null;
  phone_number: string;
}

export interface GRNAdminUser {
  id: number;
  name: string | null;
  email: string | null;
}

export interface GRNJob {
  id: number;
  name: string | null;
}

export interface GRN {
  id: number;
  source_document: string;
  odoo_picking_id: number | null;
  odoo_picking_name: string | null;
  ip_user_id: number | null;
  job_id: number | null;
  created_by_admin_id: number;
  status: 'pending' | 'submitted';
  has_missing: boolean;
  odoo_sync_error: string | null;
  created_at: string;
  submitted_at: string | null;
  packages: GRNPackage[];
  ip_user: GRNIPUser | null;
  created_by: GRNAdminUser | null;
  job: GRNJob | null;
}

export interface OdooPackageInfo {
  odoo_package_id: number | null;
  package_name: string;
}

export interface OdooPickingInfo {
  picking_id: number;
  picking_name: string;
  origin: string | null;
  partner_name: string | null;
  packages: OdooPackageInfo[];
}

// ─── Site GRN API ─────────────────────────────────────────────────────────────

export const grnAPI = {
  lookup: (sourceDoc: string): Promise<OdooPickingInfo[]> =>
    axiosInstance.get(`/admin/grn/lookup/${encodeURIComponent(sourceDoc)}`).then(res => handleResponse(res)),

  create: (data: { source_document: string; ip_user_id?: number | null; assign_to_self?: boolean; job_id?: number | null; picking_ids?: number[] }): Promise<GRN[]> =>
    axiosInstance.post('/admin/grn/', data).then(res => handleResponse(res)),

  list: (limit = 50, offset = 0, jobId?: number): Promise<GRN[]> =>
    axiosInstance.get('/admin/grn/', { params: { limit, offset, job_id: jobId } }).then(res => handleResponse(res)),

  get: (id: number): Promise<GRN> =>
    axiosInstance.get(`/admin/grn/${id}`).then(res => handleResponse(res)),

  retrySync: (id: number): Promise<GRN> =>
    axiosInstance.post(`/admin/grn/${id}/retry-sync`).then(res => handleResponse(res)),

  submit: (id: number, packages: Array<{ package_id: number; is_received: boolean }>): Promise<GRN> =>
    axiosInstance.post(`/admin/grn/${id}/submit`, { packages }).then(res => handleResponse(res)),
};

export interface DevUser {
  id: number;
  email: string | null;
  name: string | null;
  isActive: boolean;
  isApproved: boolean;
  is_superadmin: boolean;
  is_dev: boolean;
  created_at?: string | null;
}

export interface DevIPUser {
  id: number;
  phone_number: string;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  pincode: number | null;
  is_internal: boolean;
  is_id_verified: boolean;
}

export interface DevAttendanceBackfill {
  subject_type: 'ip' | 'admin';
  subject_id: number;
  attendance_date: string;
  reason: string;
  job_id?: number;
  attendance_type?: 'check_in' | 'check_out';
}

export interface DevAuditEntry {
  id: number;
  actor_email: string | null;
  action: string;
  target_email: string | null;
  detail: string | null;
  created_at: string;
}

export const devAPI = {
  listUsers: (): Promise<DevUser[]> =>
    axiosInstance.get('/dev/users').then(res => handleResponse(res)),

  createUser: (data: {
    email: string;
    name?: string;
    password: string;
    is_superadmin: boolean;
  }): Promise<DevUser> =>
    axiosInstance.post('/dev/users', data).then(res => handleResponse(res)),

  updateUser: (
    id: number,
    data: {
      isActive?: boolean;
      isApproved?: boolean;
      is_superadmin?: boolean;
      name?: string | null;
      email?: string;
    },
  ): Promise<DevUser> =>
    axiosInstance.patch(`/dev/users/${id}`, data).then(res => handleResponse(res)),

  revokeSessions: (id: number): Promise<{ message: string; email: string }> =>
    axiosInstance.post(`/dev/users/${id}/revoke-sessions`).then(res => handleResponse(res)),

  listIPUsers: (): Promise<DevIPUser[]> =>
    axiosInstance.get('/dev/ip-users').then(res => handleResponse(res)),

  updateIPUser: (
    id: number,
    data: {
      phone_number?: string;
      first_name?: string | null;
      last_name?: string | null;
      city?: string | null;
      pincode?: number | null;
      is_internal?: boolean;
    },
  ): Promise<DevIPUser> =>
    axiosInstance.patch(`/dev/ip-users/${id}`, data).then(res => handleResponse(res)),

  backfillAttendance: (data: DevAttendanceBackfill): Promise<{
    message: string;
    record: { id: number; subject_label: string; attendance_date: string };
  }> =>
    axiosInstance.post('/dev/attendance', data).then(res => handleResponse(res)),

  getAuditLog: (): Promise<DevAuditEntry[]> =>
    axiosInstance.get('/dev/audit-log').then(res => handleResponse(res)),
};
