import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { logger, toRNFile } from '../util/helpers';
import { generateDailyReport as generateDailyReportRequest } from './dailyReportGeneratedApi';
import { getJobsPage } from './jobsGeneratedApi';
import { getRoster as getRosterRequest } from './rosterApi';
import * as generated from './dashboardGeneratedApi';

const extractJob = (payload) => payload?.job || payload?.data || payload || null;
const assertPositiveId = (value, label) => {
  const numericId = Number(value);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new Error(`Invalid ${label}`);
  }
  return numericId;
};

export const dashboardApi = {
  getJobs: async () => {
    const jobs = [];
    const limit = 100;
    let result;
    for (let page = 0; page < 100; page += 1) {
      result = await getJobsPage(jobs.length, limit);
      const nextJobs = result.jobs || [];
      jobs.push(...nextJobs);
      if (nextJobs.length < limit) {
        return { ...result, total: jobs.length, skip: 0, limit: jobs.length, jobs };
      }
    }
    throw new Error('Could not load all jobs. Contact support if more than 10,000 jobs are assigned.');
  },

  getJob: async (jobId, { force = false } = {}) => {
    const id = assertPositiveId(jobId, 'job id');
    // Return cached detail when fresh — avoids two parallel network requests on revisit
    const cached = require('../store/dashboardStore').useDashboardStore.getState().getJobDetailFromCache(id);
    if (cached && !force) {
      logger.info('dashboardApi', `getJob ${id}: cache hit`);
      return { job: cached.job };
    }

    const [jobResponse, checklistsResponse] = await Promise.all([
      generated.getJob(id),
      generated.getJobChecklists(id).catch((err) => {
        logger.warn('dashboardApi', `Failed to fetch checklists for job ${id}: ${err?.message}`);
        return { checklists: [], _error: err };
      }),
    ]);

    const job = extractJob(jobResponse);
    const checklists = checklistsResponse?.checklists || [];

    return {
      ...jobResponse,
      job: {
        ...job,
        checklists,
      },
      checklistsError: checklistsResponse?._error || null,
    };
  },

  requestStartOtp: async (jobId) => {
    const id = assertPositiveId(jobId, 'job id');
    return generated.requestStartOtp(id);
  },

  // otp omitted for jobs with no customer phone on file — the backend has no OTP for them.
  startJob: async (jobId, { otp, notes } = {}) => {
    const id = assertPositiveId(jobId, 'job id');
    const response = otp
      ? await generated.verifyStartOtp(id, { otp, notes })
      : await generated.startJob(id, { notes });
    return extractJob(response);
  },

  requestEndOtp: async (jobId) => {
    const id = assertPositiveId(jobId, 'job id');
    return generated.requestEndOtp(id);
  },

  // Same shape as startJob: no otp means the job has no customer phone on file.
  finishJob: async (jobId, { otp, notes, ...documents } = {}) => {
    const id = assertPositiveId(jobId, 'job id');
    const response = otp
      ? await generated.verifyEndOtp(id, { otp, notes, ...documents })
      : await generated.finishJob(id, { notes, ...documents });
    return extractJob(response);
  },

  uploadCompletionDocument: async (jobId, documentType, file) => {
    const id = assertPositiveId(jobId, 'job id');
    const rnFile = toRNFile(file);
    if (!rnFile) throw new Error('Invalid file selected');
    return generated.uploadCompletionDocument(id, documentType, rnFile);
  },

  recordAttendance: async ({ jobId, rosterEntryId, latitude, longitude, manualLocation, photoUri, attendanceType, reportFile, sundayReason }) => {
    const filename = photoUri.split('/').pop();
    const ext = filename?.split('.').pop()?.toLowerCase() ?? 'jpg';
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
    return generated.recordAttendance({
      job_id: jobId ? assertPositiveId(jobId, 'job id') : null,
      roster_entry_id: rosterEntryId ? assertPositiveId(rosterEntryId, 'roster entry id') : null,
      latitude,
      longitude,
      manual_location: manualLocation?.trim() || '',
      attendance_type: attendanceType || 'check_in',
      photo: { uri: photoUri, name: filename || 'photo.jpg', type: mimeType },
      report_file: reportFile ? toRNFile(reportFile) : null,
      sunday_reason: sundayReason || null,
    });
  },

  // Standalone report generation: returns the PDF, writes nothing.
  generateDailyReport: async ({ jobId, manualJob, reportDate, reportData, progressPhotos = [] }) => {
    const id = jobId === 'manual' ? 'manual' : assertPositiveId(jobId, 'job id');
    const response = await generateDailyReportRequest({ jobId: id, manualJob, reportDate, reportData, progressPhotos });
    const disposition = String(response.headers?.['content-disposition'] || '');
    const filename = disposition.match(/filename="?([^";]+)/i)?.[1]
      || 'daily-installation-report.pdf';
    const file = new File(Paths.cache, filename);
    file.create({ overwrite: true, intermediates: true });
    file.write(new Uint8Array(response.data));
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/pdf',
        dialogTitle: filename,
        UTI: 'com.adobe.pdf',
      });
    }
  },

  getAttendance: async (skip = 0, limit = 50) => {
    return generated.getAttendance(skip, limit);
  },

  getJobChecklists: async (jobId) => {
    const id = assertPositiveId(jobId, 'job id');
    return (await generated.getJobChecklists(id))?.checklists || [];
  },

  getRoster: async ({ dateFrom, dateTo } = {}) => {
    return getRosterRequest({ date_from: dateFrom, date_to: dateTo });
  },

  getSundayRequests: async () => {
    return generated.getSundayRequests();
  },

  createSundayRequest: async ({ requestDate, reason }) => {
    return generated.createSundayRequest(requestDate, reason);
  },

  getBilling: async (jobId) => {
    const id = assertPositiveId(jobId, 'job id');
    return generated.getBilling(id);
  },

  requestInvoice: async (jobId) => {
    const id = assertPositiveId(jobId, 'job id');
    return generated.requestInvoice(id);
  },

  requestAdditionalInvoice: async (jobId, data = {}) => {
    const id = assertPositiveId(jobId, 'job id');
    return generated.requestAdditionalInvoice(id, data);
  },

  downloadInvoice: async (jobId, jobName, invoiceRequestId) => {
    const id = assertPositiveId(jobId, 'job id');

    const file = new File(Paths.cache, `billing_invoice_${jobName || id}_${invoiceRequestId || 'latest'}.xlsx`);
    file.create({ overwrite: true, intermediates: true });
    file.write(new Uint8Array(await generated.downloadInvoice(id, invoiceRequestId)));

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: `Invoice - ${jobName || id}`,
        UTI: 'com.microsoft.excel.xlsx',
      });
    }
  },
};
