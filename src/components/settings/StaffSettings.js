import { escapeHtml } from '../../utils/formatters.js';
import { BRANCHES, ROLE_LABELS } from '../../utils/constants.js';
import { isProduction } from '../../utils/helpers.js';

function branchOptions(selected) {
  return BRANCHES.map((value) => `<option ${value === selected ? 'selected' : ''}>${value}</option>`).join('');
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
      <p>ID ${member.id.slice(0, 8)}…</p>
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
  <p class="notice">To change your name, branch, or role, ask someone at the production centre — they can update it from their own Settings page.</p>`;
}

export function renderSettings({ staff, profile, error }) {
  const canManage = isProduction(profile);

  return `<section class="page-heading">
      <div><p class="eyebrow">Staff</p><h1>Settings</h1><p>${canManage ? 'Manage who has access and what they can do.' : 'Your account details.'}</p></div>
    </section>
    ${error ? `<p class="form-error">${escapeHtml(error)}</p>` : ''}
    <section class="staff-list">
      ${canManage
        ? (staff.map(staffRow).join('') || '<p class="empty">No staff found.</p>')
        : staff.map(ownProfileCard).join('')}
    </section>`;
}
