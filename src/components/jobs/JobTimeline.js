// Renders a timeline of job events.

import { escapeHtml } from '../../utils/formatters.js';
import { formatDateTime } from '../../utils/dates.js';
import { STATUS_LABELS } from '../../utils/constants.js';

export function renderJobTimeline(job) {
  const events = job.events || [];
  if (!events.length) return '<p>No history yet.</p>';

  const eventLabels = {
    created: 'Submitted',
    accepted: 'Accepted',
    status_change: 'Status changed',
    returned: 'Returned for correction',
    resubmitted: 'Resubmitted',
    ready: 'Ready for collection',
    collected: 'Collected',
    rush_confirmed: 'Rush confirmed',
    note_added: 'Note added'
  };

  const html = events.map(ev => `
    <div class="timeline-item">
      <time>${formatDateTime(ev.created_at)}</time>
      <strong>${eventLabels[ev.event_type] || ev.event_type}</strong>
      ${ev.to_status ? `<span>→ ${STATUS_LABELS[ev.to_status] || ev.to_status}</span>` : ''}
      ${ev.from_status && ev.to_status ? `<span> (from ${STATUS_LABELS[ev.from_status] || ev.from_status})</span>` : ''}
      ${ev.notes ? `<p class="timeline-note">${escapeHtml(ev.notes)}</p>` : ''}
      ${ev.performed_by ? `<small>by ${escapeHtml(ev.performed_by)}</small>` : ''}
    </div>
  `).join('');

  return `<section class="job-timeline">
    <h3>Timeline</h3>
    <div class="timeline">${html}</div>
  </section>`;
}