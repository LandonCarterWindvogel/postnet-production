// Production Board: compact PostNet Copy & Print queue view for desktop production use.

import { BOARD_STATUSES, STATUS_LABELS, MACHINE_STATUS_LABELS } from '../../utils/constants.js';
import { WORKFLOWS } from '../../config.js';
import { escapeHtml, formatJobNumber } from '../../utils/formatters.js';
import { formatDateTime } from '../../utils/dates.js';
import { computeNextStatus, isClosed, isProduction } from '../../utils/helpers.js';
import { renderNeedsAttention } from './NeedsAttention.js';
import { ROLAND_MACHINE_MARK } from '../../utils/brandAssets.js';

const PRIORITY_ORDER = { urgent: 0, rush: 1, standard: 2 };
const PAGE_SIZE = 10;
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
  return index < 0 ? 0 : Math.round(((index + 1) / workflow.length) * 100);
}

function priorityLabel(priority) {
  return priority === 'standard' ? 'Standard' : priority.charAt(0).toUpperCase() + priority.slice(1);
}

function statusClass(status) {
  return `status-${status.replace(/_/g, '-')}`;
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
  const nextStatus = computeNextStatus(job);
  const typeLabel = job.job_type === 'flex' ? 'T-shirt Flex' : 'Stickers';
  const status = STATUS_LABELS[job.status] || job.status;
  const updated = job.updated_at ? formatDateTime(job.updated_at) : '—';

  return `<tr class="job-row ${job.priority === 'urgent' ? 'job-row--urgent' : ''}" data-open-job="${job.id}">
    <td><strong>${formatJobNumber(job)}</strong></td>
    <td>${escapeHtml(job.branch)}</td>
    <td><strong>${escapeHtml(job.customer_name)}</strong></td>
    <td>${typeLabel}</td>
    <td>${escapeHtml(job.material)}</td>
    <td><span class="priority-badge priority-${job.priority}">${priorityLabel(job.priority)}</span></td>
    <td><span class="status-badge ${statusClass(job.status)}">${escapeHtml(status)}</span></td>
    <td class="progress-cell"><div class="progress-inline"><div class="progress-track"><span style="width:${progress}%"></span></div><span>${progress}%</span></div></td>
    <td>${escapeHtml(updated)}</td>
    <td class="next-cell">${nextStatus ? `→ ${escapeHtml(STATUS_LABELS[nextStatus] || nextStatus)}` : '—'}</td>
  </tr>`;
}

export function jobCard(job) {
  const progress = progressForJob(job);
  const nextStatus = computeNextStatus(job);
  const typeLabel = job.job_type === 'flex' ? 'T-shirt Flex' : 'Stickers';
  return `<article class="job-card ${job.priority === 'urgent' ? 'priority-urgent' : ''}" data-open-job="${job.id}">
    <div class="job-card__top"><span class="job-id">${formatJobNumber(job)}</span><span class="status-badge ${statusClass(job.status)}">${STATUS_LABELS[job.status] || job.status}</span></div>
    <h3>${escapeHtml(job.customer_name)}</h3>
    <p>${escapeHtml(job.branch)} · ${typeLabel}</p>
    <p>${escapeHtml(job.material)} · ${escapeHtml(job.specification)} · ${job.quantity}</p>
    <div class="progress-inline"><div class="progress-track"><span style="width:${progress}%"></span></div><span>${progress}%</span></div>
    <small>Next: ${escapeHtml(nextStatus ? (STATUS_LABELS[nextStatus] || nextStatus) : 'Complete')}</small>
  </article>`;
}

export function renderProductionBoard({ jobs, profile, error, machines = [], searchQuery = '', filters = {} }) {
  const canEditMachines = isProduction(profile);
  const active = jobs.filter((job) => !isClosed(job));

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
    queued: active.filter((j) => j.status === 'queued').length,
    printing: active.filter((j) => j.status === 'printing').length,
    drying: active.filter((j) => j.status === 'drying').length,
    cutting: active.filter((j) => ['cutting', 'contour_cutting'].includes(j.status)).length,
    weeding: active.filter((j) => j.status === 'weeding').length,
    qc: active.filter((j) => j.status === 'quality_check').length,
    ready: active.filter((j) => j.status === 'ready').length
  };

  const overdue = active.filter((job) => job.expected_ready_by && new Date() > new Date(job.expected_ready_by));
  const urgent = active.filter((job) => job.priority === 'urgent');
  const returned = jobs.filter((job) => job.status === 'rejected');
  const summary = { overdue: overdue.length, urgent: urgent.length, returned: returned.length, ready: counts.ready };

  const statusItems = [
    ['All', counts.all, ''],
    ['Queued', counts.queued, 'queued'],
    ['Printing', counts.printing, 'printing'],
    ['Drying', counts.drying, 'drying'],
    ['Cutting', counts.cutting, 'cutting'],
    ['Weeding', counts.weeding, 'weeding'],
    ['QC', counts.qc, 'quality-check'],
    ['Ready', counts.ready, 'ready']
  ];

  const filterHtml = `<div class="board-toolbar">
    <label class="search-box"><span aria-hidden="true">⌕</span><input type="text" id="search-input" placeholder="Search jobs, customers or references…" value="${escapeHtml(searchQuery)}" aria-label="Search jobs"></label>
    <select id="filter-branch" aria-label="Filter by branch"><option value="">All Branches</option><option value="Plettenberg Bay">Plettenberg Bay</option><option value="Knysna">Knysna</option><option value="Waterside">Waterside</option><option value="Sedgefield">Sedgefield</option></select>
    <select id="filter-priority" aria-label="Filter by priority"><option value="">All Priorities</option><option value="standard">Standard</option><option value="rush">Rush</option><option value="urgent">Urgent</option></select>
    <select id="filter-status" aria-label="Filter by status"><option value="">All Statuses</option>${BOARD_STATUSES.map((status) => `<option value="${status}">${status === 'cutting' ? 'Cutting — T-shirt Flex' : status === 'contour_cutting' ? 'Cutting — Stickers' : STATUS_LABELS[status]}</option>`).join('')}</select>
    <select id="filter-type" aria-label="Filter by type"><option value="">All Types</option><option value="stickers">Stickers</option><option value="flex">T-shirt Flex</option></select>
    <select id="filter-material" aria-label="Filter by material"><option value="">All Materials</option>${Array.from(new Set(active.map((j) => j.material))).sort().map((material) => `<option value="${escapeHtml(material)}">${escapeHtml(material)}</option>`).join('')}</select>
  </div>`;

  const pageStart = filtered.length ? start + 1 : 0;
  const pageEnd = Math.min(start + PAGE_SIZE, filtered.length);
  const pageButtons = Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((page) => `<button class="pagination-button ${page === boardPage ? 'active' : ''}" data-board-page="${page}">${page}</button>`).join('');

  return `<section class="production-board-page">
    <header class="board-header">
      <div><p class="eyebrow">Production centre</p><h1>Production Board</h1><p>Overview of all jobs in production.</p></div>
      <div class="board-header__actions">${machinePill(machines[0], canEditMachines, active)}<button class="button button--primary" data-page="new-job">+ New Job</button></div>
    </header>
    ${error ? `<p class="form-error form-error--banner">${escapeHtml(error)}</p>` : ''}
    <section class="status-strip" aria-label="Production stage counts">${statusItems.map(([label, count, key]) => `<div class="status-strip__item ${key ? `status-strip__item--${key}` : ''}"><span>${label}</span><strong>${count}</strong></div>`).join('')}</section>
    ${renderNeedsAttention(summary)}
    ${filterHtml}
    <section class="board-table-wrap" aria-label="Production jobs">
      <table class="production-table">
        <thead><tr><th>ID</th><th>Branch</th><th>Customer</th><th>Type</th><th>Material</th><th>Priority</th><th>Status</th><th>Progress</th><th>Updated</th><th>Next</th></tr></thead>
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
