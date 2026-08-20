// Renders a single job's details, production controls, correction actions and timeline.

import { escapeHtml, formatJobNumber } from '../../utils/formatters.js';
import { formatDateTime } from '../../utils/dates.js';
import { STATUS_LABELS } from '../../utils/constants.js';
import { computeNextStatus, isClosed, isProduction } from '../../utils/helpers.js';
import { estimateMachineTime } from '../../utils/machineTimeEstimator.js';
import { renderJobTimeline } from './JobTimeline.js';

function priorityLabel(priority) {
  return priority === 'standard' ? 'Standard' : priority.charAt(0).toUpperCase() + priority.slice(1);
}

export function renderJobDetails(job, profile, userId) {
  const nextStatus = computeNextStatus(job);
  const actionLabel = job.status === 'incoming' ? 'Accept into queue' : (nextStatus ? `Move to ${STATUS_LABELS[nextStatus]}` : 'Complete');
  const canReject = isProduction(profile) && !isClosed(job) && job.status !== 'rejected';
  const canResubmit = !isProduction(profile) && job.status === 'rejected' && job.branch === profile.branch;
  const correctionReason = job.status === 'rejected' ? job.notes : null;

  const machineEstimate = estimateMachineTime({
    jobType: job.job_type,
    specification: job.specification,
    quantity: job.quantity,
    cutlinesIncluded: job.cutlines_included
  });

  return `<section class="page-heading page-heading--details">
    <div>
      <button class="button button--ghost" data-page="board">← Back to Board</button>
      <div class="details-heading__id"><span>${formatJobNumber(job)}</span><span class="status-badge status-${job.status.replace(/_/g, '-')}">${STATUS_LABELS[job.status]}</span></div>
      <h1>${escapeHtml(job.customer_name)}</h1>
      <p>${escapeHtml(job.branch)} · ${job.job_type === 'flex' ? 'T-shirt Flex' : 'Stickers'} · ${escapeHtml(job.material)}</p>
    </div>
    <div class="details-heading__actions">
      ${job.priority !== 'standard' ? `<span class="priority-badge priority-${job.priority}">${priorityLabel(job.priority)}</span>` : ''}
      ${isProduction(profile) && nextStatus ? `<button class="button button--primary" data-advance="${job.id}">${actionLabel}</button>` : ''}
    </div>
  </section>

  <section class="job-details__meta">
    <article><span>Branch</span><strong>${escapeHtml(job.branch)}</strong></article>
    <article><span>Customer</span><strong>${escapeHtml(job.customer_name)}</strong></article>
    <article><span>Type</span><strong>${job.job_type === 'flex' ? 'T-shirt Flex' : 'Stickers'}</strong></article>
    <article><span>Priority</span><strong>${priorityLabel(job.priority)}</strong></article>
  </section>

  <section class="details-tabs" aria-label="Job detail sections"><span class="active">Summary</span><span>Sizes &amp; Materials</span><span>History</span><span>Notes</span><span>Files (Email)</span></section>

  <section class="job-details-grid">
    <article class="detail-card">
      <div class="detail-card__heading"><h2>Job Information</h2><span>${formatDateTime(job.created_at)}</span></div>
      <dl class="detail-list">
        <div><dt>Customer reference</dt><dd>${escapeHtml(job.email_reference)}</dd></div>
        <div><dt>Material</dt><dd>${escapeHtml(job.material)}</dd></div>
        <div><dt>Specification</dt><dd>${escapeHtml(job.specification)}</dd></div>
        <div><dt>Quantity</dt><dd>${job.quantity}</dd></div>
        ${job.expected_ready_by ? `<div><dt>Expected ready by</dt><dd>${formatDateTime(job.expected_ready_by)}</dd></div>` : ''}
        ${job.ready_at ? `<div><dt>Ready at</dt><dd>${formatDateTime(job.ready_at)}</dd></div>` : ''}
        ${job.collected_at ? `<div><dt>Collected at</dt><dd>${formatDateTime(job.collected_at)}</dd></div>` : ''}
      </dl>
    </article>
    <article class="detail-card">
      <div class="detail-card__heading"><h2>BN-20 Machine Estimate</h2><span>High Quality</span></div>
      <div class="detail-note-list">
        <p><strong>Estimated machine time:</strong> ${escapeHtml(machineEstimate.display)}</p>
        <p>${escapeHtml(machineEstimate.available ? 'Estimate only — calibrate against the real BN-20.' : machineEstimate.reason)}</p>
      </div>
    </article>
    <article class="detail-card">
      <div class="detail-card__heading"><h2>Production Notes</h2></div>
      <div class="detail-note-list">
        <p>Artwork reference remains in email.</p>
        <p>${job.cutlines_included ? 'Cutlines included.' : 'Cutlines not confirmed.'}</p>
        ${job.notes ? `<p>${escapeHtml(job.notes)}</p>` : '<p>No additional production notes.</p>'}
      </div>
    </article>
  </section>

  <section class="detail-card detail-card--checklist">
    <div class="detail-card__heading"><h2>Artwork Checklist</h2></div>
    <div class="checklist-grid">
      <label class="check"><input checked disabled type="checkbox"> PDF or CDR supplied</label>
      <label class="check"><input ${job.artwork_print_ready !== false ? 'checked' : ''} disabled type="checkbox"> Print-ready artwork</label>
      <label class="check"><input ${job.artwork_received !== false ? 'checked' : ''} disabled type="checkbox"> Artwork received</label>
      <label class="check"><input ${job.cutlines_included ? 'checked' : ''} disabled type="checkbox"> Cutlines included</label>
      <label class="check"><input ${job.artwork_approved !== false ? 'checked' : ''} disabled type="checkbox"> Customer approved artwork</label>
    </div>
  </section>

  ${correctionReason ? `<section class="detail-card"><div class="detail-card__heading"><h2>Returned for Correction</h2></div><p class="notice">${escapeHtml(correctionReason)}</p></section>` : ''}

  ${canReject ? `<form class="job-form detail-action-form" id="reject-form" data-job-id="${job.id}">
    <fieldset><legend>Return for correction</legend><label>Reason for the branch<textarea name="reason" required placeholder="e.g. artwork is missing bleed, please resend"></textarea></label></fieldset>
    <p class="form-error"></p><div class="form-actions"><button class="button button--ghost">Send back to branch</button></div>
  </form>` : ''}

  ${canResubmit ? `<form class="job-form detail-action-form" id="resubmit-form" data-job-id="${job.id}">
    <fieldset><legend>Resubmit after correction</legend><p>Confirm the artwork has been corrected and is ready for production again.</p><label class="check"><input type="checkbox" required> I have corrected the artwork</label></fieldset>
    <p class="form-error"></p><div class="form-actions"><button class="button button--primary">Resubmit to incoming</button></div>
  </form>` : ''}

  ${renderJobTimeline(job)}
}`;
}
