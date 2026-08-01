// Renders the New Job intake form. Material options depend on job type,
// so app.js listens for a change event on #job-type and re-fills #material
// using materialOptions() below.

import { BRANCHES, MATERIALS } from '../../utils/constants.js';
import { escapeHtml } from '../../utils/formatters.js';
import { isProduction } from '../../utils/helpers.js';

export function materialOptions(type) {
  return MATERIALS[type].map((value) => `<option>${value}</option>`).join('');
}

export function renderNewJobForm(profile) {
  const branchField = isProduction(profile)
    ? `<select name="branch">${BRANCHES.map((value) => `<option ${value === profile.branch ? 'selected' : ''}>${value}</option>`).join('')}</select>`
    : `<input value="${escapeHtml(profile.branch)}" disabled><input type="hidden" name="branch" value="${escapeHtml(profile.branch)}">`;

  return `<section class="page-heading">
      <div><p class="eyebrow">Production intake</p><h1>New Job</h1><p>Artwork stays in email; this records production requirements.</p></div>
    </section>
    <form class="job-form" id="job-form">
      <fieldset>
        <legend>Job details</legend>
        <label>Branch${branchField}</label>
        <label>Customer name<input name="customer" required></label>
        <label>Priority<select name="priority"><option value="standard">Standard</option><option value="rush">Rush</option><option value="urgent">Urgent</option></select></label>
        <label>Email subject / reference<input name="emailReference" required placeholder="RE: Sticker order — Ocean Blue"></label>
      </fieldset>
      <fieldset>
        <legend>Production requirements</legend>
        <label>Job type<select name="type" id="job-type"><option value="stickers">Stickers</option><option value="flex">T-shirt Flex</option></select></label>
        <label>Material<select name="material" id="material">${materialOptions('stickers')}</select></label>
        <label>Size / placement<input name="specification" required placeholder="90 × 50 mm or front chest"></label>
        <label>Quantity<input name="quantity" type="number" min="1" required></label>
      </fieldset>
      <fieldset>
        <legend>Artwork checklist</legend>
        <label class="check"><input required type="checkbox"> PDF or CDR received by email</label>
        <label class="check"><input required type="checkbox"> Artwork is print-ready and correct size</label>
        <label class="check"><input required type="checkbox"> Customer approved artwork</label>
        <label class="check"><input name="cutlines" type="checkbox"> Cutlines included</label>
      </fieldset>
      <p class="form-error"></p>
      <div class="form-actions"><button class="button button--primary">Submit to incoming jobs</button></div>
    </form>`;
}
