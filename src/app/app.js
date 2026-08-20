// Application entry point: wires together state, stores, router and the DOM.
// Kept as a single event-handling file for simplicity (no separate event modules).

import { MATERIALS } from '../utils/constants.js';
import { validateJobForm } from '../utils/validators.js';
import { isProduction, isOverdue } from '../utils/helpers.js';
import { estimateMachineTime } from '../utils/machineTimeEstimator.js';
import { renderAppShell } from '../components/layout/AppShell.js';
import { renderLoginView } from '../components/auth/LoginView.js';
import { renderToasts } from '../components/layout/Toasts.js';
import { renderPage } from './router.js';
import { getUiState, setPage, selectJob, subscribeUi, pushToast, dismissToast, toggleMobileNav, setSearchQuery, setFilters } from './state.js';
import { getAuthState, loadSession, signIn, signOut, subscribeAuth } from '../stores/authStore.js';
import {
  getJobState,
  refreshJobs,
  createJob,
  advanceJob,
  rejectJob,
  resubmitJob,
  clearJobs,
  setJobsError,
  subscribeJobs,
  subscribeJobEvents,
  startRealtime,
  stopRealtime,
  getConnectionStatus,
  subscribeConnection,
  fetchJobEvents
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
import {
  getMachineState,
  refreshMachines,
  cycleMachineStatus,
  clearMachines,
  subscribeMachines,
  startMachineRealtime,
  stopMachineRealtime
} from '../stores/machineStore.js';

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
    staffError: getStaffState().error,
    machines: getMachineState().machines,
    searchQuery: ui.searchQuery,
    filters: ui.filters
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

function updateMachineEstimate(form) {
  const output = form?.querySelector('#machine-time-estimate');
  if (!output) return;

  const estimate = estimateMachineTime({
    jobType: form.elements.type?.value || 'stickers',
    specification: form.elements.specification?.value || '',
    quantity: form.elements.quantity?.value || 1,
    cutlinesIncluded: Boolean(form.elements.cutlines?.checked)
  });

  const assumption = estimate.available
    ? 'High Quality assumption · estimate only'
    : estimate.reason;

  output.innerHTML = `<span>BN-20 machine estimate</span><strong>${estimate.display}</strong><small>${assumption}</small>`;
}

function bindEvents() {
  // -------- CLICK events --------
  appEl.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-page]');
    if (target) setPage(target.dataset.page);

    const openJob = event.target.closest('[data-open-job]');
    if (openJob) {
      const jobId = openJob.dataset.openJob;
      // Fetch events for this job before opening details
      await fetchJobEvents(jobId);
      selectJob(jobId);
    }

    const toastEl = event.target.closest('[data-dismiss-toast]');
    if (toastEl) dismissToast(toastEl.dataset.dismissToast);

    if (event.target.closest('[data-toggle-nav]')) toggleMobileNav();

    const machineEl = event.target.closest('[data-cycle-machine]');
    if (machineEl) {
      const machine = getMachineState().machines.find((m) => m.id === machineEl.dataset.cycleMachine);
      if (machine) {
        try {
          await cycleMachineStatus(machine, getAuthState().session.user.id);
        } catch (error) {
          setJobsError(error.message);
        }
      }
    }

    if (event.target.closest('[data-signout]')) {
      stopRealtime();
      stopStockRealtime();
      stopMachineRealtime();
      await signOut();
      clearJobs();
      clearStock();
      clearStaff();
      clearMachines();
      setPage('board');
    }

    // Advance job
    const advanceBtn = event.target.closest('[data-advance]');
    if (advanceBtn) {
      const job = getJobState().jobs.find((j) => j.id === advanceBtn.dataset.advance);
      try {
        await advanceJob(job, getAuthState().session.user.id);
      } catch (error) {
        setJobsError(error.message);
      }
    }

    // Confirm rush/urgent (we'll add a button in JobDetails later; for now, just a placeholder)
  });

  // -------- INPUT events (live machine estimate) --------
  appEl.addEventListener('input', (event) => {
    const form = event.target.closest('#job-form');
    if (form) updateMachineEstimate(form);
  });

  // -------- CHANGE events (job type → material; search/filters) --------
  appEl.addEventListener('change', (event) => {
    if (event.target.id === 'job-type') {
      const materialSelect = document.querySelector('#material');
      if (materialSelect) {
        materialSelect.innerHTML = MATERIALS[event.target.value]
          .map((v) => `<option>${v}</option>`)
          .join('');
      }
    }

    const jobForm = event.target.closest('#job-form');
    if (jobForm) updateMachineEstimate(jobForm);

    // Search/filter updates – we'll read from the board's inputs
    const searchInput = document.getElementById('search-input');
    const filterBranch = document.getElementById('filter-branch');
    const filterPriority = document.getElementById('filter-priority');
    const filterStatus = document.getElementById('filter-status');
    const filterType = document.getElementById('filter-type');
    const filterMaterial = document.getElementById('filter-material');

    if (searchInput || filterBranch || filterPriority || filterStatus || filterType || filterMaterial) {
      const newFilters = {
        search: searchInput ? searchInput.value : '',
        branch: filterBranch ? filterBranch.value : '',
        priority: filterPriority ? filterPriority.value : '',
        status: filterStatus ? filterStatus.value : '',
        type: filterType ? filterType.value : '',
        material: filterMaterial ? filterMaterial.value : ''
      };
      setSearchQuery(newFilters.search);
      setFilters({
        branch: newFilters.branch,
        priority: newFilters.priority,
        status: newFilters.status,
        type: newFilters.type,
        material: newFilters.material
      });
    }
  });

  // -------- SUBMIT events --------
  appEl.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Login
    if (event.target.id === 'login-form') {
      const form = new FormData(event.target);
      const messageEl = event.target.querySelector('.form-error');
      try {
        await signIn(form.get('email'), form.get('password'));
        await refreshJobs();
        await refreshStock();
        await refreshStaff();
        await refreshMachines();
        startRealtime();
        startStockRealtime();
        startMachineRealtime();
      } catch (error) {
        messageEl.textContent = error.message;
      }
      return;
    }

    // Reject form (return for correction)
    if (event.target.id === 'reject-form') {
      const jobId = event.target.dataset.jobId;
      const form = new FormData(event.target);
      const messageEl = event.target.querySelector('.form-error');
      const job = getJobState().jobs.find((j) => j.id === jobId);
      try {
        await rejectJob(job, form.get('reason'));
        // After rejection, stay on the job details page but show updated status
        await fetchJobEvents(jobId);
        render(); // re-render to show new status and events
      } catch (error) {
        if (messageEl) messageEl.textContent = error.message;
        else setJobsError(error.message);
      }
      return;
    }

    // Resubmit form (branch resubmits rejected job)
    if (event.target.id === 'resubmit-form') {
      const jobId = event.target.dataset.jobId;
      const messageEl = event.target.querySelector('.form-error');
      const job = getJobState().jobs.find((j) => j.id === jobId);
      try {
        await resubmitJob(job);
        await fetchJobEvents(jobId);
        render();
      } catch (error) {
        if (messageEl) messageEl.textContent = error.message;
        else setJobsError(error.message);
      }
      return;
    }

    // Stock update
    if (event.target.classList.contains('stock-row__form')) {
      const stockId = event.target.dataset.stockId;
      const form = new FormData(event.target);
      const item = getStockState().items.find((i) => i.id === stockId);
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

    // Staff update
    if (event.target.classList.contains('staff-row__form')) {
      const staffId = event.target.dataset.staffId;
      const form = new FormData(event.target);
      const member = getStaffState().members.find((m) => m.id === staffId);
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

    // New Job form
    if (event.target.id === 'job-form') {
      const form = new FormData(event.target);
      const messageEl = event.target.querySelector('.form-error');
      const values = {
        customer: form.get('customer'),
        emailReference: form.get('emailReference'),
        specification: form.get('specification'),
        quantity: form.get('quantity'),
        artworkReceived: form.get('artworkReceived') === 'on',
        artworkPrintReady: form.get('artworkPrintReady') === 'on',
        artworkApproved: form.get('artworkApproved') === 'on',
        cutlinesIncluded: form.get('cutlines') === 'on'
      };

      // Validate including checklist
      const errors = validateJobForm(values);
      if (!values.artworkReceived) errors.push('Please confirm artwork was received by email.');
      if (!values.artworkPrintReady) errors.push('Please confirm artwork is print-ready and correctly sized.');
      if (!values.artworkApproved) errors.push('Please confirm customer approved artwork.');
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
          cutlines_included: values.cutlinesIncluded,
          artwork_checklist_complete: true,
          artwork_received: values.artworkReceived,
          artwork_print_ready: values.artworkPrintReady,
          artwork_approved: values.artworkApproved,
          created_by: getAuthState().session.user.id
        });
        await fetchJobEvents(job.id);
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
  subscribeMachines(render);

  subscribeJobEvents(({ type, job }) => {
    const profile = getAuthState().profile;
    if (!profile) return;

    if (type === 'incoming' && isProduction(profile)) {
      pushToast(`New job from ${job.branch}: ${job.customer_name}`);
    } else if (type === 'ready' && !isProduction(profile)) {
      pushToast(`${job.customer_name}'s job is ready for collection`);
    } else if (type === 'rejected' && !isProduction(profile)) {
      pushToast(`${job.customer_name}'s job was returned for correction`);
    } else if (type === 'resubmitted' && isProduction(profile)) {
      pushToast(`${job.customer_name}'s job was resubmitted after correction`);
    } else if (type === 'rush_submitted' && isProduction(profile)) {
      pushToast(`Rush/Urgent job from ${job.branch}: ${job.customer_name}`);
    }
  });

  bindEvents();

  await loadSession();
  if (getAuthState().session) {
    await refreshJobs();
    await refreshStock();
    await refreshStaff();
    await refreshMachines();
    startRealtime();
    startStockRealtime();
    startMachineRealtime();
  }
  render();
}