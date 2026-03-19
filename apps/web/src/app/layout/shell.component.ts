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
        <div class="brand">
          <div class="pill">ISO SaaS</div>
          <h1>Integrated Management</h1>
          <p>Operational control for documents, risks, audits, CAPA, reviews, KPIs, and training.</p>
        </div>

        <nav>
          <a *ngFor="let item of navItems" [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.exact ?? false }">
            <span>{{ item.label }}</span>
          </a>
        </nav>

        <section class="account card account-card">
          <div>
            <div class="eyebrow">Tenant</div>
            <strong>{{ authStore.tenantSlug() || 'n/a' }}</strong>
          </div>
          <div>
            <div class="eyebrow">User</div>
            <strong>{{ authStore.session()?.user?.email }}</strong>
          </div>
          <button type="button" (click)="authStore.logout()">Sign out</button>
        </section>
      </aside>

      <main class="main">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .shell {
      display: grid;
      grid-template-columns: 270px minmax(0, 1fr);
      gap: 1.1rem;
      min-height: 100vh;
      padding: 1rem;
    }

    .sidebar {
      display: grid;
      grid-template-rows: auto 1fr auto;
      padding: 1.25rem;
      gap: 1.25rem;
      position: sticky;
      top: 1rem;
      height: calc(100vh - 2rem);
      background: linear-gradient(180deg, rgba(23, 55, 40, 0.98), rgba(31, 74, 55, 0.97));
      color: #f9f4ea;
    }

    .brand h1 {
      margin: 0.8rem 0 0.35rem;
      font-size: 1.55rem;
      line-height: 1.1;
    }

    .brand p {
      margin: 0;
      color: rgba(249, 244, 234, 0.78);
      line-height: 1.45;
    }

    nav {
      display: grid;
      gap: 0.28rem;
      align-content: start;
    }

    nav a {
      display: flex;
      align-items: center;
      border-radius: 12px;
      padding: 0.78rem 0.9rem;
      color: inherit;
      text-decoration: none;
      background: transparent;
      border: 1px solid transparent;
    }

    nav a.active {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.08);
      font-weight: 700;
    }

    .account-card {
      display: grid;
      gap: 0.8rem;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.08);
      box-shadow: none;
    }

    button {
      border: 0;
      border-radius: 12px;
      padding: 0.85rem 1rem;
      background: #f4e8d0;
      color: #173728;
      font-weight: 700;
      cursor: pointer;
    }

    .main {
      min-width: 0;
    }

    .eyebrow {
      font-size: 0.75rem;
      color: rgba(249, 244, 234, 0.72);
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
    { path: '/dashboard', label: 'Dashboard', exact: true },
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
