import { useState, useEffect, useCallback } from 'react';
import { jobAPI, type Job, type JobStatusLog } from '../api/services';

interface JobFilters {
  limit?: number;
  status?: string;
  type?: string;
  search?: string;
}

export const useJobs = (filters: JobFilters = {}) => {
  const [data, setData] = useState<Job[] | null>(null);
  const [error, setError] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await jobAPI.getAll(filters);
      setData(result);
    } catch (e) {
      setError(e);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, error, isLoading, refetch: fetchData };
};

export const useJob = (id: number) => {
  const [data, setData] = useState<Job | null>(null);
  const [error, setError] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const result = await jobAPI.getById(id);
        setData(result);
      } catch (e) {
        setError(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id]);

  return { data, error, isLoading };
};

export const useCreateJob = () => {
  return {
    createJob: jobAPI.create,
  };
};

export const useUpdateJob = () => {
  return {
    updateJob: ({ id, data }: { id: number; data: any }) => jobAPI.update(id, data),
  };
};

export const useDeleteJob = () => {
  return {
    deleteJob: jobAPI.delete,
  };
};

export const useJobHistory = (id: number) => {
  const [data, setData] = useState<JobStatusLog[] | null>(null);
  const [error, setError] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const result = await jobAPI.getHistory(id);
        setData(result);
      } catch (e) {
        setError(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id]);

  return { data, error, isLoading };
};