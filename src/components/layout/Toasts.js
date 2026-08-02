import { escapeHtml } from '../../utils/formatters.js';

export function renderToasts(toasts) {
  if (!toasts.length) return '';
  return `<div class="toast-stack">${toasts
    .map((toast) => `<div class="toast" data-dismiss-toast="${toast.id}">${escapeHtml(toast.message)}</div>`)
    .join('')}</div>`;
}
