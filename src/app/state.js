// UI-only state: which page is showing, which job is selected, and any
// active toast notifications. Session/profile live in authStore.js, jobs
// live in jobStore.js — this file only tracks navigation + toasts + filters.

const state = {
  page: 'board',
  selectedId: null,
  toasts: [],
  mobileNavOpen: false,
  searchQuery: '',
  filters: {
    branch: '',
    priority: '',
    status: '',
    type: '',
    material: ''
  }
};

const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener(state));
}

export function getUiState() {
  return state;
}

export function subscribeUi(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setPage(page) {
  state.page = page;
  state.mobileNavOpen = false;
  notify();
}

export function selectJob(jobId) {
  state.selectedId = jobId;
  state.page = 'job-details';
  state.mobileNavOpen = false;
  notify();
}

export function toggleMobileNav() {
  state.mobileNavOpen = !state.mobileNavOpen;
  notify();
}

export function pushToast(message) {
  const id = crypto.randomUUID();
  state.toasts = [...state.toasts, { id, message }];
  notify();
  setTimeout(() => dismissToast(id), 6000);
}

export function dismissToast(id) {
  state.toasts = state.toasts.filter((toast) => toast.id !== id);
  notify();
}

export function setSearchQuery(query) {
  state.searchQuery = query;
  notify();
}

export function setFilters(filters) {
  state.filters = { ...state.filters, ...filters };
  notify();
}