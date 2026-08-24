-- PostNet Production stock is measured by weight in-store.
-- This keeps existing quantities untouched and standardizes both sticker and Flex
-- stock labels to kilograms (kg).

update public.stock_items
set unit = 'kg'
where category in ('stickers', 'flex');
