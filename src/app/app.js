// Application entry point: wires together state, stores, router and the
// DOM. main.js just calls initApp() — this is where everything lives now
// that Sprint 3 has split the old single-file main.js into modules.

import { MATERIALS } from '../utils/constants.js';
import { validateJobForm } from '../utils/validators.js';
import { renderAppShell } from '../components/layout/AppShell.js';
import { renderLoginView } from '../components/auth/LoginView.js';
import { renderPage } from './router.js';
import { getUiState, setPage, selectJob, subscribeUi } from './state.js';
import { getAuthState, loadSession, signIn, signOut, subscribeAuth } from '../stores/authStore.js';
import {
  getJobState,
  refreshJobs,
  createJob,
  advanceJob,
  clearJobs,
  setJobsError,
  subscribeJobs
} from '../stores/jobStore.js';

let appEl;

function render() {
  const ui = getUiState();
  const auth = getAuthState();
  const jobState = getJobState();

  if (!auth.session) {
    appEl.innerHTML = renderLoginView();
    return;
  }

  const content = renderPage(ui.page, {
    jobs: jobState.jobs,
    profile: auth.profile,
    error: jobState.error,
    selectedId: ui.selectedId
  });

  appEl.innerHTML = renderAppShell({
    profile: auth.profile,
    session: auth.session,
    currentPage: ui.page,
    content
  });
}

function bindEvents() {
  appEl.addEventListener('click', async (event) => {
    const pageButton = event.target.closest('[data-page]');
    if (pageButton) setPage(pageButton.dataset.page);

    const openJob = event.target.closest('[data-open-job]');
    if (openJob) selectJob(openJob.dataset.openJob);

    if (event.target.closest('[data-signout]')) {
      await signOut();
      clearJobs();
      setPage('board');
    }

    const advanceButton = event.target.closest('[data-advance]');
    if (advanceButton) {
      const job = getJobState().jobs.find((item) => item.id === advanceButton.dataset.advance);
      try {
        await advanceJob(job, getAuthState().session.user.id);
      } catch (error) {
        setJobsError(error.message);
      }
    }
  });

  appEl.addEventListener('change', (event) => {
    if (event.target.id === 'job-type') {
      const materialSelect = document.querySelector('#material');
      materialSelect.innerHTML = MATERIALS[event.target.value]
        .map((value) => `<option>${value}</option>`)
        .join('');
    }
  });

  appEl.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (event.target.id === 'login-form') {
      const form = new FormData(event.target);
      const messageEl = event.target.querySelector('.form-error');
      try {
        await signIn(form.get('email'), form.get('password'));
        await refreshJobs();
      } catch (error) {
        messageEl.textContent = error.message;
      }
      return;
    }

    if (event.target.id === 'job-form') {
      const form = new FormData(event.target);
      const messageEl = event.target.querySelector('.form-error');
      const values = {
        customer: form.get('customer'),
        emailReference: form.get('emailReference'),
        specification: form.get('specification'),
        quantity: form.get('quantity')
      };

      const errors = validateJobForm(values);
      if (errors.length) {
        messageEl.textContent = errors[0];
        return;
      }

      try {
        const job = await createJob({
          branch: form.get('branch'),
          customer_name: form.get('customer'),
          email_reference: form.get('emailReference'),
          job_type: form.get('type'),
          material: form.get('material'),
          specification: form.get('specification'),
          quantity: Number(form.get('quantity')),
          priority: form.get('priority'),
          cutlines_included: form.get('cutlines') === 'on',
          artwork_checklist_complete: true,
          created_by: getAuthState().session.user.id
        });
        selectJob(job.id);
      } catch (error) {
        messageEl.textContent = error.message;
      }
    }
  });
}

export async function initApp() {
  appEl = document.querySelector('#app');

  subscribeUi(render);
  subscribeAuth(render);
  subscribeJobs(render);

  bindEvents();

  await loadSession();
  if (getAuthState().session) await refreshJobs();
  render();
}
