// Status → CSS color variable mapping
export const STATUS_COLORS = {
  idle:        '#64748b',
  active:      '#3b82f6',
  on_mission:  '#10b981',
  charging:    '#8b5cf6',
  blocked:     '#f59e0b',
  error:       '#ef4444',
  maintenance: '#eab308',
  offline:     '#374151',
};

export const STATUS_LABELS = {
  idle:        'Idle',
  active:      'Active',
  on_mission:  'On Mission',
  charging:    'Charging',
  blocked:     'Blocked',
  error:       'Error',
  maintenance: 'Maintenance',
  offline:     'Offline',
};

export function getBatteryColor(battery) {
  if (battery <= 15) return '#ef4444';
  if (battery <= 30) return '#f59e0b';
  return '#10b981';
}

export const ATTENTION_STATUSES = new Set(['error', 'blocked', 'maintenance', 'offline']);
export const LOW_BATTERY_THRESHOLD = 20;

export function needsAttention(robot) {
  return ATTENTION_STATUSES.has(robot.status) || robot.battery <= LOW_BATTERY_THRESHOLD || robot.isStale;
}

export const LEGEND_ITEMS = [
  { status: 'idle',        label: 'Idle' },
  { status: 'active',      label: 'Active' },
  { status: 'on_mission',  label: 'On Mission' },
  { status: 'charging',    label: 'Charging' },
  { status: 'blocked',     label: 'Blocked' },
  { status: 'error',       label: 'Error' },
  { status: 'maintenance', label: 'Maintenance' },
  { status: 'offline',     label: 'Offline' },
];
