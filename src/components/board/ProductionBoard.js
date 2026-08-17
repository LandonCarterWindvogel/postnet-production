// Production Board: queue-focused PostNet Copy & Print dashboard.

import { BOARD_COLUMNS, BOARD_STATUSES, STATUS_LABELS, MACHINE_STATUS_LABELS } from '../../utils/constants.js';
import { WORKFLOWS } from '../../config.js';
import { escapeHtml, formatJobNumber } from '../../utils/formatters.js';
import { formatDateTime } from '../../utils/dates.js';
import { computeNextStatus, isClosed, isProduction } from '../../utils/helpers.js';
import { renderNeedsAttention } from './NeedsAttention.js';

const PRIORITY_ORDER = { urgent: 0, rush: 1, standard: 2 };

function progressForJob(job) {
  if (job.status === 'incoming') return 0;
  if (job.status === 'collected') return 100;
  if (job.status === 'rejected') return 0;

  const workflow = WORKFLOWS[job.job_type] || [];
  const index = workflow.indexOf(job.status);
  if (index < 0) return 0;
  return Math.round(((index + 1) / workflow.length) * 100);
}

function priorityLabel(priority) {
  return priority === 'standard' ? 'Standard' : priority.charAt(0).toUpperCase() + priority.slice(1);
}

function statusClass(status) {
  return `status-${status.replace(/_/g, '-')}`;
}

export function jobCard(job) {
  const nextStatus = computeNextStatus(job);
  const nextLabel = job.status === 'rejected'
    ? 'Returned for correction'
    : (nextStatus ? STATUS_LABELS[nextStatus] : 'Complete');
  const progress = progressForJob(job);
  const priorityClass = job.priority === 'urgent' ? 'priority-urgent' : (job.priority === 'rush' ? 'priority-rush' : '');
  const typeLabel = job.job_type === 'flex' ? 'T-shirt Flex' : 'Stickers';
  const updated = job.updated_at ? formatDateTime(job.updated_at) : '—';

  return `<article class="job-card ${priorityClass} ${statusClass(job.status)} ${job.status === 'rejected' ? 'status-rejected' : ''}" data-open-job="${job.id}">
    <div class="job-card__top">
      <span class="job-id">${formatJobNumber(job)}</span>
      <span class="priority-badge priority-${job.priority}">${priorityLabel(job.priority)}</span>
    </div>
    <div class="job-card__body">
      <div>
        <h3>${escapeHtml(job.customer_name)}</h3>
        <p class="job-card__branch">${escapeHtml(job.branch)} <span>·</span> ${typeLabel}</p>
      </div>
      <span class="status-badge ${statusClass(job.status)}">${escapeHtml(STATUS_LABELS[job.status] || job.status)}</span>
    </div>
    <dl class="job-card__details">
      <div><dt>Material</dt><dd>${escapeHtml(job.material)}</dd></div>
      <div><dt>Specification</dt><dd>${escapeHtml(job.specification)} · ${job.quantity}</dd></div>
    </dl>
    <div class="job-card__progress">
      <div><span>Progress</span><strong>${progress}%</strong></div>
      <div class="progress-track"><span style="width:${progress}%"></span></div>
    </div>
    <div class="job-card__footer">
      <span>Next <strong>${escapeHtml(nextLabel)}</strong></span>
      <span>Updated ${escapeHtml(updated)}</span>
    </div>
  </article>`;
}

function getDerivedMachineStatus(machine, jobs) {
  if (!machine) return null;
  if (machine.status === 'maintenance') return 'maintenance';

  const machineJobs = jobs
    .filter((job) => ['printing', 'drying', 'cutting', 'contour_cutting'].includes(job.status))
    .slice()
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2) || new Date(a.created_at) - new Date(b.created_at));
  const currentJob = machineJobs[0];
  if (currentJob && ['printing', 'drying'].includes(currentJob.status)) return 'printing';
  if (currentJob && ['cutting', 'contour_cutting'].includes(currentJob.status)) return 'cutting';
  return 'ready';
}

function machineCard(machine, canEdit, jobs = []) {
  if (!machine) return `<article class="machine"><span>Production machine</span><strong>—</strong><small>No machines set up</small></article>`;
  const status = getDerivedMachineStatus(machine, jobs);
  return `<article class="machine status-${status} ${canEdit ? 'machine--editable' : ''}" ${canEdit ? `data-cycle-machine="${machine.id}"` : ''}>
    <div class="machine__icon">⌁</div>
    <div><span>${escapeHtml(machine.name)}</span><strong>${MACHINE_STATUS_LABELS[status] || status}</strong></div>
    <small>${machine.status === 'maintenance' ? 'Maintenance override' : 'Based on active production jobs'}</small>
  </article>`;
}

function sortJobs(jobsArray) {
  return jobsArray.slice().sort((a, b) => {
    const aPriority = PRIORITY_ORDER[a.priority] ?? 2;
    const bPriority = PRIORITY_ORDER[b.priority] ?? 2;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return new Date(a.created_at) - new Date(b.created_at);
  });
}

export function renderProductionBoard({ jobs, profile, error, machines = [], searchQuery = '', filters = {} }) {
  const canEditMachines = isProduction(profile);
  const active = jobs.filter((job) => !isClosed(job));

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
  if (filters.branch) filtered = filtered.filter(job => job.branch === filters.branch);
  if (filters.priority) filtered = filtered.filter(job => job.priority === filters.priority);
  if (filters.status) filtered = filtered.filter(job => job.status === filters.status);
  if (filters.type) filtered = filtered.filter(job => job.job_type === filters.type);
  if (filters.material) filtered = filtered.filter(job => job.material === filters.material);

  const relevantStatuses = new Set(
    filtered.flatMap((job) => job.job_type === 'flex'
      ? ['queued', 'cutting', 'weeding', 'heat_press', 'quality_check', 'ready']
      : ['queued', 'printing', 'drying', 'contour_cutting', 'weeding', 'quality_check', 'ready'])
  );

  const allCounts = {
    all: active.length,
    queued: active.filter((job) => job.status === 'queued').length,
    printing: active.filter((job) => job.status === 'printing').length,
    drying: active.filter((job) => job.status === 'drying').length,
    cutting: active.filter((job) => ['cutting', 'contour_cutting'].includes(job.status)).length,
    weeding: active.filter((job) => job.status === 'weeding').length,
    heatPress: active.filter((job) => job.status === 'heat_press').length,
    qc: active.filter((job) => job.status === 'quality_check').length,
    ready: active.filter((job) => job.status === 'ready').length
  };

  const summaryItems = [
    ['All', allCounts.all, ''],
    ['Queued', allCounts.queued, 'queued'],
    ['Printing', allCounts.printing, 'printing'],
    ['Drying', allCounts.drying, 'drying'],
    ['Cutting', allCounts.cutting, 'cutting'],
    ['Weeding', allCounts.weeding, 'weeding'],
    ['Heat Press', allCounts.heatPress, 'heat-press'],
    ['QC', allCounts.qc, 'quality-check'],
    ['Ready', allCounts.ready, 'ready']
  ];

  const columns = BOARD_COLUMNS
    .filter((column) => column.statuses.some((status) => relevantStatuses.has(status)) || (column.key === 'incoming' && filtered.some((job) => job.status === 'incoming')))
    .map((column) => {
      const columnJobs = sortJobs(filtered.filter((job) => column.statuses.includes(job.status)));
      const columnKey = column.key;
      return `<section class="board-column board-column--${columnKey}">
        <header><div><span class="column-kicker">Production stage</span><h2>${column.label}</h2></div><span class="column-count">${columnJobs.length}</span></header>
        <div class="job-list">${columnJobs.map(jobCard).join('') || '<p class="empty">No jobs here</p>'}</div>
      </section>`;
    }).join('');

  const filterHtml = `<div class="board-toolbar">
    <div class="board-filters">
      <label class="search-box"><span>⌕</span><input type="text" id="search-input" placeholder="Search jobs, customers or references…" value="${escapeHtml(searchQuery)}"></label>
      <select id="filter-branch"><option value="">All Branches</option><option value="Plettenberg Bay">Plettenberg Bay</option><option value="Knysna">Knysna</option><option value="Waterside">Waterside</option><option value="Sedgefield">Sedgefield</option></select>
      <select id="filter-priority"><option value="">All Priorities</option><option value="standard">Standard</option><option value="rush">Rush</option><option value="urgent">Urgent</option></select>
      <select id="filter-status"><option value="">All Statuses</option>${BOARD_STATUSES.map(s => `<option value="${s}">${s === 'cutting' || s === 'contour_cutting' ? `Cutting — ${s === 'cutting' ? 'T-shirt Flex' : 'Stickers'}` : STATUS_LABELS[s]}</option>`).join('')}</select>
      <select id="filter-type"><option value="">All Types</option><option value="stickers">Stickers</option><option value="flex">T-shirt Flex</option></select>
      <select id="filter-material"><option value="">All Materials</option>${Array.from(new Set(active.map(j => j.material))).sort().map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('')}</select>
    </div>
  </div>`;

  const overdue = active.filter(job => job.expected_ready_by && new Date() > new Date(job.expected_ready_by));
  const urgent = active.filter(job => job.priority === 'urgent');
  const returned = jobs.filter(job => job.status === 'rejected');
  const readyCount = active.filter(job => job.status === 'ready').length;
  const summary = { overdue: overdue.length, urgent: urgent.length, returned: returned.length, ready: readyCount };

  return `<section class="page-heading page-heading--board">
      <div><p class="eyebrow">Production centre</p><h1>Production Board</h1><p>Overview of every active job in production.</p></div>
      <button class="button button--primary" data-page="new-job">+ New Job</button>
    </section>
    ${error ? `<p class="form-error form-error--banner">${escapeHtml(error)}</p>` : ''}
    <section class="status-strip">${summaryItems.map(([label, count, key]) => `<div class="status-strip__item ${key ? `status-strip__item--${key}` : ''}"><span>${label}</span><strong>${count}</strong></div>`).join('')}</section>
    <section class="overview">
      <article class="overview-card"><span>Active jobs</span><strong>${active.length}</strong><small>Across production stages</small></article>
      <article class="overview-card"><span>Urgent</span><strong>${urgent.length}</strong><small>Needs attention first</small></article>
      <article class="overview-card"><span>Ready for collection</span><strong>${readyCount}</strong><small>Awaiting branch pickup</small></article>
      ${machines.map((machine) => machineCard(machine, canEditMachines, active)).join('') || machineCard(null, canEditMachines, active)}
    </section>
    ${renderNeedsAttention(summary)}
    ${filterHtml}
    <section class="board">${columns}</section>`;
}
