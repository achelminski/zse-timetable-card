/**
 * zse-timetable-card — tabela planu lekcji w układzie strony VULCAN Optivum
 * (Nr | Godz | Poniedziałek … Piątek). Źródło: sensor.timetable_* z integracji zse_timetable
 * (atrybuty `lesson_hours` i `days`, 2 tygodnie od poniedziałku bieżącego).
 *
 * type: custom:zse-timetable-card
 * entity: sensor.timetable_j_kowalski
 * title: Plan lekcji            # opcjonalnie, domyślnie nazwa nauczyciela
 * substitution_color: "#e53935" # opcjonalnie
 */

const PLC_VERSION = "1.3.0";
const PLC_I18N = {
  pl: {
    days: ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"],
    nr: "Nr",
    time: "Godz",
    this_week: "Bieżący tydzień",
    next_week_label: "Następny tydzień",
    prev_week: "Poprzedni tydzień",
    next_week: "Następny tydzień",
    prev_day: "Poprzedni dzień",
    next_day: "Następny dzień",
    today: "Dziś",
    tomorrow: "Jutro",
    substitution: "Zastępstwo",
    absent: "Za",
    notes: "Uwagi",
    no_entity: "Brak encji",
    no_data: "Brak danych planu",
    need_entity: "Podaj entity: sensor.timetable_<nauczyciel>",
    ed_entity: "Encja timetable",
    ed_title: "Tytuł",
    ed_color: "Kolor zastępstw (np. #e53935)",
    ed_hour: "Widok dzienny (pion): od której godziny pokazywać następny dzień",
    card_name: "Plan lekcji",
    card_desc: "Plan lekcji nauczyciela w układzie VULCAN Optivum (sensor.timetable_* z zse_timetable)",
  },
  en: {
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    nr: "No.",
    time: "Time",
    this_week: "This week",
    next_week_label: "Next week",
    prev_week: "Previous week",
    next_week: "Next week",
    prev_day: "Previous day",
    next_day: "Next day",
    today: "Today",
    tomorrow: "Tomorrow",
    substitution: "Substitution",
    absent: "Covering for",
    notes: "Notes",
    no_entity: "Entity not found",
    no_data: "No timetable data",
    need_entity: "Set entity: sensor.timetable_<teacher>",
    ed_entity: "Timetable entity",
    ed_title: "Title",
    ed_color: "Substitution color (e.g. #e53935)",
    ed_hour: "Day view (portrait): hour from which the next day is shown",
    card_name: "School timetable",
    card_desc: "Teacher timetable in the VULCAN Optivum layout (sensor.timetable_* from zse_timetable)",
  },
};

/** Card language: the HA user's language; without hass (editor, card picker) — the browser's. */
function plcLang(hass) {
  const code =
    hass?.locale?.language ||
    hass?.language ||
    globalThis.document?.querySelector("home-assistant")?.hass?.locale?.language ||
    globalThis.navigator?.language ||
    "en";
  return String(code).toLowerCase().startsWith("pl") ? "pl" : "en";
}

const plcT = (hass) => PLC_I18N[plcLang(hass)];

const PLC_PALETTE = {
  // Kolory ze strony planu (css/plan.css).
  light: {
    head_bg: "#f7e1b6",
    head_fg: "#7e590e",
    hour_bg: "#fcf5e8",
    cell_bg: "#ffffff",
    cell_fg: "#000000",
    meta_fg: "#7e590e",
    border: "#c0c0c0",
    today_bg: "#efc571",
  },
  dark: {
    head_bg: "#4a3b1c",
    head_fg: "#f3d9a4",
    hour_bg: "#2c2618",
    cell_bg: "var(--card-background-color, #1c1c1c)",
    cell_fg: "var(--primary-text-color, #e1e1e1)",
    meta_fg: "#d9b26a",
    border: "#5a5a5a",
    today_bg: "#7a5c22",
  },
};

const plcEsc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

const plcDayMonth = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

// Widok dzienny: telefon/tablet w pionie (wysoki monitor biurkowy zostaje przy tygodniu).
const PLC_PORTRAIT_QUERY = "(orientation: portrait) and (max-width: 900px)";

/** Bieżąca data (YYYY-MM-DD) i godzina w strefie czasowej HA — nie telefonu. */
function plcNow(hass) {
  try {
    const text = new Intl.DateTimeFormat("sv-SE", {
      timeZone: hass?.config?.time_zone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).format(new Date()); // "2026-10-20 21:55"
    return { date: text.slice(0, 10), hour: Number(text.slice(11, 13)) };
  } catch (_err) {
    const now = new Date();
    return { date: now.toISOString().slice(0, 10), hour: now.getHours() };
  }
}

const plcWeekday = (iso) => (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = poniedziałek

function plcAddDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

class ZseTimetableCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error(plcT(this._hass).need_entity);
    }
    this._config = { substitution_color: "#e53935", day_switch_hour: 16, ...config };
    this._week = null; // null = automatycznie (w weekend następny tydzień)
    this._day = null; // null = automatycznie (dziś, po day_switch_hour następny dzień)
    this._lastState = undefined;
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
      this.shadowRoot.addEventListener("click", (ev) => this._onClick(ev));
    }
    this._render();
  }

  connectedCallback() {
    this._mq = window.matchMedia(PLC_PORTRAIT_QUERY);
    this._portrait = this._mq.matches;
    this._onOrientation = () => {
      this._portrait = this._mq.matches;
      this._render();
    };
    this._mq.addEventListener("change", this._onOrientation);
    // Przeskok o day_switch_hour (i o północy) bez przeładowania — tylko gdy dzień nie był przewinięty ręcznie.
    this._timer = setInterval(() => {
      const key = this._autoKey();
      if (key !== this._lastAutoKey && this._day === null) this._render();
    }, 60000);
    this._render();
  }

  disconnectedCallback() {
    this._mq?.removeEventListener("change", this._onOrientation);
    clearInterval(this._timer);
  }

  _autoKey() {
    const now = plcNow(this._hass);
    return `${now.date}|${now.hour >= Number(this._config?.day_switch_hour ?? 16)}`;
  }

  set hass(hass) {
    this._hass = hass;
    const stateObj = hass.states[this._config.entity];
    const dark = Boolean(hass.themes?.darkMode);
    if (stateObj === this._lastState && dark === this._lastDark) return;
    this._lastState = stateObj;
    this._lastDark = dark;
    this._render();
  }

  getCardSize() {
    return 9;
  }

  getGridOptions() {
    return { columns: "full", min_columns: 6, rows: "auto" };
  }

  static getConfigForm() {
    return {
      schema: [
        { name: "entity", required: true, selector: { entity: { filter: { domain: "sensor", integration: "zse_timetable" } } } },
        { name: "title", selector: { text: {} } },
        { name: "substitution_color", selector: { text: {} } },
        { name: "day_switch_hour", selector: { number: { min: 0, max: 23, step: 1, mode: "box" } } },
      ],
      computeLabel: (s) => {
        const t = plcT();
        return { entity: t.ed_entity, title: t.ed_title, substitution_color: t.ed_color, day_switch_hour: t.ed_hour }[s.name];
      },
    };
  }

  static getStubConfig(hass) {
    const entity = Object.keys(hass.states).find((id) => id.startsWith("sensor.timetable_")) || "";
    return { entity };
  }

  // --- dane -------------------------------------------------------------------------

  _weeks(days) {
    // Podział na tygodnie po poniedziałkach (atrybut ma 2 tygodnie od poniedziałku bieżącego).
    const weeks = [];
    for (const day of days) {
      const monday = new Date(`${day.date}T12:00:00Z`);
      monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      let week = weeks.find((w) => w.key === key);
      if (!week) weeks.push((week = { key, days: [] }));
      week.days.push(day);
    }
    return weeks;
  }

  _currentWeekIndex(weeks, today) {
    if (this._week !== null) return Math.min(this._week, weeks.length - 1);
    const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = poniedziałek
    return weekday >= 5 && weeks.length > 1 ? 1 : 0;
  }

  _currentDayIndex(days, now) {
    if (this._day !== null) return Math.min(this._day, days.length - 1);
    // Dziś do day_switch_hour, potem jutro; dzień bez danych (weekend) -> najbliższy następny z planu.
    const switchHour = Number(this._config.day_switch_hour ?? 16);
    const target = now.hour >= switchHour ? plcAddDays(now.date, 1) : now.date;
    const index = days.findIndex((d) => d.date >= target);
    return index === -1 ? days.length - 1 : index;
  }

  _rows(hours, days) {
    // Siatka z planu + numery lekcji spoza niej (np. zastępstwo na lekcji spoza siatki).
    const rows = new Map(hours.map((h) => [h.nr, { ...h }]));
    let other = false;
    for (const day of days) {
      for (const lesson of day.lessons) {
        if (lesson.nr === null || lesson.nr === undefined) other = true;
        else if (!rows.has(lesson.nr)) rows.set(lesson.nr, { nr: lesson.nr, start: lesson.start, end: lesson.end });
      }
    }
    const sorted = [...rows.values()].sort((a, b) => a.nr - b.nr);
    if (other) sorted.push({ nr: null, start: null, end: null });
    return sorted;
  }

  // --- render -----------------------------------------------------------------------

  _onClick(ev) {
    const button = ev.target.closest("[data-week], [data-day]");
    if (!button || button.disabled) return;
    if ("week" in button.dataset) this._week = Number(button.dataset.week);
    else this._day = Number(button.dataset.day);
    this._render();
  }

  _tableHtml(days, hours, today) {
    const t = plcT(this._hass);
    const rows = this._rows(hours, days);
    const head = days
      .map((d) => `<th class="${d.date === today ? "today" : ""}">${t.days[plcWeekday(d.date)]}<span class="date">${plcDayMonth(d.date)}</span></th>`)
      .join("");
    const bodyRows = rows
      .map((row) => {
        const cells = days
          .map((d) => {
            const lessons = d.lessons.filter((l) => (row.nr === null ? l.nr === null || l.nr === undefined : l.nr === row.nr));
            return `<td class="l${d.date === today ? " today" : ""}">${lessons.map((l) => this._lessonHtml(l)).join("")}</td>`;
          })
          .join("");
        const time = row.start ? `${row.start}-${row.end}` : "";
        return `<tr><td class="nr">${row.nr === null ? "–" : row.nr}</td><td class="g">${time}</td>${cells}</tr>`;
      })
      .join("");
    return `
      <div class="scroll">
        <table class="${days.length === 1 ? "single" : ""}">
          <thead><tr><th class="nrh">${t.nr}</th><th class="gh">${t.time}</th>${head}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>`;
  }

  _weekBody(allDays, hours, today) {
    const weeks = this._weeks(allDays);
    const index = this._currentWeekIndex(weeks, today);
    const week = weeks[index];
    const first = week.days[0].date;
    const last = week.days[week.days.length - 1].date;
    const t = plcT(this._hass);
    const label = index === 0 ? t.this_week : t.next_week_label;
    return `
      <div class="nav">
        <button data-week="${index - 1}" ${index === 0 ? "disabled" : ""} aria-label="${t.prev_week}">‹</button>
        <span class="range"><b>${label}</b> ${plcDayMonth(first)} – ${plcDayMonth(last)}.${last.slice(0, 4)}</span>
        <button data-week="${index + 1}" ${index >= weeks.length - 1 ? "disabled" : ""} aria-label="${t.next_week}">›</button>
      </div>
      ${this._tableHtml(week.days, hours, today)}`;
  }

  _dayBody(allDays, hours, now) {
    const index = this._currentDayIndex(allDays, now);
    const day = allDays[index];
    const t = plcT(this._hass);
    const relative = day.date === now.date ? t.today : day.date === plcAddDays(now.date, 1) ? t.tomorrow : "";
    return `
      <div class="nav">
        <button data-day="${index - 1}" ${index === 0 ? "disabled" : ""} aria-label="${t.prev_day}">‹</button>
        <span class="range">${relative ? `<b>${relative}</b> · ` : ""}${t.days[plcWeekday(day.date)]} ${plcDayMonth(day.date)}</span>
        <button data-day="${index + 1}" ${index >= allDays.length - 1 ? "disabled" : ""} aria-label="${t.next_day}">›</button>
      </div>
      ${this._tableHtml([day], hours, now.date)}`;
  }

  _lessonHtml(lesson) {
    const t = plcT(this._hass);
    const sub = lesson.substitution;
    const tooltip = sub
      ? [lesson.absent && `${t.absent}: ${lesson.absent}`, lesson.notes && `${t.notes}: ${lesson.notes}`].filter(Boolean).join("\n")
      : "";
    return `
      <div class="lesson${sub ? " sub" : ""}"${tooltip ? ` title="${plcEsc(tooltip)}"` : ""}>
        <div class="subject">${plcEsc(sub ? t.substitution : lesson.subject)}</div>
        ${lesson.group ? `<div class="group">${plcEsc(lesson.group)}</div>` : ""}
        ${lesson.room ? `<div class="room">${plcEsc(lesson.room)}</div>` : ""}
      </div>`;
  }

  _render() {
    if (!this.shadowRoot || !this._config) return;
    const hass = this._hass;
    const stateObj = hass?.states?.[this._config.entity];
    const colors = PLC_PALETTE[hass?.themes?.darkMode ? "dark" : "light"];
    let body;

    if (!hass) {
      body = "";
    } else if (!stateObj) {
      body = `<div class="msg">${plcT(hass).no_entity}: ${plcEsc(this._config.entity)}</div>`;
    } else if (!Array.isArray(stateObj.attributes.days) || !stateObj.attributes.days.length) {
      body = `<div class="msg">${plcT(hass).no_data} (${plcEsc(stateObj.state)})</div>`;
    } else {
      const now = plcNow(hass);
      this._lastAutoKey = this._autoKey();
      const days = stateObj.attributes.days;
      const hours = stateObj.attributes.lesson_hours || [];
      body = this._portrait ? this._dayBody(days, hours, now) : this._weekBody(days, hours, now.date);
      const validText = stateObj.attributes.valid_from_text;
      if (validText) body += `<div class="valid">${plcEsc(validText)}</div>`;
    }

    const title = this._config.title ?? stateObj?.attributes?.teacher ?? "";
    const sub = this._config.substitution_color;
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --plc-head-bg: ${colors.head_bg};
          --plc-head-fg: ${colors.head_fg};
          --plc-hour-bg: ${colors.hour_bg};
          --plc-cell-bg: ${colors.cell_bg};
          --plc-cell-fg: ${colors.cell_fg};
          --plc-meta-fg: ${colors.meta_fg};
          --plc-border: ${colors.border};
          --plc-today-bg: ${colors.today_bg};
          --plc-sub: ${sub};
        }
        ha-card { padding: 12px; overflow: hidden; }
        .title { font-size: 18px; font-weight: 600; color: var(--primary-text-color); margin: 0 0 8px; }
        .nav { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 8px; color: var(--primary-text-color); }
        .nav button {
          border: 1px solid var(--plc-border); background: var(--plc-head-bg); color: var(--plc-head-fg);
          border-radius: 6px; width: 32px; height: 28px; font-size: 18px; line-height: 1; cursor: pointer;
        }
        .nav button:disabled { opacity: 0.35; cursor: default; }
        .range { font-size: 13px; }
        .scroll { overflow-x: auto; }
        table { width: 100%; min-width: 560px; border-collapse: collapse; table-layout: fixed; font-size: 12px; }
        table.single { min-width: 0; font-size: 14px; }
        table.single th { font-size: 14px; }
        th, td { border: 1px solid var(--plc-border); padding: 4px; }
        th { background: var(--plc-head-bg); color: var(--plc-head-fg); font-size: 13px; }
        th .date { display: block; font-weight: normal; font-size: 11px; }
        th.today { background: var(--plc-today-bg); }
        th.nrh { width: 30px; }
        th.gh { width: 76px; }
        td.nr { background: var(--plc-head-bg); color: var(--plc-head-fg); font-weight: bold; text-align: center; vertical-align: top; }
        td.g { background: var(--plc-hour-bg); color: var(--plc-head-fg); font-weight: bold; text-align: center; vertical-align: top; white-space: nowrap; }
        td.l { background: var(--plc-cell-bg); color: var(--plc-cell-fg); vertical-align: top; text-align: left; }
        td.l.today { background: color-mix(in srgb, var(--plc-today-bg) 14%, var(--plc-cell-bg)); }
        .lesson { text-align: left; line-height: 1.3; padding: 1px 3px; border-left: 3px solid transparent; }
        .lesson + .lesson { border-top: 1px dashed var(--plc-border); margin-top: 3px; padding-top: 3px; }
        .subject { font-weight: bold; }
        .group, .room { color: var(--plc-meta-fg); }
        .lesson.sub { background: color-mix(in srgb, var(--plc-sub) 18%, transparent); border-left-color: var(--plc-sub); border-radius: 2px; }
        .lesson.sub .subject { color: var(--plc-sub); }
        .msg { padding: 16px; color: var(--secondary-text-color); }
        .valid { margin-top: 8px; font-size: 12px; text-align: left; white-space: normal; overflow-wrap: anywhere; color: var(--secondary-text-color); }
      </style>
      <ha-card>
        ${title ? `<div class="title">${plcEsc(title)}</div>` : ""}
        ${body}
      </ha-card>`;
  }
}

if (!customElements.get("zse-timetable-card")) {
  customElements.define("zse-timetable-card", ZseTimetableCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "zse-timetable-card",
    name: plcT().card_name,
    description: plcT().card_desc,
    preview: false,
  });
  console.info(`%c ZSE-TIMETABLE-CARD %c ${PLC_VERSION} `, "background:#efc571;color:#7e590e", "");
}
