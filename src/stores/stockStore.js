// Holds current stock levels and notifies subscribers on change.
// Same shape as jobStore.js: a small pub-sub wrapping services/stock.js,
// plus its own Realtime channel so a level change on one screen shows up
// on another without a refresh.

import { listStock, updateStockLevel } from '../services/stock.js';
import { supabase } from '../services/supabase.js';

const state = { items: [], error: '' };
const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener(state));
}

export function getStockState() {
  return state;
}

export function subscribeStock(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function refreshStock() {
  try {
    state.items = await listStock();
    state.error = '';
  } catch (error) {
    state.error = error.message;
  }
  notify();
}

export async function updateStock(item, { quantityOnHand, lowStockThreshold }, updatedBy) {
  const saved = await updateStockLevel(item.id, { quantityOnHand, lowStockThreshold, updatedBy });
  state.items = state.items.map((existing) => (existing.id === saved.id ? saved : existing));
  notify();
  return saved;
}

export function setStockError(message) {
  state.error = message;
  notify();
}

export function clearStock() {
  state.items = [];
  state.error = '';
  notify();
}

let channel = null;

export function startStockRealtime() {
  if (!supabase || channel) return;
  channel = supabase
    .channel('stock-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_items' }, handleRealtimeChange)
    .subscribe();
}

export function stopStockRealtime() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}

function handleRealtimeChange(payload) {
  if (payload.eventType === 'INSERT') {
    const exists = state.items.some((item) => item.id === payload.new.id);
    if (!exists) state.items = [...state.items, payload.new];
  } else if (payload.eventType === 'UPDATE') {
    state.items = state.items.map((item) => (item.id === payload.new.id ? payload.new : item));
  } else if (payload.eventType === 'DELETE') {
    state.items = state.items.filter((item) => item.id !== payload.old.id);
  }
  notify();
}
