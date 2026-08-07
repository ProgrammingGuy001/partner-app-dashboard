/**
 * Self-check for the error sanitiser. No test framework — Node strips the types.
 *   node src/lib/apiError.check.ts
 */
import { getApiErrorMessage, isSafeErrorText, sanitizeErrorText } from './apiError.ts';

const ok = (cond: boolean, label: string) => {
  if (!cond) throw new Error(`FAIL: ${label}`);
};

const err = (status: number, data: unknown) => ({ response: { status, data } });

// The leak this whole module exists to stop: SQLAlchemy stringifies bound params.
ok(
  getApiErrorMessage(
    err(500, {
      detail:
        "Database error: (psycopg2.errors.UniqueViolation) duplicate key\n[SQL: INSERT INTO jobs ...]\n[parameters: {'phone': '9876543210'}]",
    }),
    'Could not save the job',
  ) === 'Could not save the job',
  'SQL + bound parameters must never reach the user',
);

// Pydantic 422: detail is an array of {loc, msg}; loc is our schema.
ok(
  getApiErrorMessage(err(422, { detail: [{ loc: ['body', 'customer_id'], msg: 'field required' }] }), 'Check the form') ===
    'Check the form',
  'Pydantic loc paths must not be rendered',
);

// A short, clean business message is useful and safe — let it through.
ok(
  getApiErrorMessage(err(409, { detail: 'Job has already been started' }), 'Could not start the job') ===
    'Job has already been started',
  'clean backend detail passes through',
);

// Status copy beats a vague caller fallback where it genuinely helps.
ok(getApiErrorMessage(err(429, {}), 'Failed').startsWith('Too many attempts'), '429 gets rate-limit copy');
ok(getApiErrorMessage(err(403, {}), 'Failed').includes("don't have permission"), '403 gets permission copy');

// axios "Request failed with status code 500" must never surface.
ok(
  getApiErrorMessage({ message: 'Request failed with status code 500' }, 'Something went wrong') ===
    'Something went wrong',
  'axios error.message is ignored',
);
ok(getApiErrorMessage(undefined, 'Something went wrong') === 'Something went wrong', 'non-error input falls back');

// Internal hostnames and traceback text are internals too.
ok(!isSafeErrorText('Failed to connect to Odoo at http://10.0.0.7:8069'), 'internal URLs blocked');
ok(!isSafeErrorText('Traceback (most recent call last):'), 'tracebacks blocked');
ok(!isSafeErrorText('x'.repeat(201)), 'dumps blocked by length');
ok(isSafeErrorText('Requisite already submitted'), 'plain business text allowed');

// Persisted *_sync_error columns get the same filter.
ok(sanitizeErrorText('[SQL: SELECT 1]').startsWith('Sync failed'), 'stored SQL text is masked');
ok(sanitizeErrorText('Vendor code missing') === 'Vendor code missing', 'stored clean text passes');

// eslint-disable-next-line no-console -- CLI script, not shipped code
console.log('apiError: all checks passed');
