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
  collected: 'Collected',
  rejected: 'Rejected'
};

// Statuses that are "closed" — a job here has left the active workflow,
// either because it's done (Collected) or because it was sent back to the
// branch for correction (Rejected).
export const CLOSED_STATUSES = ['collected', 'rejected'];

// The Production Board only shows the active in-progress columns.
export const BOARD_STATUSES = Object.keys(STATUS_LABELS).filter((key) => !CLOSED_STATUSES.includes(key));

export const BRANCHES = ['Plettenberg Bay', 'Knysna', 'Waterside', 'Sedgefield'];

export const ROLE_LABELS = {
  production: 'Production',
  branch_admin: 'Branch Admin',
  branch_user: 'Branch User'
};

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
