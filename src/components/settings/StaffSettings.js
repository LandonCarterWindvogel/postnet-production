import { escapeHtml } from '../../utils/formatters.js';
import { BRANCHES, ROLE_LABELS } from '../../utils/constants.js';
import { isProduction } from '../../utils/helpers.js';

function branchOptions(selected) {
  return BRANCHES.map((value) => `<option ${value === selected ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('');
}

function roleOptions(selected) {
  return Object.entries(ROLE_LABELS)
    .map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`)
    .join('');
}

function staffRow(member) {
  return `<article class="staff-row">
    <div class="staff-row__info">
      <h3>${escapeHtml(member.full_name)}</h3>
      <p>${escapeHtml(member.branch)} · ${ROLE_LABELS[member.role] || member.role}</p>
    </div>
    <form class="staff-row__form" data-staff-id="${member.id}">
      <label>Name<input name="fullName" value="${escapeHtml(member.full_name)}" required></label>
      <label>Branch<select name="branch">${branchOptions(member.branch)}</select></label>
      <label>Role<select name="role">${roleOptions(member.role)}</select></label>
      <button class="button">Save</button>
    </form>
  </article>`;
}

function ownProfileCard(member) {
  return `<article class="staff-row">
    <div class="staff-row__info">
      <h3>${escapeHtml(member.full_name)}</h3>
      <p>${escapeHtml(member.branch)} · ${ROLE_LABELS[member.role] || member.role}</p>
    </div>
  </article>
  <p class="notice">To change your name, branch, or role, ask someone at the production centre.</p>`;
}

function storeOverview() {
  return `<section class="settings-section">
    <div class="settings-section__heading"><div><span class="eyebrow">PostNet stores</span><h2>Branches</h2></div><span>Available for job routing and staff assignment</span></div>
    <div class="store-grid">
      ${BRANCHES.map((branch, index) => `<article class="store-card"><div class="store-card__badge">${String(index + 1).padStart(2, '0')}</div><div><strong>${escapeHtml(branch)}</strong><small>Active production branch</small></div><span class="store-card__status">Active</span></article>`).join('')}
    </div>
  </section>`;
}

export function renderSettings({ staff, profile, error }) {
  const canManage = isProduction(profile);

  return `<section class="page-heading">
      <div><p class="eyebrow">Administration</p><h1>Settings</h1><p>${canManage ? 'Manage operators and the stores available to the production workflow.' : 'Your account details.'}</p></div>
    </section>
    ${error ? `<p class="form-error form-error--banner">${escapeHtml(error)}</p>` : ''}
    ${storeOverview()}
    <section class="settings-section">
      <div class="settings-section__heading"><div><span class="eyebrow">Access</span><h2>Operators</h2></div><span>${canManage ? 'Production can update branch and role assignments.' : 'Your current account.'}</span></div>
      <section class="staff-list">
        ${canManage
          ? (staff.map(staffRow).join('') || '<p class="empty">No staff found.</p>')
          : staff.map(ownProfileCard).join('')}
      </section>
    </section>`;
}
