import { File as ExpoFile } from 'expo-file-system';
import { generateDailyReportApiV1DashboardJobsJobIdDailyReportPost } from './generatedClient';

type ManualJob = {
  projectName: string;
  salesOrder: string;
  projectSupervisor: string;
  siteAddress: string;
};

type ProgressPhoto = { uri: string; name?: string };

export const generateDailyReport = async ({
  jobId,
  manualJob,
  reportDate,
  reportData,
  progressPhotos = [],
}: {
  jobId: string | number;
  manualJob: ManualJob;
  reportDate: string;
  reportData: unknown;
  progressPhotos?: ProgressPhoto[];
}) => {
  const pathId = jobId === 'manual' ? 'manual' : Number(jobId);
  const validPhotos = progressPhotos.filter((photo) => photo?.uri);
  const photoFiles = validPhotos.map((photo) => new ExpoFile(photo.uri));
  const formData = new FormData();
  formData.append('report_date', reportDate);
  formData.append('report_data', JSON.stringify(reportData));
  if (pathId === 'manual') {
    formData.append('project_name', manualJob.projectName.trim());
    formData.append('sales_order', manualJob.salesOrder.trim());
    formData.append('project_supervisor', manualJob.projectSupervisor.trim());
    formData.append('site_address', manualJob.siteAddress.trim());
  }
  photoFiles.forEach((file, index) => {
    formData.append('progress_photos', file as unknown as Blob, validPhotos[index]?.name || `progress-${index + 1}.jpg`);
  });

  const response = await generateDailyReportApiV1DashboardJobsJobIdDailyReportPost({
    path: { job_id: pathId },
    body: {
      report_date: reportDate,
      report_data: JSON.stringify(reportData),
      progress_photos: photoFiles as unknown as Blob[],
    },
    bodySerializer: () => formData,
    responseType: 'arraybuffer',
    throwOnError: true,
  });
  return { data: response.data as ArrayBuffer, headers: response.headers };
};
