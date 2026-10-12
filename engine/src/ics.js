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
  for (const line of unfold(text).split("\n")) {
    if (line === "BEGIN:VEVENT") { current = {}; continue; }
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

/** Write events ({ id, title, date, description }) as an .ics file other calendars can import. */
export function toICS(events, { name = "Seekto" } = {}) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Seekto//EN", `X-WR-CALNAME:${escape(name)}`];
  for (const e of events) {
    const day = e.date.replace(/-/g, "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escape(e.id || `${day}-${e.title}`)}@seekto`,
      `DTSTART;VALUE=DATE:${day}`,
      `SUMMARY:${escape(e.title)}`,
      ...(e.description ? [`DESCRIPTION:${escape(e.description)}`] : []),
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
