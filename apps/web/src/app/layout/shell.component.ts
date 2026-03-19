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
          <div class="brand-mark">
            <div class="brand-seal">IMS</div>
            <div>
              <div class="pill brand-pill">ISO SaaS</div>
              <h1>Integrated Management</h1>
            </div>
          </div>
          <p>Operational control for documents, risks, audits, CAPA, reviews, KPIs, and training.</p>
        </div>

        <nav>
          <a *ngFor="let item of navItems" [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.exact ?? false }">
            <span class="nav-label">{{ item.label }}</span>
            <small>{{ item.hint }}</small>
          </a>
        </nav>

        <section class="account card account-card">
          <div class="account-copy">
            <div>
              <div class="eyebrow">Tenant</div>
              <strong>{{ authStore.tenantSlug() || 'n/a' }}</strong>
            </div>
            <div>
              <div class="eyebrow">User</div>
              <strong>{{ authStore.session()?.user?.email }}</strong>
            </div>
          </div>
          <button type="button" class="secondary account-button" (click)="authStore.logout()">Sign out</button>
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
      grid-template-columns: 292px minmax(0, 1fr);
      gap: 1.25rem;
      height: 100vh;
      padding: 1.1rem;
      overflow: hidden;
    }

    .sidebar {
      display: grid;
      grid-template-rows: auto 1fr auto;
      padding: 1.35rem;
      gap: 1.35rem;
      position: sticky;
      top: 1.1rem;
      height: calc(100vh - 2.2rem);
      background:
        radial-gradient(circle at top, rgba(184, 132, 51, 0.16), transparent 28%),
        linear-gradient(180deg, rgba(23, 55, 40, 0.985), rgba(21, 44, 33, 0.985));
      color: #f9f4ea;
      overflow: hidden;
    }

    .brand {
      display: grid;
      gap: 0.9rem;
    }

    .brand-mark {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.9rem;
      align-items: start;
    }

    .brand-seal {
      display: grid;
      place-items: center;
      width: 3rem;
      height: 3rem;
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(244, 232, 208, 0.98), rgba(216, 188, 132, 0.96));
      color: #173728;
      font-weight: 900;
      letter-spacing: 0.08em;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
    }

    .brand-pill {
      background: rgba(255, 255, 255, 0.12);
      color: #f9f4ea;
    }

    .brand h1 {
      margin: 0.55rem 0 0;
      font-size: 1.6rem;
      line-height: 1.05;
      letter-spacing: -0.03em;
    }

    .brand p {
      margin: 0;
      color: rgba(249, 244, 234, 0.76);
      line-height: 1.55;
      font-size: 0.95rem;
    }

    nav {
      display: grid;
      gap: 0.35rem;
      align-content: start;
      min-height: 0;
      overflow-y: auto;
      padding-right: 0.25rem;
      margin-right: -0.25rem;
    }

    nav a {
      display: grid;
      gap: 0.12rem;
      border-radius: 16px;
      padding: 0.88rem 0.95rem;
      color: inherit;
      text-decoration: none;
      background: transparent;
      border: 1px solid transparent;
      transition: background-color 140ms ease, border-color 140ms ease, transform 140ms ease;
    }

    nav a:hover {
      transform: translateX(2px);
      background: rgba(255, 255, 255, 0.05);
    }

    nav a.active {
      background: rgba(255, 255, 255, 0.11);
      border-color: rgba(255, 255, 255, 0.1);
      font-weight: 700;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }

    .nav-label {
      font-size: 0.96rem;
      letter-spacing: -0.01em;
    }

    nav small {
      color: rgba(249, 244, 234, 0.64);
      font-size: 0.76rem;
    }

    .account-card {
      display: grid;
      gap: 0.95rem;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.08);
      box-shadow: none;
    }

    .account-copy {
      display: grid;
      gap: 0.75rem;
    }

    .account-button {
      width: 100%;
    }

    .main {
      min-width: 0;
      padding: 0.15rem 0;
      overflow-y: auto;
      max-height: calc(100vh - 2.2rem);
      padding-right: 0.15rem;
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
        height: auto;
        overflow: visible;
      }

      .sidebar {
        position: static;
        height: auto;
        overflow: visible;
      }

      nav a:hover {
        transform: none;
      }

      nav,
      .main {
        overflow: visible;
        max-height: none;
      }
    }
  `]
})
export class ShellComponent {
  protected readonly authStore = inject(AuthStore);
  protected readonly navItems = [
    { path: '/dashboard', label: 'Dashboard', hint: 'Executive overview', exact: true },
    { path: '/documents', label: 'Documents', hint: 'Controlled library' },
    { path: '/risks', label: 'Risks', hint: 'Assessment and treatment' },
    { path: '/capa', label: 'CAPA', hint: 'Corrective workflows' },
    { path: '/audits', label: 'Audits', hint: 'Plans and findings' },
    { path: '/management-review', label: 'Management Review', hint: 'Meetings and decisions' },
    { path: '/kpis', label: 'KPIs', hint: 'Targets and trends' },
    { path: '/training', label: 'Training', hint: 'Assignments and evidence' },
    { path: '/reports', label: 'Reports', hint: 'Exports and summaries' },
    { path: '/users', label: 'Users', hint: 'Access and ownership' },
    { path: '/settings', label: 'Settings', hint: 'System configuration' }
  ];
}
