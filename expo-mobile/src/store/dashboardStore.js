import { create } from 'zustand';
import { JOB_STATUS } from '../util/constants';

const JOBS_TTL = 90_000;        // 90 seconds
const JOB_DETAIL_TTL = 300_000; // 5 minutes
const MAX_JOB_DETAIL_CACHE = 20;

export const useDashboardStore = create((set, get) => ({
  jobs: [],
  selectedJob: null,
  activeFilter: JOB_STATUS.IN_PROGRESS,
  stats: {
    completedJobs: 0,
    inProgressJobs: 0,
    totalEarnings: 0,
    totalIncentives: 0,
  },
  loading: false,
  error: null,
  lastFetched: null,
  jobDetailCache: {}, // { [jobId]: { job, progress, fetchedAt } }

  isJobsStale: () => {
    const { lastFetched } = get();
    return !lastFetched || Date.now() - lastFetched > JOBS_TTL;
  },

  setJobs: (jobs) => {
    set({ jobs, lastFetched: Date.now() });
    get().calculateStats();
  },

  cacheJobDetail: (jobId, job, progress) => {
    set((state) => {
      const updated = {
        ...state.jobDetailCache,
        [jobId]: { job, progress, fetchedAt: Date.now() },
      };
      // LRU eviction — keep at most MAX_JOB_DETAIL_CACHE entries
      const entries = Object.entries(updated);
      if (entries.length > MAX_JOB_DETAIL_CACHE) {
        entries.sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);
        const [oldestKey] = entries[0];
        delete updated[oldestKey];
      }
      return { jobDetailCache: updated };
    });
  },

  getJobDetailFromCache: (jobId) => {
    const cached = get().jobDetailCache[jobId];
    if (!cached) return null;
    if (Date.now() - cached.fetchedAt > JOB_DETAIL_TTL) return null;
    return cached;
  },

  setSelectedJob: (job) => set({ selectedJob: job }),
  setActiveFilter: (filter) => set({ activeFilter: filter }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  calculateStats: () => {
    const { jobs } = get();
    const stats = jobs.reduce(
      (acc, job) => {
        if (job.status === JOB_STATUS.COMPLETED) {
          acc.completedJobs++;
          acc.totalEarnings += job.rate || 0;
        }
        if (job.status === JOB_STATUS.IN_PROGRESS) acc.inProgressJobs++;
        acc.totalIncentives += job.incentive || 0;
        return acc;
      },
      { completedJobs: 0, inProgressJobs: 0, totalEarnings: 0, totalIncentives: 0 }
    );
    set({ stats });
  },

  clearSelectedJob: () => set({ selectedJob: null }),
}));
