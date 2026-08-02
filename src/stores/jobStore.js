// Holds the current list of jobs and notifies subscribers on change.
// Wraps services/jobs.js (the Supabase calls) so components never talk to
// Supabase directly.

import { createJob as apiCreateJob, listJobs, setJobStatus, rejectJob as apiRejectJob } from '../services/jobs.js';
import { computeNextStatus } from '../utils/helpers.js';
import { supabase } from '../services/supabase.js';

const state = { jobs: [], error: '' };
const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener(state));
}

// --- Realtime connection state -------------------------------------------
// Tracked separately from `state` so the top bar can show connecting /
// connected / offline without every job change also touching this.

let channel = null;
let connectionStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'connected'
const connectionListeners = new Set();

function setConnectionStatus(status) {
  connectionStatus = status;
  connectionListeners.forEach((listener) => listener(connectionStatus));
}

export function getConnectionStatus() {
  return connectionStatus;
}

export function subscribeConnection(listener) {
  connectionListeners.add(listener);
  return () => connectionListeners.delete(listener);
}

// Subscribes to live Postgres changes on the jobs table. RLS still applies
// to what each client receives, so a branch user only ever sees changes to
// their own branch's jobs, same as a normal select.
export function startRealtime() {
  if (!supabase || channel) return;
  setConnectionStatus('connecting');
  channel = supabase
    .channel('jobs-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, handleRealtimeChange)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') setConnectionStatus('connected');
      if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) setConnectionStatus('disconnected');
    });
}

export function stopRealtime() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  setConnectionStatus('disconnected');
}

function handleRealtimeChange(payload) {
  if (payload.eventType === 'INSERT') {
    const exists = state.jobs.some((job) => job.id === payload.new.id);
    if (!exists) state.jobs = [payload.new, ...state.jobs];
  } else if (payload.eventType === 'UPDATE') {
    state.jobs = state.jobs.map((job) => (job.id === payload.new.id ? payload.new : job));
  } else if (payload.eventType === 'DELETE') {
    state.jobs = state.jobs.filter((job) => job.id !== payload.old.id);
  }
  notify();
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

// Sends a job back to the branch with a reason. Realtime will also deliver
// this update to other connected clients, but we update locally right away
// so the person who clicked the button doesn't wait on a round trip.
export async function rejectJob(job, reason) {
  const saved = await apiRejectJob(job.id, reason);
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
