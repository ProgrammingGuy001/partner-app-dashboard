type ApiError = {
  message?: unknown;
  data?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const getApiErrorMessage = (error: unknown) => {
  if (isRecord(error) && typeof error.message === 'string') return error.message;
  return 'The server returned an unreadable error response.';
};

export const getApiFieldErrors = (error: unknown) => {
  const apiError = isRecord(error) ? (error as ApiError) : null;
  const data = isRecord(apiError?.data) ? apiError.data : null;
  const detail = Array.isArray(data?.detail) ? data.detail : [];

  return detail.reduce<Record<string, string>>((fields, item) => {
    if (!isRecord(item) || !Array.isArray(item.loc) || typeof item.msg !== 'string') return fields;
    const path = item.loc.filter((part) => !['body', 'query', 'path'].includes(String(part))).join('.');
    if (path && !fields[path]) fields[path] = item.msg;
    return fields;
  }, {});
};
