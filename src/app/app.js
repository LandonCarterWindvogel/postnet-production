// Application entry point: wires together state, stores, router and the
// DOM. main.js just calls initApp() — this is where everything lives now
// that Sprint 3 has split the old single-file main.js into modules.

import { MATERIALS } from '../utils/constants.js';
import { validateJobForm } from '../utils/validators.js';
import { isProduction } from '../utils/helpers.js';
import { renderAppShell } from '../components/layout/AppShell.js';
import { renderLoginView } from '../components/auth/LoginView.js';
import { renderToasts } from '../components/layout/Toasts.js';
import { renderPage } from './router.js';
import { getUiState, setPage, selectJob, subscribeUi, pushToast, dismissToast, toggleMobileNav } from './state.js';
import { getAuthState, loadSession, signIn, signOut, subscribeAuth } from '../stores/authStore.js';
import {
  getJobState,
  refreshJobs,
  createJob,
  advanceJob,
  rejectJob,
  clearJobs,
  setJobsError,
  subscribeJobs,
  subscribeJobEvents,
  startRealtime,
  stopRealtime,
  getConnectionStatus,
  subscribeConnection
} from '../stores/jobStore.js';
import {
  getStockState,
  refreshStock,
  updateStock,
  clearStock,
  setStockError,
  subscribeStock,
  startStockRealtime,
  stopStockRealtime
} from '../stores/stockStore.js';
import {
  getStaffState,
  refreshStaff,
  updateStaff,
  clearStaff,
  setStaffError,
  subscribeStaff
} from '../stores/staffStore.js';

let appEl;

function render() {
  const ui = getUiState();
  const auth = getAuthState();
  const jobState = getJobState();

  if (!auth.session) {
    appEl.innerHTML = renderLoginView() + renderToasts(ui.toasts);
    return;
  }

  const content = renderPage(ui.page, {
    jobs: jobState.jobs,
    profile: auth.profile,
    error: jobState.error,
    selectedId: ui.selectedId,
    userId: auth.session.user.id,
    stock: getStockState().items,
    stockError: getStockState().error,
    staff: getStaffState().members,
    staffError: getStaffState().error
  });

  appEl.innerHTML = renderAppShell({
    profile: auth.profile,
    session: auth.session,
    currentPage: ui.page,
    content,
    connectionStatus: getConnectionStatus(),
    mobileNavOpen: ui.mobileNavOpen
  }) + renderToasts(ui.toasts);
}

function bindEvents() {
  appEl.addEventListener('click', async (event) => {
    const pageButton = event.target.closest('[data-page]');
    if (pageButton) setPage(pageButton.dataset.page);

    const openJob = event.target.closest('[data-open-job]');
    if (openJob) selectJob(openJob.dataset.openJob);

    const toastEl = event.target.closest('[data-dismiss-toast]');
    if (toastEl) dismissToast(toastEl.dataset.dismissToast);

    if (event.target.closest('[data-toggle-nav]')) toggleMobileNav();

    if (event.target.closest('[data-signout]')) {
      stopRealtime();
      stopStockRealtime();
      await signOut();
      clearJobs();
      clearStock();
      clearStaff();
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
        await refreshStock();
        await refreshStaff();
        startRealtime();
        startStockRealtime();
      } catch (error) {
        messageEl.textContent = error.message;
      }
      return;
    }

    if (event.target.id === 'reject-form') {
      const jobId = event.target.dataset.jobId;
      const form = new FormData(event.target);
      const messageEl = event.target.querySelector('.form-error');
      const job = getJobState().jobs.find((item) => item.id === jobId);
      try {
        await rejectJob(job, form.get('reason'));
      } catch (error) {
        if (messageEl) messageEl.textContent = error.message;
        else setJobsError(error.message);
      }
      return;
    }

    if (event.target.classList.contains('stock-row__form')) {
      const stockId = event.target.dataset.stockId;
      const form = new FormData(event.target);
      const item = getStockState().items.find((existing) => existing.id === stockId);
      if (!item) return;
      try {
        await updateStock(item, {
          quantityOnHand: Number(form.get('quantityOnHand')),
          lowStockThreshold: Number(form.get('lowStockThreshold'))
        }, getAuthState().session.user.id);
      } catch (error) {
        setStockError(error.message);
      }
      return;
    }

    if (event.target.classList.contains('staff-row__form')) {
      const staffId = event.target.dataset.staffId;
      const form = new FormData(event.target);
      const member = getStaffState().members.find((existing) => existing.id === staffId);
      if (!member) return;
      try {
        await updateStaff(member, {
          fullName: form.get('fullName'),
          branch: form.get('branch'),
          role: form.get('role')
        });
      } catch (error) {
        setStaffError(error.message);
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
  subscribeConnection(render);
  subscribeStock(render);
  subscribeStaff(render);

  subscribeJobEvents(({ type, job }) => {
    const profile = getAuthState().profile;
    if (!profile) return;

    // Ready/Rejected are things a branch needs to act on — production just
    // did that action themselves, so they don't need a toast about it.
    // Incoming is the reverse: production needs to know a new job arrived,
    // the submitting branch already knows since they just submitted it.
    if (type === 'incoming' && isProduction(profile)) {
      pushToast(`New job from ${job.branch}: ${job.customer_name}`);
    } else if (type === 'ready' && !isProduction(profile)) {
      pushToast(`${job.customer_name}'s job is ready for collection`);
    } else if (type === 'rejected' && !isProduction(profile)) {
      pushToast(`${job.customer_name}'s job was returned for correction`);
    }
  });

  bindEvents();

  await loadSession();
  if (getAuthState().session) {
    await refreshJobs();
    await refreshStock();
    await refreshStaff();
    startRealtime();
    startStockRealtime();
  }
  render();
}
