// Renders the main Production Board: one column per workflow status, with
// jobCard() exported separately since the My Jobs page reuses it.

import { BOARD_STATUSES, STATUS_LABELS } from '../../utils/constants.js';
import { escapeHtml, formatJobNumber } from '../../utils/formatters.js';
import { computeNextStatus, isProduction } from '../../utils/helpers.js';

export function jobCard(job) {
  const nextStatus = computeNextStatus(job);
  return `<article class="job-card ${job.priority}">
    <div class="job-card__top"><span class="job-id">${formatJobNumber(job)}</span><span class="priority">${job.priority}</span></div>
    <h3>${escapeHtml(job.customer_name)}</h3>
    <p class="branch">${escapeHtml(job.branch)} · ${job.job_type === 'flex' ? 'T-shirt Flex' : 'Stickers'}</p>
    <dl>
      <div><dt>Material</dt><dd>${escapeHtml(job.material)}</dd></div>
      <div><dt>Specification</dt><dd>${escapeHtml(job.specification)} · ${job.quantity}</dd></div>
    </dl>
    <div class="job-card__next"><span>Next</span><strong>${nextStatus ? STATUS_LABELS[nextStatus] : 'Complete'}</strong></div>
    <button class="button" data-open-job="${job.id}">View job</button>
  </article>`;
}

export function renderProductionBoard({ jobs, profile, error }) {
  const active = jobs.filter((job) => job.status !== 'collected');

  const columns = BOARD_STATUSES.map((status) => {
    const columnJobs = active.filter((job) => job.status === status);
    return `<div class="board-column">
      <header><h2>${STATUS_LABELS[status]}</h2><span>${columnJobs.length}</span></header>
      <div class="job-list">${columnJobs.map(jobCard).join('') || '<p class="empty">No jobs here</p>'}</div>
    </div>`;
  }).join('');

  return `<section class="page-heading">
      <div>
        <p class="eyebrow">${isProduction(profile) ? 'Production centre' : escapeHtml(profile?.branch)}</p>
        <h1>Production Board</h1>
        <p>Live jobs from intake through to collection.</p>
      </div>
      <button class="button button--primary" data-page="new-job">+ New job</button>
    </section>
    ${error ? `<p class="form-error">${escapeHtml(error)}</p>` : ''}
    <section class="overview">
      <article><span>Active jobs</span><strong>${active.length}</strong><small>Across all production stages</small></article>
      <article><span>Urgent</span><strong>${active.filter((job) => job.priority === 'urgent').length}</strong><small>Needs attention first</small></article>
      <article><span>Ready today</span><strong>${active.filter((job) => job.status === 'ready').length}</strong><small>Awaiting collection</small></article>
      <article class="machine"><span>Roland BN-20</span><strong><i></i> Ready</strong><small>Manual status for Sprint 2</small></article>
    </section>
    <section class="board">${columns}</section>`;
}
