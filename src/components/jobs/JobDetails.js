// Renders a single job's detail page, including the action button that
// advances it to the next workflow status (production role only).
// Also shows timeline and correction history.

import { escapeHtml, formatJobNumber } from '../../utils/formatters.js';
import { formatDateTime } from '../../utils/dates.js';
import { STATUS_LABELS } from '../../utils/constants.js';
import { computeNextStatus, isClosed, isProduction } from '../../utils/helpers.js';
import { renderJobTimeline } from './JobTimeline.js';

export function renderJobDetails(job, profile, userId) {
  const nextStatus = computeNextStatus(job);
  const actionLabel = job.status === 'incoming' ? 'Accept into queue' : `Move to ${STATUS_LABELS[nextStatus]}`;
  const canReject = isProduction(profile) && !isClosed(job) && job.status !== 'rejected';
  const canResubmit = !isProduction(profile) && job.status === 'rejected' && job.branch === profile.branch;

  // Show correction reason if rejected
  const correctionReason = job.status === 'rejected' ? job.notes : null;

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
        ${job.expected_ready_by ? `<label>Expected ready by<input value="${formatDateTime(job.expected_ready_by)}" disabled></label>` : ''}
        ${job.ready_at ? `<label>Ready at<input value="${formatDateTime(job.ready_at)}" disabled></label>` : ''}
        ${job.collected_at ? `<label>Collected at<input value="${formatDateTime(job.collected_at)}" disabled></label>` : ''}
      </fieldset>
      <fieldset>
        <legend>Artwork confirmation</legend>
        <label class="check"><input checked disabled type="checkbox"> Print-ready artwork confirmed</label>
        <label class="check"><input ${job.cutlines_included ? 'checked' : ''} disabled type="checkbox"> Cutlines included</label>
        ${job.artwork_received !== undefined ? `<label class="check"><input ${job.artwork_received ? 'checked' : ''} disabled type="checkbox"> Artwork received</label>` : ''}
        ${job.artwork_print_ready !== undefined ? `<label class="check"><input ${job.artwork_print_ready ? 'checked' : ''} disabled type="checkbox"> Artwork print-ready</label>` : ''}
        ${job.artwork_approved !== undefined ? `<label class="check"><input ${job.artwork_approved ? 'checked' : ''} disabled type="checkbox"> Artwork approved</label>` : ''}
      </fieldset>
      ${correctionReason ? `<fieldset><legend>Reason returned for correction</legend><p class="notice">${escapeHtml(correctionReason)}</p></fieldset>` : ''}
      ${job.notes && job.status !== 'rejected' ? `<fieldset><legend>Notes</legend><p class="notice">${escapeHtml(job.notes)}</p></fieldset>` : ''}
    </section>
    ${canReject ? `<form class="job-form" id="reject-form" data-job-id="${job.id}">
      <fieldset>
        <legend>Return for correction</legend>
        <label>Reason for the branch<textarea name="reason" required placeholder="e.g. artwork is missing bleed, please resend"></textarea></label>
      </fieldset>
      <p class="form-error"></p>
      <div class="form-actions"><button class="button button--ghost">Send back to branch</button></div>
    </form>` : ''}
    ${canResubmit ? `<form class="job-form" id="resubmit-form" data-job-id="${job.id}">
      <fieldset>
        <legend>Resubmit after correction</legend>
        <p>Confirm that the artwork has been corrected and is ready for production again.</p>
        <label><input type="checkbox" required> I have corrected the artwork</label>
      </fieldset>
      <p class="form-error"></p>
      <div class="form-actions"><button class="button button--primary">Resubmit to incoming</button></div>
    </form>` : ''}
    ${renderJobTimeline(job)}`;
}