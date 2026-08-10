-- Fix sticker material units: they should be kg (weight), not metres.
-- This only changes the label; stored quantities remain the same, but the
-- unit interpretation changes. Existing quantities entered as metres are now
-- interpreted as kg, so users must adjust values on the Stock page.
-- This migration does not alter quantity_on_hand values.

update public.stock_items
set unit = 'kg'
where category = 'stickers';