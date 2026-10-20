// Guided New Job intake with any number of sticker and T-shirt Flex line items.

import { BRANCHES, MATERIALS } from '../../utils/constants.js';
import { escapeHtml } from '../../utils/formatters.js';
import { isProduction } from '../../utils/helpers.js';

export function materialOptions(type) {
  return MATERIALS[type].map((value) => `<option>${escapeHtml(value)}</option>`).join('');
}

export function renderJobItemRow(type = 'stickers', index = 1) {
  const isFlex = type === 'flex';
  const label = isFlex ? 'T-shirt Flex' : 'Sticker';
  return `<article class="job-item-card" data-item-row>
    <header class="job-item-card__header">
      <div><span class="job-item-card__number" data-item-title>${label} ${index}</span><small>Size, quantity and material for this design</small></div>
      <button type="button" class="button button--ghost job-item-card__remove" data-remove-item ${index === 1 ? 'disabled' : ''}>Remove</button>
    </header>
    <div class="form-grid">
      <label>Item type<select data-item-field="type">
        <option value="stickers" ${!isFlex ? 'selected' : ''}>Stickers</option>
        <option value="flex" ${isFlex ? 'selected' : ''}>T-shirt Flex</option>
      </select></label>
      <label>Width (mm)<input data-item-field="width_mm" type="number" min="1" max="10000" step="1" required inputmode="numeric" placeholder="50"></label>
      <label>Height (mm)<input data-item-field="height_mm" type="number" min="1" step="1" required inputmode="numeric" placeholder="50"></label>
      <label>Quantity<input data-item-field="quantity" type="number" min="1" step="1" required inputmode="numeric" placeholder="100"></label>
      <label class="form-grid__full">Material<select data-item-field="material">${materialOptions(type)}</select></label>
    </div>
  </article>`;
}

function stepper() {
  return `<div class="wizard-steps" aria-label="New job steps">
    <div class="wizard-step active" data-wizard-indicator="1"><span>1</span><strong>Job Information</strong></div>
    <div class="wizard-step" data-wizard-indicator="2"><span>2</span><strong>Items &amp; Sizes</strong></div>
    <div class="wizard-step" data-wizard-indicator="3"><span>3</span><strong>Review &amp; Submit</strong></div>
  </div>`;
}

export function renderNewJobForm(profile, stockItems = []) {
  const branchField = isProduction(profile)
    ? `<select name="branch">${BRANCHES.map((value) => `<option ${value === profile.branch ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select>`
    : `<input value="${escapeHtml(profile.branch)}" disabled><input type="hidden" name="branch" value="${escapeHtml(profile.branch)}">`;

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
          <label>Priority<select name="priority"><option value="standard">Standard (24–48 hours)</option><option value="rush">Rush (needs production confirmation)</option><option value="urgent">Urgent (needs production confirmation)</option></select></label>
          <label class="form-grid__full">Email subject / reference<input name="emailReference" required placeholder="RE: Stickers and T-shirt Flex — Ocean Blue"></label>
        </div>
        <p class="form-error" data-wizard-error="1" role="alert"></p>
        <div class="wizard-actions"><span></span><button type="button" class="button button--primary" data-wizard-next="2">Next</button></div>
      </section>

      <section class="wizard-panel" data-wizard-panel="2" hidden>
        <div class="wizard-panel__heading"><span class="wizard-panel__eyebrow">Step 2</span><h2>Items &amp; Sizes</h2><p>Add each sticker design or T-shirt Flex design that belongs to this job. Every item keeps its own size, quantity and material.</p></div>
        <div class="job-items" data-job-items>
          ${renderJobItemRow('stickers', 1)}
        </div>
        <div class="job-item-add-actions" aria-label="Add items">
          <button type="button" class="button button--ghost" data-add-item="stickers">+ Add Sticker</button>
          <button type="button" class="button button--ghost" data-add-item="flex">+ Add T-shirt Flex</button>
        </div>
        <div class="machine-estimate-card" data-machine-estimate aria-live="polite">
          <span>Estimated machine time</span><strong>Enter size and quantity</strong><small>Print + cut estimate for all items, where applicable.</small>
        </div>
        <div class="material-summary">
          <span>Items in job</span><strong data-item-summary>1 item · Stickers</strong><small>Pricing is unchanged.</small>
        </div>
        <p class="form-error" data-wizard-error="2" role="alert"></p>
        <div class="wizard-actions"><button type="button" class="button button--ghost" data-wizard-back="1">Back</button><button type="button" class="button button--primary" data-wizard-next="3">Next</button></div>
      </section>

      <section class="wizard-panel" data-wizard-panel="3" hidden>
        <div class="wizard-panel__heading"><span class="wizard-panel__eyebrow">Step 3</span><h2>Review &amp; Submit</h2><p>Confirm the job details and every item before sending it to production.</p></div>
        <div class="review-grid">
          <div class="review-card"><span>Job summary</span><dl>
            <div><dt>Branch</dt><dd data-review="branch">—</dd></div>
            <div><dt>Customer</dt><dd data-review="customer">—</dd></div>
            <div><dt>Job contents</dt><dd data-review="type">—</dd></div>
            <div><dt>Priority</dt><dd data-review="priority">—</dd></div>
            <div><dt>Reference</dt><dd data-review="emailReference">—</dd></div>
          </dl></div>
          <div class="review-card review-card--items"><span>Items &amp; materials</span><div class="review-item-list" data-review-items><p>—</p></div></div>
        </div>
        <div class="machine-estimate-card machine-estimate-card--review" data-review-machine-estimate>
          <span>Estimated machine time</span><strong>—</strong><small>Print + cut only.</small>
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
