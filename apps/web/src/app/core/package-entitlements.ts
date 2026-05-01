export type TenantPackageTier = 'ASSURANCE' | 'CORE_IMS' | 'QHSE_PRO';

export type PackageModuleKey =
  | 'dashboard'
  | 'implementation'
  | 'settings'
  | 'users'
  | 'activity-log'
  | 'audits'
  | 'ncr'
  | 'capa'
  | 'actions'
  | 'documents'
  | 'risks'
  | 'context'
  | 'process-register'
  | 'training'
  | 'compliance-obligations'
  | 'kpis'
  | 'management-review'
  | 'reports'
  | 'incidents'
  | 'environmental-aspects'
  | 'hazards'
  | 'external-providers'
  | 'change-management';

export const DEFAULT_PACKAGE_TIER: TenantPackageTier = 'QHSE_PRO';

const alwaysIncludedModules: PackageModuleKey[] = [
  'dashboard',
  'implementation',
  'settings',
  'users',
  'activity-log'
];

const packageModules: Record<TenantPackageTier, PackageModuleKey[]> = {
  ASSURANCE: ['audits', 'ncr', 'capa', 'actions'],
  CORE_IMS: [
    'audits',
    'ncr',
    'capa',
    'actions',
    'documents',
    'risks',
    'context',
    'process-register',
    'training',
    'compliance-obligations',
    'kpis',
    'management-review',
    'reports'
  ],
  QHSE_PRO: [
    'audits',
    'ncr',
    'capa',
    'actions',
    'documents',
    'risks',
    'context',
    'process-register',
    'training',
    'compliance-obligations',
    'kpis',
    'management-review',
    'reports',
    'incidents',
    'environmental-aspects',
    'hazards',
    'external-providers',
    'change-management'
  ]
};

const minimumPackageTierByModule = Object.entries(packageModules).reduce((accumulator, [tier, modules]) => {
  for (const moduleKey of modules) {
    if (!accumulator[moduleKey]) {
      accumulator[moduleKey] = tier as TenantPackageTier;
    }
  }
  return accumulator;
}, {} as Partial<Record<PackageModuleKey, TenantPackageTier>>);

export function getEnabledModules(packageTier: TenantPackageTier): PackageModuleKey[] {
  return [...new Set([...alwaysIncludedModules, ...packageModules[packageTier]])];
}

export function isModuleIncluded(packageTier: TenantPackageTier, moduleKey: PackageModuleKey) {
  return getEnabledModules(packageTier).includes(moduleKey);
}

export function minimumPackageTierForModule(moduleKey: PackageModuleKey): TenantPackageTier {
  return minimumPackageTierByModule[moduleKey] ?? DEFAULT_PACKAGE_TIER;
}
