// Read and write iCalendar (.ics) files: Canvas, Google Classroom (through Google Calendar),
// Moodle and most school calendars can export one.
import { toISO } from "./dates.js";

function unfold(text) {
  return String(text).replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

function unescape(value) {
  return value.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();
}

function parseStamp(value, isDate) {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (isDate || h === undefined) return { date: `${y}-${mo}-${d}`, time: null };
  const date = z
    ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi))
    : new Date(+y, +mo - 1, +d, +h, +mi);
  return {
    date: toISO(date),
    time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
  };
}

/** Parse an .ics file into [{ uid, title, date, time, description, url }]. */
export function parseICS(text) {
  const events = [];
  let current = null;
  let nested = 0; // inside a VALARM (or other block) within the event: its fields aren't the event's
  for (const line of unfold(text).split("\n")) {
    if (line === "BEGIN:VEVENT") { current = {}; nested = 0; continue; }
    if (current && /^BEGIN:/i.test(line)) { nested++; continue; }
    if (current && nested && /^END:/i.test(line)) { nested--; continue; }
    if (nested) continue;
    if (line === "END:VEVENT") {
      if (current && current.date) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const head = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const [name, ...params] = head.split(";");
    switch (name.toUpperCase()) {
      case "UID": current.uid = value.trim(); break;
      case "SUMMARY": current.title = unescape(value); break;
      case "DESCRIPTION": current.description = unescape(value); break;
      case "URL": current.url = value.trim(); break;
      case "DTSTART": {
        const stamp = parseStamp(value.trim(), params.some((p) => /VALUE=DATE$/i.test(p)));
        if (stamp) Object.assign(current, stamp);
        break;
      }
      default: break;
    }
  }
  return events.map((e) => ({ uid: e.uid || null, title: e.title || "Untitled", date: e.date, time: e.time ?? null, description: e.description || "", url: e.url || null }));
}

function escape(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

/**
 * Write events ({ id, title, date, description, type }) as an .ics file other calendars can import.
 * Each event carries reminders, so the phone's calendar app does the reminding: 9 in the morning
 * the day before and 8 in the morning on the day (reviews only on the day). `reminders: false` leaves them out.
 */
export function toICS(events, { name = "Seekto", reminders = true, now = new Date(), labels = { tomorrow: "Tomorrow", today: "Today" } } = {}) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Seekto//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${escape(name)}`];
  for (const e of events) {
    const day = e.date.replace(/-/g, "");
    const [y, m, d] = e.date.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10).replace(/-/g, "");
    const alarm = (trigger, text) => ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escape(text)}`, `TRIGGER:${trigger}`, "END:VALARM"];
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escape(e.id || `${day}-${e.title}`)}@seekto`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${day}`,
      `DTEND;VALUE=DATE:${next}`,
      `SUMMARY:${escape(e.title)}`,
      ...(e.description ? [`DESCRIPTION:${escape(e.description)}`] : []),
      // All-day events start at midnight: -PT15H is 9:00 the day before, PT8H is 8:00 on the day
      ...(reminders && e.type !== "review" ? alarm("-PT15H", `${labels.tomorrow}: ${e.title}`) : []),
      ...(reminders ? alarm("PT8H", `${labels.today}: ${e.title}`) : []),
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

/** A link that opens Google Calendar's "new event" page filled in with this all-day event. */
export function googleCalendarLink({ title, date, description = "" }) {
  const [y, m, d] = date.split("-").map(Number);
  const start = date.replace(/-/g, "");
  const end = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10).replace(/-/g, "");
  const params = new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${start}/${end}` });
  if (description) params.set("details", description);
  return `https://calendar.google.com/calendar/render?${params}`;
}
