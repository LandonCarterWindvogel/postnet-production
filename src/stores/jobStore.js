// Holds the current list of jobs and notifies subscribers on change.
// Wraps services/jobs.js (the Supabase calls) so components never talk to Supabase directly.

import { createJob as apiCreateJob, listJobs, setJobStatus, rejectJob as apiRejectJob, resubmitJob as apiResubmitJob, getJobEvents } from '../services/jobs.js';
import { computeNextStatus } from '../utils/helpers.js';
import { supabase } from '../services/supabase.js';

const state = { jobs: [], error: '' };
const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener(state));
}

// --- Job events -----------------------------------------------------------
const jobEventListeners = new Set();

export function subscribeJobEvents(listener) {
  jobEventListeners.add(listener);
  return () => jobEventListeners.delete(listener);
}

function emitJobEvent(event) {
  jobEventListeners.forEach((listener) => listener(event));
}

// --- Realtime connection state -------------------------------------------
let channel = null;
let connectionStatus = 'disconnected';
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
    if (!exists) {
      state.jobs = [payload.new, ...state.jobs];
      if (payload.new.status === 'incoming') emitJobEvent({ type: 'incoming', job: payload.new });
      if (payload.new.priority === 'rush' || payload.new.priority === 'urgent') {
        emitJobEvent({ type: 'rush_submitted', job: payload.new });
      }
    }
  } else if (payload.eventType === 'UPDATE') {
    const previous = state.jobs.find((job) => job.id === payload.new.id);
    state.jobs = state.jobs.map((job) => (job.id === payload.new.id ? payload.new : job));
    if (previous && previous.status !== payload.new.status) {
      if (payload.new.status === 'ready') emitJobEvent({ type: 'ready', job: payload.new });
      if (payload.new.status === 'rejected') emitJobEvent({ type: 'rejected', job: payload.new });
      if (previous.status === 'rejected' && payload.new.status === 'incoming') {
        emitJobEvent({ type: 'resubmitted', job: payload.new });
      }
    }
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
  emitJobEvent({ type: 'created', job });
  return job;
}

export async function advanceJob(job, userId) {
  const nextStatus = computeNextStatus(job);
  if (!nextStatus) return job;

  const acceptedBy = job.status === 'incoming' ? userId : null;
  const saved = await setJobStatus(job.id, nextStatus, acceptedBy);
  state.jobs = state.jobs.map((item) => (item.id === saved.id ? saved : item));
  notify();
  return saved;
}

export async function rejectJob(job, reason) {
  const saved = await apiRejectJob(job.id, reason);
  state.jobs = state.jobs.map((item) => (item.id === saved.id ? saved : item));
  notify();
  emitJobEvent({ type: 'rejected', job: saved });
  return saved;
}

export async function resubmitJob(job) {
  const saved = await apiResubmitJob(job.id);
  state.jobs = state.jobs.map((item) => (item.id === saved.id ? saved : item));
  notify();
  emitJobEvent({ type: 'resubmitted', job: saved });
  return saved;
}

export async function fetchJobEvents(jobId) {
  const events = await getJobEvents(jobId);
  const job = state.jobs.find(j => j.id === jobId);
  if (job) {
    job.events = events;
  }
  return events;
}

export function setJobsError(message) {
  state.error = message;
  notify();
}

export function clearJobs() {
  state.jobs = [];
  state.error = '';
  notify();
}