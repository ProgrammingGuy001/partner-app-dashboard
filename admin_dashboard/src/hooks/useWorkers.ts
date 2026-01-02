import { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../api/services';

export const useWorkers = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await adminAPI.getIPUsers();
      setData(result);
    } catch (e) {
      setError(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, error, isLoading, refetch: fetchData };
};

export const useApprovedWorkers = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const result = await adminAPI.getApprovedIPUsers();
        setData(result);
      } catch (e) {
        setError(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, error, isLoading };
};

export const useVerifyWorker = () => {
  return {
    verifyWorker: adminAPI.verifyIPUser,
  };
};