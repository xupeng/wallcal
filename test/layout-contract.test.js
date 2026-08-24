import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [markup, script, styles] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/main.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/style.css', import.meta.url), 'utf8'),
]);

test('month pages keep required headings and exactly three legend items', () => {
  assert.match(script, /class="month-title"/);
  assert.match(script, /class="month-number"[^$]+\$\{String\(month\)\.padStart\(2, '0'\)\}/);
  assert.match(script, /const MONTH_NAMES = \['一月', '二月'/);
  assert.match(script, /class="year-title"/);
  assert.match(script, /const WEEKDAYS = \['一', '二', '三', '四', '五', '六', '日'\]/);

  const footerMarkup = script.match(/footer\.innerHTML = '([^']+)'/)?.[1] ?? '';
  assert.equal((footerMarkup.match(/<span>/g) ?? []).length, 3);
  assert.match(footerMarkup, /放假安排/);
  assert.match(footerMarkup, /二十四节气/);
  assert.match(footerMarkup, /调休上班/);
  assert.doesNotMatch(footerMarkup, /MONDAY|SUNDAY/);
  assert.doesNotMatch(styles, /\.month-footer em/);
});

test('today marker remains on screen and resets to an ordinary date when printed', () => {
  assert.match(script, /classList\.add\('is-today'\)/);
  assert.match(styles, /\.is-today \.solar-day \{[^}]+background: var\(--ink\)/);

  const printStyles = styles.match(/@media print \{([\s\S]+)\}\s*$/)?.[1] ?? '';
  assert.match(printStyles, /\.is-today \.solar-day \{[^}]+display: inline;/);
  assert.match(printStyles, /\.is-today \.solar-day \{[^}]+width: auto;[^}]+height: auto;/);
  assert.match(printStyles, /\.is-today \.solar-day \{[^}]+margin: 0;/);
  assert.match(printStyles, /\.is-today \.solar-day \{[^}]+color: inherit;[^}]+background: transparent;/);
});

test('screen-only toolbar branding stays present', () => {
  assert.match(markup, /class="brand"/);
  assert.match(markup, /class="brand-mark"/);
  assert.match(styles, /@media print[\s\S]+\.toolbar \{ display: none; \}/);
});
