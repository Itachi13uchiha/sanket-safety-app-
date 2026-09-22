export const ROLES = ['citizen', 'officer', 'supervisor', 'admin'] as const;
export type Role = (typeof ROLES)[number];
export type StaffRole = Exclude<Role, 'citizen'>;
export const STAFF_ROLES = ['officer', 'supervisor', 'admin'] as const;

export const PERMISSIONS = [
  'reports:view',
  'patterns:view',
  'cases:manage',
  'alerts:escalate',
  'audit:view',
  'users:manage',
  'data:export',
  'settings:modify',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Single source of truth for the RBAC matrix shown on the Access Control screen. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  citizen: ['patterns:view'],
  officer: ['reports:view', 'patterns:view', 'alerts:escalate'],
  supervisor: [
    'reports:view',
    'patterns:view',
    'cases:manage',
    'alerts:escalate',
    'audit:view',
    'data:export',
  ],
  admin: PERMISSIONS,
};

export const ROLE_LABELS: Record<Role, string> = {
  citizen: 'Citizen',
  officer: 'Authority Officer',
  supervisor: 'Supervisor',
  admin: 'Administrator',
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  'reports:view': 'View Reports',
  'patterns:view': 'View Patterns',
  'cases:manage': 'Manage Cases',
  'alerts:escalate': 'Escalate Alerts',
  'audit:view': 'View Audit Logs',
  'users:manage': 'Manage Users',
  'data:export': 'Export Data',
  'settings:modify': 'Modify Settings',
};

export const can = (role: Role, permission: Permission) => ROLE_PERMISSIONS[role].includes(permission);
