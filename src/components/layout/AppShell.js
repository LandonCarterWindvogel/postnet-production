// The signed-in app frame: PostNet-branded sidebar, top bar, and page content.

import { NAV_ITEMS } from '../../config.js';
import { NAV_ICONS } from '../../utils/constants.js';
import { POSTNET_COPY_PRINT_MARK } from '../../utils/brandAssets.js';
import { escapeHtml } from '../../utils/formatters.js';
import { isProduction } from '../../utils/helpers.js';

const CONNECTION_LABELS = {
  connected: 'Live database',
  connecting: 'Connecting…',
  disconnected: 'Offline'
};

function renderBrand() {
  return `<a class="brand" aria-label="PostNet Production Management System">
    <img class="brand__logo" src="${POSTNET_COPY_PRINT_MARK}" alt="PostNet Copy & Print">
    <span class="brand__system">Production<br>Management</span>
  </a>`;
}

export function renderAppShell({ profile, session, currentPage, content, connectionStatus, mobileNavOpen }) {
  let navItems = [...NAV_ITEMS];
  if (!isProduction(profile)) {
    navItems = [
      ['board', 'Production Board'],
      ['dashboard', 'Dashboard'],
      ...NAV_ITEMS.slice(1)
    ];
  }

  const nav = navItems.map(([id, label]) =>
    `<button class="nav-item ${currentPage === id ? 'active' : ''}" data-page="${id}" aria-current="${currentPage === id ? 'page' : 'false'}">
      <span class="nav-item__icon" aria-hidden="true">${NAV_ICONS[id] || ''}</span>
      <span>${label}</span>
    </button>`
  ).join('');

  const connectionLabel = CONNECTION_LABELS[connectionStatus] || CONNECTION_LABELS.disconnected;
  const connectionClass = connectionStatus === 'connected' ? 'connected' : '';
  const initials = (session.user.email || 'U').slice(0, 1).toUpperCase();

  return `<div class="app-shell">
      <aside class="sidebar ${mobileNavOpen ? 'sidebar--open' : ''}">
        ${renderBrand()}
        <nav class="sidebar__nav" aria-label="Main navigation">${nav}</nav>
        <div class="sidebar__footer">
          <div class="profile-chip">
            <span class="profile-chip__avatar">${initials}</span>
            <span class="profile-chip__copy">
              <strong>${escapeHtml(profile?.full_name || session.user.email)}</strong>
              <small>${isProduction(profile) ? 'Production Centre' : escapeHtml(profile?.branch || 'Branch')}</small>
            </span>
          </div>
        </div>
      </aside>
      ${mobileNavOpen ? '<div class="sidebar-backdrop" data-toggle-nav></div>' : ''}
      <main>
        <header class="topbar">
          <button class="menu-button" data-toggle-nav aria-label="Open menu">☰</button>
          <div class="topbar__context">
            <span class="topbar__label">PostNet Copy &amp; Print</span>
            <span class="connection ${connectionClass}"><i></i>${connectionLabel}</span>
          </div>
          <div class="user-menu">
            <span class="user-menu__avatar">${initials}</span>
            <div class="user-menu__copy"><strong>${escapeHtml(profile?.full_name || session.user.email)}</strong><small>${isProduction(profile) ? 'Production Centre' : escapeHtml(profile?.branch || '')}</small></div>
            <button data-signout>Sign out</button>
          </div>
        </header>
        <div class="content">${content}</div>
      </main>
    </div>`;
}
