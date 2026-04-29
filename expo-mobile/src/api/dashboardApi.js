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
    const response = await apiClient.get('/dashboard/jobs');
    return response.data;
  },

  getJob: async (jobId) => {
    const id = assertPositiveId(jobId, 'job id');
    // Return cached detail when fresh — avoids two parallel network requests on revisit
    const cached = require('../store/dashboardStore').useDashboardStore.getState().getJobDetailFromCache(id);
    if (cached) {
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

  uploadProgress: async (jobId, file, comment) => {
    const id = assertPositiveId(jobId, 'job id');
    const formData = new FormData();

    if (file) {
      const rnFile = toRNFile(file);
      if (rnFile) {
        formData.append('file', rnFile);
      }
    }

    if (comment) {
      formData.append('comment', comment);
    }

    const response = await apiClient.post(`/dashboard/jobs/${id}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getJobProgress: async (jobId) => {
    const id = assertPositiveId(jobId, 'job id');
    const response = await apiClient.get(`/dashboard/jobs/${id}/progress`);
    return response.data;
  },

  recordAttendance: async ({ latitude, longitude, manualLocation, photoUri }) => {
    const formData = new FormData();
    formData.append('latitude', String(latitude));
    formData.append('longitude', String(longitude));
    if (manualLocation?.trim()) {
      formData.append('manual_location', manualLocation.trim());
    }

    const filename = photoUri.split('/').pop();
    const ext = filename?.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
    formData.append('photo', { uri: photoUri, name: filename || 'photo.jpg', type: mimeType });

    const response = await apiClient.post('/dashboard/attendance', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getAttendance: async () => {
    const response = await apiClient.get('/dashboard/attendance');
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

  downloadInvoice: async (jobId, jobName) => {
    const id = assertPositiveId(jobId, 'job id');
    const { fetch: expoFetch } = await import('expo/fetch');
    const { File, Paths } = await import('expo-file-system');
    const Sharing = await import('expo-sharing');
    const SecureStore = await import('../util/secureStore');
    const { STORAGE_KEYS } = await import('../util/constants');

    const baseURL = apiClient.defaults.baseURL || '';
    const url = `${baseURL}/dashboard/jobs/${id}/invoice-request/download`;
    const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) throw new Error('You need to log in again before downloading.');

    const file = new File(Paths.cache, `billing_invoice_${jobName || id}.xlsx`);
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
