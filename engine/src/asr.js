// Helpers for on-device speech recognition (Whisper). The model itself runs in the app;
// these turn its output into Seekto's timed lines and are tested without it.

/**
 * Whisper output ({ text, chunks: [{ timestamp: [start, end], text }] }) -> cues [{ start, end, text }].
 * Merges tiny fragments into sentences, drops empty and repeated "hallucinated" lines.
 */
export function whisperCues(output, { offset = 0 } = {}) {
  const chunks = Array.isArray(output?.chunks) && output.chunks.length
    ? output.chunks
    : output?.text ? [{ timestamp: [0, null], text: output.text }] : [];
  const cues = [];
  let last = "";
  for (const c of chunks) {
    const text = String(c.text || "").replace(/\s+/g, " ").trim();
    if (!text || /^\[(?:music|blank_audio|silence|inaudible)\]$/i.test(text) || /^\(.*\)$/.test(text)) continue;
    if (text.toLowerCase() === last) continue; // Whisper sometimes repeats a line over silence
    last = text.toLowerCase();
    const [s, e] = c.timestamp || [0, null];
    const start = Math.max(0, (Number(s) || 0) + offset);
    const end = e == null ? null : Number(e) + offset;
    const prev = cues[cues.length - 1];
    // Join fragments that don't end a sentence and are close together.
    if (prev && !/[.!?]["')\]]?$/.test(prev.text) && start - (prev.end ?? prev.start) < 1.5 && prev.text.length < 160) {
      prev.text = `${prev.text} ${text}`;
      prev.end = end;
    } else {
      cues.push({ start: Math.round(start * 10) / 10, end: end == null ? null : Math.round(end * 10) / 10, text: text.charAt(0).toUpperCase() + text.slice(1) });
    }
  }
  return cues;
}

/** Downmix and resample PCM to 16 kHz mono (what Whisper expects). Linear interpolation. */
export function toMono16k(channels, sampleRate) {
  const n = channels[0]?.length || 0;
  const mono = new Float32Array(n);
  for (const ch of channels) for (let i = 0; i < n; i++) mono[i] += ch[i] / channels.length;
  if (sampleRate === 16000) return mono;
  const ratio = sampleRate / 16000;
  const out = new Float32Array(Math.floor(n / ratio));
  for (let i = 0; i < out.length; i++) {
    const x = i * ratio;
    const j = Math.floor(x);
    const f = x - j;
    out[i] = mono[j] * (1 - f) + (mono[j + 1] ?? mono[j]) * f;
  }
  return out;
}
