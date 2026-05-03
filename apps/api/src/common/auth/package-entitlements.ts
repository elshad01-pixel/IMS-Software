export type TenantPackageTier = 'ASSURANCE' | 'CORE_IMS' | 'QHSE_PRO';

export type TenantScope = 'QMS' | 'EMS' | 'OHSMS' | 'IMS' | 'FSMS';

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
export const DEFAULT_SCOPE: TenantScope = 'IMS';

const alwaysIncludedModules: PackageModuleKey[] = ['dashboard', 'implementation', 'settings', 'users', 'activity-log'];

const assuranceModules: PackageModuleKey[] = ['audits', 'ncr', 'capa', 'actions'];

const coreSharedModules: PackageModuleKey[] = [
  'documents',
  'risks',
  'context',
  'process-register',
  'training',
  'compliance-obligations',
  'kpis',
  'management-review',
  'reports'
];

const proSharedModules: PackageModuleKey[] = ['external-providers', 'change-management'];

const scopeModules: Record<TenantScope, PackageModuleKey[]> = {
  QMS: [],
  EMS: ['incidents', 'environmental-aspects'],
  OHSMS: ['incidents', 'hazards'],
  IMS: ['incidents', 'environmental-aspects', 'hazards'],
  FSMS: []
};

function uniqueModules(modules: PackageModuleKey[]) {
  return [...new Set(modules)];
}

const packageScopeModules: Record<TenantPackageTier, Record<TenantScope, PackageModuleKey[]>> = {
  ASSURANCE: {
    QMS: assuranceModules,
    EMS: assuranceModules,
    OHSMS: assuranceModules,
    IMS: assuranceModules,
    FSMS: assuranceModules
  },
  CORE_IMS: {
    QMS: uniqueModules([...assuranceModules, ...coreSharedModules]),
    EMS: uniqueModules([...assuranceModules, ...coreSharedModules, ...scopeModules.EMS]),
    OHSMS: uniqueModules([...assuranceModules, ...coreSharedModules, ...scopeModules.OHSMS]),
    IMS: uniqueModules([...assuranceModules, ...coreSharedModules, ...scopeModules.IMS]),
    FSMS: uniqueModules([...assuranceModules, ...coreSharedModules])
  },
  QHSE_PRO: {
    QMS: uniqueModules([...assuranceModules, ...coreSharedModules, ...proSharedModules]),
    EMS: uniqueModules([...assuranceModules, ...coreSharedModules, ...proSharedModules, ...scopeModules.EMS]),
    OHSMS: uniqueModules([...assuranceModules, ...coreSharedModules, ...proSharedModules, ...scopeModules.OHSMS]),
    IMS: uniqueModules([...assuranceModules, ...coreSharedModules, ...proSharedModules, ...scopeModules.IMS]),
    FSMS: uniqueModules([...assuranceModules, ...coreSharedModules, ...proSharedModules])
  }
};

export function getEnabledModules(packageTier: TenantPackageTier, scope: TenantScope): PackageModuleKey[] {
  return uniqueModules([...alwaysIncludedModules, ...packageScopeModules[packageTier][scope]]);
}

export function isModuleIncluded(packageTier: TenantPackageTier, scope: TenantScope, moduleKey: PackageModuleKey) {
  return getEnabledModules(packageTier, scope).includes(moduleKey);
}
