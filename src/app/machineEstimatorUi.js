import { estimateMachineMinutes, formatMachineTime } from '../utils/machineTime.js';

function readEstimate(form) {
  const type = form.querySelector('[name="type"]')?.value || 'stickers';
  const width = Number(form.querySelector('[name="widthMm"]')?.value);
  const height = Number(form.querySelector('[name="heightMm"]')?.value);
  const quantity = Number(form.querySelector('[name="quantity"]')?.value);
  const minutes = estimateMachineMinutes({ type, width, height, quantity });

  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    const specification = form.querySelector('[name="specification"]');
    if (specification) specification.value = `${width} × ${height} mm`;

    const reviewSpecification = form.querySelector('[data-review="specification"]');
    if (reviewSpecification) reviewSpecification.textContent = `${width} × ${height} mm`;
  }

  return minutes;
}

function renderEstimate(form) {
  if (!form) return;
  const output = form.querySelector('[data-machine-estimate]');
  const reviewOutput = form.querySelector('[data-review-machine-estimate]');
  const minutes = readEstimate(form);

  if (output) {
    output.innerHTML = minutes
      ? `<span>Estimated machine time</span><strong>≈ ${formatMachineTime(minutes)}</strong><small>Print + cut only · excludes queue, drying, weeding, pressing and QC.</small>`
      : `<span>Estimated machine time</span><strong>Enter size and quantity</strong><small>Estimate appears automatically.</small>`;
  }

  if (reviewOutput) {
    reviewOutput.innerHTML = minutes
      ? `<span>Estimated machine time</span><strong>≈ ${formatMachineTime(minutes)}</strong><small>Print + cut only.</small>`
      : `<span>Estimated machine time</span><strong>—</strong><small>Enter valid size and quantity.</small>`;
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

  const observer = new MutationObserver(() => renderEstimate(document.getElementById('job-form')));
  observer.observe(document.body, { childList: true, subtree: true });
}
