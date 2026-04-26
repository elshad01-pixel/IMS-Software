import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';

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

export const permissionGuard: CanActivateChildFn = (childRoute, state) => {
  const requiredPermission = childRoute.data?.['permission'] as string | undefined;
  if (!requiredPermission) {
    return true;
  }

  const authStore = inject(AuthStore);
  if (authStore.hasPermission(requiredPermission)) {
    return true;
  }

  const router = inject(Router);
  return router.createUrlTree(['/no-access'], {
    queryParams: {
      area: readAreaLabel(state.url),
      permission: requiredPermission,
      attempted: state.url
    }
  });
};
