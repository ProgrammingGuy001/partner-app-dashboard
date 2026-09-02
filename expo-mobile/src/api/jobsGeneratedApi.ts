import { getAllJobsApiV1DashboardJobsGet } from './generatedClient';

export type JobsPage = {
  jobs: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export const getJobsPage = async (skip: number, limit: number) => {
  const response = await getAllJobsApiV1DashboardJobsGet({
    query: { skip, limit },
    throwOnError: true,
  });
  return response.data as JobsPage;
};
