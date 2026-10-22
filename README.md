# zse-timetable-card

[Polski](README.pl.md)

Lovelace card showing a school timetable in the VULCAN Optivum layout (No. | Time | Monday … Friday), with data from
`sensor.timetable_*` of the [zse_timetable](https://github.com/achelminski/zse-timetable) integration.
Each cell shows subject (bold) / class with group / room, left-aligned; substitutions are highlighted in colour,
the first line names the absent teacher (“Substitution for J. Kowalski”, requires zse_timetable ≥ 1.3.0)
(tooltip: who is being covered, notes). Below the table: the whole “Obowiązuje od: …” line from the school page.

## Installation

### HACS (recommended)
1. HACS → ⋮ → **Custom repositories** → `https://github.com/achelminski/zse-timetable-card`, type **Dashboard**.
2. Download **ZSE Timetable card** — HACS adds the dashboard resource itself.
3. Hard-refresh the browser / clear the companion app cache.

HACS shows an update in **Settings → Updates** whenever a new release is published.

### Manual
1. Copy `zse-timetable-card.js` to `/config/www/zse-timetable-card/zse-timetable-card.js`.
2. Add a dashboard resource `/local/zse-timetable-card/zse-timetable-card.js?v=1.3.0`, type **JavaScript module**;
   bump `?v=` after every file change, otherwise browsers keep the old version.

## Configuration
```yaml
type: custom:zse-timetable-card
entity: sensor.timetable_j_kowalski
title: Timetable              # optional; default: the `teacher` attribute
substitution_color: "#e53935" # optional
day_switch_hour: 16           # optional; day view: from this hour show the next day
```
The visual editor offers: entity (filtered to zse_timetable sensors), title, substitution colour, day switch hour.

## Behaviour
- Landscape (and desktop): week view, ‹ › switch between the 2 weeks provided by the sensor; on weekends the
  card starts with next week.
- Portrait on a phone / tablet (`(orientation: portrait) and (max-width: 900px)`): a single day column;
  today until `day_switch_hour` (16), then the next day; a day without data (weekend) → the nearest day in the
  timetable; ‹ › scroll days. Time is taken in the Home Assistant time zone. Every minute the card checks whether
  the switch hour / midnight has passed and moves on by itself — unless the day was changed manually. Rotating the
  screen switches the view immediately.
- Rows: `lesson_hours` + lesson numbers present in the shown days (e.g. lesson 9); lessons without a number go to a “–” row.
- Columns: Mon–Fri, Sat/Sun only when they have lessons; today's column has a tinted background.
- Colours follow the school page (`plan.css`); a dimmed palette in a dark Home Assistant theme.
- Language follows the Home Assistant user language: Polish for `pl`, English otherwise.
- No dependencies (plain Web Component, no Lit); re-renders only when the entity state or the theme changes.
