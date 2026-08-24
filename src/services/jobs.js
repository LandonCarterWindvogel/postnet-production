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

async function updateJobAndFetch(id, update) {
  // Do not rely on PostgREST's UPDATE ... RETURNING to produce a single row.
  // RLS/trigger combinations can legitimately return an empty representation even
  // when the update succeeds, which otherwise surfaces as "Cannot coerce the
  // result to a single JSON object" from .single().
  const { error } = await supabase.from('jobs').update(update).eq('id', id);
  if (error) throw error;

  const { data, error: fetchError } = await supabase.from('jobs').select('*').eq('id', id).single();
  if (fetchError) throw fetchError;
  return data;
}

export async function setJobStatus(id, status, acceptedBy = null) {
  const update = { status };
  if (acceptedBy) update.accepted_by = acceptedBy;
  return updateJobAndFetch(id, update);
}

export async function rejectJob(id, reason) {
  return updateJobAndFetch(id, { status: 'rejected', notes: reason });
}

export async function resubmitJob(id) {
  return updateJobAndFetch(id, {
    status: 'incoming',
    accepted_by: null,
    accepted_at: null,
    returned_at: null
  });
}

export async function getJobEvents(jobId) {
  const { data, error } = await supabase
    .from('job_events')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}