// Guided New Job intake. The underlying job schema remains unchanged; the UI is split
// into Job Information, Sizes & Materials, and Review & Submit for clarity.

import { BRANCHES, MATERIALS } from '../../utils/constants.js';
import { escapeHtml } from '../../utils/formatters.js';
import { isProduction } from '../../utils/helpers.js';

export function materialOptions(type) {
  return MATERIALS[type].map((value) => `<option>${escapeHtml(value)}</option>`).join('');
}

function stepper() {
  return `<div class="wizard-steps" aria-label="New job steps">
    <div class="wizard-step active" data-wizard-indicator="1"><span>1</span><strong>Job Information</strong></div>
    <div class="wizard-step" data-wizard-indicator="2"><span>2</span><strong>Sizes &amp; Materials</strong></div>
    <div class="wizard-step" data-wizard-indicator="3"><span>3</span><strong>Review &amp; Submit</strong></div>
  </div>`;
}

export function renderNewJobForm(profile, stockItems = []) {
  const branchField = isProduction(profile)
    ? `<select name="branch">${BRANCHES.map((value) => `<option ${value === profile.branch ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select>`
    : `<input value="${escapeHtml(profile.branch)}" disabled><input type="hidden" name="branch" value="${escapeHtml(profile.branch)}">`;

  const stockWarnings = {};
  stockItems.forEach(item => {
    if (item.quantity_on_hand <= 0) stockWarnings[item.material] = 'unavailable';
    else if (item.quantity_on_hand <= item.low_stock_threshold) stockWarnings[item.material] = 'low';
  });

  return `<section class="page-heading">
      <div><p class="eyebrow">Production intake</p><h1>New Job</h1><p>Capture the production requirements from the customer's approved artwork email.</p></div>
    </section>
    <form class="job-form job-form--wizard" id="job-form" novalidate>
      ${stepper()}

      <section class="wizard-panel active" data-wizard-panel="1">
        <div class="wizard-panel__heading"><span class="wizard-panel__eyebrow">Step 1</span><h2>Job Information</h2><p>Tell production who the job is for and where it came from.</p></div>
        <div class="form-grid">
          <label>Branch${branchField}</label>
          <label>Customer name<input name="customer" required autocomplete="organization"></label>
          <label>Job type<select name="type" id="job-type"><option value="stickers">Stickers</option><option value="flex">T-shirt Flex</option></select></label>
          <label>Priority<select name="priority"><option value="standard">Standard (24–48 hours)</option><option value="rush">Rush (needs production confirmation)</option><option value="urgent">Urgent (needs production confirmation)</option></select></label>
          <label class="form-grid__full">Email subject / reference<input name="emailReference" required placeholder="RE: Sticker order — Ocean Blue"></label>
        </div>
        <p class="form-error" data-wizard-error="1" role="alert"></p>
        <div class="wizard-actions"><span></span><button type="button" class="button button--primary" data-wizard-next="2">Next</button></div>
      </section>

      <section class="wizard-panel" data-wizard-panel="2" hidden>
        <div class="wizard-panel__heading"><span class="wizard-panel__eyebrow">Step 2</span><h2>Sizes &amp; Materials</h2><p>Define the physical production requirements.</p></div>
        <div class="form-grid">
          <label>Size / placement<input name="specification" required placeholder="90 × 50 mm or front chest"></label>
          <label>Quantity<input name="quantity" type="number" min="1" required></label>
          <label>Material<select name="material" id="material">${materialOptions('stickers')}</select><small id="stock-warning" class="stock-warning"></small></label>
        </div>
        <div class="material-summary">
          <span>Selected material</span><strong id="selected-material-label">Gloss Vinyl</strong><small>Stock is tracked in kilograms (kg).</small>
        </div>
        <p class="form-error" data-wizard-error="2" role="alert"></p>
        <div class="wizard-actions"><button type="button" class="button button--ghost" data-wizard-back="1">Back</button><button type="button" class="button button--primary" data-wizard-next="3">Next</button></div>
      </section>

      <section class="wizard-panel" data-wizard-panel="3" hidden>
        <div class="wizard-panel__heading"><span class="wizard-panel__eyebrow">Step 3</span><h2>Review &amp; Submit</h2><p>Confirm that the artwork and job information are ready for production.</p></div>
        <div class="review-grid">
          <div class="review-card"><span>Job summary</span><dl>
            <div><dt>Branch</dt><dd data-review="branch">—</dd></div>
            <div><dt>Customer</dt><dd data-review="customer">—</dd></div>
            <div><dt>Type</dt><dd data-review="type">—</dd></div>
            <div><dt>Priority</dt><dd data-review="priority">—</dd></div>
            <div><dt>Reference</dt><dd data-review="emailReference">—</dd></div>
          </dl></div>
          <div class="review-card"><span>Sizes &amp; materials</span><dl>
            <div><dt>Specification</dt><dd data-review="specification">—</dd></div>
            <div><dt>Quantity</dt><dd data-review="quantity">—</dd></div>
            <div><dt>Material</dt><dd data-review="material">—</dd></div>
          </dl></div>
        </div>
        <div class="artwork-checklist">
          <h3>Artwork checklist</h3>
          <label class="check"><input type="checkbox" name="artworkReceived" required> PDF or CDR received by email</label>
          <label class="check"><input type="checkbox" name="artworkPrintReady" required> Artwork is print-ready and correct size</label>
          <label class="check"><input type="checkbox" name="artworkApproved" required> Customer approved artwork</label>
          <label class="check"><input type="checkbox" name="cutlines"> Cutlines included</label>
          <p class="hint">For sticker jobs, cutlines are strongly recommended.</p>
        </div>
        <p class="form-error" data-wizard-error="3" role="alert"></p>
        <div class="wizard-actions"><button type="button" class="button button--ghost" data-wizard-back="2">Back</button><button class="button button--primary">Submit Job</button></div>
      </section>
    </form>`;
}
