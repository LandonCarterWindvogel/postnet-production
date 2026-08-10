// Simple dashboard for branch users showing counts and recent jobs.

import { escapeHtml, formatJobNumber } from '../../utils/formatters.js';
import { STATUS_LABELS } from '../../utils/constants.js';
import { isClosed } from '../../utils/helpers.js';

export function renderBranchDashboard({ jobs, profile }) {
  if (!profile) return '<p>Please sign in.</p>';

  const branchJobs = jobs.filter(j => j.branch === profile.branch);
  const active = branchJobs.filter(j => !isClosed(j) && j.status !== 'rejected');
  const ready = branchJobs.filter(j => j.status === 'ready');
  const returned = branchJobs.filter(j => j.status === 'rejected');
  const collected = branchJobs.filter(j => j.status === 'collected');

  const recent = branchJobs.slice(0, 10); // newest first (already sorted)

  return `<section class="page-heading">
      <div><p class="eyebrow">Branch overview</p><h1>Dashboard</h1><p>${escapeHtml(profile.branch)}</p></div>
    </section>
    <section class="dashboard-stats">
      <article><span>Active jobs</span><strong>${active.length}</strong></article>
      <article><span>Ready for collection</span><strong>${ready.length}</strong></article>
      <article><span>Returned for correction</span><strong>${returned.length}</strong></article>
      <article><span>Collected</span><strong>${collected.length}</strong></article>
    </section>
    <section>
      <h2>Recent jobs</h2>
      <div class="job-table">${recent.map(job => `
        <article class="job-card ${job.priority === 'urgent' ? 'priority-urgent' : ''}">
          <div class="job-card__top">
            <span class="job-id">${formatJobNumber(job)}</span>
            <span class="status">${STATUS_LABELS[job.status]}</span>
          </div>
          <h3>${escapeHtml(job.customer_name)}</h3>
          <p>${escapeHtml(job.material)} · ${job.quantity}</p>
          <button class="button" data-open-job="${job.id}">View</button>
        </article>
      `).join('')}</div>
    </section>`;
}