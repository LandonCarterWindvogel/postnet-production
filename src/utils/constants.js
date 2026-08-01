// Central place for display labels and option lists shared across views.

export const STATUS_LABELS = {
  incoming: 'Incoming',
  queued: 'Queued',
  printing: 'Printing',
  drying: 'Drying',
  contour_cutting: 'Contour Cutting',
  weeding: 'Weeding',
  heat_press: 'Heat Press',
  quality_check: 'Quality Check',
  ready: 'Ready',
  collected: 'Collected'
};

// The Production Board shows every status except "Collected" (that column
// is intentionally hidden once a job is picked up).
export const BOARD_STATUSES = Object.keys(STATUS_LABELS).filter((key) => key !== 'collected');

export const BRANCHES = ['Plettenberg Bay', 'Knysna', 'Waterside', 'Sedgefield'];

export const MATERIALS = {
  stickers: ['Gloss Vinyl', 'Matte Vinyl', 'Clear Vinyl', 'Contravision'],
  flex: ['White Flex', 'Gold Flex', 'Silver Flex']
};

export const NAV_ICONS = {
  board: '▦',
  'new-job': '+',
  'my-jobs': '◷',
  stock: '◫',
  settings: '⚙'
};
