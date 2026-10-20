import { estimateMachineMinutes, formatMachineTime } from '../utils/machineTime.js';

function readItems(form) {
  return [...form.querySelectorAll('[data-item-row]')].map((row) => ({
    type: row.querySelector('[data-item-field="type"]')?.value || 'stickers',
    width: Number(row.querySelector('[data-item-field="width_mm"]')?.value),
    height: Number(row.querySelector('[data-item-field="height_mm"]')?.value),
    quantity: Number(row.querySelector('[data-item-field="quantity"]')?.value)
  }));
}

function estimateAllItems(form) {
  const items = readItems(form);
  if (!items.length) return null;

  const estimates = items.map((item) => estimateMachineMinutes(item));
  // Avoid showing a partial estimate while any item is still incomplete.
  if (estimates.some((minutes) => !Number.isFinite(minutes))) return null;
  return estimates.reduce((total, minutes) => total + minutes, 0);
}

function renderEstimate(form) {
  if (!form) return;
  const output = form.querySelector('[data-machine-estimate]');
  const reviewOutput = form.querySelector('[data-review-machine-estimate]');
  const items = readItems(form);
  const minutes = estimateAllItems(form);
  const itemCount = items.length;
  const description = itemCount > 1
    ? `Combined estimate for ${itemCount} items · print + cut only; excludes queue, drying, weeding, pressing and QC.`
    : 'Print + cut only · excludes queue, drying, weeding, pressing and QC.';

  if (output) {
    output.innerHTML = minutes !== null
      ? `<span>Estimated machine time</span><strong>≈ ${formatMachineTime(minutes)}</strong><small>${description}</small>`
      : `<span>Estimated machine time</span><strong>Enter size and quantity for each item</strong><small>Estimate appears once every item has valid dimensions and quantity.</small>`;
  }

  if (reviewOutput) {
    reviewOutput.innerHTML = minutes !== null
      ? `<span>Estimated machine time</span><strong>≈ ${formatMachineTime(minutes)}</strong><small>Combined estimate for all ${itemCount} item${itemCount === 1 ? '' : 's'} · print + cut only.</small>`
      : `<span>Estimated machine time</span><strong>—</strong><small>Enter valid size and quantity for every item.</small>`;
  }
}

export function installMachineEstimatorUi() {
  document.addEventListener('input', (event) => {
    const form = event.target.closest('#job-form');
    if (form) renderEstimate(form);
  });

  document.addEventListener('change', (event) => {
    const form = event.target.closest('#job-form');
    if (form) renderEstimate(form);
  });
}
