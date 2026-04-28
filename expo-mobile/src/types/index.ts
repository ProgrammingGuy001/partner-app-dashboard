// Core domain types shared across the app

export interface User {
  id: number | string;
  first_name: string;
  last_name: string;
  phone_number: string;
  city?: string;
  pincode?: string;
  is_verified?: boolean;
  is_pan_verified?: boolean;
  is_bank_details_verified?: boolean;
  is_id_verified?: boolean;
}

export interface Job {
  id: number | string;
  name: string;
  status: 'created' | 'in_progress' | 'completed' | 'paused';
  customer_name?: string;
  city?: string;
  delivery_date?: string;
  rate?: number;
  incentive?: number;
  checklists?: Checklist[];
}

export interface Checklist {
  id: number | string;
  name: string;
  job_id: number | string;
  total_items?: number;
  checked_count?: number;
  approved_count?: number;
  completion_percentage?: number;
}

export interface ChecklistItem {
  id: number | string;
  text: string;
  description?: string;
  checked: boolean;
  is_approved: boolean;
  comment?: string;
  admin_comment?: string;
  document_link?: string;
}

export interface JobProgress {
  id: number | string;
  comment?: string;
  file_url?: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  user?: User;
}

export interface ApiError {
  status?: number;
  message: string;
  data?: unknown;
}

export interface VerificationStatus {
  is_pan_verified: boolean;
  is_bank_details_verified: boolean;
  is_id_verified: boolean;
  pan_number?: string;
  bank_account_number?: string;
}

export interface DashboardStats {
  completedJobs: number;
  inProgressJobs: number;
  totalEarnings: number;
  totalIncentives: number;
}
