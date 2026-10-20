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
  updateJobDetails,
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
    name: row.querySelector('[data-item-field="name"]').value.trim(),
    type: row.querySelector('[data-item-field="type"]').value,
    width_mm: Number(row.querySelector('[data-item-field="width_mm"]').value),
    height_mm: Number(row.querySelector('[data-item-field="height_mm"]').value),
    quantity: Number(row.querySelector('[data-item-field="quantity"]').value),
    material: row.querySelector('[data-item-field="material"]').value,
    notes: row.querySelector('[data-item-field="notes"]').value.trim()
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

  ['branch', 'customer', 'contactName', 'contactPhone', 'priority', 'emailReference'].forEach((key) => {
    const target = form.querySelector(`[data-review="${key}"]`);
    if (target) target.textContent = labels[key] || values.get(key) || '—';
  });
  const fulfillmentTarget = form.querySelector('[data-review="fulfillmentMethod"]');
  if (fulfillmentTarget) fulfillmentTarget.textContent = values.get('fulfillmentMethod') === 'delivery' ? 'Delivery' : 'Collection at branch';
  const addressTarget = form.querySelector('[data-review="deliveryAddress"]');
  if (addressTarget) addressTarget.textContent = values.get('fulfillmentMethod') === 'delivery' ? (values.get('deliveryAddress') || '—') : '—';

  const typeTarget = form.querySelector('[data-review="type"]');
  if (typeTarget) typeTarget.textContent = jobTypeLabelForItems(items);

  const itemList = form.querySelector('[data-review-items]');
  if (itemList) {
    itemList.innerHTML = items.map((item, index) => {
      const size = item.width_mm > 0 && item.height_mm > 0
        ? `${item.width_mm} × ${item.height_mm} mm`
        : 'Size not entered';
      const quantity = Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : '—';
      const itemName = item.name || `${itemTypeLabel(item.type)} ${index + 1}`;
      return `<article class="review-item"><strong>${index + 1}. ${escapeHtml(itemName)} · ${escapeHtml(itemTypeLabel(item.type))}</strong><span>${escapeHtml(size)} · Qty ${quantity}</span><small>${escapeHtml(item.material)}</small>${item.notes ? `<small>Instructions: ${escapeHtml(item.notes)}</small>` : ''}</article>`;
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

function syncFulfillmentFields(form) {
  if (!form) return;
  const method = form.querySelector('[data-fulfillment-method]')?.value || 'collection';
  const field = form.querySelector('[data-delivery-address-field]');
  const address = form.querySelector('[name="deliveryAddress"]');
  if (field) field.hidden = method !== 'delivery';
  if (address) {
    address.disabled = method !== 'delivery';
    address.required = method === 'delivery';
  }
}

function applyReportFilters() {
  const table = document.querySelector('[data-report-table]');
  if (!table) return;
  const panel = table.closest('.report-panel');
  const start = panel?.querySelector('[data-report-start]')?.value || '';
  const end = panel?.querySelector('[data-report-end]')?.value || '';
  const branch = panel?.querySelector('[data-report-branch]')?.value || '';
  const rows = [...table.querySelectorAll('[data-report-row]')];
  const visible = [];

  rows.forEach((row) => {
    const date = row.dataset.reportDate || '';
    const matches = (!start || date >= start) && (!end || date <= end) && (!branch || row.dataset.reportBranch === branch);
    row.hidden = !matches;
    if (matches) visible.push(row);
  });

  const statuses = visible.map((row) => row.dataset.reportStatus);
  const values = {
    total: visible.length,
    active: statuses.filter((status) => !['collected', 'rejected'].includes(status)).length,
    ready: statuses.filter((status) => status === 'ready').length,
    returned: statuses.filter((status) => status === 'rejected').length,
    collected: statuses.filter((status) => status === 'collected').length
  };
  Object.entries(values).forEach(([key, value]) => {
    const metric = document.querySelector(`[data-report-metric="${key}"]`);
    if (metric) metric.textContent = String(value);
  });
  const empty = table.querySelector('[data-report-empty]');
  if (empty) empty.hidden = visible.length > 0;
}

function bindEvents() {
  appEl.addEventListener('click', async (event) => {
    const addItemButton = event.target.closest('[data-add-item], [data-edit-add-item]');
    if (addItemButton) {
      const isEditForm = addItemButton.hasAttribute('data-edit-add-item');
      const form = addItemButton.closest(isEditForm ? '#edit-job-form' : '#job-form');
      const list = form?.querySelector('[data-job-items]');
      if (!form || !list) return;
      const itemCount = list.querySelectorAll('[data-item-row]').length;
      const type = isEditForm ? addItemButton.dataset.editAddItem : addItemButton.dataset.addItem;
      list.insertAdjacentHTML('beforeend', renderJobItemRow(type, itemCount + 1));
      syncItemRows(form);
      if (form.id === 'job-form') form.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    const removeItemButton = event.target.closest('[data-remove-item]');
    if (removeItemButton) {
      const form = removeItemButton.closest('form');
      const list = form?.querySelector('[data-job-items]');
      if (!form || !list || list.querySelectorAll('[data-item-row]').length <= 1) return;
      removeItemButton.closest('[data-item-row]')?.remove();
      syncItemRows(form);
      if (form.id === 'job-form') form.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    if (event.target.closest('[data-edit-job]')) {
      const button = event.target.closest('[data-edit-job]');
      const form = document.getElementById('edit-job-form');
      if (form) {
        form.hidden = false;
        button.hidden = true;
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    if (event.target.closest('[data-cancel-edit]')) {
      const form = event.target.closest('#edit-job-form');
      if (form) {
        form.hidden = true;
        const button = document.querySelector('[data-edit-job]');
        if (button) button.hidden = false;
      }
      return;
    }

    if (event.target.closest('[data-report-apply]')) {
      applyReportFilters();
      return;
    }

    if (event.target.closest('[data-report-reset]')) {
      const panel = event.target.closest('.report-panel');
      panel?.querySelectorAll('[data-report-start], [data-report-end]').forEach((input) => { input.value = ''; });
      const branchSelect = panel?.querySelector('[data-report-branch]');
      if (branchSelect) branchSelect.value = '';
      applyReportFilters();
      return;
    }

    if (event.target.closest('[data-report-export]')) {
      const table = document.querySelector('[data-report-table]');
      if (!table) return;
      const header = [...table.querySelectorAll('thead th')].map((cell) => cell.textContent.trim());
      const rows = [...table.querySelectorAll('tbody [data-report-row]:not([hidden])')]
        .map((row) => [...row.cells].map((cell) => cell.textContent.trim()));
      const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const csv = [header, ...rows].map((row) => row.map(quote).join(',')).join('\\r\\n');
      const blob = new Blob(['\\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `postnet-production-report-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
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
      const form = itemTypeField.closest('form');
      syncItemRows(form);
      if (form?.id === 'job-form') form.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const fulfillmentSelect = event.target.closest('[data-fulfillment-method]');
    if (fulfillmentSelect) syncFulfillmentFields(fulfillmentSelect.closest('form'));

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

    if (event.target.id === 'edit-job-form') {
      const editForm = event.target;
      const form = new FormData(editForm);
      const jobId = editForm.dataset.jobId;
      const messageEl = editForm.querySelector('[data-edit-error]');
      const job = getJobState().jobs.find((item) => item.id === jobId);
      const items = collectJobItems(editForm);
      const errors = [];
      const customerName = String(form.get('customerName') || '').trim();
      const emailReference = String(form.get('emailReference') || '').trim();
      const fulfillmentMethod = String(form.get('fulfillmentMethod') || 'collection');
      const deliveryAddress = String(form.get('deliveryAddress') || '').trim();
      if (customerName.length < 2 || customerName.length > 160) errors.push('Enter a customer name between 2 and 160 characters.');
      if (emailReference.length < 3 || emailReference.length > 300) errors.push('Enter an email subject or reference between 3 and 300 characters.');
      if (form.get('contactName') && String(form.get('contactName')).trim().length === 1) errors.push('Contact person must be at least 2 characters.');
      if (form.get('contactPhone') && String(form.get('contactPhone')).trim().length > 0 && String(form.get('contactPhone')).trim().length < 3) errors.push('Contact number must be at least 3 characters.');
      if (fulfillmentMethod === 'delivery' && deliveryAddress.length < 5) errors.push('Enter a delivery address of at least 5 characters.');
      if (!items.length) errors.push('Add at least one item.');
      items.forEach((item, index) => {
        if (!item.name || item.name.length > 80) errors.push(`Item ${index + 1}: enter a name of 1 to 80 characters.`);
        if (!Number.isFinite(item.width_mm) || item.width_mm <= 0 || item.width_mm > 10000 ||
            !Number.isFinite(item.height_mm) || item.height_mm <= 0 || item.height_mm > 10000) errors.push(`Item ${index + 1}: enter width and height between 1 and 10,000 mm.`);
        if (!Number.isInteger(item.quantity) || item.quantity < 1) errors.push(`Item ${index + 1}: quantity must be a whole number of at least 1.`);
        if (!MATERIALS[item.type]?.includes(item.material)) errors.push(`Item ${index + 1}: choose a valid material.`);
        if (item.notes.length > 500) errors.push(`Item ${index + 1}: instructions cannot exceed 500 characters.`);
      });
      if (errors.length) {
        if (messageEl) messageEl.textContent = errors[0];
        return;
      }
      if (!job) {
        if (messageEl) messageEl.textContent = 'This job is no longer available. Refresh and try again.';
        return;
      }

      try {
        const saved = await updateJobDetails(job, {
          customer_name: customerName,
          contact_name: String(form.get('contactName') || '').trim() || null,
          contact_phone: String(form.get('contactPhone') || '').trim() || null,
          email_reference: emailReference,
          fulfillment_method: fulfillmentMethod,
          delivery_address: fulfillmentMethod === 'delivery' ? deliveryAddress : null,
          priority: form.get('priority'),
          items,
          notes: String(form.get('notes') || '').trim() || null,
          cutlines_included: form.get('cutlines') === 'on'
        });
        await fetchJobEvents(saved.id);
        selectJob(saved.id);
        pushToast('Job details saved.');
      } catch (error) {
        if (messageEl) messageEl.textContent = error.message;
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
        cutlinesIncluded: form.get('cutlines') === 'on',
        fulfillmentMethod: form.get('fulfillmentMethod') || 'collection',
        deliveryAddress: String(form.get('deliveryAddress') || '').trim()
      };

      const errors = validateJobForm(values);
      if (!items.length) errors.push('Add at least one sticker or T-shirt Flex item.');
      items.forEach((item, index) => {
        const itemLabel = `Item ${index + 1}`;
        if (!Number.isFinite(item.width_mm) || item.width_mm <= 0 || item.width_mm > 10000 ||
            !Number.isFinite(item.height_mm) || item.height_mm <= 0 || item.height_mm > 10000) {
          errors.push(`${itemLabel}: enter a width and height between 1 and 10,000 mm.`);
        }
        if (!item.name || item.name.length > 80) {
          errors.push(`${itemLabel}: enter a name of 1 to 80 characters.`);
        }
        if (!Number.isInteger(item.quantity) || item.quantity < 1) {
          errors.push(`${itemLabel}: quantity must be a whole number of at least 1.`);
        }
        if (item.notes.length > 500) errors.push(`${itemLabel}: instructions cannot exceed 500 characters.`);
        if (!MATERIALS[item.type]?.includes(item.material)) {
          errors.push(`${itemLabel}: choose a valid material for the selected item type.`);
        }
      });

      if (!values.artworkReceived) errors.push('Please confirm artwork was received by email.');
      if (!values.artworkPrintReady) errors.push('Please confirm artwork is print-ready and correctly sized.');
      if (!values.artworkApproved) errors.push('Please confirm customer approved artwork.');
      if (values.fulfillmentMethod === 'delivery' && values.deliveryAddress.length < 5) {
        errors.push('Enter a delivery address of at least 5 characters.');
      }
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
          contact_name: String(form.get('contactName') || '').trim() || null,
          contact_phone: String(form.get('contactPhone') || '').trim() || null,
          email_reference: form.get('emailReference'),
          fulfillment_method: values.fulfillmentMethod,
          delivery_address: values.fulfillmentMethod === 'delivery' ? values.deliveryAddress : null,
          notes: String(form.get('notes') || '').trim() || null,
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
