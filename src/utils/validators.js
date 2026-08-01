// Friendly, inline validation for the New Job form, run before we hit
// Supabase. The database still enforces its own check constraints — this
// just gives the person a clearer error than a raw Postgres message.

export function validateJobForm(values) {
  const errors = [];

  if (!values.customer || values.customer.trim().length < 2) {
    errors.push('Enter the customer name.');
  }
  if (!values.emailReference || values.emailReference.trim().length < 3) {
    errors.push('Enter the email subject or reference.');
  }
  if (!values.specification || values.specification.trim().length < 2) {
    errors.push('Enter a size or placement.');
  }

  const quantity = Number(values.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) {
    errors.push('Quantity must be a whole number of at least 1.');
  }

  return errors;
}
