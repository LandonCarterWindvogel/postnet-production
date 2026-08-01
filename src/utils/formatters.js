// Small, pure display-formatting helpers with no DOM or Supabase dependency.

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

// e.g. job_number 24, created in 2026 -> "PN-2026-00024"
export function formatJobNumber(job) {
  const year = new Date(job.created_at).getFullYear();
  return `PN-${year}-${String(job.job_number).padStart(5, '0')}`;
}
