// Daily Installation Report shape and formatting, shared by the check-out flow
// and the standalone generator screen, so the two can't drift out of agreement
// with app/schemas/attendance.py.

// Field limits mirror app/schemas/attendance.py — enforced in the inputs so an
// over-long entry is stopped as it is typed, not with a 422 after the photo and GPS.
export const LIMITS = { action: 500, notes: 1000, short: 20 };
export const MAX_PROGRESS_PHOTOS = 12;
export const MAX_PROGRESS_PHOTO_BYTES = 2 * 1024 * 1024;
export const MAX_REPORT_ROWS = 3;

// DD/MM/YYYY, the format the report itself prints (installation_report_service).
// No date-picker dependency: these rows are almost always today and tomorrow, so
// prefilling removes the typing instead of adding a library.
export const reportDate = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

export const emptyProgressRow = () => ({ action_item: '', date: reportDate(0), challenges_faced: '' });
export const emptyUpcomingRow = () => ({ action_item: '', date: reportDate(1), potential_issues: '' });

export const addReportRow = (rows, row) => rows.length < MAX_REPORT_ROWS ? [...rows, row] : rows;

export const emptyReport = () => ({
  accomplishments: [''],
  completed_work: [emptyProgressRow()],
  num_ips: '', ip_in_time: '', ip_out_time: '',
  num_helpers: '', helper_in_time: '', helper_out_time: '',
  num_labour: '', labour_in_time: '', labour_out_time: '', mandays: '',
  upcoming_work: [emptyUpcomingRow()],
});

/** Strip the blank rows. Keyed on action_item, not "any field set" — the date is
 *  prefilled, so `some()` would send three empty rows every time. */
export const normalizeReport = (reportData) => ({
  ...reportData,
  accomplishments: reportData.accomplishments.filter((value) => value.trim()),
  completed_work: reportData.completed_work.filter((row) => row.action_item.trim()),
  upcoming_work: reportData.upcoming_work.filter((row) => row.action_item.trim()),
});

export const hasAccomplishment = (reportData) =>
  reportData.accomplishments.some((value) => value.trim());
