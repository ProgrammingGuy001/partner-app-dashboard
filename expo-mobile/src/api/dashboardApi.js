import apiClient from './axiosConfig';
import { toRNFile, logger } from '../util/helpers';

const extractJob = (payload) => payload?.job || payload?.data || payload || null;
const assertPositiveId = (value, label) => {
  const numericId = Number(value);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new Error(`Invalid ${label}`);
  }
  return numericId;
};

export const dashboardApi = {
  getJobs: async () => {
    const jobs = [];
    const limit = 100;
    let result;
    for (let page = 0; page < 100; page += 1) {
      const response = await apiClient.get('/dashboard/jobs', {
        params: { skip: jobs.length, limit },
      });
      result = response.data;
      const nextJobs = result.jobs || [];
      jobs.push(...nextJobs);
      if (nextJobs.length < limit) {
        return { ...result, total: jobs.length, skip: 0, limit: jobs.length, jobs };
      }
    }
    throw new Error('Could not load all jobs. Contact support if more than 10,000 jobs are assigned.');
  },

  getJob: async (jobId, { force = false } = {}) => {
    const id = assertPositiveId(jobId, 'job id');
    // Return cached detail when fresh — avoids two parallel network requests on revisit
    const cached = require('../store/dashboardStore').useDashboardStore.getState().getJobDetailFromCache(id);
    if (cached && !force) {
      logger.info('dashboardApi', `getJob ${id}: cache hit`);
      return { job: cached.job };
    }

    const [jobResponse, checklistsResponse] = await Promise.all([
      apiClient.get(`/dashboard/jobs/${id}`),
      apiClient.get(`/dashboard/jobs/${id}/checklists`).catch((err) => {
        logger.warn('dashboardApi', `Failed to fetch checklists for job ${id}: ${err?.message}`);
        return { data: { checklists: [] } };
      }),
    ]);

    const job = extractJob(jobResponse.data);
    const checklists = checklistsResponse?.data?.checklists || [];

    return {
      ...jobResponse.data,
      job: {
        ...job,
        checklists,
      },
    };
  },

  getJobHistory: async (jobId) => {
    const id = assertPositiveId(jobId, 'job id');
    const response = await apiClient.get(`/dashboard/jobs/${id}/history`);
    return response.data;
  },

  addJobNote: async (jobId, notes) => {
    const id = assertPositiveId(jobId, 'job id');
    const response = await apiClient.post(`/dashboard/jobs/${id}/notes`, { notes: notes.trim() });
    return response.data;
  },

  recordAttendance: async ({ jobId, latitude, longitude, manualLocation, photoUri, attendanceType, reportFile }) => {
    const formData = new FormData();
    if (jobId) formData.append('job_id', String(assertPositiveId(jobId, 'job id')));
    formData.append('latitude', String(latitude));
    formData.append('longitude', String(longitude));
    formData.append('manual_location', manualLocation?.trim() || '');
    formData.append('attendance_type', attendanceType || 'check_in');

    const filename = photoUri.split('/').pop();
    const ext = filename?.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
    formData.append('photo', { uri: photoUri, name: filename || 'photo.jpg', type: mimeType });
    if (reportFile) formData.append('report_file', toRNFile(reportFile));

    const response = await apiClient.post('/dashboard/attendance', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Standalone report generation: returns the PDF, writes nothing. Uses expoFetch
  // rather than apiClient because the response is binary, not JSON.
  generateDailyReport: async ({ jobId, manualJob, reportDate, reportData, progressPhotos = [] }) => {
    const id = jobId === 'manual' ? 'manual' : assertPositiveId(jobId, 'job id');
    const { fetch: expoFetch } = await import('expo/fetch');
    const { File, Paths } = await import('expo-file-system');
    const Sharing = await import('expo-sharing');
    const SecureStore = await import('../util/secureStore');
    const { STORAGE_KEYS } = await import('../util/constants');

    const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) throw new Error('You need to log in again before generating a report.');

    const formData = new FormData();
    formData.append('report_date', reportDate);
    formData.append('report_data', JSON.stringify(reportData));
    if (id === 'manual') {
      formData.append('project_name', manualJob.projectName.trim());
      formData.append('sales_order', manualJob.salesOrder.trim());
      formData.append('project_supervisor', manualJob.projectSupervisor.trim());
      formData.append('site_address', manualJob.siteAddress.trim());
    }
    progressPhotos.forEach((file) => formData.append('progress_photos', toRNFile(file)));

    const url = `${apiClient.defaults.baseURL || ''}/dashboard/jobs/${id}/daily-report`;
    const response = await expoFetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest' },
      body: formData,
    });
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.text()).trim(); } catch { detail = ''; }
      throw new Error(detail || `Report generation failed with status ${response.status}`);
    }

    const disposition = response.headers.get('content-disposition') || '';
    const filename = disposition.match(/filename="?([^";]+)/i)?.[1]
      || 'daily-installation-report.pdf';
    const file = new File(Paths.cache, filename);
    file.create({ overwrite: true, intermediates: true });
    file.write(await response.bytes());
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/pdf',
        dialogTitle: filename,
        UTI: 'com.adobe.pdf',
      });
    }
  },

  getAttendance: async (skip = 0, limit = 50) => {
    const response = await apiClient.get('/dashboard/attendance', {
      params: { skip, limit },
    });
    return response.data;
  },

  getSundayRequests: async () => {
    const response = await apiClient.get('/dashboard/sunday-requests');
    return response.data;
  },

  createSundayRequest: async ({ requestDate, reason }) => {
    const response = await apiClient.post('/dashboard/sunday-requests', {
      request_date: requestDate,
      reason: reason?.trim() || null,
    });
    return response.data;
  },

  getBilling: async (jobId) => {
    const id = assertPositiveId(jobId, 'job id');
    const response = await apiClient.get(`/dashboard/jobs/${id}/billing`);
    return response.data;
  },

  requestInvoice: async (jobId) => {
    const id = assertPositiveId(jobId, 'job id');
    const response = await apiClient.post(`/dashboard/jobs/${id}/invoice-request`);
    return response.data;
  },

  requestAdditionalInvoice: async (jobId, data = {}) => {
    const id = assertPositiveId(jobId, 'job id');
    const response = await apiClient.post(`/dashboard/jobs/${id}/invoice-requests`, data);
    return response.data;
  },

  downloadInvoice: async (jobId, jobName, invoiceRequestId) => {
    const id = assertPositiveId(jobId, 'job id');
    const { fetch: expoFetch } = await import('expo/fetch');
    const { File, Paths } = await import('expo-file-system');
    const Sharing = await import('expo-sharing');
    const SecureStore = await import('../util/secureStore');
    const { STORAGE_KEYS } = await import('../util/constants');

    const baseURL = apiClient.defaults.baseURL || '';
    const invoicePath = invoiceRequestId
      ? `/dashboard/jobs/${id}/invoice-requests/${invoiceRequestId}/download`
      : `/dashboard/jobs/${id}/invoice-request/download`;
    const url = `${baseURL}${invoicePath}`;
    const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) throw new Error('You need to log in again before downloading.');

    const file = new File(Paths.cache, `billing_invoice_${jobName || id}_${invoiceRequestId || 'latest'}.xlsx`);
    const response = await expoFetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest' },
    });

    if (!response.ok) {
      let detail = '';
      try { detail = (await response.text()).trim(); } catch { detail = ''; }
      throw new Error(detail || `Download failed with status ${response.status}`);
    }

    file.create({ overwrite: true, intermediates: true });
    file.write(await response.bytes());

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: `Invoice - ${jobName || id}`,
        UTI: 'com.microsoft.excel.xlsx',
      });
    }
  },
};
