import apiClient from './axiosConfig';
import { toRNFile, logger } from '../util/helpers';
import { fetch as expoFetch } from 'expo/fetch';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { STORAGE_KEYS } from '../util/constants';
import * as SecureStore from '../util/secureStore';

const computeStats = (items) => {
  const totalItems = items.length;
  const checkedCount = items.filter((item) => item.checked).length;
  const approvedCount = items.filter((item) => item.is_approved).length;
  const pendingCount = items.filter((item) => item.checked && !item.is_approved).length;
  const completionPercentage = totalItems > 0 ? Math.round((approvedCount / totalItems) * 100) : 0;

  return {
    total_items: totalItems,
    checked_count: checkedCount,
    pending_count: pendingCount,
    approved_count: approvedCount,
    completion_percentage: completionPercentage,
  };
};

const normalizeChecklistPayload = (payload) => {
  const checklist = payload?.checklist || {};
  const rawItems = checklist.items || [];

  const items = rawItems
    .map((item) => {
      const status = item.status || {};
      const reviewStatus = status.review_status || (status.is_approved ? 'approved' : (status.admin_comment ? 'rejected' : 'pending'));
      return {
        id: item.id,
        checklist_item_id: item.id,
        text: item.text || '',
        position: item.position ?? 0,
        checked: status.checked ?? false,
        is_approved: status.is_approved ?? false,
        review_status: reviewStatus,
        comment: status.comment ?? '',
        admin_comment: status.admin_comment ?? '',
        document_link: status.document_link ?? null,
        created_at: status.created_at || item.created_at || null,
        updated_at: status.updated_at || item.updated_at || null,
      };
    })
    .sort((a, b) => a.position - b.position);

  const stats = computeStats(items);

  return {
    checklist: {
      id: checklist.id,
      name: checklist.name,
      description: checklist.description,
      document_link: checklist.document_link ?? null,
      template_available: checklist.template_available ?? false,
    },
    items,
    job_id: payload?.job_id,
    job_title: payload?.job_title || `Job #${payload?.job_id ?? ''}`,
    ...stats,
  };
};

export const checklistApi = {
  getChecklist: async (jobId, checklistId) => {
    const response = await apiClient.get(`/dashboard/jobs/${jobId}/checklists/${checklistId}/items`);
    return normalizeChecklistPayload(response.data);
  },

  batchUpdate: async (jobId, checklistId, payload) => {
    const updates = payload?.updates || [];

    // Use Promise.allSettled to handle partial failures gracefully
    const results = await Promise.allSettled(
      updates.map((update) => {
        const itemId = update.checklist_item_id || update.id;
        const body = {};

        if (typeof update.checked === 'boolean') body.checked = update.checked;
        if (typeof update.comment === 'string') body.comment = update.comment;
        if (typeof update.document_link === 'string') body.document_link = update.document_link;

        return apiClient.put(`/dashboard/jobs/${jobId}/checklists/items/${itemId}/status`, body);
      })
    );

    const failures = results.filter((r) => r.status === 'rejected');

    // All failed — throw immediately, no re-fetch needed
    if (failures.length === updates.length && updates.length > 0) {
      const firstError = failures[0]?.reason;
      const errorMessage = firstError?.response?.data?.detail || firstError?.message || 'All updates failed. Please try again.';
      throw new Error(errorMessage);
    }

    if (failures.length > 0) {
      logger.warn('checklistApi', `${failures.length}/${updates.length} updates failed — re-fetching for server truth`);
      // Partial failure: re-fetch to get the authoritative server state
      const refreshed = await checklistApi.getChecklist(jobId, checklistId);
      return {
        items: refreshed.items,
        total_items: refreshed.total_items,
        checked_count: refreshed.checked_count,
        pending_count: refreshed.pending_count,
        approved_count: refreshed.approved_count,
        completion_percentage: refreshed.completion_percentage,
        partial_failure: true,
        failed_count: failures.length,
      };
    }

    // All succeeded — signal the store to keep its optimistic state (no re-fetch)
    return {
      items: null,
      partial_failure: false,
      failed_count: 0,
    };
  },

  uploadDocument: async (jobId, checklistId, itemId, file, comment = null) => {
    try {
      const formData = new FormData();
      const rnFile = toRNFile(file);
      if (!rnFile) {
        throw new Error('Invalid file selected');
      }
      formData.append('file', rnFile);

      const uploadResponse = await apiClient.post(`/dashboard/jobs/${jobId}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const fileUrl = uploadResponse?.data?.file_url;
      if (!fileUrl) {
        throw new Error('Upload succeeded but file URL was not returned');
      }

      const statusPayload = {
        document_link: fileUrl,
      };
      if (comment) {
        statusPayload.comment = comment;
      }

      await apiClient.put(`/dashboard/jobs/${jobId}/checklists/items/${itemId}/status`, statusPayload);

      const refreshed = await checklistApi.getChecklist(jobId, checklistId);
      return {
        file_url: fileUrl,
        item: refreshed.items.find((item) => item.id === itemId),
      };
    } catch (error) {
      // Extract error message from response
      const errorMessage = error?.response?.data?.detail || error?.response?.data?.message || error.message || 'Upload failed';
      logger.error('checklistApi.uploadDocument', errorMessage, error);
      throw new Error(errorMessage);
    }
  },

  uploadChecklistDocument: async (jobId, checklistId, file) => {
    try {
      const formData = new FormData();
      const rnFile = toRNFile(file);
      if (!rnFile) {
        throw new Error('Invalid file selected');
      }
      formData.append('file', rnFile);

      const response = await apiClient.post(`/dashboard/jobs/${jobId}/checklists/${checklistId}/document`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      const errorMessage = error?.response?.data?.detail || error?.response?.data?.message || error.message || 'Upload failed';
      logger.error('checklistApi.uploadChecklistDocument', errorMessage, error);
      throw new Error(errorMessage);
    }
  },

  downloadChecklistTemplate: async (jobId, checklistId) => {
    const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) throw new Error('You need to log in again before downloading.');

    const url = `${apiClient.defaults.baseURL || ''}/dashboard/jobs/${jobId}/checklists/${checklistId}/template`;
    const response = await expoFetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.text()).trim(); } catch { detail = ''; }
      throw new Error(detail || `Download failed with status ${response.status}`);
    }

    const file = new File(Paths.cache, 'All Check-list.xlsx');
    file.create({ overwrite: true, intermediates: true });
    file.write(await response.bytes());
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'All Check-list workbook',
        UTI: 'com.microsoft.excel.xlsx',
      });
    }
  },

  // The filled-in checklist as a PDF: items, statuses, notes and evidence photos.
  // Available for every checklist, unlike the ISM-only blank workbook above.
  exportChecklist: async (jobId, checklistId) => {
    const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) throw new Error('You need to log in again before exporting.');

    const url = `${apiClient.defaults.baseURL || ''}/dashboard/jobs/${jobId}/checklists/${checklistId}/export`;
    const response = await expoFetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.text()).trim(); } catch { detail = ''; }
      throw new Error(detail || `Export failed with status ${response.status}`);
    }

    const disposition = response.headers.get('content-disposition') || '';
    const filename = disposition.match(/filename="?([^";]+)/i)?.[1] || 'checklist.pdf';
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

  getJobChecklists: async (jobId) => {
    const response = await apiClient.get(`/dashboard/jobs/${jobId}/checklists`);
    return response?.data?.checklists || [];
  },
};

export default checklistApi;
