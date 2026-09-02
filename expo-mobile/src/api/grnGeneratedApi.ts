import {
  getAssignedGrnsApiV1DashboardGrnAssignedGet,
  getJobPaperworkApiV1DashboardGrnJobJobIdGet,
  submitGrnApiV1DashboardGrnGrnIdSubmitPost,
  type GrnPackageSubmit,
  type GrnResponse,
} from './generatedClient';

export const getAssignedGrns = async () => {
  const grns: GrnResponse[] = [];
  const limit = 50;
  while (true) {
    const response = await getAssignedGrnsApiV1DashboardGrnAssignedGet({ query: { offset: grns.length, limit }, throwOnError: true });
    grns.push(...response.data);
    if (response.data.length < limit) return grns;
  }
};

export const getJobGrnPaperwork = async (jobId: number) => {
  const response = await getJobPaperworkApiV1DashboardGrnJobJobIdGet({ path: { job_id: jobId }, throwOnError: true });
  return response.data;
};

export const submitGrn = async (grnId: number, packages: GrnPackageSubmit[]) => {
  const response = await submitGrnApiV1DashboardGrnGrnIdSubmitPost({ path: { grn_id: grnId }, body: { packages }, throwOnError: true });
  return response.data;
};
