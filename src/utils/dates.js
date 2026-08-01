// Date/time display helpers. Kept separate from formatters.js so job-field
// formatting and calendar/time formatting can evolve independently.

export function formatDateTime(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleString('en-ZA', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}
