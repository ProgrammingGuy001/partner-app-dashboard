/**
 * Mirror of app/utils/job_documents.py — what each job type files.
 *
 * Installation records a visit with the generated Daily Installation Report and closes
 * on handover, project report and NCR. Measurement, site readiness and site validation
 * each upload one report at check-out that is both the visit record and the closure
 * document — a separate document from the job's checklist.
 */
export const SITE_REPORT_SLOTS = {
  measurement: 'measurement_report',
  site_readiness: 'readiness_report',
  site_validation: 'validation_report',
};

export const DOCUMENT_LABELS = {
  handover: 'Handover Document',
  ncr: 'Level 2 NCR',
  project_report: 'Project Report',
  measurement_report: 'Measurement Report',
  readiness_report: 'Site Readiness Report',
  validation_report: 'Site Validation Report',
};

// Rate cards carry display names ("Site Readiness"); jobs carry keys.
export const normalizeJobType = (jobType) =>
  (jobType || '').trim().toLowerCase().replace(/-/g, ' ').split(/\s+/).filter(Boolean).join('_');

export const siteReportSlot = (jobType) => SITE_REPORT_SLOTS[normalizeJobType(jobType)] || null;

export const filesDailyInstallationReport = (jobType) => siteReportSlot(jobType) === null;

/** What the IP has to attach when checking out of this job. */
export const checkOutReportLabel = (jobType) => {
  const slot = siteReportSlot(jobType);
  return slot ? DOCUMENT_LABELS[slot] : 'Daily Installation Report';
};

/** Documents that must already be filed before the job can be completed. */
export const closureDocuments = (jobType) => {
  const slot = siteReportSlot(jobType);
  return slot ? [slot] : ['handover', 'ncr', 'project_report'];
};

export const closureDocumentLabels = (jobType) =>
  closureDocuments(jobType).map((slot) => DOCUMENT_LABELS[slot]);

export const completionDocumentLink = (job, slot) =>
  Object.values(SITE_REPORT_SLOTS).includes(slot)
    ? job?.site_report_document_link
    : job?.[`${slot}_document_link`];
