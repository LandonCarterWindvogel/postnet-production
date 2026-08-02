// Renders a single job's detail page, including the action button that
// advances it to the next workflow status (production role only).

import { escapeHtml, formatJobNumber } from '../../utils/formatters.js';
import { STATUS_LABELS } from '../../utils/constants.js';
import { computeNextStatus, isClosed, isProduction } from '../../utils/helpers.js';

export function renderJobDetails(job, profile) {
  const nextStatus = computeNextStatus(job);
  const actionLabel = job.status === 'incoming' ? 'Accept into queue' : `Move to ${STATUS_LABELS[nextStatus]}`;
  const canReject = isProduction(profile) && !isClosed(job);

  return `<section class="page-heading">
      <div>
        <button class="button" data-page="board">← Back to board</button>
        <p class="eyebrow">${formatJobNumber(job)} · ${STATUS_LABELS[job.status]}</p>
        <h1>${escapeHtml(job.customer_name)}</h1>
        <p>${escapeHtml(job.branch)} · ${job.job_type === 'flex' ? 'T-shirt Flex' : 'Stickers'}</p>
      </div>
      ${isProduction(profile) && nextStatus ? `<button class="button button--primary" data-advance="${job.id}">${actionLabel}</button>` : ''}
    </section>
    <section class="job-form">
      <fieldset>
        <legend>Production requirements</legend>
        <label>Material<input value="${escapeHtml(job.material)}" disabled></label>
        <label>Specification<input value="${escapeHtml(job.specification)} · ${job.quantity}" disabled></label>
        <label>Priority<input value="${escapeHtml(job.priority)}" disabled></label>
        <label>Email reference<input value="${escapeHtml(job.email_reference)}" disabled></label>
      </fieldset>
      <fieldset>
        <legend>Artwork confirmation</legend>
        <label class="check"><input checked disabled type="checkbox"> Print-ready artwork confirmed</label>
        <label class="check"><input ${job.cutlines_included ? 'checked' : ''} disabled type="checkbox"> Cutlines included</label>
      </fieldset>
      ${job.notes ? `<fieldset><legend>${job.status === 'rejected' ? 'Reason returned for correction' : 'Notes'}</legend><p class="notice">${escapeHtml(job.notes)}</p></fieldset>` : ''}
    </section>
    ${canReject ? `<form class="job-form" id="reject-form" data-job-id="${job.id}">
      <fieldset>
        <legend>Return for correction</legend>
        <label>Reason for the branch<textarea name="reason" required placeholder="e.g. artwork is missing bleed, please resend"></textarea></label>
      </fieldset>
      <p class="form-error"></p>
      <div class="form-actions"><button class="button button--ghost">Send back to branch</button></div>
    </form>` : ''}`;
}
