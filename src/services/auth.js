import { supabase } from './supabase.js';

export async function signIn(email, password) {
  if (!supabase) throw new Error('Supabase is not configured yet. Add your values to .env.');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}
