// Parse WebVTT and SRT caption files into timed cues.
// A cue is { start, end, text } with times in seconds.

/** Parse "01:02:03.500", "01:02:03,500" or "02:03.500" into seconds. */
export function parseTime(value) {
  const parts = String(value).trim().replace(",", ".").split(":").map(Number);
  if (parts.some(Number.isNaN)) return NaN;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return NaN;
}

/** Parse the text of a .vtt or .srt file. Repeated lines (common in auto-captions) are merged. */
export function parseCaptions(text) {
  const cues = [];
  for (const block of String(text).replace(/\r/g, "").split(/\n\s*\n/)) {
    const lines = block.split("\n");
    const timing = lines.findIndex((line) => line.includes("-->"));
    if (timing < 0) continue;
    const [from, to] = lines[timing].split("-->");
    const body = lines
      .slice(timing + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!body) continue;
    const start = parseTime(from);
    const end = parseTime(to.trim().split(/\s+/)[0]);
    if (Number.isNaN(start)) continue;
    const previous = cues[cues.length - 1];
    if (previous && previous.text === body) {
      previous.end = Number.isNaN(end) ? previous.end : end;
      continue;
    }
    cues.push({ start, end: Number.isNaN(end) ? start : end, text: body });
  }
  return cues;
}

/** Parse text copied from a transcript panel: a timestamp line ("1:02" or "1:02:03") followed by text. */
export function parseTranscriptText(text) {
  const cues = [];
  const stamp = /^(\d{1,2}:)?\d{1,2}:\d{2}$/;
  let current = null;
  for (const raw of String(text).replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (stamp.test(line)) {
      if (current && current.text) cues.push(current);
      current = { start: parseTime(line), end: parseTime(line), text: "" };
    } else if (current) {
      current.text = current.text ? `${current.text} ${line}` : line;
    }
  }
  if (current && current.text) cues.push(current);
  for (let i = 0; i < cues.length - 1; i++) cues[i].end = cues[i + 1].start;
  return cues;
}

/** Format seconds as "mm:ss" or "h:mm:ss". */
export function formatTime(seconds) {
  const t = Math.max(0, Math.floor(seconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = h ? `${h}:${String(m).padStart(2, "0")}` : String(m).padStart(2, "0");
  return `${mm}:${String(s).padStart(2, "0")}`;
}
