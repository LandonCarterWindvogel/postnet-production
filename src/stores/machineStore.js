// Holds machine status and notifies subscribers on change. Same shape as
// stockStore.js: a small pub-sub wrapping services/machines.js, with its
// own Realtime channel so a status change shows up on every screen.

import { listMachines, setMachineStatus } from '../services/machines.js';
import { supabase } from '../services/supabase.js';

const state = { machines: [], error: '' };
const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener(state));
}

export function getMachineState() {
  return state;
}

export function subscribeMachines(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function refreshMachines() {
  try {
    state.machines = await listMachines();
    state.error = '';
  } catch (error) {
    state.error = error.message;
  }
  notify();
}

export async function cycleMachineStatus(machine, updatedBy) {
  const cycle = ['ready', 'printing', 'cutting', 'maintenance'];
  const next = cycle[(cycle.indexOf(machine.status) + 1) % cycle.length];
  const saved = await setMachineStatus(machine.id, next, updatedBy);
  state.machines = state.machines.map((existing) => (existing.id === saved.id ? saved : existing));
  notify();
  return saved;
}

export function clearMachines() {
  state.machines = [];
  state.error = '';
  notify();
}

let channel = null;

export function startMachineRealtime() {
  if (!supabase || channel) return;
  channel = supabase
    .channel('machine-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'machines' }, handleRealtimeChange)
    .subscribe();
}

export function stopMachineRealtime() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}

function handleRealtimeChange(payload) {
  if (payload.eventType === 'UPDATE') {
    state.machines = state.machines.map((machine) => (machine.id === payload.new.id ? payload.new : machine));
    notify();
  }
}
