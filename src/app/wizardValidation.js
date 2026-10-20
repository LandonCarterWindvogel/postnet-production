// Captures wizard navigation before the app's generic click handler can move
// to the next panel. This prevents hidden required fields from being skipped
// and keeps validation focused on the step the operator is actually completing.

const FIELD_MESSAGES = {
  customer: 'Enter the customer name.',
  emailReference: 'Enter the email subject or reference.',
  widthMm: 'Enter the width in millimetres.',
  heightMm: 'Enter the height in millimetres.',
  quantity: 'Enter a quantity of at least 1.'
};

function showStepError(form, step, message, fieldName) {
  const error = form.querySelector(`[data-wizard-error="${step}"]`);
  if (error) error.textContent = message;

  const field = fieldName ? form.elements[fieldName] : null;
  if (field) {
    field.setAttribute('aria-invalid', 'true');
    field.focus({ preventScroll: false });
  }
}

function clearStepError(form, step) {
  const error = form.querySelector(`[data-wizard-error="${step}"]`);
  if (error) error.textContent = '';

  form.querySelectorAll('[aria-invalid="true"]').forEach((field) => {
    field.removeAttribute('aria-invalid');
  });
}

function positiveNumber(form, name) {
  const value = Number(form.elements[name]?.value);
  return Number.isFinite(value) && value > 0;
}

function validateStep(form, step) {
  clearStepError(form, step);

  if (step === 1) {
    for (const name of ['customer', 'emailReference']) {
      if (!String(form.elements[name]?.value || '').trim()) {
        showStepError(form, step, FIELD_MESSAGES[name], name);
        return false;
      }
    }
  }

  if (step === 2) {
    const rows = [...form.querySelectorAll('[data-item-row]')];
    if (!rows.length) {
      showStepError(form, step, 'Add at least one sticker or T-shirt Flex item.');
      return false;
    }

    for (const [index, row] of rows.entries()) {
      const name = row.querySelector('[data-item-field="name"]');
      const width = row.querySelector('[data-item-field="width_mm"]');
      const height = row.querySelector('[data-item-field="height_mm"]');
      const quantity = row.querySelector('[data-item-field="quantity"]');
      const material = row.querySelector('[data-item-field="material"]');
      if (!name?.value.trim()) {
        showStepError(form, step, `Enter a name for item ${index + 1}.`);
        name?.focus();
        return false;
      }
      if (!Number.isFinite(Number(width?.value)) || Number(width?.value) <= 0) {
        showStepError(form, step, `Enter a valid width for item ${index + 1}.`);
        width?.focus();
        return false;
      }
      if (!Number.isFinite(Number(height?.value)) || Number(height?.value) <= 0) {
        showStepError(form, step, `Enter a valid height for item ${index + 1}.`);
        height?.focus();
        return false;
      }
      if (!Number.isInteger(Number(quantity?.value)) || Number(quantity?.value) < 1) {
        showStepError(form, step, `Enter a quantity of at least 1 for item ${index + 1}.`);
        quantity?.focus();
        return false;
      }
      if (!material?.value) {
        showStepError(form, step, `Choose a material for item ${index + 1}.`);
        material?.focus();
        return false;
      }
    }
  }

  if (step === 1 && form.elements.fulfillmentMethod?.value === 'delivery') {
    const address = form.elements.deliveryAddress;
    if (!String(address?.value || '').trim() || String(address.value).trim().length < 5) {
      showStepError(form, step, 'Enter a delivery address of at least 5 characters.', 'deliveryAddress');
      return false;
    }
  }

  return true;
}

export function installWizardValidation() {
  document.addEventListener('click', (event) => {
    const nextButton = event.target.closest('[data-wizard-next]');
    if (!nextButton) return;

    const form = nextButton.closest('#job-form');
    if (!form) return;

    const currentPanel = form.querySelector('.wizard-panel:not([hidden])');
    const currentStep = Number(currentPanel?.dataset.wizardPanel || 0);

    if (!validateStep(form, currentStep)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }, true);
}
