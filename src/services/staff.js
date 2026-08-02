import { supabase } from './supabase.js';

// Returns every profile a production user can see (everyone), or just the
// caller's own row for a branch user — RLS decides, not this function.
export async function listStaff() {
  const { data, error } = await supabase.from('profiles').select('*').order('full_name');
  if (error) throw error;
  return data;
}

export async function updateStaffMember(id, { fullName, branch, role }) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, branch, role, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
