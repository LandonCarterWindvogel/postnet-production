import './styles.css';
import { APP_NAME, NAV_ITEMS } from './config.js';
import { sampleJobs } from './data/sample-jobs.js';
import { getSession, signIn, signOut } from './services/auth.js';
import { isSupabaseConfigured } from './services/supabase.js';

const state = { session: null, page: 'board' };
const app = document.querySelector('#app');

const icon = (name) => ({ board: '▦', 'new-job': '+', 'my-jobs': '◷', stock: '◫', settings: '⚙' }[name]);

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function jobCard(job) {
  return `<article class="job-card ${job.priority.toLowerCase()}">
    <div class="job-card__top"><span class="job-id">${job.id}</span><span class="priority">${job.priority}</span></div>
    <h3>${escapeHtml(job.customer)}</h3><p class="branch">${escapeHtml(job.branch)} · ${job.type === 'flex' ? 'T-shirt Flex' : 'Stickers'}</p>
    <dl><div><dt>Material</dt><dd>${escapeHtml(job.material)}</dd></div><div><dt>Specification</dt><dd>${escapeHtml(job.sizes)}</dd></div></dl>
    <div class="job-card__next"><span>Next</span><strong>${job.next}</strong><time>Received ${job.received}</time></div>
  </article>`;
}

function board() {
  const statuses = ['Queued', 'Printing', 'Drying', 'Weeding', 'Quality Check', 'Ready'];
  return `<section class="page-heading"><div><p class="eyebrow">Production centre</p><h1>Production Board</h1><p>See what needs attention now and move jobs through production.</p></div><button class="button button--primary" data-page="new-job">+ New job</button></section>
  <section class="overview"><article><span>Active jobs</span><strong>${sampleJobs.length}</strong><small>Across all production stages</small></article><article><span>Urgent</span><strong>1</strong><small>Needs attention first</small></article><article><span>Ready today</span><strong>0</strong><small>Awaiting collection</small></article><article class="machine"><span>Roland BN-20</span><strong><i></i> Printing</strong><small>Ocean Blue · Gloss Vinyl</small></article></section>
  <section class="board" aria-label="Production jobs">${statuses.map((status) => `<div class="board-column"><header><h2>${status}</h2><span>${sampleJobs.filter((job) => job.status === status).length}</span></header><div class="job-list">${sampleJobs.filter((job) => job.status === status).map(jobCard).join('') || '<p class="empty">No jobs here</p>'}</div></div>`).join('')}</section>`;
}

function newJob() {
  return `<section class="page-heading"><div><p class="eyebrow">Production intake</p><h1>New Job</h1><p>Record the email reference and production requirements. Artwork remains in email.</p></div></section>
  <form class="job-form" id="job-form"><fieldset><legend>Job details</legend><label>Branch<select required><option>Plettenberg Bay</option><option>Knysna</option><option>Waterside</option><option>Sedgefield</option></select></label><label>Customer name<input required name="customer" autocomplete="organization" /></label><label>Priority<select name="priority"><option>Standard</option><option>Rush</option><option>Urgent</option></select></label><label>Email subject / reference<input required name="emailReference" placeholder="RE: Sticker order — Ocean Blue" /></label></fieldset><fieldset><legend>Production requirements</legend><label>Job type<select name="type" id="job-type"><option value="stickers">Stickers</option><option value="flex">T-shirt Flex</option></select></label><label>Material<select name="material" id="material"><option>Gloss Vinyl</option><option>Matte Vinyl</option><option>Clear Vinyl</option><option>Contravision</option></select></label><label>Size / placement<input required name="size" placeholder="e.g. 90 × 50 mm or front chest" /></label><label>Quantity<input required type="number" min="1" name="quantity" /></label></fieldset><fieldset><legend>Artwork checklist</legend><label class="check"><input required type="checkbox" /> PDF or CDR file received by email</label><label class="check"><input required type="checkbox" /> Artwork is print-ready and correct size</label><label class="check"><input required type="checkbox" /> Customer approved artwork</label><label class="check"><input type="checkbox" /> Cutlines included (leave clear if not required)</label></fieldset><div class="form-actions"><button class="button button--primary">Submit to incoming jobs</button></div></form>`;
}

function simplePage(title, text) { return `<section class="page-heading"><div><p class="eyebrow">Sprint 1 foundation</p><h1>${title}</h1><p>${text}</p></div></section><section class="empty-state"><h2>Ready for the next sprint</h2><p>This screen is part of the application shell. Its working data view arrives with the relevant module.</p></section>`; }

function layout(content) {
  const nav = NAV_ITEMS.map(([id, label]) => `<button class="nav-item ${state.page === id ? 'active' : ''}" data-page="${id}"><span>${icon(id)}</span>${label}</button>`).join('');
  return `<div class="app-shell"><aside class="sidebar"><a class="brand" href="#"><span>PN</span><b>PostNet<br/>Production</b></a><nav>${nav}</nav><div class="sidebar-footer"><small>Production Centre</small><strong>Plettenberg Bay</strong></div></aside><main><header class="topbar"><button class="menu-button" aria-label="Open menu">☰</button><div class="connection ${isSupabaseConfigured ? 'connected' : ''}"><i></i>${isSupabaseConfigured ? 'Connected' : 'Set up required'}</div><div class="user-menu"><span>${state.session?.user.email?.slice(0, 1).toUpperCase() || 'P'}</span><button data-action="signout">${state.session ? 'Sign out' : 'Sign in'}</button></div></header><div class="content">${content}</div></main></div>`;
}

function login() { return `<main class="login"><section><a class="brand brand--dark" href="#"><span>PN</span><b>PostNet<br/>Production</b></a><p class="eyebrow">Production workflow management</p><h1>Welcome back</h1><p>Sign in to manage work across the production centre and branches.</p>${!isSupabaseConfigured ? '<div class="notice">Supabase is not connected yet. Add the project values to <code>.env</code>, then restart the app.</div>' : ''}<form id="login-form"><label>Work email<input name="email" type="email" required autocomplete="email" /></label><label>Password<input name="password" type="password" required autocomplete="current-password" /></label><p class="form-error" role="alert"></p><button class="button button--primary" ${!isSupabaseConfigured ? 'disabled' : ''}>Sign in</button></form></section><aside><p>Built for the production centre.</p><h2>Know the next job, its exact requirements, and where every job is in the process.</h2><ul><li>Sticker and T-shirt flex workflows</li><li>Artwork references without file uploads</li><li>Clear job status from intake to collection</li></ul></aside></main>`; }

function render() {
  if (!state.session) { app.innerHTML = login(); return; }
  const views = { board, 'new-job': newJob, 'my-jobs': () => simplePage('My Jobs', 'Your submitted and assigned jobs will be available here.'), stock: () => simplePage('Stock', 'Material stock and low-stock alerts are planned for Sprint 3.'), settings: () => simplePage('Settings', 'Branch, team, and account settings will be managed here.') };
  app.innerHTML = layout(views[state.page]());
}

app.addEventListener('click', async (event) => {
  const page = event.target.closest('[data-page]')?.dataset.page;
  if (page) { state.page = page; render(); }
  if (event.target.closest('[data-action="signout"]')) { await signOut(); state.session = null; render(); }
});

app.addEventListener('submit', async (event) => {
  if (event.target.id === 'login-form') { event.preventDefault(); const form = new FormData(event.target); const error = event.target.querySelector('.form-error'); error.textContent = ''; try { await signIn(form.get('email'), form.get('password')); state.session = await getSession(); render(); } catch (err) { error.textContent = err.message; } }
  if (event.target.id === 'job-form') { event.preventDefault(); alert('Job capture is ready. Database persistence is connected in Sprint 2.'); }
});

app.addEventListener('change', (event) => { if (event.target.id === 'job-type') { const material = document.querySelector('#material'); material.innerHTML = event.target.value === 'flex' ? '<option>White Flex</option><option>Gold Flex</option><option>Silver Flex</option>' : '<option>Gloss Vinyl</option><option>Matte Vinyl</option><option>Clear Vinyl</option><option>Contravision</option>'; } });

state.session = await getSession();
render();
