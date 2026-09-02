import assert from 'node:assert/strict';
import { reportDateToISO } from './dailyReportDate.ts';

const now = new Date(2026, 7, 24);
assert.equal(reportDateToISO('24/08/2026', now), '2026-08-24');
assert.equal(reportDateToISO('31/02/2026', now), '');
assert.equal(reportDateToISO('25/08/2026', now), '');
