// Renders the New Job intake form. Material options depend on job type,
// so app.js listens for a change event on #job-type and re-fills #material
// using materialOptions() below.

import { BRANCHES, MATERIALS } from '../../utils/constants.js';
import { escapeHtml } from '../../utils/formatters.js';
import { isProduction } from '../../utils/helpers.js';
import { estimateMachineTime } from '../../utils/machineTimeEstimator.js';

export function materialOptions(type) {
  return MATERIALS[type].map((value) => `<option>${value}</option>`).join('');
}

export function renderNewJobForm(profile, stockItems = []) {
  const branchField = isProduction(profile)
    ? `<select name="branch">${BRANCHES.map((value) => `<option ${value === profile.branch ? 'selected' : ''}>${value}</option>`).join('')}</select>`
    : `<input value="${escapeHtml(profile.branch)}" disabled><input type="hidden" name="branch" value="${escapeHtml(profile.branch)}">`;

  // Build stock warnings for each material
  const stockWarnings = {};
  stockItems.forEach(item => {
    if (item.quantity_on_hand <= 0) {
      stockWarnings[item.material] = 'unavailable';
    } else if (item.quantity_on_hand <= item.low_stock_threshold) {
      stockWarnings[item.material] = 'low';
    }
  });

  const initialEstimate = estimateMachineTime({
    jobType: 'stickers',
    specification: '',
    quantity: 1,
    cutlinesIncluded: false
  });

  return `<section class="page-heading">
      <div><p class="eyebrow">Production intake</p><h1>New Job</h1><p>Artwork stays in email; this records production requirements.</p></div>
    </section>
    <form class="job-form" id="job-form">
      <fieldset>
        <legend>Job details</legend>
        <label>Branch${branchField}</label>
        <label>Customer name<input name="customer" required></label>
        <label>Priority<select name="priority"><option value="normal">Normal (24–48 hours)</option><option value="rush">Rush (needs production confirmation)</option><option value="urgent">Urgent (needs production confirmation)</option></select></label>
        <label>Email subject / reference<input name="emailReference" required placeholder="RE: Sticker order — Ocean Blue"></label>
      </fieldset>
      <fieldset>
        <legend>Production requirements</legend>
        <label>Job type<select name="type" id="job-type"><option value="stickers">Stickers</option><option value="flex">T-shirt Flex</option></select></label>
        <label>Material<select name="material" id="material">${materialOptions('stickers')}</select>
          <div id="stock-warning" class="stock-warning"></div>
        </label>
        <label>Size / placement<input name="specification" required placeholder="90 × 50 mm or front chest"></label>
        <label>Quantity<input name="quantity" type="number" min="1" required></label>
      </fieldset>
      <fieldset>
        <legend>Artwork checklist</legend>
        <label class="check"><input type="checkbox" name="artworkReceived" required> PDF or CDR received by email</label>
        <label class="check"><input type="checkbox" name="artworkPrintReady" required> Artwork is print-ready and correct size</label>
        <label class="check"><input type="checkbox" name="artworkApproved" required> Customer approved artwork</label>
        <label class="check"><input type="checkbox" name="cutlines"> Cutlines included</label>
        <p class="hint">For sticker jobs, cutlines are strongly recommended.</p>
      </fieldset>
      <div class="machine-estimate" id="machine-time-estimate" aria-live="polite">
        <span>BN-20 machine estimate</span>
        <strong>${initialEstimate.display}</strong>
        <small>High Quality assumption · estimate only</small>
      </div>
      <p class="form-error"></p>
      <div class="form-actions"><button class="button button--primary">Submit to incoming jobs</button></div>
    </form>`;
}