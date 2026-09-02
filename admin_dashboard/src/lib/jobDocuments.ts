/**
 * Mirror of app/utils/job_documents.py — what each job type files at closure.
 *
 * Installation runs over many days: its history is a Daily Installation Report per
 * visit, and closing it needs handover, project report and NCR. Measurement, site
 * readiness and site validation each file one report on site that serves as both the
 * visit record and the closure document.
 */
export const SITE_REPORT_SLOTS: Record<string, string> = {
  measurement: 'measurement_report',
  site_readiness: 'readiness_report',
  site_validation: 'validation_report',
};

export const DOCUMENT_LABELS: Record<string, string> = {
  handover: 'Handover Document',
  ncr: 'Level 2 NCR',
  project_report: 'Project Report',
  measurement_report: 'Measurement Report',
  readiness_report: 'Site Readiness Report',
  validation_report: 'Site Validation Report',
};

// Rate cards carry display names ("Site Readiness"); jobs carry keys.
export const normalizeJobType = (jobType?: string | null): string => {
  const normalized = (jobType || '').trim().toLowerCase().replace(/-/g, ' ').split(/\s+/).filter(Boolean).join('_');
  return normalized === 'site_measurement' ? 'measurement' : normalized;
};

export const siteReportSlot = (jobType?: string | null): string | null =>
  SITE_REPORT_SLOTS[normalizeJobType(jobType)] ?? null;

/** Unknown and legacy types (including grn) keep the three-document rule. */
export const closureDocuments = (jobType?: string | null): string[] => {
  const slot = siteReportSlot(jobType);
  return slot ? [slot] : ['handover', 'ncr', 'project_report'];
};

export const filesDailyInstallationReport = (jobType?: string | null): boolean =>
  siteReportSlot(jobType) === null;
