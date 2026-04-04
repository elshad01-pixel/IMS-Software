import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';

export const permissionGuard: CanActivateChildFn = (childRoute) => {
  const requiredPermission = childRoute.data?.['permission'] as string | undefined;
  if (!requiredPermission) {
    return true;
  }

  const authStore = inject(AuthStore);
  if (authStore.hasPermission(requiredPermission)) {
    return true;
  }

  const router = inject(Router);
  return router.createUrlTree(['/dashboard']);
};
