import {
  createAdditionalInvoiceRequestApiV1DashboardJobsJobIdInvoiceRequestsPost,
  createInvoiceRequestApiV1DashboardJobsJobIdInvoiceRequestPost,
  createSundayWorkRequestApiV1DashboardSundayRequestsPost,
  downloadInvoiceBillApiV1DashboardJobsJobIdInvoiceRequestDownloadGet,
  downloadInvoiceRequestBillApiV1DashboardJobsJobIdInvoiceRequestsInvoiceRequestIdDownloadGet,
  finishAssignedJobApiV1DashboardJobsJobIdFinishPost,
  getBillingApiV1DashboardJobsJobIdBillingGet,
  getIndependentAttendanceApiV1DashboardAttendanceGet,
  getJobChecklistsApiV1DashboardJobsJobIdChecklistsGet,
  getSingleJobApiV1DashboardJobsJobIdGet,
  listMySundayWorkRequestsApiV1DashboardSundayRequestsGet,
  recordIndependentAttendanceApiV1DashboardAttendancePost,
  requestEndOtpApiV1DashboardJobsJobIdRequestEndOtpPost,
  requestStartOtpApiV1DashboardJobsJobIdRequestStartOtpPost,
  startAssignedJobApiV1DashboardJobsJobIdStartPost,
  uploadCompletionDocumentApiV1DashboardJobsJobIdCompletionDocumentsDocumentTypePost,
  verifyEndOtpAndFinishApiV1DashboardJobsJobIdVerifyEndOtpPost,
  verifyStartOtpAndStartApiV1DashboardJobsJobIdVerifyStartOtpPost,
  type AppRoutesJobCreateInvoiceRequestRequest,
  type BodyRecordIndependentAttendanceApiV1DashboardAttendancePost,
  type JobFinish,
  type JobFinishWithOtp,
  type JobStart,
  type JobStartWithOtp,
} from './generatedClient';

type ReactNativeFile = { uri: string; name: string; type: string };
type AttendanceBody = Omit<BodyRecordIndependentAttendanceApiV1DashboardAttendancePost, 'photo' | 'report_file'> & {
  photo: ReactNativeFile;
  report_file?: ReactNativeFile | null;
};

const data = async <T>(request: Promise<{ data: T }>) => (await request).data;

export const getJob = (jobId: number) => data(getSingleJobApiV1DashboardJobsJobIdGet({ path: { job_id: jobId }, throwOnError: true }));
export const getJobChecklists = (jobId: number) => data(getJobChecklistsApiV1DashboardJobsJobIdChecklistsGet({ path: { job_id: jobId }, throwOnError: true }));
export const requestStartOtp = (jobId: number) => data(requestStartOtpApiV1DashboardJobsJobIdRequestStartOtpPost({ path: { job_id: jobId }, throwOnError: true }));
export const verifyStartOtp = (jobId: number, body: JobStartWithOtp) => data(verifyStartOtpAndStartApiV1DashboardJobsJobIdVerifyStartOtpPost({ path: { job_id: jobId }, body, throwOnError: true }));
export const startJob = (jobId: number, body: JobStart) => data(startAssignedJobApiV1DashboardJobsJobIdStartPost({ path: { job_id: jobId }, body, throwOnError: true }));
export const requestEndOtp = (jobId: number) => data(requestEndOtpApiV1DashboardJobsJobIdRequestEndOtpPost({ path: { job_id: jobId }, throwOnError: true }));
export const verifyEndOtp = (jobId: number, body: JobFinishWithOtp) => data(verifyEndOtpAndFinishApiV1DashboardJobsJobIdVerifyEndOtpPost({ path: { job_id: jobId }, body, throwOnError: true }));
export const finishJob = (jobId: number, body: JobFinish) => data(finishAssignedJobApiV1DashboardJobsJobIdFinishPost({ path: { job_id: jobId }, body, throwOnError: true }));

export const uploadCompletionDocument = (jobId: number, documentType: string, file: ReactNativeFile) => {
  const formData = new FormData();
  formData.append('file', file as unknown as Blob);
  return data(uploadCompletionDocumentApiV1DashboardJobsJobIdCompletionDocumentsDocumentTypePost({
    path: { job_id: jobId, document_type: documentType },
    body: { file: file as unknown as Blob },
    bodySerializer: () => formData,
    throwOnError: true,
  }));
};

export const recordAttendance = (body: AttendanceBody) => {
  const formData = new FormData();
  Object.entries(body).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    formData.append(key, typeof value === 'object' ? value as unknown as Blob : String(value));
  });
  return data(recordIndependentAttendanceApiV1DashboardAttendancePost({
    body: body as unknown as BodyRecordIndependentAttendanceApiV1DashboardAttendancePost,
    bodySerializer: () => formData,
    throwOnError: true,
  }));
};

export const getAttendance = (skip = 0, limit = 50) => data(getIndependentAttendanceApiV1DashboardAttendanceGet({ query: { skip, limit }, throwOnError: true }));
export const getSundayRequests = () => data(listMySundayWorkRequestsApiV1DashboardSundayRequestsGet({ throwOnError: true }));
export const createSundayRequest = (requestDate: string, reason?: string) => data(createSundayWorkRequestApiV1DashboardSundayRequestsPost({ body: { request_date: requestDate, reason: reason?.trim() || null }, throwOnError: true }));
export const getBilling = (jobId: number) => data(getBillingApiV1DashboardJobsJobIdBillingGet({ path: { job_id: jobId }, throwOnError: true }));
export const requestInvoice = (jobId: number) => data(createInvoiceRequestApiV1DashboardJobsJobIdInvoiceRequestPost({ path: { job_id: jobId }, throwOnError: true }));
export const requestAdditionalInvoice = (jobId: number, body: AppRoutesJobCreateInvoiceRequestRequest) => data(createAdditionalInvoiceRequestApiV1DashboardJobsJobIdInvoiceRequestsPost({ path: { job_id: jobId }, body, throwOnError: true }));

export const downloadInvoice = async (jobId: number, invoiceRequestId?: number) => {
  const response = invoiceRequestId
    ? await downloadInvoiceRequestBillApiV1DashboardJobsJobIdInvoiceRequestsInvoiceRequestIdDownloadGet({ path: { job_id: jobId, invoice_request_id: invoiceRequestId }, responseType: 'arraybuffer', throwOnError: true })
    : await downloadInvoiceBillApiV1DashboardJobsJobIdInvoiceRequestDownloadGet({ path: { job_id: jobId }, responseType: 'arraybuffer', throwOnError: true });
  return response.data as ArrayBuffer;
};
