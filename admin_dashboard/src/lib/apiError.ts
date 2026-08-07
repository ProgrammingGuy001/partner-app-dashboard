/**
 * Single chokepoint for turning an API/network failure into user-facing copy.
 *
 * Rule: never render text we did not write unless it is provably free of backend
 * internals. A raw FastAPI `detail` can carry SQL, bound parameters, Pydantic
 * field paths or internal hostnames — all of which are free reconnaissance for
 * anyone with devtools open. Anything suspicious collapses to a status-mapped
 * message or the caller's fallback.
 */

/** Markers that mean a string carries backend internals rather than user advice. */
const LEAK_SIGNATURES = [
  /\[sql\b/i,
  /\bparameters:/i,
  /traceback/i,
  /psycopg|sqlalchemy|asyncpg|xmlrpc|pydantic|odoo/i,
  /https?:\/\//i,
  /(^|\s)\/(usr|var|home|opt|app|Users)\//,
  /\.py["']?,?\s*line\s*\d+/i,
  /\bException\b|\bError:\s/,
];

/** Longer than this and it is a dump, not a sentence. */
const MAX_DETAIL_LENGTH = 200;

const STATUS_MESSAGES: Record<number, string> = {
  401: 'Your session has expired. Please sign in again.',
  403: "You don't have permission to do that.",
  404: 'That record no longer exists.',
  409: 'That conflicts with the current state. Refresh and try again.',
  413: 'That file is too large.',
  429: 'Too many attempts. Wait a minute and try again.',
};

type ApiErrorShape = {
  response?: {
    status?: number;
  };
};

/** True only for a short, single-line string with no backend internals in it. */
export const isSafeErrorText = (text: unknown): text is string => {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MAX_DETAIL_LENGTH) return false;
  if (/[\n\r]/.test(trimmed)) return false;
  return !LEAK_SIGNATURES.some((pattern) => pattern.test(trimmed));
};

/** For values already persisted server-side (e.g. `odoo_sync_error` columns). */
export const sanitizeErrorText = (
  text: unknown,
  fallback = 'Sync failed. Quote the record ID to support.',
): string => (isSafeErrorText(text) ? text : fallback);

/**
 * Drop-in replacement for the per-file `detail` extractors. Note we never read
 * `error.message`: axios produces "Request failed with status code 500", which
 * tells the user nothing and the attacker something.
 */
export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const response = (error as ApiErrorShape | null | undefined)?.response;
  const status = response?.status;
  return (status && STATUS_MESSAGES[status]) || fallback;
};
