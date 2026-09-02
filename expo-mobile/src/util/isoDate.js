const isISODate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
};

// Local date, not toISOString() — that is UTC and rolls the day over early in IST.
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

module.exports = { isISODate, todayISO };

if (require.main === module) {
  console.assert(isISODate('2026-08-02') && !isISODate('2026-02-30'));
  console.assert(isISODate(todayISO()));
}
