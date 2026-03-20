import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, signal } from '@angular/core';
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
      </aside>

      <main class="main">
        <header class="topbar card">
          <div class="topbar-copy">
            <span class="topbar-label">Workspace</span>
            <strong>Integrated Management System</strong>
          </div>

          <div class="user-menu" [class.open]="menuOpen()">
            <button type="button" class="user-trigger" (click)="toggleMenu($event)">
              <span class="user-trigger__copy">
                <strong>{{ authStore.session()?.user?.email }}</strong>
                <small>{{ authStore.tenantSlug() || 'n/a' }}</small>
              </span>
              <span class="user-trigger__caret">▾</span>
            </button>

            <section class="user-dropdown card" *ngIf="menuOpen()">
              <div class="user-dropdown__identity">
                <strong>{{ authStore.session()?.user?.email }}</strong>
                <small>{{ authStore.tenantSlug() || 'n/a' }}</small>
              </div>
              <div class="user-dropdown__divider"></div>
              <button type="button" class="user-dropdown__item" (click)="logout()">
                Sign out
              </button>
            </section>
          </div>
        </header>

        <section class="main-body">
          <router-outlet />
        </section>
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
      grid-template-rows: auto 1fr;
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
      scrollbar-width: thin;
      scrollbar-color: rgba(244, 232, 208, 0.18) transparent;
    }

    nav::-webkit-scrollbar {
      width: 8px;
    }

    nav::-webkit-scrollbar-track {
      background: transparent;
    }

    nav::-webkit-scrollbar-thumb {
      background: rgba(244, 232, 208, 0.12);
      border-radius: 999px;
      border: 2px solid transparent;
      background-clip: padding-box;
    }

    nav::-webkit-scrollbar-thumb:hover {
      background: rgba(244, 232, 208, 0.28);
      background-clip: padding-box;
    }

    nav::-webkit-scrollbar-button {
      display: none;
      width: 0;
      height: 0;
    }

    .sidebar:hover nav {
      scrollbar-color: rgba(244, 232, 208, 0.3) transparent;
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

    .main {
      min-width: 0;
      padding: 0.15rem 0;
      overflow-y: auto;
      max-height: calc(100vh - 2.2rem);
      padding-right: 0.15rem;
      display: grid;
      gap: 1rem;
      align-content: start;
    }

    .eyebrow {
      font-size: 0.75rem;
      color: rgba(249, 244, 234, 0.72);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding: 0.9rem 1.15rem;
      min-height: 4.25rem;
      background: rgba(255, 255, 255, 0.82);
      position: sticky;
      top: 0;
      z-index: 20;
      backdrop-filter: blur(14px);
    }

    .topbar-copy {
      display: grid;
      gap: 0.12rem;
    }

    .topbar-copy strong {
      font-size: 1rem;
      letter-spacing: -0.02em;
      color: var(--text-soft);
    }

    .topbar-label {
      color: var(--muted);
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .main-body {
      min-width: 0;
      padding-bottom: 1rem;
    }

    .user-menu {
      position: relative;
    }

    .user-trigger {
      display: inline-flex;
      align-items: center;
      gap: 0.8rem;
      min-width: 13.5rem;
      padding: 0.72rem 0.85rem;
      border-radius: 16px;
      border: 1px solid rgba(23, 50, 37, 0.08);
      background: rgba(244, 247, 242, 0.92);
      color: var(--text);
      box-shadow: none;
      transition: background-color 140ms ease, border-color 140ms ease, transform 140ms ease;
    }

    .user-trigger:hover {
      transform: translateY(-1px);
      background: rgba(255, 255, 255, 0.98);
      border-color: rgba(36, 79, 61, 0.14);
      box-shadow: var(--shadow-soft);
    }

    .user-trigger__copy {
      display: grid;
      gap: 0.12rem;
      text-align: left;
      min-width: 0;
      flex: 1;
    }

    .user-trigger__copy strong,
    .user-dropdown__identity strong {
      font-size: 0.92rem;
      line-height: 1.2;
      color: var(--text-soft);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-trigger__copy small,
    .user-dropdown__identity small {
      color: var(--muted);
      font-size: 0.78rem;
    }

    .user-trigger__caret {
      color: var(--muted-strong);
      font-size: 0.82rem;
      transition: transform 140ms ease;
    }

    .user-menu.open .user-trigger__caret {
      transform: rotate(180deg);
    }

    .user-dropdown {
      position: absolute;
      top: calc(100% + 0.65rem);
      right: 0;
      min-width: 15rem;
      padding: 0.7rem;
      display: grid;
      gap: 0.55rem;
      background: rgba(255, 255, 255, 0.98);
      animation: dropdown-in 160ms ease;
    }

    .user-dropdown__identity {
      display: grid;
      gap: 0.15rem;
      padding: 0.45rem 0.45rem 0.2rem;
    }

    .user-dropdown__divider {
      height: 1px;
      background: rgba(23, 50, 37, 0.08);
      margin: 0 0.2rem;
    }

    .user-dropdown__item {
      justify-content: flex-start;
      width: 100%;
      background: transparent;
      color: var(--text-soft);
      box-shadow: none;
      padding: 0.8rem 0.85rem;
    }

    .user-dropdown__item:hover {
      background: rgba(23, 50, 37, 0.04);
      box-shadow: none;
      transform: none;
    }

    @keyframes dropdown-in {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }

      to {
        opacity: 1;
        transform: translateY(0);
      }
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

      .topbar {
        position: static;
      }
    }

    @media (max-width: 700px) {
      .topbar {
        display: grid;
        align-items: start;
      }

      .user-trigger,
      .user-dropdown {
        min-width: 100%;
        width: 100%;
      }
    }
  `]
})
export class ShellComponent {
  protected readonly authStore = inject(AuthStore);
  protected readonly menuOpen = signal(false);
  protected readonly navItems = [
    { path: '/dashboard', label: 'Dashboard', hint: 'Executive overview', exact: true },
    { path: '/documents', label: 'Documents', hint: 'Controlled library' },
    { path: '/risks', label: 'Risks', hint: 'Assessment and treatment' },
    { path: '/capa', label: 'CAPA', hint: 'Corrective workflows' },
    { path: '/audits', label: 'Audits', hint: 'Plans and findings' },
    { path: '/management-review', label: 'Management Review', hint: 'Meetings and decisions' },
    { path: '/kpis', label: 'KPIs', hint: 'Targets and trends' },
    { path: '/training', label: 'Training', hint: 'Assignments and evidence' },
    { path: '/actions', label: 'Actions', hint: 'Global follow-up tracker' },
    { path: '/reports', label: 'Reports', hint: 'Exports and summaries' },
    { path: '/users', label: 'Users', hint: 'Access and ownership' },
    { path: '/settings', label: 'Settings', hint: 'System configuration' }
  ];

  protected toggleMenu(event: Event) {
    event.stopPropagation();
    this.menuOpen.update((value) => !value);
  }

  protected logout() {
    this.menuOpen.set(false);
    this.authStore.logout();
  }

  @HostListener('document:click')
  protected closeMenu() {
    this.menuOpen.set(false);
  }
}
