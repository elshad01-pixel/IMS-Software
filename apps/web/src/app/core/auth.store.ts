import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, of, tap } from 'rxjs';

type Session = {
  accessToken: string;
  user: {
    sub: string;
    tenantId: string;
    email: string;
    permissions: string[];
    roleId?: string;
    roleName?: string;
  };
  tenantSlug: string;
};

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly sessionState = signal<Session | null>(this.readSession());

  constructor() {
    this.refreshSession();
  }

  readonly session = computed(() => this.sessionState());
  readonly isAuthenticated = computed(() => !!this.sessionState()?.accessToken);
  readonly tenantId = computed(() => this.sessionState()?.user.tenantId ?? null);
  readonly tenantSlug = computed(() => this.sessionState()?.tenantSlug ?? null);
  readonly permissions = computed(() => this.sessionState()?.user.permissions ?? []);
  readonly roleLabel = computed(() => {
    const explicit = this.sessionState()?.user.roleName;
    if (explicit) {
      return explicit;
    }

    const permissions = this.permissions();
    if (permissions.includes('admin.delete')) {
      return 'Admin';
    }

    if (permissions.includes('documents.write') || permissions.includes('risks.write') || permissions.includes('capa.write')) {
      return 'Manager';
    }

    return 'User';
  });

  hasPermission(permission: string) {
    return this.permissions().includes(permission);
  }

  isAdmin() {
    return this.roleLabel() === 'Admin';
  }

  login(payload: { email: string; password: string; tenantSlug: string }) {
    return this.http
      .post<Omit<Session, 'tenantSlug'>>('/api/auth/login', payload)
      .pipe(
        tap((result) => {
          const session = { ...result, tenantSlug: payload.tenantSlug };
          this.sessionState.set(session);
          localStorage.setItem('iso-session', JSON.stringify(session));
          void this.router.navigateByUrl('/');
        })
      );
  }

  refreshSession() {
    const current = this.sessionState();
    if (!current?.accessToken) {
      return;
    }

    this.http
      .get<{
        id: string;
        tenantId: string;
        email: string;
        role?: {
          id: string;
          name: string;
          permissions: Array<{ permission: { key: string } }>;
        } | null;
      }>('/api/auth/me')
      .pipe(
        tap((me) => {
          const next: Session = {
            accessToken: current.accessToken,
            tenantSlug: current.tenantSlug,
            user: {
              sub: me.id,
              tenantId: me.tenantId,
              email: me.email,
              roleId: me.role?.id,
              roleName: me.role?.name,
              permissions: me.role?.permissions.map((entry) => entry.permission.key) ?? []
            }
          };
          this.sessionState.set(next);
          localStorage.setItem('iso-session', JSON.stringify(next));
        }),
        catchError(() => of(null))
      )
      .subscribe();
  }

  logout() {
    this.sessionState.set(null);
    localStorage.removeItem('iso-session');
    void this.router.navigateByUrl('/login');
  }

  private readSession(): Session | null {
    const raw = localStorage.getItem('iso-session');
    return raw ? (JSON.parse(raw) as Session) : null;
  }
}
