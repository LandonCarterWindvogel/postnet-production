import { supabase } from './supabase.js';

export async function getProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

export async function listJobs() {
  const { data, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createJob(job) {
  const { data, error } = await supabase.from('jobs').insert(job).select().single();
  if (error) throw error;
  return data;
}

export async function setJobStatus(id, status, acceptedBy = null) {
  const update = { status };
  if (acceptedBy) update.accepted_by = acceptedBy;
  const { data, error } = await supabase.from('jobs').update(update).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// Sends a job back to the branch with a note explaining what to fix.
export async function rejectJob(id, reason) {
  const { data, error } = await supabase
    .from('jobs')
    .update({ status: 'rejected', notes: reason })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
