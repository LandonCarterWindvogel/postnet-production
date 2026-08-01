// Holds the current Supabase session + profile, and notifies subscribers
// (app.js) whenever either changes so the UI can re-render.

import { getSession, signIn as apiSignIn, signOut as apiSignOut } from '../services/auth.js';
import { getProfile } from '../services/jobs.js';

const state = { session: null, profile: null };
const listeners = new Set();

function notify() {
  listeners.forEach((listener) => listener(state));
}

export function getAuthState() {
  return state;
}

export function subscribeAuth(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Called once on boot to restore an existing Supabase session, if any.
export async function loadSession() {
  state.session = await getSession();
  state.profile = state.session ? await getProfile(state.session.user.id) : null;
  notify();
  return state.session;
}

export async function signIn(email, password) {
  await apiSignIn(email, password);
  state.session = await getSession();
  state.profile = await getProfile(state.session.user.id);
  notify();
}

export async function signOut() {
  await apiSignOut();
  state.session = null;
  state.profile = null;
  notify();
}
