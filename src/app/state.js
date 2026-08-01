// UI-only state: which page is showing and which job is selected.
// Session/profile live in authStore.js, jobs live in jobStore.js — this
// file only tracks navigation, so it stays tiny and framework-free.

const state = {
  page: 'board',
  selectedId: null
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
  notify();
}

export function selectJob(jobId) {
  state.selectedId = jobId;
  state.page = 'job-details';
  notify();
}
