import { estimateMachineMinutes, formatMachineTime } from '../utils/machineTime.js';

function renderEstimate(form) {
  const output = form?.querySelector('[data-machine-estimate]');
  if (!output) return;

  const type = form.querySelector('[name="type"]')?.value || 'stickers';
  const width = form.querySelector('[name="widthMm"]')?.value;
  const height = form.querySelector('[name="heightMm"]')?.value;
  const quantity = form.querySelector('[name="quantity"]')?.value;
  const minutes = estimateMachineMinutes({ type, width, height, quantity });

  output.innerHTML = minutes
    ? `<strong>≈ ${formatMachineTime(minutes)}</strong><small>Print + cut machine time only</small>`
    : `<strong>Enter size and quantity</strong><small>Estimate appears automatically</small>`;
}

export function installMachineEstimatorUi() {
  document.addEventListener('input', (event) => {
    if (event.target.closest('#job-form')) renderEstimate(event.target.closest('#job-form'));
  });

  document.addEventListener('change', (event) => {
    if (event.target.closest('#job-form')) renderEstimate(event.target.closest('#job-form'));
  });

  const observer = new MutationObserver(() => renderEstimate(document.getElementById('job-form')));
  observer.observe(document.body, { childList: true, subtree: true });
}
