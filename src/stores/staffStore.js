// Holds the staff list and notifies subscribers on change. Same shape as
// jobStore/stockStore, minus a Realtime channel — profile edits are rare
// enough that live updates would add complexity without real benefit here.

import { listStaff, updateStaffMember } from '../services/staff.js';

const state = { members: [], error: '' };
const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener(state));
}

export function getStaffState() {
  return state;
}

export function subscribeStaff(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function refreshStaff() {
  try {
    state.members = await listStaff();
    state.error = '';
  } catch (error) {
    state.error = error.message;
  }
  notify();
}

export async function updateStaff(member, { fullName, branch, role }) {
  const saved = await updateStaffMember(member.id, { fullName, branch, role });
  state.members = state.members.map((existing) => (existing.id === saved.id ? saved : existing));
  notify();
  return saved;
}

export function setStaffError(message) {
  state.error = message;
  notify();
}

export function clearStaff() {
  state.members = [];
  state.error = '';
  notify();
}
