// Offline journey checks: node tests/check_business_flows.mjs
import { build } from '../admin_dashboard/node_modules/esbuild/lib/main.js';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const partnerChecks = String.raw`
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { collapseRosterVisits, pickVisit, visitAttendanceType, visitCanRecord } from './src/utils/attendanceFlow';
import { addDaysISO } from './src/utils/dailyReport';
import { useAuthStore } from './src/store/authStore';
import { useVerificationStore } from './src/store/verificationStore';
import DocumentUpload from './src/components/verification/DocumentUpload';
import Sidebar from './src/components/layout/Sidebar';
import TodayCard from './src/components/dashboard/TodayCard';
import DailyAttendance from './src/components/dashboard/DailyAttendance';
import JobDetailPage from './src/pages/dashboard/JobDetailPage';
import { dashboardApi } from './src/api/dashboardApi';
import apiClient from './src/api/axiosConfig';

const today = addDaysISO(0);
const job = {id: 4, name: 'Test kitchen', status: 'in_progress', type: 'installation', customer_city: 'Chennai', checklists: [{id: 1, name: 'Installation checklist'}], customer_phone: '9999999999'};
const first = {id: 10, job_id: 4, work_date: today, slot_number: 1, slot_start: '09:00', slot_end: '13:00', status: 'report_due', job};
const second = {...first, id: 11, slot_number: 2, slot_start: '14:00', slot_end: '18:00'};
const entries = [second, first];
const visits = collapseRosterVisits(entries);
assert.equal(visits.length, 1);
assert.equal(visits[0].id, 10);
assert.equal(visits[0].span_end, '18:00');
assert.equal(pickVisit(visits, '11').id, 10);
assert.equal(pickVisit(visits, '', '4').id, 10);
assert.equal(pickVisit(visits, '', '999'), undefined);
assert.equal(visitAttendanceType(visits[0]), 'check_out');
assert.equal(visitCanRecord(visits[0]), true);
assert.equal(visitCanRecord({...first, status: 'completed'}), false);
assert.equal(visitCanRecord({...first, job: {...job, status: 'paused'}}), false);
assert.equal(pickVisit([...visits, {...first, id: 20, status: 'unknown'}]).id, 10);
assert.equal(collapseRosterVisits([first, {...first, work_date: '2000-01-01'}]).length, 2);
assert.equal(pickVisit([...visits, {...first, id: 20, status: 'check_in_open'}]).id, 10);


const render = (component, roster = entries, path = '/') => {
  const client = new QueryClient({defaultOptions: {queries: {retry: false, refetchOnMount: false, staleTime: Infinity}}});
  client.setQueryData(['partner-roster', today, today], {entries: roster});
  client.setQueryData(['partner-attendance'], {records: [], missing_reports: []});
  client.setQueryData(['partner-jobs'], [job]);
  client.setQueryData(['partner-job', '4'], job);
  const html = renderToStaticMarkup(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}>{component}</MemoryRouter></QueryClientProvider>);
  client.clear();
  return html;
};
const pending = render(<DocumentUpload canProceed isDocumentUploaded isIdVerified={false} onRefresh={() => {}} />);
assert.match(pending, /waiting for approval/);
assert.match(pending, /Check approval status/);
assert.doesNotMatch(pending, /Skip for Now|Go to my jobs|verification steps are complete/);
assert.match(render(<DocumentUpload canProceed isIdVerified />), /Go to my jobs/);
useVerificationStore.getState().setVerificationStatus({is_verified: true, is_pan_verified: true, is_bank_details_verified: true, id_document_uploaded: true});
assert.equal(useVerificationStore.getState().isDocumentUploaded, true);
assert.equal(useVerificationStore.getState().isFullyVerified(), false);
assert.doesNotMatch(render(<Sidebar />), /href="\/attendance"/);
useAuthStore.getState().setUser({is_verified: true, is_pan_verified: true, is_bank_details_verified: true, is_id_verified: true, is_internal: true});
Object.assign(useAuthStore.getInitialState(), useAuthStore.getState());
assert.match(render(<Sidebar />), /href="\/attendance"/);
const card = render(<TodayCard />);
assert.match(card, /href="\/attendance\?entry=10"/);
assert.doesNotMatch(card, /href="\/daily-report"|more visit/);
const checkout = render(<DailyAttendance initialRosterEntryId="11" />);
assert.match(checkout, /value="10" selected=""/);
assert.match(checkout, /value="Chennai"/);
assert.match(checkout, /What did you finish today/);
assert.match(checkout, /Submit report &amp; check out/);
assert.doesNotMatch(checkout, /Upload completed Daily Installation Report/);
assert.match(checkout, /<details[^>]*><summary[^>]*>Completed work/);
const site = render(<DailyAttendance />, [{...first, job: {...job, type: 'measurement'}}]);
assert.match(site, /Upload completed Measurement Report/);
assert.doesNotMatch(site, /What did you finish today/);
const missing = render(<DailyAttendance initialJobId="999" />);
assert.match(missing, /not on your schedule/);
assert.match(missing, /<fieldset disabled=""/);
const finished = render(<DailyAttendance />, [{...first, status: 'completed'}]);
assert.match(finished, /visit is already closed/);
assert.match(finished, /<fieldset disabled=""/);
const details = render(<Routes><Route path="/jobs/:id" element={<JobDetailPage />} /></Routes>, entries, '/jobs/4');
assert(details.indexOf('Your next step') < details.indexOf('Finish the whole job'));
assert(details.indexOf('id="job-checklists"') < details.indexOf('Finish the whole job'));
assert.match(details, /<details[^>]*><summary[^>]*>Finish the whole job/);
assert.match(details, /Attach the documents above before requesting/);

// Exercise the actual adapter + generated multipart serializer without HTTP.
apiClient.defaults.adapter = async (config) => {
  assert.equal(config.data.get('roster_entry_id'), '10');
  assert.deepEqual(JSON.parse(config.data.get('report_data')), {accomplishments: ['Cabinets installed']});
  assert.equal(config.data.getAll('progress_photos').length, 1);
  assert.equal(config.data.has('report_file'), false);
  return {data: {ok: true}, status: 200, statusText: 'OK', headers: {}, config};
};
(async () => {
  await dashboardApi.recordAttendance({jobId: 4, rosterEntryId: 10, attendanceType: 'check_out', manualLocation: 'Test site', photoFile: new Blob(['photo']), reportData: {accomplishments: ['Cabinets installed']}, progressPhotos: [new Blob(['progress'])]});
  console.log('Partner setup, navigation, full-day visit, report submission and final completion checks passed');
})().catch(error => {console.error(error); process.exitCode = 1;});
`;

const adminChecks = String.raw`
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import JobWorkspace from './src/pages/JobWorkspace';
function render(status, failure = false) {
  const client = new QueryClient({defaultOptions: {queries: {retry: false, retryOnMount: false, refetchOnMount: false, staleTime: Infinity}}});
  client.setQueryData(['jobs', 4], {id: 4, name: 'Test job', status, assigned_ip_id: 1});
  client.setQueryData(['auth', 'user'], {is_superadmin: true});
  client.setQueryData(['checklists', 'job', 4], []);
  client.setQueryData(['attendance', 'job', 4], {records: [], missing_reports: []});
  if (failure) for (const key of [['checklists', 'job', 4], ['attendance', 'job', 4]]) {
    client.getQueryCache().find({queryKey: key, exact: true}).setState({data: undefined, status: 'error', error: new Error('Offline'), fetchStatus: 'idle'});
  }
  const html = renderToStaticMarkup(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/jobs/4']}><Routes><Route path="/jobs/:jobId" element={<JobWorkspace />} /></Routes></MemoryRouter></QueryClientProvider>);
  client.clear();
  return html;
}
const active = render('in_progress');
assert.match(active, /Review work and approvals/);
assert.doesNotMatch(active, /Supervisor assigned|Checklist mapped|Customer OTP/);
assert.match(render('pending_approval'), /Review pending jobs/);
assert.match(render('completed'), /View job records &amp; billing/);
const failed = render('created', true);
assert.match(failed, /Start requirements could not be checked/);
assert.match(failed, /Visit reports could not be loaded/);
assert.doesNotMatch(failed, /Set up job checklist|No visit report has been filed|No checklist is attached/);
console.log('Admin stage-specific next steps and unavailable-data checks passed');
`;

for (const [folder, contents] of [['partnerfrontend', partnerChecks], ['admin_dashboard', adminChecks]]) {
  const root = fileURLToPath(new URL('../' + folder + '/', import.meta.url));
  const alias = Object.fromEntries(['components', 'pages', 'store', 'api', 'utils', 'hooks', 'assets'].map(name => ['@' + name, root + 'src/' + name]));
  const result = await build({stdin: {contents, loader: 'tsx', resolveDir: root}, alias: {...alias, '@': root + 'src'}, bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic', define: {'import.meta.env': '{}'}, loader: {'.css': 'empty', '.png': 'dataurl'}, logLevel: 'silent'});
  const check = spawnSync(process.execPath, ['--input-type=commonjs'], {input: result.outputFiles[0].text, encoding: 'utf8'});
  process.stdout.write(check.stdout);
  process.stderr.write(check.stderr);
  if (check.status !== 0) process.exitCode = 1;
}
