import {
  exportChecklistApiV1DashboardJobsJobIdChecklistsChecklistIdExportGet,
  getJobChecklistItemsApiV1DashboardJobsJobIdChecklistsChecklistIdItemsGet,
  getJobChecklistsApiV1DashboardJobsJobIdChecklistsGet,
  updateChecklistItemStatusApiV1DashboardJobsJobIdChecklistsItemsItemIdStatusPut,
  uploadChecklistDocumentApiV1DashboardJobsJobIdChecklistsChecklistIdDocumentPost,
  uploadProgressUpdateApiV1DashboardJobsJobIdUploadPost,
  type JobChecklistItemStatusUpdate,
} from './generatedClient';

type ReactNativeFile = { uri: string; name: string; type: string };

const fileBody = (file: ReactNativeFile) => {
  const formData = new FormData();
  formData.append('file', file as unknown as Blob);
  return { body: { file: file as unknown as Blob }, bodySerializer: () => formData };
};

export const getChecklistItems = async (jobId: number, checklistId: number) => {
  const response = await getJobChecklistItemsApiV1DashboardJobsJobIdChecklistsChecklistIdItemsGet({
    path: { job_id: jobId, checklist_id: checklistId },
    throwOnError: true,
  });
  return response.data;
};

export const updateChecklistItem = async (
  jobId: number,
  itemId: number,
  body: JobChecklistItemStatusUpdate,
) => {
  const response = await updateChecklistItemStatusApiV1DashboardJobsJobIdChecklistsItemsItemIdStatusPut({
    path: { job_id: jobId, item_id: itemId },
    body,
    throwOnError: true,
  });
  return response.data;
};

export const uploadJobProgress = async (jobId: number, file: ReactNativeFile) => {
  const response = await uploadProgressUpdateApiV1DashboardJobsJobIdUploadPost({
    path: { job_id: jobId },
    ...fileBody(file),
    throwOnError: true,
  });
  return response.data;
};

export const uploadCompletedChecklist = async (
  jobId: number,
  checklistId: number,
  file: ReactNativeFile,
) => {
  const response = await uploadChecklistDocumentApiV1DashboardJobsJobIdChecklistsChecklistIdDocumentPost({
    path: { job_id: jobId, checklist_id: checklistId },
    ...fileBody(file),
    throwOnError: true,
  });
  return response.data;
};

export const exportChecklistPdf = async (jobId: number, checklistId: number) => {
  const response = await exportChecklistApiV1DashboardJobsJobIdChecklistsChecklistIdExportGet({
    path: { job_id: jobId, checklist_id: checklistId },
    responseType: 'arraybuffer',
    throwOnError: true,
  });
  return { data: response.data as ArrayBuffer, headers: response.headers };
};

export const getJobChecklists = async (jobId: number) => {
  const response = await getJobChecklistsApiV1DashboardJobsJobIdChecklistsGet({
    path: { job_id: jobId },
    throwOnError: true,
  });
  return response.data;
};
