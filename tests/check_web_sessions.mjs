// Run: node tests/check_web_sessions.mjs (uses the existing Vite/esbuild dependency).
import { build } from '../partnerfrontend/node_modules/esbuild/lib/main.js';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
for (const app of ['admin_dashboard', 'partnerfrontend']) {
  const partner = app === 'partnerfrontend';
  const source = path.join(root, app, 'src');
  const result = await build({
    stdin: {
      resolveDir: path.join(root, app),
      contents: `
        import assert from 'node:assert/strict';
        import axios, { AxiosError } from 'axios';
        import client from './src/api/${partner ? 'axiosConfig.js' : 'axios.ts'}';
        ${partner ? "import { useAuthStore } from './src/store/authStore.js';" : ''}
        ${partner ? "import { loginSchema } from './src/utils/schemas.js';" : ''}
        async function check() {
          const storage = new Map([['auth-token', 'legacy-token']]);
          globalThis.localStorage = {
            getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, value),
            removeItem: key => storage.delete(key),
          };
          ${partner ? `
            for (const phoneNumber of ['9123456789', '+91 91234 56789', '919123456789']) {
              assert.equal(loginSchema.parse({ phoneNumber }).phoneNumber, '9123456789');
            }
            assert.equal(loginSchema.safeParse({phoneNumber: '12345'}).success, false);
            useAuthStore.getState().setUser({ id: 1, first_name: 'Partner', access_token: 'secret', refresh_token: 'secret' });
            assert.equal(useAuthStore.getState().user.access_token, undefined, 'tokens must not enter user state');
            assert.equal(storage.has('cached-user-profile'), false, 'user profiles must not persist on shared devices');
          ` : ''}
          let refreshes = 0;
          let authenticated = false;
          axios.post = async (_url, _body, config) => {
            refreshes++;
            assert.equal(config.timeout, 30000, 'refresh must have a bounded timeout');
            await new Promise(resolve => setTimeout(resolve, 10));
            authenticated = true;
            return { data: {} };
          };
          client.defaults.adapter = async config => {
            assert.equal(config.headers.Authorization, undefined, 'browser must use HttpOnly cookies');
            if (!authenticated) throw new AxiosError('Expired', 'ERR_BAD_REQUEST', config, {}, {status: 401, data: {detail: 'Expired'}, config});
            return { status: 200, data: { ok: true }, config };
          };
          const results = await Promise.all(Array.from({length: 5}, () => client.get('/jobs')));
          assert.equal(refreshes, 1, 'parallel 401s must share one refresh');
          assert(results.every(result => result.data.ok));
          ${partner ? `
            authenticated = false;
            axios.post = async () => { throw new AxiosError('Offline', 'ERR_NETWORK'); };
            await assert.rejects(client.get('/jobs'));
            assert.equal(useAuthStore.getState().isAuthenticated, true, 'offline refresh must not log the user out');
            axios.post = async () => { throw new AxiosError('Expired', 'ERR_BAD_REQUEST', {}, {}, {status: 401}); };
            await assert.rejects(client.get('/jobs'));
            assert.equal(useAuthStore.getState().isAuthenticated, false, 'rejected refresh must clear authentication');
          ` : ''}
          let mutationAttempts = 0;
          client.defaults.adapter = async config => {
            mutationAttempts++;
            throw new AxiosError('Response lost', 'ECONNABORTED', config, {});
          };
          await assert.rejects(client.post('/jobs', { name: 'Test' }), error => {
            ${partner ? "assert.match(error.message, /Check the record before submitting again/);" : ''}
            return true;
          });
          assert.equal(mutationAttempts, 1, 'a lost save response must never be replayed');
          console.log('${app}: session checks passed');
        }
        check().catch(error => { console.error(error); process.exitCode = 1; });
      `,
    },
    bundle: true, write: false, platform: 'node', format: 'cjs',
    define: { 'import.meta.env': JSON.stringify({VITE_API_BASE_URL: 'https://example.invalid/api/v1'}) },
    alias: { '@utils': path.join(source, 'utils'), '@store': path.join(source, 'store') },
    logLevel: 'silent',
  });
  const check = spawnSync(process.execPath, ['--input-type=commonjs'], {
    input: result.outputFiles[0].text, encoding: 'utf8',
  });
  process.stdout.write(check.stdout);
  process.stderr.write(check.stderr);
  if (check.status !== 0) process.exitCode = 1;
}
