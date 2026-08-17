// Renders production items that need attention and provides a direct path into returned jobs.

import { escapeHtml, formatJobNumber } from '../../utils/formatters.js';

export function renderNeedsAttention({ overdue = 0, urgent = 0, returned = 0, ready = 0, returnedJobs = [] }) {
  const items = [];
  if (overdue > 0) items.push(`<span><strong>${overdue}</strong> overdue</span>`);
  if (urgent > 0) items.push(`<span><strong>${urgent}</strong> urgent</span>`);
  if (ready > 0) items.push(`<span><strong>${ready}</strong> ready for collection</span>`);

  if (returnedJobs.length > 0) {
    items.push(`<div class="needs-attention__returned"><strong>${returned}</strong> returned for correction
      <div class="needs-attention__jobs" aria-label="Returned jobs">
        ${returnedJobs.map((job) => `<button type="button" class="needs-attention__job" data-open-job="${job.id}">
          <strong>${formatJobNumber(job)}</strong><span>${escapeHtml(job.customer_name)}</span><small>${escapeHtml(job.branch)} · View and resubmit</small>
        </button>`).join('')}
      </div>
    </div>`);
  } else if (returned > 0) {
    items.push(`<span><strong>${returned}</strong> returned for correction</span>`);
  }

  if (items.length === 0) return '';

  return `<section class="needs-attention">
    <h3>Needs Attention</h3>
    <div>${items.join(' · ')}</div>
  </section>`;
}
