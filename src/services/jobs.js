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

// NEW: Resubmit a rejected job back to incoming
export async function resubmitJob(id) {
  const { data, error } = await supabase
    .from('jobs')
    .update({ status: 'incoming', accepted_by: null, accepted_at: null, returned_at: null })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// NEW: Fetch job events for timeline
export async function getJobEvents(jobId) {
  const { data, error } = await supabase
    .from('job_events')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}