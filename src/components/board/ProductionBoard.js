// Production Board: compact PostNet Copy & Print queue view for desktop production use.

import { BOARD_STATUSES, STATUS_LABELS, MACHINE_STATUS_LABELS, BRANCHES } from '../../utils/constants.js';
import { WORKFLOWS } from '../../config.js';
import { escapeHtml, formatJobNumber } from '../../utils/formatters.js';
import { formatDateTime } from '../../utils/dates.js';
import { computeNextStatus, isClosed, isProduction } from '../../utils/helpers.js';
import { renderNeedsAttention } from './NeedsAttention.js';
import { ROLAND_MACHINE_MARK } from '../../utils/brandAssets.js';

const PRIORITY_ORDER = { urgent: 0, rush: 1, standard: 2 };
const PAGE_SIZE = 10;
const MACHINE_STATUSES = ['printing', 'drying', 'contour_cutting', 'cutting', 'weeding', 'heat_press', 'quality_check'];
let boardPage = 1;

export function setBoardPage(page) {
  boardPage = Math.max(1, Number(page) || 1);
}

function progressForJob(job) {
  if (job.status === 'incoming') return 0;
  if (job.status === 'collected') return 100;
  if (job.status === 'rejected') return 0;
  const workflow = WORKFLOWS[job.job_type] || [];
  const index = workflow.indexOf(job.status);
  return index < 0 ? 50 : Math.round(((index + 1) / workflow.length) * 100);
}

function priorityLabel(priority) {
  return priority === 'standard' ? 'Standard' : priority.charAt(0).toUpperCase() + priority.slice(1);
}

function operatorPhase(job) {
  if (job.status === 'incoming') return 'Incoming';
  if (job.status === 'ready') return 'Ready';
  if (job.status === 'rejected') return 'Returned for Correction';
  if (job.status === 'collected') return 'Collected / Sent';
  return 'In Production';
}

function operatorPhaseClass(job) {
  return `operator-phase operator-phase--${operatorPhase(job).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function isInProduction(job) {
  return job.status === 'queued' || MACHINE_STATUSES.includes(job.status);
}

function productionActionLabel(job) {
  if (job.status === 'incoming' || job.status === 'queued') return 'Start Production';
  if (MACHINE_STATUSES.includes(job.status)) return 'Mark Ready';
  if (job.status === 'ready') return 'Mark Collected / Sent';
  return null;
}

function sortJobs(jobsArray) {
  return jobsArray.slice().sort((a, b) => {
    const aPriority = PRIORITY_ORDER[a.priority] ?? 2;
    const bPriority = PRIORITY_ORDER[b.priority] ?? 2;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return new Date(a.created_at) - new Date(b.created_at);
  });
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

function machinePill(machine, canEdit, jobs) {
  if (!machine) return '';
  const status = getDerivedMachineStatus(machine, jobs);
  return `<button class="board-machine ${canEdit ? 'board-machine--editable' : ''}" ${canEdit ? `data-cycle-machine="${machine.id}"` : ''} type="button" title="${canEdit ? 'Click to cycle manual machine status' : 'Machine status is production-queue derived'}">
    <img src="${ROLAND_MACHINE_MARK}" alt="Roland" class="board-machine__logo">
    <span><strong>${escapeHtml(machine.name)}</strong><small><i class="machine-dot machine-dot--${status}"></i>${MACHINE_STATUS_LABELS[status] || status}</small></span>
  </button>`;
}

function renderTableRow(job) {
  const progress = progressForJob(job);
  const typeLabel = job.job_type === 'flex' ? 'T-shirt Flex' : 'Stickers';
  const updated = job.updated_at ? formatDateTime(job.updated_at) : '—';
  const actionLabel = productionActionLabel(job);

  return `<tr class="job-row ${job.priority === 'urgent' ? 'job-row--urgent' : ''}" data-open-job="${job.id}">
    <td><strong>${formatJobNumber(job)}</strong></td>
    <td>${escapeHtml(job.branch)}</td>
    <td><strong>${escapeHtml(job.customer_name)}</strong></td>
    <td>${typeLabel}</td>
    <td>${escapeHtml(job.material)}</td>
    <td><span class="priority-badge priority-${job.priority}">${priorityLabel(job.priority)}</span></td>
    <td><span class="${operatorPhaseClass(job)}">${escapeHtml(operatorPhase(job))}</span>${isInProduction(job) && job.status !== 'queued' ? `<small class="phase-detail">${escapeHtml(STATUS_LABELS[job.status] || job.status)}</small>` : ''}</td>
    <td class="progress-cell"><div class="progress-inline"><div class="progress-track"><span style="width:${progress}%"></span></div><span>${progress}%</span></div></td>
    <td>${escapeHtml(updated)}</td>
    <td class="next-cell">${actionLabel ? `→ ${escapeHtml(actionLabel)}` : '—'}</td>
  </tr>`;
}

function storeViews(jobs, selectedBranch) {
  const allCount = jobs.filter((job) => !isClosed(job)).length;
  const buttons = [
    `<button type="button" class="store-view ${selectedBranch === '' ? 'active' : ''}" data-branch-filter=""><strong>All Branches</strong><span>${allCount} active jobs</span></button>`
  ];

  BRANCHES.forEach((branch) => {
    const count = jobs.filter((job) => !isClosed(job) && job.branch === branch).length;
    buttons.push(`<button type="button" class="store-view ${selectedBranch === branch ? 'active' : ''}" data-branch-filter="${escapeHtml(branch)}"><strong>${escapeHtml(branch)}</strong><span>${count} active jobs</span></button>`);
  });

  return `<section class="store-views" aria-label="Store views">${buttons.join('')}</section>`;
}

export function renderProductionBoard({ jobs, profile, error, machines = [], searchQuery = '', filters = {} }) {
  const canEditMachines = isProduction(profile);
  const active = jobs.filter((job) => !isClosed(job));
  const returnedJobs = jobs.filter((job) => job.status === 'rejected');

  let filtered = active;
  const query = searchQuery.trim().toLowerCase();
  if (query) {
    filtered = filtered.filter((job) =>
      formatJobNumber(job).toLowerCase().includes(query) ||
      job.customer_name.toLowerCase().includes(query) ||
      job.branch.toLowerCase().includes(query) ||
      job.email_reference.toLowerCase().includes(query) ||
      job.material.toLowerCase().includes(query)
    );
  }
  if (filters.branch) filtered = filtered.filter((job) => job.branch === filters.branch);
  if (filters.priority) filtered = filtered.filter((job) => job.priority === filters.priority);
  if (filters.status) filtered = filtered.filter((job) => job.status === filters.status);
  if (filters.type) filtered = filtered.filter((job) => job.job_type === filters.type);
  if (filters.material) filtered = filtered.filter((job) => job.material === filters.material);

  filtered = sortJobs(filtered);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  boardPage = Math.min(boardPage, totalPages);
  const start = (boardPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  const counts = {
    all: active.length,
    incoming: active.filter((job) => job.status === 'incoming').length,
    inProduction: active.filter((job) => isInProduction(job)).length,
    ready: active.filter((job) => job.status === 'ready').length
  };

  const urgent = active.filter((job) => job.priority === 'urgent');
  const overdue = active.filter((job) => job.expected_ready_by && new Date() > new Date(job.expected_ready_by));
  const summary = { overdue: overdue.length, urgent: urgent.length, returned: returnedJobs.length, ready: counts.ready, returnedJobs };

  const statusItems = [
    ['All', counts.all, ''],
    ['Incoming', counts.incoming, 'incoming'],
    ['In Production', counts.inProduction, 'in-production'],
    ['Ready', counts.ready, 'ready']
  ];

  const filterHtml = `<div class="board-toolbar">
    <label class="search-box"><span aria-hidden="true">⌕</span><input type="text" id="search-input" placeholder="Search jobs, customers or references…" value="${escapeHtml(searchQuery)}" aria-label="Search jobs"></label>
    <select id="filter-branch" aria-label="Filter by branch"><option value="" ${filters.branch === '' ? 'selected' : ''}>All Branches</option>${BRANCHES.map((branch) => `<option value="${escapeHtml(branch)}" ${filters.branch === branch ? 'selected' : ''}>${escapeHtml(branch)}</option>`).join('')}</select>
    <select id="filter-priority" aria-label="Filter by priority"><option value="" ${filters.priority === '' ? 'selected' : ''}>All Priorities</option><option value="standard" ${filters.priority === 'standard' ? 'selected' : ''}>Standard</option><option value="rush" ${filters.priority === 'rush' ? 'selected' : ''}>Rush</option><option value="urgent" ${filters.priority === 'urgent' ? 'selected' : ''}>Urgent</option></select>
    <select id="filter-status" aria-label="Filter by internal status"><option value="" ${filters.status === '' ? 'selected' : ''}>All Production States</option>${BOARD_STATUSES.map((status) => `<option value="${status}" ${filters.status === status ? 'selected' : ''}>${status === 'cutting' ? 'Cutting — T-shirt Flex' : status === 'contour_cutting' ? 'Cutting — Stickers' : STATUS_LABELS[status]}</option>`).join('')}</select>
    <select id="filter-type" aria-label="Filter by type"><option value="" ${filters.type === '' ? 'selected' : ''}>All Types</option><option value="stickers" ${filters.type === 'stickers' ? 'selected' : ''}>Stickers</option><option value="flex" ${filters.type === 'flex' ? 'selected' : ''}>T-shirt Flex</option></select>
    <select id="filter-material" aria-label="Filter by material"><option value="" ${filters.material === '' ? 'selected' : ''}>All Materials</option>${Array.from(new Set(active.map((j) => j.material))).sort().map((material) => `<option value="${escapeHtml(material)}" ${filters.material === material ? 'selected' : ''}>${escapeHtml(material)}</option>`).join('')}</select>
  </div>`;

  const pageStart = filtered.length ? start + 1 : 0;
  const pageEnd = Math.min(start + PAGE_SIZE, filtered.length);
  const pageButtons = Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((page) => `<button class="pagination-button ${page === boardPage ? 'active' : ''}" data-board-page="${page}">${page}</button>`).join('');

  return `<section class="production-board-page">
    <header class="board-header">
      <div><p class="eyebrow">Production centre</p><h1>Production Board</h1><p>Live overview of active production jobs.</p></div>
      <div class="board-header__actions">${machinePill(machines[0], canEditMachines, active)}<button class="button button--primary" data-page="new-job">+ New Job</button></div>
    </header>
    ${error ? `<p class="form-error form-error--banner">${escapeHtml(error)}</p>` : ''}
    <section class="status-strip" aria-label="Active production overview">${statusItems.map(([label, count, key]) => `<div class="status-strip__item ${key ? `status-strip__item--${key}` : ''}"><span>${label}</span><strong>${count}</strong></div>`).join('')}</section>
    <div class="board-alerts"><span class="board-alert">Urgent <strong>${urgent.length}</strong></span><span class="board-alert">Returned for Correction <strong>${returnedJobs.length}</strong></span></div>
    ${storeViews(jobs, filters.branch || '')}
    ${renderNeedsAttention(summary)}
    ${filterHtml}
    <section class="board-table-wrap" aria-label="Production jobs">
      <table class="production-table">
        <thead><tr><th>ID</th><th>Branch</th><th>Customer</th><th>Type</th><th>Material</th><th>Priority</th><th>Status</th><th>Progress</th><th>Updated</th><th>Action</th></tr></thead>
        <tbody>${visible.map(renderTableRow).join('') || '<tr><td colspan="10" class="table-empty">No jobs match the current filters.</td></tr>'}</tbody>
      </table>
    </section>
    <footer class="board-pagination">
      <span>Showing ${pageStart} to ${pageEnd} of ${filtered.length} results</span>
      <div class="board-pagination__buttons">
        <button class="pagination-button" data-board-page="${Math.max(1, boardPage - 1)}" ${boardPage === 1 ? 'disabled' : ''} aria-label="Previous page">‹</button>
        ${pageButtons}
        <button class="pagination-button" data-board-page="${Math.min(totalPages, boardPage + 1)}" ${boardPage === totalPages ? 'disabled' : ''} aria-label="Next page">›</button>
      </div>
    </footer>
  </section>`;
}
