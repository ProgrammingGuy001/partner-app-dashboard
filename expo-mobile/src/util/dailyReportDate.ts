export const reportDateToISO = (value: unknown, now = new Date()) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value || ''));
  if (!match) return '';
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const latest = new Date(now);
  latest.setHours(23, 59, 59, 999);
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day) || date > latest) return '';
  return `${year}-${month}-${day}`;
};
