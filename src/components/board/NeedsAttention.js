// Renders a summary of items needing attention: overdue, urgent, returned, low stock.

import { escapeHtml } from '../../utils/formatters.js';

export function renderNeedsAttention({ overdue = 0, urgent = 0, returned = 0, ready = 0 }) {
  const items = [];
  if (overdue > 0) items.push(`<span><strong>${overdue}</strong> overdue</span>`);
  if (urgent > 0) items.push(`<span><strong>${urgent}</strong> urgent</span>`);
  if (returned > 0) items.push(`<span><strong>${returned}</strong> returned for correction</span>`);
  if (ready > 0) items.push(`<span><strong>${ready}</strong> ready for collection</span>`);

  if (items.length === 0) return '';

  return `<section class="needs-attention">
    <h3>Needs Attention</h3>
    <div>${items.join(' · ')}</div>
  </section>`;
}