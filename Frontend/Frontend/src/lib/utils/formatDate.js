// Tolerant date formatter utilities
export function formatTimestamp(ts) {
  if (ts == null || ts === '') return '';
  // normalize numeric strings
  if (typeof ts === 'string' && /^\d+$/.test(ts)) ts = Number(ts);
  // seconds -> milliseconds
  if (typeof ts === 'number' && ts.toString().length === 10) ts = ts * 1000;
  const d = new Date(ts);
  if (isNaN(d.getTime())) {
    const parsed = Date.parse(String(ts).trim());
    if (isNaN(parsed)) return '';
    return new Date(parsed).toLocaleString();
  }
  return d.toLocaleString();
}

// Simple relative time (e.g., '2 days ago')
export function relativeTime(ts) {
  if (!ts) return '';
  // reuse format normalization
  if (typeof ts === 'string' && /^\d+$/.test(ts)) ts = Number(ts);
  if (typeof ts === 'number' && ts.toString().length === 10) ts = ts * 1000;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day >= 7) return d.toLocaleDateString();
  if (day >= 1) return `${day} day${day>1?'s':''} ago`;
  if (hr >= 1) return `${hr} hour${hr>1?'s':''} ago`;
  if (min >= 1) return `${min} minute${min>1?'s':''} ago`;
  if (sec >= 5) return `${sec} seconds ago`;
  return 'just now';
}
