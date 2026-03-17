import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStore } from '../core/auth.store';

@Component({
  selector: 'iso-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <aside class="sidebar card">
        <div>
          <div class="pill">ISO SaaS</div>
          <h1>Integrated Management</h1>
          <p>Multi-tenant platform for ISO operations, controls, and follow-up.</p>
        </div>

        <nav>
          <a *ngFor="let item of navItems" [routerLink]="item.path" routerLinkActive="active">{{ item.label }}</a>
        </nav>

        <button type="button" (click)="authStore.logout()">Sign out</button>
      </aside>

      <main class="main">
        <header class="topbar card">
          <div>
            <div class="eyebrow">Tenant</div>
            <strong>{{ authStore.tenantSlug() || 'n/a' }}</strong>
          </div>
          <div>
            <div class="eyebrow">User</div>
            <strong>{{ authStore.session()?.user?.email }}</strong>
          </div>
        </header>

        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .shell {
      display: grid;
      grid-template-columns: 290px 1fr;
      gap: 1.25rem;
      min-height: 100vh;
      padding: 1.25rem;
    }

    .sidebar {
      display: grid;
      align-content: space-between;
      padding: 1.5rem;
      gap: 1.5rem;
      position: sticky;
      top: 1.25rem;
      height: calc(100vh - 2.5rem);
      background: linear-gradient(180deg, rgba(23, 55, 40, 0.98), rgba(40, 89, 67, 0.96));
      color: #f9f4ea;
    }

    .sidebar h1 {
      margin: 0.9rem 0 0.4rem;
      font-size: 1.8rem;
      line-height: 1.1;
    }

    .sidebar p {
      margin: 0;
      color: rgba(249, 244, 234, 0.78);
    }

    nav {
      display: grid;
      gap: 0.35rem;
    }

    nav a {
      border-radius: 14px;
      padding: 0.8rem 0.95rem;
      color: inherit;
      text-decoration: none;
      background: rgba(255, 255, 255, 0.05);
    }

    nav a.active {
      background: rgba(255, 255, 255, 0.16);
      font-weight: 700;
    }

    button {
      border: 0;
      border-radius: 14px;
      padding: 0.95rem 1rem;
      background: #f4e8d0;
      color: #173728;
      font-weight: 700;
      cursor: pointer;
    }

    .main {
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 1.25rem;
      min-width: 0;
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding: 1.1rem 1.3rem;
    }

    .eyebrow {
      font-size: 0.75rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    @media (max-width: 960px) {
      .shell {
        grid-template-columns: 1fr;
      }

      .sidebar {
        position: static;
        height: auto;
      }
    }
  `]
})
export class ShellComponent {
  protected readonly authStore = inject(AuthStore);
  protected readonly navItems = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/documents', label: 'Documents' },
    { path: '/risks', label: 'Risks' },
    { path: '/capa', label: 'CAPA' },
    { path: '/audits', label: 'Audits' },
    { path: '/management-review', label: 'Management Review' },
    { path: '/kpis', label: 'KPIs' },
    { path: '/training', label: 'Training' },
    { path: '/reports', label: 'Reports' },
    { path: '/users', label: 'Users' },
    { path: '/settings', label: 'Settings' }
  ];
}
