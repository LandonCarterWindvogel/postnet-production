// Production reports scoped to the jobs the signed-in user can read.
import { BRANCHES, STATUS_LABELS } from '../../utils/constants.js';
import { escapeHtml, formatJobNumber } from '../../utils/formatters.js';
import { isProduction } from '../../utils/helpers.js';

function reportItems(job) {
  const items = Array.isArray(job.items) && job.items.length
    ? job.items
    : [{ name: job.material || 'Job item', quantity: job.quantity, type: job.job_type }];
  return items.map((item, index) => {
    const label = item.name || `${item.type === 'flex' ? 'T-shirt Flex' : 'Sticker'} ${index + 1}`;
    return `${label} (Qty ${item.quantity ?? job.quantity})`;
  }).join('; ');
}

function localDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: '2-digit' });
}

function option(label, value, selected) {
  return `<option value="${escapeHtml(value)}" ${selected ? 'selected' : ''}>${escapeHtml(label)}</option>`;
}

export function renderReports({ jobs, profile }) {
  const production = isProduction(profile);
  const active = jobs.filter((job) => !['collected', 'rejected'].includes(job.status)).length;
  const ready = jobs.filter((job) => job.status === 'ready').length;
  const returned = jobs.filter((job) => job.status === 'rejected').length;
  const collected = jobs.filter((job) => job.status === 'collected').length;

  return `<section class="page-heading">
    <div><p class="eyebrow">Production overview</p><h1>Reports &amp; Export</h1><p>Review job volumes and export the filtered job list to a CSV file for Excel.</p></div>
    <button class="button button--primary" type="button" data-report-export>Export CSV</button>
  </section>

  <section class="dashboard-stats reports-stats">
    <article><span>Visible jobs</span><strong data-report-metric="total">${jobs.length}</strong></article>
    <article><span>Active jobs</span><strong data-report-metric="active">${active}</strong></article>
    <article><span>Ready for collection</span><strong data-report-metric="ready">${ready}</strong></article>
    <article><span>Returned for correction</span><strong data-report-metric="returned">${returned}</strong></article>
    <article><span>Collected</span><strong data-report-metric="collected">${collected}</strong></article>
  </section>

  <section class="report-panel">
    <div class="report-panel__heading"><div><h2>Job register</h2><p>Filter by creation date and branch, then export only the matching rows.</p></div></div>
    <div class="report-filters">
      <label>From date<input type="date" data-report-start></label>
      <label>To date<input type="date" data-report-end></label>
      ${production ? `<label>Branch<select data-report-branch>${option('All branches', '', true)}${BRANCHES.map((branch) => option(branch, branch, false)).join('')}</select></label>` : ''}
      <button type="button" class="button button--primary" data-report-apply>Apply filters</button>
      <button type="button" class="button button--ghost" data-report-reset>Reset</button>
    </div>
    <div class="report-table-wrap">
      <table class="report-table" data-report-table>
        <thead><tr><th>Job</th><th>Created</th><th>Branch</th><th>Customer</th><th>Contact</th><th>Items &amp; quantities</th><th>Status</th><th>Priority</th><th>Collection / delivery</th></tr></thead>
        <tbody>
          ${jobs.map((job) => {
            const date = String(job.created_at || '').slice(0, 10);
            const contact = [job.contact_name, job.contact_phone].filter(Boolean).join(' · ') || '—';
            const fulfillment = (job.fulfillment_method || 'collection') === 'delivery'
              ? `Delivery: ${job.delivery_address || 'Address missing'}`
              : 'Collection at branch';
            const priority = job.priority === 'standard' || job.priority === 'normal' ? 'Standard' : job.priority.charAt(0).toUpperCase() + job.priority.slice(1);
            return `<tr data-report-row data-report-date="${escapeHtml(date)}" data-report-branch="${escapeHtml(job.branch)}" data-report-status="${escapeHtml(job.status)}">
              <td><button type="button" class="report-job-link" data-open-job="${job.id}">${formatJobNumber(job)}</button></td>
              <td>${escapeHtml(localDate(job.created_at))}</td>
              <td>${escapeHtml(job.branch)}</td>
              <td>${escapeHtml(job.customer_name)}</td>
              <td>${escapeHtml(contact)}</td>
              <td>${escapeHtml(reportItems(job))}</td>
              <td>${escapeHtml(STATUS_LABELS[job.status] || job.status)}</td>
              <td>${escapeHtml(priority)}</td>
              <td>${escapeHtml(fulfillment)}</td>
            </tr>`;
          }).join('')}
          <tr data-report-empty hidden><td colspan="9">No jobs match the selected filters.</td></tr>
        </tbody>
      </table>
    </div>
  </section>`;
}
