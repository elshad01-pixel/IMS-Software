import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';
import { PackageModuleKey } from './package-entitlements';

function readAreaLabel(url: string) {
  const firstSegment = url.split('?')[0].split('/').filter(Boolean)[0];
  const labels: Record<string, string> = {
    dashboard: 'Dashboard',
    implementation: 'Start Here',
    documents: 'Documents',
    risks: 'Risks',
    capa: 'CAPA',
    audits: 'Audits',
    'management-review': 'Management Review',
    kpis: 'KPIs',
    training: 'Training',
    actions: 'Actions',
    ncr: 'NCR',
    context: 'Context',
    'compliance-obligations': 'Compliance Obligations',
    incidents: 'Incidents',
    'environmental-aspects': 'Environmental Aspects',
    hazards: 'Hazards',
    'external-providers': 'External Providers',
    'change-management': 'Change Management',
    'process-register': 'Process Register',
    reports: 'Reports',
    users: 'Users',
    settings: 'Settings'
  };

  return labels[firstSegment] ?? 'This area';
}

function readPackageModule(url: string): PackageModuleKey | null {
  const firstSegment = url.split('?')[0].split('/').filter(Boolean)[0];
  const modules: Record<string, PackageModuleKey> = {
    dashboard: 'dashboard',
    implementation: 'implementation',
    documents: 'documents',
    risks: 'risks',
    capa: 'capa',
    audits: 'audits',
    'management-review': 'management-review',
    kpis: 'kpis',
    training: 'training',
    actions: 'actions',
    ncr: 'ncr',
    context: 'context',
    'compliance-obligations': 'compliance-obligations',
    incidents: 'incidents',
    'environmental-aspects': 'environmental-aspects',
    hazards: 'hazards',
    'external-providers': 'external-providers',
    'change-management': 'change-management',
    'process-register': 'process-register',
    reports: 'reports',
    users: 'users',
    'activity-log': 'activity-log',
    settings: 'settings'
  };

  return modules[firstSegment] ?? null;
}

export const permissionGuard: CanActivateChildFn = (childRoute, state) => {
  const requiredPermission = childRoute.data?.['permission'] as string | undefined;
  const authStore = inject(AuthStore);
  const requiredModule = (childRoute.data?.['packageModule'] as PackageModuleKey | undefined) ?? readPackageModule(state.url);

  const hasPermission = !requiredPermission || authStore.hasPermission(requiredPermission);
  const hasPackageAccess = !requiredModule || authStore.hasModule(requiredModule);

  if (hasPermission && hasPackageAccess) {
    return true;
  }

  const router = inject(Router);
  return router.createUrlTree(['/no-access'], {
    queryParams: {
      area: readAreaLabel(state.url),
      permission: requiredPermission || '',
      packageModule: requiredModule || '',
      packageTier: authStore.packageTier(),
      attempted: state.url
    }
  });
};
