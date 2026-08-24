import './style.css';
import {
  SUPPORTED_YEAR_END,
  SUPPORTED_YEAR_START,
  getYearCalendar,
  resolveYear,
} from './calendar-data.js';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const TODAY = new Date();

const calendar = document.querySelector('#calendar');
const yearSelect = document.querySelector('#year');
const printButton = document.querySelector('#print');

function getInitialYear() {
  return resolveYear(new URLSearchParams(location.search).get('year'), TODAY.getFullYear());
}

function initYearSelect() {
  for (let year = SUPPORTED_YEAR_START; year <= SUPPORTED_YEAR_END; year += 1) {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = `${year} 年`;
    yearSelect.append(option);
  }
  yearSelect.value = getInitialYear();
}

function createDayCell(year, month, day, info) {
  const cell = document.createElement('div');
  cell.className = 'day';
  if (info.isHoliday) cell.classList.add('is-holiday');
  if (info.solarTerm) cell.classList.add('is-term');
  if (info.isAdjustedWorkday) cell.classList.add('is-workday');
  if (year === TODAY.getFullYear() && month === TODAY.getMonth() + 1 && day === TODAY.getDate()) {
    cell.classList.add('is-today');
  }

  const top = document.createElement('div');
  top.className = 'day-top';
  top.innerHTML = `<span class="solar-day">${day}</span><span class="lunar">${info.lunarLabel}</span>`;

  const notes = document.createElement('div');
  notes.className = 'day-notes';
  const labels = [];
  if (info.solarTerm) labels.push(`<span class="term-label">${info.solarTerm}</span>`);
  if (info.holidayName && info.isHoliday) labels.push(`<span class="holiday-label">${info.holidayName}</span>`);
  if (info.isAdjustedWorkday) labels.push('<span class="work-label" title="调休上班">班</span>');
  notes.innerHTML = labels.join('');

  cell.append(top, notes);
  return cell;
}

function createMonth(monthData) {
  const { year, month, offset, dayCount, rowCount, days } = monthData;
  const page = document.createElement('section');
  page.className = 'month-page';
  page.setAttribute('aria-label', `${year}年${month}月`);

  const header = document.createElement('header');
  header.className = 'month-header';
  header.innerHTML = `
    <div class="month-title"><span class="month-number">${String(month).padStart(2, '0')}</span><span>${MONTH_NAMES[month - 1]}</span></div>
    <div class="year-title"><strong>${year}</strong><span>年 · 中国月历</span></div>
  `;

  const weekdayRow = document.createElement('div');
  weekdayRow.className = 'weekday-row';
  WEEKDAYS.forEach((name, index) => {
    const item = document.createElement('div');
    item.textContent = `周${name}`;
    if (index >= 5) item.className = 'weekend';
    weekdayRow.append(item);
  });

  const grid = document.createElement('div');
  grid.className = 'days-grid';
  grid.style.setProperty('--rows', rowCount);

  for (let index = 0; index < 42; index += 1) {
    const day = index - offset + 1;
    if (index >= rowCount * 7) break;
    if (day < 1 || day > dayCount) {
      const blank = document.createElement('div');
      blank.className = 'day is-blank';
      grid.append(blank);
    } else {
      grid.append(createDayCell(year, month, day, days[day - 1]));
    }
  }

  const footer = document.createElement('footer');
  footer.className = 'month-footer';
  footer.innerHTML = '<span><i class="legend holiday"></i>放假安排</span><span><i class="legend term"></i>二十四节气</span><span><b>班</b> 调休上班</span>';

  page.append(header, weekdayRow, grid, footer);
  return page;
}

function render(year) {
  document.title = `${year} 墙上月历`;
  calendar.replaceChildren(...getYearCalendar(year).map(createMonth));
  document.documentElement.dataset.calendarReady = 'true';
}

initYearSelect();
render(Number(yearSelect.value));

yearSelect.addEventListener('change', () => {
  const year = Number(yearSelect.value);
  const url = new URL(location.href);
  url.searchParams.set('year', year);
  history.replaceState(null, '', url);
  render(year);
});
printButton.addEventListener('click', () => window.print());
