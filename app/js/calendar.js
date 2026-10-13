// Calendar: dates heard in class, typed in notes, imported from school calendars, or added by hand.
import { $, $$, html, raw, toast, download, readFile, friendlyDate, announce } from "./ui.js";
import { state, saveEvent, deleteEvent, hasEvent, today } from "./state.js";
import { uid } from "./store.js";
import { go } from "./nav.js";
import { practiceNote } from "./quiz.js";
import { parseICS, toICS, googleCalendarLink, toISO, fromISO, describeDay } from "../engine/index.js";
import { t, uiLocale, weekStart } from "./i18n.js";

let month = null;
let showPast = false;

/** The event type as shown to the user; the English type stays the CSS class. */
export function typeLabel(type) {
  const labels = {
    test: t("test"),
    assignment: t("assignment"),
    review: t("review"),
    task: t("task"),
    event: t("event"),
  };
  return labels[type] || type;
}

function typeFor(title) {
  return /test|exam|quiz|midterm|final/i.test(title)
    ? "test"
    : /due|essay|paper|project|homework|assignment|lab|report|reading|presentation/i.test(title)
      ? "assignment"
      : "event";
}

// Exported events carry reminders (the day before and the morning of), in the interface language
const icsFor = (events) => toICS(events, { labels: { tomorrow: t("Tomorrow"), today: t("Today") } });

/** Every upcoming deadline in one .ics file with reminders: open it once and the phone's calendar
 * reminds you about all of them. */
export function remindAll() {
  const now = today();
  const upcoming = state.events.filter((e) => e.date >= now);
  if (!upcoming.length) return toast(t("Nothing coming up yet."));
  download("seekto-reminders.ics", icsFor(upcoming), "text/calendar");
  toast(
    upcoming.length === 1
      ? t("Open the file to add 1 date with reminders to your calendar.")
      : t("Open the file to add {n} dates with reminders to your calendar.", { n: upcoming.length }),
  );
}

export function render(main) {
  if (!month) {
    const d = new Date();
    month = new Date(d.getFullYear(), d.getMonth(), 1);
  }
  main.innerHTML = html`
    <div class="view">
      <div class="view-head">
        <h1>${t("Calendar")}</h1>
        <div class="row">
          <label class="btn ghost" style="cursor:pointer">${t("Import calendar (.ics)")}<input type="file" id="ics" accept=".ics,text/calendar" class="sr-only"></label>
          <button class="btn" id="remindAll">${t("Remind me about all of them")}</button>
          <button class="btn ghost" id="exportIcs">${t("Export")}</button>
        </div>
      </div>
      <section class="panel">
        <div class="view-head"><button class="btn ghost small" id="prev" aria-label="${t("Previous month")}">←</button><h2 id="monthLabel"></h2><button class="btn ghost small" id="next" aria-label="${t("Next month")}">→</button></div>
        <div class="month" id="grid"></div>
      </section>
      <section class="panel">
        <div class="view-head"><h2>${t("Coming up")}</h2><label class="row note-small"><input type="checkbox" id="past" ${raw(showPast ? "checked" : "")}> ${t("Show past")}</label></div>
        <div class="agenda" id="agenda" tabindex="-1"></div>
      </section>
      <section class="panel">
        <h2>${t("Add a date")}</h2>
        <form class="row" id="addForm">
          <input type="text" id="evTitle" placeholder="${t("Math chapter 5 quiz")}" required style="flex:2;min-width:180px">
          <input type="date" id="evDate" required value="${today()}" style="flex:1;min-width:150px">
          <button class="btn">${t("Add")}</button>
        </form>
      </section>
      <section class="panel">
        <h2>${t("Connect your school calendar")}</h2>
        <p class="sub">${raw(t("<b>Canvas:</b> open Calendar, click <i>Calendar Feed</i>, open the link to download the .ics file, then use <i>Import calendar</i> above."))}</p>
        <p class="sub">${raw(t("<b>Google Classroom:</b> class deadlines appear in Google Calendar. In Google Calendar's settings, export the class calendar and import the .ics here."))}</p>
        <p class="sub">${raw(t("<b>Other school sites:</b> most (Moodle, Blackboard, Schoology) have an export or iCal link. Import the file the same way."))}</p>
        <p class="note-small">${t("Seekto also adds dates it hears when you record a class, and dates you type in notes. Live syncing with school sites is on the roadmap.")}</p>
      </section>
    </div>`;
  $("#prev").addEventListener("click", () => {
    month = new Date(month.getFullYear(), month.getMonth() - 1, 1);
    drawMonth();
  });
  $("#next").addEventListener("click", () => {
    month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    drawMonth();
  });
  $("#past").addEventListener("change", (e) => {
    showPast = e.target.checked;
    drawAgenda();
  });
  $("#ics").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const events = parseICS(await readFile(file));
    let added = 0;
    for (const ev of events) {
      const item = {
        id: uid("event"),
        title: ev.title,
        date: ev.date,
        time: ev.time,
        type: typeFor(ev.title),
        source: "import",
        description: ev.description,
        url: ev.url,
      };
      if (hasEvent(item)) continue;
      await saveEvent(item);
      added++;
    }
    const skipped = events.length - added;
    const imported = skipped
      ? added === 1
        ? t("Imported 1 event ({skipped} already here)", { skipped })
        : t("Imported {n} events ({skipped} already here)", { n: added, skipped })
      : added === 1
        ? t("Imported 1 event")
        : t("Imported {n} events", { n: added });
    toast(events.length ? imported : t("No events found in that file"));
    render(main);
  });
  $("#remindAll").addEventListener("click", remindAll);
  $("#exportIcs").addEventListener("click", () =>
    download("seekto-calendar.ics", icsFor(state.events), "text/calendar"),
  );
  $("#addForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = $("#evTitle").value.trim();
    await saveEvent({ id: uid("event"), title, date: $("#evDate").value, type: typeFor(title), source: "manual" });
    toast(t("Added"));
    render(main);
  });
  drawMonth();
  drawAgenda();
}

function drawMonth() {
  $("#monthLabel").textContent = month.toLocaleDateString(uiLocale(), { month: "long", year: "numeric" });
  const start = new Date(month);
  const first = weekStart();
  start.setDate(1 - ((month.getDay() - first + 7) % 7));
  const cells = Array.from({ length: 7 }, (_, i) =>
    new Date(2026, 0, 4 + first + i).toLocaleDateString(uiLocale(), { weekday: "short" }),
  ).map((d) => `<div class="dow" aria-hidden="true">${d}</div>`);
  for (let i = 0; i < 42; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const iso = toISO(day);
    const evs = state.events.filter((e) => e.date === iso);
    const label = `${day.toLocaleDateString(uiLocale(), { weekday: "long", month: "long", day: "numeric" })}${evs.length ? `: ${evs.map((e) => e.title).join(", ")}` : ""}`;
    cells.push(html`<div class="day ${day.getMonth() !== month.getMonth() ? "other" : ""} ${iso === today() ? "today" : ""} ${evs.length ? "has" : ""}" role="listitem" aria-label="${label}" ${raw(iso === today() ? 'aria-current="date"' : "")} title="${evs.map((e) => e.title).join(", ")}">
      <span class="n" aria-hidden="true">${day.getDate()}</span>${raw(
        evs
          .slice(0, 3)
          .map((e) => html`<span class="ev ${e.type}" aria-hidden="true">${e.title}</span>`)
          .join(""),
      )}</div>`);
  }
  $("#grid").setAttribute("role", "list");
  $("#grid").innerHTML = cells.join("");
}

function drawAgenda() {
  const now = today();
  const list = state.events.filter((e) => showPast || e.date >= now);
  $("#agenda").innerHTML = list.length
    ? list
        .map(
          (e) => html`<div class="event">
        <span class="when">${e.date >= now ? describeDay(e.date, now, { tr: t, locale: uiLocale() }) : friendlyDate(e.date)}</span>
        <span>${e.title}${raw(e.noteId ? html` <a href="#note/${e.noteId}" class="note-small">${t("from your notes")}</a>` : e.source === "import" ? html` <span class="note-small">${t("imported")}</span>` : "")}</span>
        <span class="row">${raw(e.type === "review" && e.noteId ? html`<button class="btn small" data-practice="${e.noteId}" aria-label="${t("Practice for {title}", { title: e.title })}">${t("Practice")}</button>` : html`<span class="kind ${e.type}">${typeLabel(e.type)}</span>`)}${raw(e.date >= now ? html`<details class="remind"><summary class="btn ghost small" aria-label="${t("Remind me about {title}", { title: e.title })}">${t("Remind me")}</summary><div class="remind-menu"><a class="btn ghost small" href="${googleCalendarLink({ title: e.title, date: e.date })}" target="_blank" rel="noopener">${t("Google Calendar")}</a><button class="btn ghost small" data-ics="${e.id}">${t("Apple or Outlook (.ics)")}</button><p class="note-small">${t("The .ics file reminds you the day before and that morning. Google Calendar uses your usual reminders.")}</p></div></details>` : "")}<button class="btn ghost small" data-del="${e.id}" aria-label="${t("Remove {title}", { title: e.title })}">${t("Remove")}</button></span>
      </div>`,
        )
        .join("")
    : `<p class="empty">${t("Nothing coming up. Record a class, import your school calendar, or add a date.")}</p>`;
  $$("[data-del]").forEach((b) =>
    b.addEventListener("click", async () => {
      // Focus moves to the next row's Remove button (or the list), and the removal is announced
      const rows = $$("[data-del]");
      const at = rows.indexOf(b);
      const title = state.events.find((e) => e.id === b.dataset.del)?.title || "";
      await deleteEvent(b.dataset.del);
      drawAgenda();
      drawMonth();
      const next = $$("[data-del]")[Math.min(at, $$("[data-del]").length - 1)];
      (next || $("#agenda")).focus();
      announce(t("Removed {title}.", { title }));
    }),
  );
  $$("[data-practice]").forEach((b) => b.addEventListener("click", () => practiceNote(b.dataset.practice)));
  // Escape closes an open "Remind me" menu and returns to its button
  $$(".remind").forEach((d) =>
    d.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && d.open) {
        e.stopPropagation();
        d.open = false;
        d.querySelector("summary").focus();
      }
    }),
  );
  // One "Remind me" menu open at a time, opening upwards when there's no room below
  $$(".remind").forEach((d) =>
    d.addEventListener("toggle", () => {
      if (!d.open) return;
      $$(".remind[open]").forEach((o) => {
        if (o !== d) o.open = false;
      });
      const menu = d.querySelector(".remind-menu");
      menu.classList.remove("up");
      if (menu.getBoundingClientRect().bottom > innerHeight - 8) menu.classList.add("up");
    }),
  );
  $$("[data-ics]").forEach((b) =>
    b.addEventListener("click", () => {
      const e = state.events.find((x) => x.id === b.dataset.ics);
      if (e)
        download(
          `${
            e.title
              .replace(/[^\p{L}\d]+/gu, "-")
              .replace(/^-|-$/g, "")
              .slice(0, 40) || "event"
          }.ics`,
          icsFor([e]),
          "text/calendar",
        );
    }),
  );
}

export { go, fromISO };
