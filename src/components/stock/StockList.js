import { escapeHtml } from '../../utils/formatters.js';
import { isProduction } from '../../utils/helpers.js';

const CATEGORY_LABELS = { stickers: 'Stickers', flex: 'T-shirt Flex' };

function stockRow(item, canEdit) {
  const isLow = item.quantity_on_hand <= item.low_stock_threshold;

  return `<article class="stock-row ${isLow ? 'stock-row--low' : ''}">
    <div class="stock-row__info">
      <h3>${escapeHtml(item.material)}</h3>
      <p>${item.quantity_on_hand} ${escapeHtml(item.unit)} on hand${isLow ? ' · Low stock' : ''}</p>
    </div>
    ${canEdit ? `<form class="stock-row__form" data-stock-id="${item.id}">
      <label>Quantity<input name="quantityOnHand" type="number" min="0" step="0.5" value="${item.quantity_on_hand}" required></label>
      <label>Low-stock at<input name="lowStockThreshold" type="number" min="0" step="0.5" value="${item.low_stock_threshold}" required></label>
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
      <h2>${CATEGORY_LABELS[category]}</h2>
      <div class="stock-list">${categoryItems.map((item) => stockRow(item, canEdit)).join('')}</div>
    </section>`;
  }).join('');

  return `<section class="page-heading">
      <div><p class="eyebrow">Materials</p><h1>Stock</h1><p>${canEdit ? 'Update levels as materials arrive or get used up.' : 'Current material levels at the production centre.'}</p></div>
    </section>
    ${error ? `<p class="form-error">${escapeHtml(error)}</p>` : ''}
    ${sections || '<p class="empty">No stock items yet.</p>'}`;
}
