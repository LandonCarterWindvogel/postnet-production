// The signed-in app frame: sidebar nav, top bar, and a slot for whichever
// page router.js decided to render.

import { NAV_ITEMS } from '../../config.js';
import { NAV_ICONS } from '../../utils/constants.js';
import { escapeHtml } from '../../utils/formatters.js';
import { isProduction } from '../../utils/helpers.js';

export function renderAppShell({ profile, session, currentPage, content }) {
  const nav = NAV_ITEMS.map(([id, label]) =>
    `<button class="nav-item ${currentPage === id ? 'active' : ''}" data-page="${id}"><span>${NAV_ICONS[id]}</span>${label}</button>`
  ).join('');

  return `<div class="app-shell">
      <aside class="sidebar">
        <a class="brand"><span>PN</span><b>PostNet<br>Production</b></a>
        <nav>${nav}</nav>
        <div class="sidebar-footer">
          <small>${isProduction(profile) ? 'Production Centre' : 'Branch'}</small>
          <strong>${escapeHtml(profile?.branch)}</strong>
        </div>
      </aside>
      <main>
        <header class="topbar">
          <div class="connection connected"><i></i>Live database</div>
          <div class="user-menu"><span>${session.user.email.slice(0, 1).toUpperCase()}</span><button data-signout>Sign out</button></div>
        </header>
        <div class="content">${content}</div>
      </main>
    </div>`;
}
