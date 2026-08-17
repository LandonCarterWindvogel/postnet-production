// Captures wizard navigation before the app's generic click handler can move
// to the next panel. This prevents hidden required fields from being skipped
// and keeps validation focused on the step the operator is actually completing.

const FIELD_MESSAGES = {
  customer: 'Enter the customer name.',
  emailReference: 'Enter the email subject or reference.',
  specification: 'Enter a size or placement.',
  quantity: 'Enter a quantity of at least 1.'
};

function fieldValue(form, name) {
  return String(form.elements[name]?.value || '').trim();
}

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

function validateStep(form, step) {
  clearStepError(form, step);

  if (step === 1) {
    for (const name of ['customer', 'emailReference']) {
      if (!fieldValue(form, name)) {
        showStepError(form, step, FIELD_MESSAGES[name], name);
        return false;
      }
    }
  }

  if (step === 2) {
    const specification = fieldValue(form, 'specification');
    if (!specification) {
      showStepError(form, step, FIELD_MESSAGES.specification, 'specification');
      return false;
    }

    const quantity = Number(form.elements.quantity?.value);
    if (!Number.isInteger(quantity) || quantity < 1) {
      showStepError(form, step, FIELD_MESSAGES.quantity, 'quantity');
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
