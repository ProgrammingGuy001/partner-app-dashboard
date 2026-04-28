import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { checklistApi } from '../api/checklistApi';
import { logger } from '../util/helpers';

const CHECKLIST_TTL = 30 * 60_000; // 30 minutes
const MAX_CACHE_ENTRIES = 20;

const cacheKey = (jobId, checklistId) => `${jobId}-${checklistId}`;

const emptyStats = {
  totalItems: 0,
  checkedCount: 0,
  pendingCount: 0,
  approvedCount: 0,
  completionPercentage: 0,
};

const calculateStats = (items) => {
  const total = items.length;
  if (!total) {
    return { ...emptyStats };
  }

  const checked = items.filter((item) => item.checked).length;
  const pending = items.filter((item) => item.checked && !item.is_approved).length;
  const approved = items.filter((item) => item.is_approved).length;

  return {
    totalItems: total,
    checkedCount: checked,
    pendingCount: pending,
    approvedCount: approved,
    completionPercentage: Math.round((approved / total) * 100),
  };
};

const useChecklistStore = create(
  persist(
    (set, get) => ({
  checklist: null,
  items: [],
  stats: { ...emptyStats },
  jobId: null,
  jobTitle: '',
  isLoading: false,
  isSaving: false,
  error: null,
  dirtyItems: {},        // { [itemId]: true } — plain object, safe for JSON serialization
  pendingChanges: {},    // { [itemId]: { ...changes } } — plain object, safe for JSON serialization
  itemsBackup: [],
  checklistCache: {},    // persisted: { [key]: { checklist, items, stats, jobId, jobTitle, fetchedAt } }

  fetchChecklist: async (jobId, checklistId) => {
    const key = cacheKey(jobId, checklistId);
    const cached = get().checklistCache[key];

    // Serve from cache if fresh — skip network entirely
    if (cached && Date.now() - cached.fetchedAt < CHECKLIST_TTL) {
      set({
        checklist: cached.checklist,
        items: cached.items,
        stats: cached.stats,
        jobId: cached.jobId,
        jobTitle: cached.jobTitle,
        isLoading: false,
        dirtyItems: {},
        pendingChanges: {},
      });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const data = await checklistApi.getChecklist(jobId, checklistId);
      const stats = {
        totalItems: data.total_items,
        checkedCount: data.checked_count,
        pendingCount: data.pending_count,
        approvedCount: data.approved_count,
        completionPercentage: data.completion_percentage,
      };

      set((state) => ({
        checklist: data.checklist,
        items: data.items,
        stats,
        jobId: data.job_id,
        jobTitle: data.job_title,
        isLoading: false,
        dirtyItems: {},
        pendingChanges: {},
        // write-through to persistent cache with LRU eviction
        checklistCache: (() => {
          const updated = {
            ...state.checklistCache,
            [key]: {
              checklist: data.checklist,
              items: data.items,
              stats,
              jobId: data.job_id,
              jobTitle: data.job_title,
              fetchedAt: Date.now(),
            },
          };
          const entries = Object.entries(updated);
          if (entries.length > MAX_CACHE_ENTRIES) {
            // Evict oldest entry by fetchedAt
            entries.sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);
            const [oldestKey] = entries[0];
            delete updated[oldestKey];
          }
          return updated;
        })(),
      }));
    } catch (error) {
      set({
        error: error?.message || 'Failed to fetch checklist',
        isLoading: false,
      });
      throw error;
    }
  },

  updateItem: (itemId, changes) => {
    const { items, pendingChanges, dirtyItems } = get();

    if (Object.keys(dirtyItems).length === 0) {
      set({ itemsBackup: [...items] });
    }

    const updatedItems = items.map((item) => (item.id === itemId ? { ...item, ...changes } : item));

    const newDirtyItems = { ...dirtyItems, [itemId]: true };

    const existingChanges = pendingChanges[itemId] || {};
    const newPendingChanges = {
      ...pendingChanges,
      [itemId]: { ...existingChanges, ...changes },
    };

    set({
      items: updatedItems,
      dirtyItems: newDirtyItems,
      pendingChanges: newPendingChanges,
      stats: calculateStats(updatedItems),
    });
  },

  saveChanges: async () => {
    const { jobId, checklist, pendingChanges, items, itemsBackup } = get();
    if (Object.keys(pendingChanges).length === 0) return;

    // Validate all items being checked require photo and notes
    for (const [id, changes] of Object.entries(pendingChanges)) {
      if (changes.checked === true) {
        const item = items.find(i => i.id === parseInt(id));
        if (!item?.document_link) {
          const errorMsg = `Item "${item?.text || 'Unknown'}" requires a photo before it can be marked complete.`;
          set({ error: errorMsg, isSaving: false });
          throw new Error(errorMsg);
        }
        if (!item?.comment?.trim()) {
          const errorMsg = `Item "${item?.text || 'Unknown'}" requires notes/comment before it can be marked complete.`;
          set({ error: errorMsg, isSaving: false });
          throw new Error(errorMsg);
        }
      }
    }

    set({ isSaving: true, error: null });

    const updates = Object.entries(pendingChanges).map(([id, changes]) => ({
      checklist_item_id: Number(id),
      ...changes,
    }));

    try {
      const response = await checklistApi.batchUpdate(jobId, checklist.id, { updates });
      const key = cacheKey(jobId, checklist.id);
      // items === null means all updates succeeded and the optimistic state is correct
      const newItems = response.items ?? items;
      const newStats = response.items
        ? {
            totalItems: response.total_items,
            checkedCount: response.checked_count,
            pendingCount: response.pending_count,
            approvedCount: response.approved_count,
            completionPercentage: response.completion_percentage,
          }
        : calculateStats(newItems);

      set((state) => ({
        items: newItems,
        stats: newStats,
        dirtyItems: {},
        pendingChanges: {},
        itemsBackup: [],
        isSaving: false,
        checklistCache: {
          ...state.checklistCache,
          [key]: {
            checklist: state.checklist,
            items: newItems,
            stats: newStats,
            jobId: state.jobId,
            jobTitle: state.jobTitle,
            fetchedAt: Date.now(),
          },
        },
      }));

      return response;
    } catch (error) {
      set({
        items: itemsBackup,
        stats: calculateStats(itemsBackup),
        dirtyItems: {},
        pendingChanges: {},
        error: error?.message || 'Failed to save changes',
        isSaving: false,
      });
      throw error;
    }
  },

  discardChanges: () => {
    const { itemsBackup } = get();
    if (!itemsBackup.length) return;

    set({
      items: itemsBackup,
      stats: calculateStats(itemsBackup),
      dirtyItems: {},
      pendingChanges: {},
      itemsBackup: [],
    });
  },

  toggleCheckbox: (itemId) => {
    const item = get().items.find((currentItem) => currentItem.id === itemId);
    if (item) {
      get().updateItem(itemId, { checked: !item.checked });
    }
  },

  updateComment: (itemId, comment) => {
    get().updateItem(itemId, { comment });
  },

  uploadDocument: async (itemId, file, comment = null) => {
    const { jobId, checklist } = get();

    set({ isSaving: true, error: null });

    try {
      const response = await checklistApi.uploadDocument(jobId, checklist.id, itemId, file, comment);
      const updatedItems = get().items.map((item) => (item.id === itemId ? response.item : item));

      set({
        items: updatedItems,
        stats: calculateStats(updatedItems),
        isSaving: false,
      });

      return response;
    } catch (error) {
      set({
        error: error?.message || 'Failed to upload document',
        isSaving: false,
      });
      throw error;
    }
  },

  uploadChecklistDocument: async (jobId, checklistId, file) => {
    set({ isSaving: true, error: null });

    try {
      const response = await checklistApi.uploadChecklistDocument(jobId, checklistId, file);
      
      // Update the checklist with the new document link
      const updatedChecklist = {
        ...get().checklist,
        document_link: response.document_link,
      };

      const key = cacheKey(jobId, checklistId);
      const { checklistCache } = get();
      
      set({
        checklist: updatedChecklist,
        isSaving: false,
        checklistCache: {
          ...checklistCache,
          [key]: {
            ...checklistCache[key],
            checklist: updatedChecklist,
          },
        },
      });

      return response;
    } catch (error) {
      set({
        error: error?.message || 'Failed to upload checklist document',
        isSaving: false,
      });
      throw error;
    }
  },

  hasUnsavedChanges: () => Object.keys(get().dirtyItems).length > 0,
  getUnsavedCount: () => Object.keys(get().dirtyItems).length,
  clearError: () => set({ error: null }),

  resetStore: () => {
    set({
      checklist: null,
      items: [],
      stats: { ...emptyStats },
      jobId: null,
      jobTitle: '',
      isLoading: false,
      isSaving: false,
      error: null,
      dirtyItems: {},
      pendingChanges: {},
      itemsBackup: [],
      // checklistCache intentionally NOT cleared — persists across sessions
    });
  },

  invalidateChecklistCache: (jobId, checklistId) => {
    const key = cacheKey(jobId, checklistId);
    set((state) => {
      const { [key]: _, ...rest } = state.checklistCache;
      return { checklistCache: rest };
    });
  },
}),
    {
      name: 'checklist-cache',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the cache map — not ephemeral session state
      partialize: (state) => ({ checklistCache: state.checklistCache }),
    }
  )
);

export default useChecklistStore;
