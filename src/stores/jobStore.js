// Holds the current list of jobs and notifies subscribers on change.
// Wraps services/jobs.js (the Supabase calls) so components never talk to
// Supabase directly.

import { createJob as apiCreateJob, listJobs, setJobStatus } from '../services/jobs.js';
import { computeNextStatus } from '../utils/helpers.js';

const state = { jobs: [], error: '' };
const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener(state));
}

export function getJobState() {
  return state;
}

export function subscribeJobs(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function refreshJobs() {
  try {
    state.jobs = await listJobs();
    state.error = '';
  } catch (error) {
    state.error = error.message;
  }
  notify();
}

export async function createJob(payload) {
  const job = await apiCreateJob(payload);
  state.jobs = [job, ...state.jobs];
  notify();
  return job;
}

// Moves a job to its next workflow status. Production users accepting an
// Incoming job also get recorded as accepted_by.
export async function advanceJob(job, userId) {
  const nextStatus = computeNextStatus(job);
  if (!nextStatus) return job;

  const acceptedBy = job.status === 'incoming' ? userId : null;
  const saved = await setJobStatus(job.id, nextStatus, acceptedBy);
  state.jobs = state.jobs.map((item) => (item.id === saved.id ? saved : item));
  notify();
  return saved;
}

export function setJobsError(message) {
  state.error = message;
  notify();
}

// Called on sign-out so the next login never briefly shows a stale board.
export function clearJobs() {
  state.jobs = [];
  state.error = '';
  notify();
}
