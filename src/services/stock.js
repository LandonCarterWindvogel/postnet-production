import { supabase } from './supabase.js';

export async function listStock() {
  const { data, error } = await supabase.from('stock_items').select('*').order('category').order('material');
  if (error) throw error;
  return data;
}

export async function updateStockLevel(id, { quantityOnHand, lowStockThreshold, updatedBy }) {
  const { data, error } = await supabase
    .from('stock_items')
    .update({
      quantity_on_hand: quantityOnHand,
      low_stock_threshold: lowStockThreshold,
      updated_by: updatedBy,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
