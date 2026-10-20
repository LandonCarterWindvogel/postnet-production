// Application entry point: wires together state, stores, router and the DOM.

import { MATERIALS } from '../utils/constants.js';
import { renderJobItemRow } from '../components/jobs/NewJobForm.js';
import { escapeHtml } from '../utils/formatters.js';
import { validateJobForm } from '../utils/validators.js';
import { isProduction, isOverdue } from '../utils/helpers.js';
import { setBoardPage } from '../components/board/ProductionBoard.js';
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

function collectJobItems(form) {
  return [...form.querySelectorAll('[data-item-row]')].map((row) => ({
    type: row.querySelector('[data-item-field="type"]').value,
    width_mm: Number(row.querySelector('[data-item-field="width_mm"]').value),
    height_mm: Number(row.querySelector('[data-item-field="height_mm"]').value),
    quantity: Number(row.querySelector('[data-item-field="quantity"]').value),
    material: row.querySelector('[data-item-field="material"]').value
  }));
}

function itemTypeLabel(type) {
  return type === 'flex' ? 'T-shirt Flex' : 'Sticker';
}

function jobTypeLabelForItems(items) {
  const types = new Set(items.map((item) => item.type));
  if (types.has('stickers') && types.has('flex')) return 'Stickers + T-shirt Flex';
  return types.has('flex') ? 'T-shirt Flex' : 'Stickers';
}

function updateWizardReview() {
  const form = document.getElementById('job-form');
  if (!form) return;
  const values = new FormData(form);
  const items = collectJobItems(form);
  const labels = {
    priority: values.get('priority') === 'standard'
      ? 'Standard'
      : values.get('priority')?.charAt(0).toUpperCase() + values.get('priority')?.slice(1)
  };

  ['branch', 'customer', 'priority', 'emailReference'].forEach((key) => {
    const target = form.querySelector(`[data-review="${key}"]`);
    if (target) target.textContent = labels[key] || values.get(key) || '—';
  });

  const typeTarget = form.querySelector('[data-review="type"]');
  if (typeTarget) typeTarget.textContent = jobTypeLabelForItems(items);

  const itemList = form.querySelector('[data-review-items]');
  if (itemList) {
    itemList.innerHTML = items.map((item, index) => {
      const size = item.width_mm > 0 && item.height_mm > 0
        ? `${item.width_mm} × ${item.height_mm} mm`
        : 'Size not entered';
      const quantity = Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : '—';
      return `<article class="review-item"><strong>${index + 1}. ${escapeHtml(itemTypeLabel(item.type))}</strong><span>${escapeHtml(size)} · Qty ${quantity}</span><small>${escapeHtml(item.material)}</small></article>`;
    }).join('') || '<p>Add at least one item.</p>';
  }

  const summary = form.querySelector('[data-item-summary]');
  if (summary) {
    const count = items.length;
    summary.textContent = `${count} item${count === 1 ? '' : 's'} · ${jobTypeLabelForItems(items)}`;
  }
}

function syncItemRows(form) {
  if (!form) return;
  const rows = [...form.querySelectorAll('[data-item-row]')];
  const counts = { stickers: 0, flex: 0 };

  rows.forEach((row) => {
    const type = row.querySelector('[data-item-field="type"]').value;
    counts[type] = (counts[type] || 0) + 1;
    const title = row.querySelector('[data-item-title]');
    if (title) title.textContent = `${type === 'flex' ? 'T-shirt Flex' : 'Sticker'} ${counts[type]}`;
    const remove = row.querySelector('[data-remove-item]');
    if (remove) remove.disabled = rows.length <= 1;
  });

  updateWizardReview();
}

function bindEvents() {
  appEl.addEventListener('click', async (event) => {
    const addItemButton = event.target.closest('[data-add-item]');
    if (addItemButton) {
      const form = addItemButton.closest('#job-form');
      const list = form?.querySelector('[data-job-items]');
      if (!form || !list) return;
      const itemCount = list.querySelectorAll('[data-item-row]').length;
      list.insertAdjacentHTML('beforeend', renderJobItemRow(addItemButton.dataset.addItem, itemCount + 1));
      syncItemRows(form);
      form.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    const removeItemButton = event.target.closest('[data-remove-item]');
    if (removeItemButton) {
      const form = removeItemButton.closest('#job-form');
      const list = form?.querySelector('[data-job-items]');
      if (!form || !list || list.querySelectorAll('[data-item-row]').length <= 1) return;
      removeItemButton.closest('[data-item-row]')?.remove();
      syncItemRows(form);
      form.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
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

    const boardPageButton = event.target.closest('[data-board-page]');
    if (boardPageButton && !boardPageButton.disabled) {
      setBoardPage(Number(boardPageButton.dataset.boardPage));
      render();
      return;
    }

    const branchViewButton = event.target.closest('[data-branch-filter]');
    if (branchViewButton) {
      setBoardPage(1);
      setFilters({ branch: branchViewButton.dataset.branchFilter || '' });
      return;
    }

    const target = event.target.closest('[data-page]');
    if (target) {
      setPage(target.dataset.page);
      return;
    }

    const openJob = event.target.closest('[data-open-job]');
    if (openJob) {
      const jobId = openJob.dataset.openJob;
      await fetchJobEvents(jobId);
      selectJob(jobId);
      return;
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
      return;
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
    const itemTypeField = event.target.closest('[data-item-field="type"]');
    if (itemTypeField) {
      const row = itemTypeField.closest('[data-item-row]');
      const materialSelect = row?.querySelector('[data-item-field="material"]');
      if (materialSelect) {
        materialSelect.innerHTML = MATERIALS[itemTypeField.value]
          .map((value) => `<option>${escapeHtml(value)}</option>`)
          .join('');
      }
      const form = itemTypeField.closest('#job-form');
      syncItemRows(form);
      if (form) form.dispatchEvent(new Event('input', { bubbles: true }));
    }

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
      setBoardPage(1);
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
      const jobForm = event.target;
      const form = new FormData(jobForm);
      const messageEl = jobForm.querySelector('[data-wizard-error="3"]');
      const items = collectJobItems(jobForm);
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
      const firstItem = items[0];
      const values = {
        customer: form.get('customer'),
        emailReference: form.get('emailReference'),
        specification: firstItem && firstItem.width_mm > 0 && firstItem.height_mm > 0
          ? `${firstItem.width_mm} × ${firstItem.height_mm} mm`
          : '',
        quantity: Number.isInteger(totalQuantity) ? totalQuantity : '',
        artworkReceived: form.get('artworkReceived') === 'on',
        artworkPrintReady: form.get('artworkPrintReady') === 'on',
        artworkApproved: form.get('artworkApproved') === 'on',
        cutlinesIncluded: form.get('cutlines') === 'on'
      };

      const errors = validateJobForm(values);
      if (!items.length) errors.push('Add at least one sticker or T-shirt Flex item.');
      items.forEach((item, index) => {
        const itemLabel = `Item ${index + 1}`;
        if (!Number.isFinite(item.width_mm) || item.width_mm <= 0 || !Number.isFinite(item.height_mm) || item.height_mm <= 0) {
          errors.push(`${itemLabel}: enter a valid width and height.`);
        }
        if (!Number.isInteger(item.quantity) || item.quantity < 1) {
          errors.push(`${itemLabel}: quantity must be a whole number of at least 1.`);
        }
        if (!MATERIALS[item.type]?.includes(item.material)) {
          errors.push(`${itemLabel}: choose a valid material for the selected item type.`);
        }
      });

      if (!values.artworkReceived) errors.push('Please confirm artwork was received by email.');
      if (!values.artworkPrintReady) errors.push('Please confirm artwork is print-ready and correctly sized.');
      if (!values.artworkApproved) errors.push('Please confirm customer approved artwork.');
      if (errors.length) {
        messageEl.textContent = errors[0];
        return;
      }

      const types = new Set(items.map((item) => item.type));
      const jobType = types.size > 1 ? 'mixed' : items[0].type;

      try {
        const job = await createJob({
          branch: form.get('branch'),
          customer_name: form.get('customer'),
          email_reference: form.get('emailReference'),
          job_type: jobType,
          material: firstItem.material,
          specification: values.specification,
          quantity: totalQuantity,
          items,
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
