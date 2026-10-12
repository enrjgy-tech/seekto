// Calendar: dates heard in class, typed in notes, imported from school calendars, or added by hand.
import { $, $$, html, raw, toast, download, readFile, friendlyDate } from "./ui.js";
import { state, saveEvent, deleteEvent, hasEvent, today } from "./state.js";
import { uid } from "./store.js";
import { go } from "./nav.js";
import { parseICS, toICS, toISO, fromISO, describeDay } from "../engine/index.js";

let month = null;
let showPast = false;

function typeFor(title) {
  return /test|exam|quiz|midterm|final/i.test(title) ? "test" : /due|essay|paper|project|homework|assignment|lab|report|reading|presentation/i.test(title) ? "assignment" : "event";
}

export function render(main) {
  if (!month) { const d = new Date(); month = new Date(d.getFullYear(), d.getMonth(), 1); }
  main.innerHTML = html`
    <div class="view">
      <div class="view-head">
        <h1>Calendar</h1>
        <div class="row">
          <label class="btn ghost" style="cursor:pointer">Import calendar (.ics)<input type="file" id="ics" accept=".ics,text/calendar" hidden></label>
          <button class="btn ghost" id="exportIcs">Export</button>
        </div>
      </div>
      <section class="panel">
        <div class="view-head"><button class="btn ghost small" id="prev" aria-label="Previous month">←</button><h2 id="monthLabel"></h2><button class="btn ghost small" id="next" aria-label="Next month">→</button></div>
        <div class="month" id="grid"></div>
      </section>
      <section class="panel">
        <div class="view-head"><h2>Coming up</h2><label class="row note-small"><input type="checkbox" id="past" ${raw(showPast ? "checked" : "")}> Show past</label></div>
        <div class="agenda" id="agenda"></div>
      </section>
      <section class="panel">
        <h2>Add a date</h2>
        <form class="row" id="addForm">
          <input type="text" id="evTitle" placeholder="Math chapter 5 quiz" required style="flex:2;min-width:180px">
          <input type="date" id="evDate" required value="${today()}" style="flex:1;min-width:150px">
          <button class="btn">Add</button>
        </form>
      </section>
      <section class="panel">
        <h2>Connect your school calendar</h2>
        <p class="sub"><b>Canvas:</b> open Calendar, click <i>Calendar Feed</i>, open the link to download the .ics file, then use <i>Import calendar</i> above.</p>
        <p class="sub"><b>Google Classroom:</b> class deadlines appear in Google Calendar. In Google Calendar's settings, export the class calendar and import the .ics here.</p>
        <p class="sub"><b>Other school sites:</b> most (Moodle, Blackboard, Schoology) have an export or iCal link. Import the file the same way.</p>
        <p class="note-small">Seekto also adds dates it hears when you record a class, and dates you type in notes. Live syncing with school sites is on the roadmap.</p>
      </section>
    </div>`;
  $("#prev").addEventListener("click", () => { month = new Date(month.getFullYear(), month.getMonth() - 1, 1); drawMonth(); });
  $("#next").addEventListener("click", () => { month = new Date(month.getFullYear(), month.getMonth() + 1, 1); drawMonth(); });
  $("#past").addEventListener("change", (e) => { showPast = e.target.checked; drawAgenda(); });
  $("#ics").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const events = parseICS(await readFile(file));
    let added = 0;
    for (const ev of events) {
      const item = { id: uid("event"), title: ev.title, date: ev.date, time: ev.time, type: typeFor(ev.title), source: "import", description: ev.description, url: ev.url };
      if (hasEvent(item)) continue;
      await saveEvent(item);
      added++;
    }
    toast(events.length ? `Imported ${added} event${added === 1 ? "" : "s"}${events.length > added ? ` (${events.length - added} already here)` : ""}` : "No events found in that file");
    render(main);
  });
  $("#exportIcs").addEventListener("click", () => download("seekto-calendar.ics", toICS(state.events), "text/calendar"));
  $("#addForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = $("#evTitle").value.trim();
    await saveEvent({ id: uid("event"), title, date: $("#evDate").value, type: typeFor(title), source: "manual" });
    toast("Added");
    render(main);
  });
  drawMonth();
  drawAgenda();
}

function drawMonth() {
  $("#monthLabel").textContent = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const start = new Date(month);
  start.setDate(1 - month.getDay());
  const cells = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => `<div class="dow">${d}</div>`);
  for (let i = 0; i < 42; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const iso = toISO(day);
    const evs = state.events.filter((e) => e.date === iso);
    cells.push(html`<div class="day ${day.getMonth() !== month.getMonth() ? "other" : ""} ${iso === today() ? "today" : ""} ${evs.length ? "has" : ""}" title="${evs.map((e) => e.title).join(", ")}">
      <span class="n">${day.getDate()}</span>${raw(evs.slice(0, 3).map((e) => html`<span class="ev ${e.type}">${e.title}</span>`).join(""))}</div>`);
  }
  $("#grid").innerHTML = cells.join("");
}

function drawAgenda() {
  const now = today();
  const list = state.events.filter((e) => showPast || e.date >= now);
  $("#agenda").innerHTML = list.length
    ? list.map((e) => html`<div class="event">
        <span class="when">${e.date >= now ? describeDay(e.date, now) : friendlyDate(e.date)}</span>
        <span>${e.title}${raw(e.noteId ? html` <a href="#note/${e.noteId}" class="note-small">from your notes</a>` : e.source === "import" ? ' <span class="note-small">imported</span>' : "")}</span>
        <span class="row"><span class="kind ${e.type}">${e.type}</span><button class="btn ghost small" data-del="${e.id}" aria-label="Remove ${e.title}">Remove</button></span>
      </div>`).join("")
    : `<p class="empty">Nothing coming up. Record a class, import your school calendar, or add a date.</p>`;
  $$("[data-del]").forEach((b) => b.addEventListener("click", async () => { await deleteEvent(b.dataset.del); drawAgenda(); drawMonth(); }));
}

export { go, fromISO };
