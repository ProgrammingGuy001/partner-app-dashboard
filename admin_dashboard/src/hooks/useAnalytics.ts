import { useState, useEffect } from 'react';
import { analyticsAPI } from '../api/services';

interface PayoutParams {
  period: string;
  year?: number;
  month?: number;
  quarter?: number;
  week?: number;
}

export const usePayoutReport = (params: PayoutParams) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const result = await analyticsAPI.getPayoutReport(params);
        setData(result);
      } catch (e) {
        setError(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [params]);

  return { data, error, isLoading };
};

export const useJobStages = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const result = await analyticsAPI.getJobStages();
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

export const useIPPerformance = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const result = await analyticsAPI.getIPPerformance();
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