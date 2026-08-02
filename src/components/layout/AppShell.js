// The signed-in app frame: sidebar nav, top bar, and a slot for whichever
// page router.js decided to render.

import { NAV_ITEMS } from '../../config.js';
import { NAV_ICONS } from '../../utils/constants.js';
import { escapeHtml } from '../../utils/formatters.js';
import { isProduction } from '../../utils/helpers.js';

const CONNECTION_LABELS = {
  connected: 'Live database',
  connecting: 'Connecting…',
  disconnected: 'Offline'
};

export function renderAppShell({ profile, session, currentPage, content, connectionStatus, mobileNavOpen }) {
  const nav = NAV_ITEMS.map(([id, label]) =>
    `<button class="nav-item ${currentPage === id ? 'active' : ''}" data-page="${id}"><span>${NAV_ICONS[id]}</span>${label}</button>`
  ).join('');

  const connectionLabel = CONNECTION_LABELS[connectionStatus] || CONNECTION_LABELS.disconnected;
  const connectionClass = connectionStatus === 'connected' ? 'connected' : '';

  return `<div class="app-shell">
      <aside class="sidebar ${mobileNavOpen ? 'sidebar--open' : ''}">
        <a class="brand"><span>PN</span><b>PostNet<br>Production</b></a>
        <nav>${nav}</nav>
        <div class="sidebar-footer">
          <small>${isProduction(profile) ? 'Production Centre' : 'Branch'}</small>
          <strong>${escapeHtml(profile?.branch)}</strong>
        </div>
      </aside>
      ${mobileNavOpen ? '<div class="sidebar-backdrop" data-toggle-nav></div>' : ''}
      <main>
        <header class="topbar">
          <button class="menu-button" data-toggle-nav aria-label="Open menu">☰</button>
          <div class="connection ${connectionClass}"><i></i>${connectionLabel}</div>
          <div class="user-menu"><span>${escapeHtml(session.user.email.slice(0, 1).toUpperCase())}</span><button data-signout>Sign out</button></div>
        </header>
        <div class="content">${content}</div>
      </main>
    </div>`;
}
