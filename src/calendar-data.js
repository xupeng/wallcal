import chineseDays from 'chinese-days';

export const SUPPORTED_YEAR_START = 2004;
export const SUPPORTED_YEAR_END = 2026;

export function dateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isSupportedYear(year) {
  return Number.isInteger(year) && year >= SUPPORTED_YEAR_START && year <= SUPPORTED_YEAR_END;
}

export function resolveYear(value, currentYear = new Date().getFullYear()) {
  const requestedYear = Number(value);
  if (isSupportedYear(requestedYear)) return requestedYear;
  if (isSupportedYear(currentYear)) return currentYear;
  return Math.min(Math.max(currentYear, SUPPORTED_YEAR_START), SUPPORTED_YEAR_END);
}

export function firstDayOffset(year, month) {
  return (new Date(year, month - 1, 1).getDay() + 6) % 7;
}

export function getMonthLayout(year, month) {
  const offset = firstDayOffset(year, month);
  const dayCount = new Date(year, month, 0).getDate();

  return {
    offset,
    dayCount,
    rowCount: Math.ceil((offset + dayCount) / 7),
  };
}

export function parseHolidayDetail(detail) {
  const parts = typeof detail?.name === 'string' ? detail.name.split(',') : [];
  const hasHolidayMetadata = parts.length >= 2;

  return {
    holidayName: hasHolidayMetadata ? (parts[1] || parts[0]) : '',
    isHoliday: hasHolidayMetadata && detail.work === false,
    isAdjustedWorkday: hasHolidayMetadata && detail.work === true,
  };
}

export function lunarLabel(lunar) {
  if (!lunar) return '';
  return lunar.lunarDay === 1 ? lunar.lunarMonCN || '' : lunar.lunarDayCN || '';
}

export function getDayInfo(year, month, day) {
  const key = dateKey(year, month, day);
  const detail = chineseDays.getDayDetail(key);
  const lunar = chineseDays.getLunarDate(key);
  const solarTerm = chineseDays.getSolarTerms(key)[0]?.name || '';

  return {
    dateKey: key,
    lunarLabel: lunarLabel(lunar),
    solarTerm,
    ...parseHolidayDetail(detail),
  };
}

export function getYearCalendar(year) {
  if (!isSupportedYear(year)) {
    throw new RangeError(`年份需在 ${SUPPORTED_YEAR_START}—${SUPPORTED_YEAR_END} 之间。`);
  }

  return Array.from({ length: 12 }, (_, monthIndex) => {
    const month = monthIndex + 1;
    const layout = getMonthLayout(year, month);
    const days = Array.from(
      { length: layout.dayCount },
      (_, dayIndex) => getDayInfo(year, month, dayIndex + 1),
    );

    return { year, month, ...layout, days };
  });
}
