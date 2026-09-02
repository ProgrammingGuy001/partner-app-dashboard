import assert from 'node:assert/strict';

import { getApiFieldErrors } from './apiErrors.ts';

assert.deepEqual(
  getApiFieldErrors({ data: { detail: [{ loc: ['body', 'phone_number'], msg: 'Invalid phone', type: 'value_error' }] } }),
  { phone_number: 'Invalid phone' },
);
