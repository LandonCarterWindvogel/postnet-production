// Central place for display labels and option lists shared across views.

export const STATUS_LABELS = {
  incoming: 'Incoming',
  queued: 'Queued',
  cutting: 'Cutting',
  printing: 'Printing',
  drying: 'Drying',
  contour_cutting: 'Cutting',
  weeding: 'Weeding',
  heat_press: 'Heat Press',
  quality_check: 'Quality Check',
  ready: 'Ready',
  collected: 'Collected',
  rejected: 'Rejected'
};

export const CLOSED_STATUSES = ['collected', 'rejected'];

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

export const BOARD_STATUSES = BOARD_COLUMNS.flatMap((column) => column.statuses);

export const BRANCHES = [
  'Plettenberg Bay',
  'Knysna',
  'Waterside',
  'Sedgefield'
];

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

export const STOCK_UNITS = {
  stickers: 'kg',
  flex: 'kg'
};

export const NAV_ICONS = {
  board: '▦',
  'new-job': '+',
  'my-jobs': '◷',
  stock: '◫',
  settings: '⚙',
  dashboard: '⌂'
};
