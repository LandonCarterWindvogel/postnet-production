import { escapeHtml } from '../../utils/formatters.js';
import { isProduction } from '../../utils/helpers.js';

const CATEGORY_LABELS = { stickers: 'Stickers Materials', flex: 'T-Shirt Flex Materials' };

function statusFor(item) {
  if (item.quantity_on_hand <= 0) return 'Critical';
  if (item.quantity_on_hand <= item.low_stock_threshold) return 'Low';
  return 'Good';
}

function stockRow(item, canEdit) {
  const isLow = item.quantity_on_hand <= item.low_stock_threshold;
  const status = statusFor(item);
  return `<article class="stock-row ${isLow ? 'stock-row--low' : ''}">
    <div class="stock-row__info">
      <h3>${escapeHtml(item.material)}</h3>
      <p>Measured in kilograms (kg) · Updated by production</p>
    </div>
    <div class="stock-row__numbers">
      <div><span>On hand</span><strong>${Number(item.quantity_on_hand).toFixed(1)} kg</strong></div>
      <div><span>Low stock at</span><strong>${Number(item.low_stock_threshold).toFixed(1)} kg</strong></div>
      <span class="stock-status stock-status--${status.toLowerCase()}">${status}</span>
    </div>
    ${canEdit ? `<form class="stock-row__form" data-stock-id="${item.id}">
      <label>Quantity (kg)<input name="quantityOnHand" type="number" min="0" step="0.1" value="${item.quantity_on_hand}" required></label>
      <label>Low-stock at (kg)<input name="lowStockThreshold" type="number" min="0" step="0.1" value="${item.low_stock_threshold}" required></label>
      <button class="button">Update</button>
    </form>` : ''}
  </article>`;
}

export function renderStock({ items, profile, error }) {
  const canEdit = isProduction(profile);
  const categories = ['stickers', 'flex'];

  const sections = categories.map((category) => {
    const categoryItems = items.filter((item) => item.category === category);
    if (!categoryItems.length) return '';
    return `<section class="stock-section">
      <div class="stock-section__heading"><div><span class="eyebrow">Materials</span><h2>${CATEGORY_LABELS[category]}</h2></div><span class="stock-section__unit">All weight is measured in kg</span></div>
      <div class="stock-list">${categoryItems.map((item) => stockRow(item, canEdit)).join('')}</div>
    </section>`;
  }).join('');

  return `<section class="page-heading">
      <div><p class="eyebrow">Materials control</p><h1>Stock</h1><p>${canEdit ? 'Update material levels as stock arrives or is used.' : 'Current material levels at the production centre.'}</p></div>
    </section>
    ${error ? `<p class="form-error form-error--banner">${escapeHtml(error)}</p>` : ''}
    ${sections || '<p class="empty-state">No stock items yet.</p>'}`;
}
