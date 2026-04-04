import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from './auth.store';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const session = authStore.session();

  const request = session
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${session.accessToken}`,
          'x-tenant-id': session.user.tenantId
        }
      })
    : req;

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/api/auth/login')) {
        authStore.logout();
      }

      return throwError(() => error);
    })
  );
};
