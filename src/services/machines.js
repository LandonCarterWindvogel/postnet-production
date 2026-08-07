import { supabase } from './supabase.js';

export async function listMachines() {
  const { data, error } = await supabase.from('machines').select('*').order('name');
  if (error) throw error;
  return data;
}

export async function setMachineStatus(id, status, updatedBy) {
  const { data, error } = await supabase
    .from('machines')
    .update({ status, updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
