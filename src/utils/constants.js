// Central place for display labels and option lists shared across views.

export const STATUS_LABELS = {
  incoming: 'Incoming',
  queued: 'Queued',
  cutting: 'Cutting',
  printing: 'Printing',
  drying: 'Drying',
  // Internal status remains contour_cutting for sticker jobs, but the board
  // intentionally presents it as the shared Cutting production stage.
  contour_cutting: 'Cutting',
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
export const BOARD_COLUMNS = [
  { key: 'incoming', label: 'Incoming', statuses: ['incoming'] },
  { key: 'queued', label: 'Queued', statuses: ['queued'] },
  { key: 'printing', label: 'Printing', statuses: ['printing'] },
  { key: 'drying', label: 'Drying', statuses: ['drying'] },
  { key: 'cutting', label: 'Cutting', statuses: ['cutting', 'contour_cutting'] },
  { key: 'weeding', label: 'Weeding', statuses: ['weeding'] },
  { key: 'heat_press', label: 'Heat Press', statuses: ['heat_press'] },
  { key: 'quality_check', label: 'Quality Check', statuses: ['quality_check'] },
  { key: 'ready', label: 'Ready', statuses: ['ready'] }
];

// Internal statuses are retained for filtering, workflow enforcement, and event history.
export const BOARD_STATUSES = BOARD_COLUMNS.flatMap((column) => column.statuses);


export const BRANCHES = ['Plettenberg Bay', 'Knysna', 'Waterside', 'Sedgefield'];

export const ROLE_LABELS = {
  production: 'Production',
  branch_admin: 'Branch Admin',
  branch_user: 'Branch User'
};

export const MACHINE_STATUS_LABELS = {
  ready: 'Ready',
  printing: 'Printing',
  cutting: 'Cutting',
  maintenance: 'Maintenance'
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
