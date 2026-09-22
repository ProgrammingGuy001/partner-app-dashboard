// Offline rendering checks; no browser, API calls, or additional dependencies.
// Run: node tests/check_dashboard_states.mjs
import { build } from '../admin_dashboard/node_modules/esbuild/lib/main.js';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const admin = fileURLToPath(new URL('../admin_dashboard/', import.meta.url));
const result = await build({
  stdin: {
    resolveDir: admin, loader: 'tsx',
    contents: `
      import assert from 'node:assert/strict';
      import React from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import { MemoryRouter } from 'react-router-dom';
      import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
      import Dashboard from './src/pages/Dashboard';
      import { getApiErrorMessage } from './src/lib/apiError';

      function render(failures = [], superadmin = false) {
        const client = new QueryClient({defaultOptions: {queries: {retry: false, retryOnMount: false, refetchOnMount: false, staleTime: Infinity}}});
        client.setQueryData(['auth', 'user'], {id: 1, is_superadmin: superadmin});
        client.setQueryData(['jobs', undefined], []);
        client.setQueryData(['ip-users'], []);
        client.setQueryData(['analytics', 'job-stages'], []);
        client.setQueryData(['analytics', 'payout', {period: 'month'}], {total_jobs: 7, total_payout: 7000});
        client.setQueryData(['analytics', 'ip-performance'], [{ip_id: 1, ip_name: 'Test Partner', job_count: 3}]);
        for (const key of failures) {
          client.getQueryCache().find({queryKey: key, exact: true}).setState({
            data: undefined, status: 'error', error: new Error('Offline'), fetchStatus: 'idle',
          });
        }
        const html = renderToStaticMarkup(<QueryClientProvider client={client}><MemoryRouter><Dashboard /></MemoryRouter></QueryClientProvider>);
        client.clear();
        return html;
      }

      const unavailable = render([['jobs', undefined], ['ip-users']]);
      assert.match(unavailable, /Could not update:/);
      assert.match(unavailable, /Try again/);
      assert.match(unavailable, /Approval counts are unavailable/);
      assert.doesNotMatch(unavailable, /All Caught Up|No recent jobs found/);
      const empty = render();
      assert.match(empty, /All Caught Up/);
      assert.match(empty, /No recent jobs found/);
      assert.match(empty, /Manage jobs/);
      const partial = render([['analytics', 'payout', {period: 'month'}]], true);
      assert.match(partial, /Payout figures are unavailable/);
      assert.match(partial, /Test Partner/);
      const message = detail => getApiErrorMessage({response: {status: 422, data: {detail}}}, 'Try again');
      assert.equal(message('Upload the handover document first'), 'Upload the handover document first');
      assert.equal(message('SQLAlchemy Error: secret query'), 'Try again');
      console.log('Dashboard empty, error, partial-data and safe validation checks passed');
    `,
  },
  alias: { '@': admin + 'src' },
  bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
  define: { 'import.meta.env': JSON.stringify({}) }, logLevel: 'silent',
});
const check = spawnSync(process.execPath, ['--input-type=commonjs'], {
  input: result.outputFiles[0].text, encoding: 'utf8',
});
process.stdout.write(check.stdout);
process.stderr.write(check.stderr);
if (check.status !== 0) process.exitCode = 1;
