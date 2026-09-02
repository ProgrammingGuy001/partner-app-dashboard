import { getAssignedGrns, getJobGrnPaperwork, submitGrn } from './grnGeneratedApi';

export const grnApi = {
  getAssigned: getAssignedGrns,

  // The SO, the repair orders Odoo links to it, and this job's GRNs - the same
  // payload the supervisor sees.
  getJobPaperwork: getJobGrnPaperwork,

  submit: submitGrn,
};
