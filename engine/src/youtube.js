// Helpers for YouTube links. Seekto never downloads or scrapes YouTube;
// videos play in YouTube's own embedded player.

/** Return the 11-character video ID from a YouTube URL or a bare ID, or null. */
export function videoId(input) {
  const value = String(input || "").trim();
  const match = value.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);
  if (match) return match[1];
  return /^[A-Za-z0-9_-]{11}$/.test(value) ? value : null;
}

/** Link that opens the video on YouTube at the given second. */
export function watchUrl(id, seconds = 0) {
  return `https://www.youtube.com/watch?v=${id}&t=${Math.floor(seconds)}s`;
}
