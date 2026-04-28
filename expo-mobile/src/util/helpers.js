export const toRNFile = (file) => {
  if (!file?.uri) return null;
  return {
    uri: file.uri,
    name: file.name || `upload-${Date.now()}`,
    type: file.mimeType || 'application/octet-stream',
  };
};

/**
 * Logger utility that only logs in development mode.
 * Use instead of console.log/warn/error in production code.
 */
export const logger = {
  log: (tag, ...args) => {
    if (__DEV__) console.log(`[${tag}]`, ...args);
  },
  warn: (tag, ...args) => {
    if (__DEV__) console.warn(`[${tag}]`, ...args);
  },
  error: (tag, ...args) => {
    if (__DEV__) console.error(`[${tag}]`, ...args);
  },
  info: (tag, ...args) => {
    if (__DEV__) console.info(`[${tag}]`, ...args);
  },
};
