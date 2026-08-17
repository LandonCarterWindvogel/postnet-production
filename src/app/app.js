// Application entry point: wires together state, stores, router and the DOM.

import { MATERIALS } from '../utils/constants.js';
import { validateJobForm } from '../utils/validators.js';
import { isProduction, isOverdue } from '../utils/helpers.js';
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

function showWizardStep(step) {
  document.querySelectorAll('[data-wizard-panel]').forEach((panel) => {
    const active = Number(panel.dataset.wizardPanel) === Number(step);
    panel.hidden = !active;
    panel.classList.toggle('active', active);
  });

  document.querySelectorAll('[data-wizard-indicator]').forEach((indicator) => {
    const number = Number(indicator.dataset.wizardIndicator);
    indicator.classList.toggle('active', number === Number(step));
    indicator.classList.toggle('complete', number < Number(step));
  });

  if (Number(step) === 3) updateWizardReview();
}

function updateWizardReview() {
  const form = document.getElementById('job-form');
  if (!form) return;
  const values = new FormData(form);
  const labels = {
    type: values.get('type') === 'flex' ? 'T-shirt Flex' : 'Stickers',
    priority: values.get('priority') === 'standard' ? 'Standard' : values.get('priority')?.charAt(0).toUpperCase() + values.get('priority')?.slice(1)
  };

  ['branch', 'customer', 'type', 'priority', 'emailReference', 'specification', 'quantity', 'material'].forEach((key) => {
    const target = form.querySelector(`[data-review="${key}"]`);
    if (!target) return;
    target.textContent = labels[key] || values.get(key) || '—';
  });
}

function updateMaterialUi() {
  const form = document.getElementById('job-form');
  if (!form) return;
  const material = form.querySelector('#material');
  const warning = form.querySelector('#stock-warning');
  const selected = form.querySelector('#selected-material-label');
  if (selected && material) selected.textContent = material.value;

  // Stock is currently a live informational warning rendered by the Stock store.
  // The authoritative availability check remains server-side.
  if (warning) warning.textContent = '';
}

function bindEvents() {
  appEl.addEventListener('click', async (event) => {
    const wizardNext = event.target.closest('[data-wizard-next]');
    if (wizardNext) {
      showWizardStep(Number(wizardNext.dataset.wizardNext));
      return;
    }

    const wizardBack = event.target.closest('[data-wizard-back]');
    if (wizardBack) {
      showWizardStep(Number(wizardBack.dataset.wizardBack));
      return;
    }

    const target = event.target.closest('[data-page]');
    if (target) setPage(target.dataset.page);

    const openJob = event.target.closest('[data-open-job]');
    if (openJob) {
      const jobId = openJob.dataset.openJob;
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

    const advanceBtn = event.target.closest('[data-advance]');
    if (advanceBtn) {
      const job = getJobState().jobs.find((j) => j.id === advanceBtn.dataset.advance);
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
      if (materialSelect) {
        materialSelect.innerHTML = MATERIALS[event.target.value]
          .map((v) => `<option>${v}</option>`)
          .join('');
      }
      updateMaterialUi();
    }

    if (event.target.id === 'material') updateMaterialUi();

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
        await refreshMachines();
        startRealtime();
        startStockRealtime();
        startMachineRealtime();
      } catch (error) {
        messageEl.textContent = error.message;
      }
      return;
    }

    if (event.target.id === 'reject-form') {
      const jobId = event.target.dataset.jobId;
      const form = new FormData(event.target);
      const messageEl = event.target.querySelector('.form-error');
      const job = getJobState().jobs.find((j) => j.id === jobId);
      try {
        await rejectJob(job, form.get('reason'));
        await fetchJobEvents(jobId);
        render();
      } catch (error) {
        if (messageEl) messageEl.textContent = error.message;
        else setJobsError(error.message);
      }
      return;
    }

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

    if (type === 'incoming' && isProduction(profile)) pushToast(`New job from ${job.branch}: ${job.customer_name}`);
    else if (type === 'ready' && !isProduction(profile)) pushToast(`${job.customer_name}'s job is ready for collection`);
    else if (type === 'rejected' && !isProduction(profile)) pushToast(`${job.customer_name}'s job was returned for correction`);
    else if (type === 'resubmitted' && isProduction(profile)) pushToast(`${job.customer_name}'s job was resubmitted after correction`);
    else if (type === 'rush_submitted' && isProduction(profile)) pushToast(`Rush/Urgent job from ${job.branch}: ${job.customer_name}`);
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
