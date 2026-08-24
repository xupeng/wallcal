# Calendar and PDF Contract

## Scenario: Maintain the wall-calendar generator

### 1. Scope / Trigger

Apply this contract whenever changing supported years, calendar-data adaptation, day-state rendering, A4 print CSS, or the local PDF export command. These areas can produce plausible-looking but incorrect annual output, so a successful build alone is not sufficient.

### 2. Signatures

- `resolveYear(value, currentYear?) -> number`: return a supported year, falling back to the current year or nearest supported boundary.
- `getDayInfo(year, month, day) -> DayInfo`: normalize the third-party calendar response before rendering.
- `getYearCalendar(year) -> MonthData[12]`: reject unsupported years and return all month layouts.
- `npm run pdf -- <year>`: export `output/wallcal-<year>.pdf` from the current `dist/` build.

### 3. Contracts

`DayInfo` must provide:

- `dateKey`: `YYYY-MM-DD`.
- `lunarLabel`: lunar month name on day 1, otherwise lunar day name.
- `solarTerm`: term name or an empty string.
- `holidayName`: Chinese holiday name or an empty string.
- `isHoliday`: true only for dates in the official holiday arrangement.
- `isAdjustedWorkday`: true only for official make-up workdays, never for ordinary weekdays.

Environment and output:

- `CHROME_PATH` is optional and, when present, must point to an executable browser.
- The PDF command requires `dist/index.html` from `npm run build`.
- Every month is one `210mm × 297mm` portrait page with an 8 mm internal safe area; print controls must be hidden.
- Ephemeral screen state such as the “today” circle must reset to ordinary date styling in print; printed calendars must not become visually stale the next day.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Year outside the published holiday-data range | Do not expose it in the selector; CLI exits non-zero |
| Missing `dist/index.html` | CLI exits non-zero and tells the user to build first |
| Invalid `CHROME_PATH` or no browser found | CLI exits non-zero with an actionable browser-path message |
| Browser hangs | Terminate after the configured timeout, then force-kill if necessary |
| Browser exits unsuccessfully | CLI exits non-zero and does not preserve a stale target PDF |
| Output is empty, stale, or lacks `%PDF-` signature | CLI exits non-zero |

### 5. Good / Base / Bad Cases

- **Good**: an official make-up Sunday has `isAdjustedWorkday: true` and renders one `班` badge.
- **Base**: a normal Monday has no holiday metadata and renders no holiday/workday badge.
- **Bad**: deriving `isAdjustedWorkday` from `detail.work === true` alone marks every weekday as `班`.

### 6. Tests Required

- Scan every supported year: 12 months, non-empty lunar labels, exactly 24 solar terms, and valid holiday/workday classification.
- Pin representative official holidays and adjusted workdays for the latest supported year.
- Cover Monday-first offsets and real 4-, 5-, and 6-row month layouts.
- Test stale-output removal, PDF freshness/signature checks, browser discovery, and timeout termination.
- After print CSS or rendering changes, build and export a representative year; assert 12 A4 portrait pages and visually inspect pages with 5 and 6 rows. Include a 4-row year when changing row sizing.
- Keep each detached month self-contained with its three print legends, but do not duplicate the Monday-to-Sunday order in a decorative footer because the weekday header already carries that information.

### 7. Wrong vs Correct

#### Wrong

```js
const isAdjustedWorkday = detail.work;
```

#### Correct

```js
const parts = typeof detail?.name === 'string' ? detail.name.split(',') : [];
const hasHolidayMetadata = parts.length >= 2;
const isAdjustedWorkday = hasHolidayMetadata && detail.work === true;
```

Normalize this once in the data layer. Rendering code must consume normalized flags rather than interpreting third-party fields again.
