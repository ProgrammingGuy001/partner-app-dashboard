import apiClient from './axiosConfig';
import { toRNFile, logger } from '../util/helpers';

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
      return {
        id: item.id,
        checklist_item_id: item.id,
        text: item.text || '',
        position: item.position ?? 0,
        checked: status.checked ?? false,
        is_approved: status.is_approved ?? false,
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

      const uploadResponse = await apiClient.post(`/dashboard/jobs/${jobId}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const fileUrl = uploadResponse?.data?.file_url;
      if (!fileUrl) {
        throw new Error('Upload succeeded but file URL was not returned');
      }

      await apiClient.put(`/dashboard/jobs/${jobId}/checklists/${checklistId}/document`, {
        document_link: fileUrl,
      });

      return {
        file_url: fileUrl,
        document_link: fileUrl,
      };
    } catch (error) {
      const errorMessage = error?.response?.data?.detail || error?.response?.data?.message || error.message || 'Upload failed';
      logger.error('checklistApi.uploadChecklistDocument', errorMessage, error);
      throw new Error(errorMessage);
    }
  },

  getJobChecklists: async (jobId) => {
    const response = await apiClient.get(`/dashboard/jobs/${jobId}/checklists`);
    return response?.data?.checklists || [];
  },
};

export default checklistApi;
