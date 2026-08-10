// Renders the main Production Board: one column per workflow status, with
// jobCard() exported separately since the My Jobs page reuses it.

import { BOARD_STATUSES, STATUS_LABELS, MACHINE_STATUS_LABELS } from '../../utils/constants.js';
import { escapeHtml, formatJobNumber } from '../../utils/formatters.js';
import { formatDateTime } from '../../utils/dates.js';
import { computeNextStatus, isClosed, isProduction } from '../../utils/helpers.js';
import { renderNeedsAttention } from './NeedsAttention.js';

export function jobCard(job) {
  const nextStatus = computeNextStatus(job);
  const nextLabel = job.status === 'rejected'
    ? 'Returned for correction'
    : (nextStatus ? STATUS_LABELS[nextStatus] : 'Complete');

  const priorityClass = job.priority === 'urgent' ? 'priority-urgent' : (job.priority === 'rush' ? 'priority-rush' : '');
  const expectedBy = job.expected_ready_by ? formatDateTime(job.expected_ready_by) : '—';

  // Make the entire card clickable by adding data-open-job and cursor:pointer
  return `<article class="job-card ${priorityClass} ${job.status === 'rejected' ? 'status-rejected' : ''}" data-open-job="${job.id}" style="cursor:pointer;">
    <div class="job-card__top">
      <span class="job-id">${formatJobNumber(job)}</span>
      <span class="priority">${job.priority}</span>
    </div>
    <h3>${escapeHtml(job.customer_name)}</h3>
    <p class="branch">${escapeHtml(job.branch)} · ${job.job_type === 'flex' ? 'T-shirt Flex' : 'Stickers'}</p>
    <dl>
      <div><dt>Material</dt><dd>${escapeHtml(job.material)}</dd></div>
      <div><dt>Specification</dt><dd>${escapeHtml(job.specification)} · ${job.quantity}</dd></div>
    </dl>
    <div class="job-card__meta">
      <span>Expected: ${expectedBy}</span>
      ${job.ready_at ? `<span>Ready: ${formatDateTime(job.ready_at)}</span>` : ''}
    </div>
    <div class="job-card__next"><span>Next</span><strong>${nextLabel}</strong></div>
    <button class="button" data-open-job="${job.id}">View job</button>
  </article>`;
}

function machineCard(machine, canEdit) {
  if (!machine) return `<article class="machine"><span>Machines</span><strong>—</strong><small>No machines set up</small></article>`;
  return `<article class="machine status-${machine.status} ${canEdit ? 'machine--editable' : ''}" ${canEdit ? `data-cycle-machine="${machine.id}"` : ''}>
    <span>${escapeHtml(machine.name)}</span>
    <strong><i></i> ${MACHINE_STATUS_LABELS[machine.status] || machine.status}</strong>
    <small>${canEdit ? 'Tap to update' : 'Machine status'}</small>
  </article>`;
}

export function renderProductionBoard({ jobs, profile, error, machines = [], searchQuery = '', filters = {} }) {
  const canEditMachines = isProduction(profile);
  const active = jobs.filter((job) => !isClosed(job));

  // Apply search and filters
  let filtered = active;
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(job =>
      formatJobNumber(job).toLowerCase().includes(q) ||
      job.customer_name.toLowerCase().includes(q) ||
      job.branch.toLowerCase().includes(q) ||
      job.email_reference.toLowerCase().includes(q) ||
      job.material.toLowerCase().includes(q)
    );
  }
  if (filters.branch) {
    filtered = filtered.filter(job => job.branch === filters.branch);
  }
  if (filters.priority) {
    filtered = filtered.filter(job => job.priority === filters.priority);
  }
  if (filters.status) {
    filtered = filtered.filter(job => job.status === filters.status);
  }
  if (filters.type) {
    filtered = filtered.filter(job => job.job_type === filters.type);
  }
  if (filters.material) {
    filtered = filtered.filter(job => job.material === filters.material);
  }

  // Sort function: priority order (urgent > rush > normal), then created_at ASC (FIFO)
  const sortJobs = (jobsArray) => {
    return jobsArray.slice().sort((a, b) => {
      const priorityOrder = { urgent: 0, rush: 1, normal: 2 };
      const aPriority = priorityOrder[a.priority] ?? 2;
      const bPriority = priorityOrder[b.priority] ?? 2;
      if (aPriority !== bPriority) return aPriority - bPriority;
      // Same priority: oldest first (FIFO)
      return new Date(a.created_at) - new Date(b.created_at);
    });
  };

  const columns = BOARD_STATUSES.map((status) => {
    const columnJobs = sortJobs(filtered.filter((job) => job.status === status));
    return `<div class="board-column">
      <header><h2>${STATUS_LABELS[status]}</h2><span>${columnJobs.length}</span></header>
      <div class="job-list">${columnJobs.map(jobCard).join('') || '<p class="empty">No jobs here</p>'}</div>
    </div>`;
  }).join('');

  // Filter UI (compact)
  const filterHtml = `
    <div class="board-filters">
      <input type="text" id="search-input" placeholder="Search jobs..." value="${escapeHtml(searchQuery)}">
      <select id="filter-branch"><option value="">All Branches</option><option value="Plettenberg Bay">Plettenberg Bay</option><option value="Knysna">Knysna</option><option value="Waterside">Waterside</option><option value="Sedgefield">Sedgefield</option></select>
      <select id="filter-priority"><option value="">All Priorities</option><option value="normal">Normal</option><option value="rush">Rush</option><option value="urgent">Urgent</option></select>
      <select id="filter-status"><option value="">All Statuses</option>${BOARD_STATUSES.map(s => `<option value="${s}">${STATUS_LABELS[s]}</option>`).join('')}</select>
      <select id="filter-type"><option value="">All Types</option><option value="stickers">Stickers</option><option value="flex">T-shirt Flex</option></select>
      <select id="filter-material"><option value="">All Materials</option>${Array.from(new Set(active.map(j => j.material))).map(m => `<option value="${m}">${m}</option>`).join('')}</select>
    </div>
  `;

  // Summary stats (for Needs Attention)
  const overdue = active.filter(job => job.expected_ready_by && new Date() > new Date(job.expected_ready_by));
  const urgent = active.filter(job => job.priority === 'urgent');
  const returned = jobs.filter(job => job.status === 'rejected');
  const readyCount = active.filter(job => job.status === 'ready').length;

  const summary = {
    overdue: overdue.length,
    urgent: urgent.length,
    returned: returned.length,
    ready: readyCount
  };

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
      ${machines.map((machine) => machineCard(machine, canEditMachines)).join('') || machineCard(null, canEditMachines)}
    </section>
    ${renderNeedsAttention(summary)}
    ${filterHtml}
    <section class="board">${columns}</section>`;
}