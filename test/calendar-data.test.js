import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SUPPORTED_YEAR_END,
  SUPPORTED_YEAR_START,
  getDayInfo,
  getMonthLayout,
  getYearCalendar,
  lunarLabel,
  parseHolidayDetail,
  resolveYear,
} from '../src/calendar-data.js';

const HOLIDAY_COUNTS = [
  22, 24, 24, 26, 27, 27, 29, 28, 26, 29, 23, 25, 24, 24, 25, 28, 30, 31, 32,
  26, 28, 28, 33,
];
const ADJUSTED_WORKDAY_COUNTS = [
  6, 6, 8, 7, 5, 6, 8, 6, 6, 12, 5, 5, 6, 5, 7, 6, 6, 7, 7, 7, 8, 5, 6,
];

test('year resolution accepts only years with complete holiday data', () => {
  assert.equal(resolveYear('2025', 2026), 2025);
  assert.equal(resolveYear('2100', 2026), 2026);
  assert.equal(resolveYear('not-a-year', 2027), 2026);
  assert.equal(resolveYear(null, 2003), 2004);
});

test('month layout uses Monday-first offsets and natural row counts', () => {
  const layouts = Array.from({ length: 12 }, (_, index) => getMonthLayout(2026, index + 1));
  assert.deepEqual(layouts.map(({ offset }) => offset), [3, 6, 6, 2, 4, 0, 2, 5, 1, 3, 6, 1]);
  assert.deepEqual(layouts.map(({ dayCount }) => dayCount), [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
  assert.deepEqual(layouts.map(({ rowCount }) => rowCount), [5, 5, 6, 5, 5, 5, 5, 6, 5, 5, 6, 5]);
  assert.equal(getMonthLayout(2021, 2).rowCount, 4);
});

test('holiday metadata distinguishes ordinary weekdays and adjusted workdays', () => {
  assert.deepEqual(parseHolidayDetail({ work: true, name: 'Monday' }), {
    holidayName: '',
    isHoliday: false,
    isAdjustedWorkday: false,
  });
  assert.deepEqual(parseHolidayDetail({ work: true, name: 'Spring Festival,春节,4' }), {
    holidayName: '春节',
    isHoliday: false,
    isAdjustedWorkday: true,
  });
});

test('lunar first days display the month name', () => {
  assert.equal(lunarLabel({ lunarDay: 1, lunarMonCN: '正月', lunarDayCN: '初一' }), '正月');
  assert.equal(lunarLabel({ lunarDay: 30, lunarMonCN: '腊月', lunarDayCN: '三十' }), '三十');
});

test('2026 key holidays and a holiday-term overlap match the data source', () => {
  const expected = new Map([
    ['2026-01-01', '元旦'],
    ['2026-02-17', '春节'],
    ['2026-04-05', '清明'],
    ['2026-05-01', '劳动节'],
    ['2026-06-19', '端午'],
    ['2026-09-25', '中秋'],
    ['2026-10-01', '国庆节'],
  ]);

  for (const [key, holidayName] of expected) {
    const [, month, day] = key.split('-').map(Number);
    const info = getDayInfo(2026, month, day);
    assert.equal(info.isHoliday, true, key);
    assert.equal(info.holidayName, holidayName, key);
  }

  const qingming = getDayInfo(2026, 4, 5);
  assert.equal(qingming.solarTerm, '清明');
  assert.equal(qingming.isHoliday, true);
});

test('2026 contains all 24 terms and only official adjusted workdays', () => {
  const days = getYearCalendar(2026).flatMap((month) => month.days);
  const terms = days.filter((day) => day.solarTerm);
  const adjustedWorkdays = days.filter((day) => day.isAdjustedWorkday).map((day) => day.dateKey);

  assert.equal(terms.length, 24);
  assert.deepEqual(adjustedWorkdays, [
    '2026-01-04',
    '2026-02-14',
    '2026-02-28',
    '2026-05-09',
    '2026-09-20',
    '2026-10-10',
  ]);
});

test('all supported years satisfy the published calendar data contract', () => {
  const supportedYears = Array.from(
    { length: SUPPORTED_YEAR_END - SUPPORTED_YEAR_START + 1 },
    (_, index) => SUPPORTED_YEAR_START + index,
  );
  assert.equal(HOLIDAY_COUNTS.length, supportedYears.length);
  assert.equal(ADJUSTED_WORKDAY_COUNTS.length, supportedYears.length);

  supportedYears.forEach((year, yearIndex) => {
    const months = getYearCalendar(year);
    const days = months.flatMap((month) => month.days);
    const expectedDayCount = new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
    const dateKeys = new Set(days.map((day) => day.dateKey));
    const terms = days.filter((day) => day.solarTerm);
    const holidays = days.filter((day) => day.isHoliday);
    const adjustedWorkdays = days.filter((day) => day.isAdjustedWorkday);

    assert.equal(months.length, 12, `${year}: month count`);
    assert.equal(days.length, expectedDayCount, `${year}: day count`);
    assert.equal(dateKeys.size, expectedDayCount, `${year}: unique date keys`);
    assert.ok(days.every((day) => day.dateKey.startsWith(`${year}-`)), `${year}: date key year`);
    assert.ok(days.every((day) => day.lunarLabel), `${year}: lunar labels`);
    assert.equal(terms.length, 24, `${year}: solar term count`);
    assert.equal(new Set(terms.map((day) => day.solarTerm)).size, 24, `${year}: unique solar terms`);
    assert.equal(holidays.length, HOLIDAY_COUNTS[yearIndex], `${year}: holiday count`);
    assert.equal(
      adjustedWorkdays.length,
      ADJUSTED_WORKDAY_COUNTS[yearIndex],
      `${year}: adjusted workday count`,
    );
    assert.ok(
      [...holidays, ...adjustedWorkdays].every((day) => day.holidayName),
      `${year}: holiday metadata`,
    );
    assert.ok(
      days.every((day) => !(day.isHoliday && day.isAdjustedWorkday)),
      `${year}: mutually exclusive holiday states`,
    );
    assert.ok(
      months.every((month) => month.rowCount >= 4 && month.rowCount <= 6),
      `${year}: natural month row counts`,
    );
  });
});

test('representative lunar dates are stable', () => {
  assert.equal(getDayInfo(2026, 2, 16).lunarLabel, '廿九');
  assert.equal(getDayInfo(2026, 2, 17).lunarLabel, '正月');
  assert.equal(getDayInfo(2026, 10, 10).lunarLabel, '九月');
});
