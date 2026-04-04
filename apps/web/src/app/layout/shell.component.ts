import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStore } from '../core/auth.store';

type NavItem = {
  path: string;
  label: string;
  hint: string;
  icon: string;
  exact?: boolean;
  permission?: string;
};

const SIDEBAR_PIN_KEY = 'ims.sidebar.pinned';

@Component({
  selector: 'iso-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div
      class="shell"
      [class.sidebar-expanded]="sidebarExpanded()"
      [class.sidebar-pinned]="sidebarPinned()"
      [class.sidebar-mobile-open]="mobileNavOpen()"
    >
      <div class="shell-backdrop" *ngIf="isCompactViewport() && mobileNavOpen()" (click)="closeMobileNav()"></div>

      <aside
        class="sidebar card"
        [class.expanded]="sidebarExpanded()"
        [class.pinned]="sidebarPinned()"
        [class.mobile-open]="mobileNavOpen()"
        (mouseenter)="handleSidebarEnter()"
        (mouseleave)="handleSidebarLeave()"
      >
        <div class="sidebar-top">
          <div class="brand">
            <div class="brand-mark">
              <div class="brand-seal">IMS</div>
              <div class="brand-copy" *ngIf="sidebarExpanded()">
                <div class="pill brand-pill">ISO SaaS</div>
                <h1>Integrated Management</h1>
              </div>
            </div>
            <p *ngIf="sidebarExpanded()">Operational control for documents, risks, audits, CAPA, reviews, KPIs, and training.</p>
          </div>

          <button type="button" class="pin-toggle" (click)="togglePin()" [attr.aria-pressed]="sidebarPinned()">
            <span class="pin-toggle__icon">{{ sidebarPinned() ? 'PIN' : 'UNP' }}</span>
            <span *ngIf="sidebarExpanded()">{{ sidebarPinned() ? 'Pinned' : 'Pin sidebar' }}</span>
          </button>
        </div>

        <nav>
          <a
            *ngFor="let item of visibleNavItems()"
            [routerLink]="item.path"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
            [attr.aria-label]="item.label"
          >
            <span class="nav-icon">{{ item.icon }}</span>
            <span class="nav-copy" *ngIf="sidebarExpanded()">
              <span class="nav-label">{{ item.label }}</span>
              <small>{{ item.hint }}</small>
            </span>
          </a>
        </nav>
      </aside>

      <main class="main">
        <header class="topbar card">
          <div class="topbar-copy">
            <div class="topbar-leading">
              <button type="button" class="nav-toggle" (click)="toggleMobileNav()" *ngIf="isCompactViewport()">NAV</button>
              <span class="topbar-label">Workspace</span>
            </div>
            <strong>Integrated Management System</strong>
          </div>

          <div class="topbar-actions">
            <button type="button" class="topbar-pin" (click)="togglePin()" *ngIf="!isCompactViewport()">
              {{ sidebarPinned() ? 'Unpin sidebar' : 'Pin sidebar' }}
            </button>

            <div class="user-menu" [class.open]="menuOpen()">
              <button type="button" class="user-trigger" (click)="toggleMenu($event)">
                <span class="user-trigger__copy">
                  <strong>{{ authStore.session()?.user?.email }}</strong>
                  <small>{{ authStore.tenantSlug() || 'n/a' }}</small>
                </span>
                <span class="user-trigger__caret">V</span>
              </button>

              <section class="user-dropdown card" *ngIf="menuOpen()">
                <div class="user-dropdown__identity">
                  <strong>{{ authStore.session()?.user?.email }}</strong>
                  <small>{{ authStore.tenantSlug() || 'n/a' }}</small>
                  <small>Role: {{ authStore.roleLabel() }}</small>
                </div>
                <div class="user-dropdown__divider"></div>
                <button type="button" class="user-dropdown__item" (click)="logout()">
                  Sign out
                </button>
              </section>
            </div>
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
      --sidebar-collapsed: 5.8rem;
      --sidebar-expanded: 18.25rem;
      display: grid;
      grid-template-columns: var(--sidebar-collapsed) minmax(0, 1fr);
      gap: 1.25rem;
      height: 100vh;
      padding: 1.1rem;
      overflow: hidden;
      position: relative;
      transition: grid-template-columns 180ms ease;
    }

    .shell.sidebar-expanded {
      grid-template-columns: var(--sidebar-expanded) minmax(0, 1fr);
    }

    .shell-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(14, 23, 18, 0.34);
      z-index: 29;
    }

    .sidebar {
      display: grid;
      grid-template-rows: auto 1fr;
      padding: 1.1rem 0.9rem 1.1rem 1rem;
      gap: 1rem;
      position: sticky;
      top: 1.1rem;
      height: calc(100vh - 2.2rem);
      background:
        radial-gradient(circle at top, rgba(184, 132, 51, 0.16), transparent 28%),
        linear-gradient(180deg, rgba(23, 55, 40, 0.985), rgba(21, 44, 33, 0.985));
      color: #f9f4ea;
      overflow: hidden;
      transition: width 180ms ease, padding 180ms ease, box-shadow 180ms ease, transform 180ms ease;
      width: var(--sidebar-collapsed);
      z-index: 30;
    }

    .sidebar.expanded {
      width: var(--sidebar-expanded);
      padding-right: 1.15rem;
    }

    .sidebar-top {
      display: grid;
      gap: 1rem;
    }

    .brand {
      display: grid;
      gap: 0.8rem;
    }

    .brand-mark {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.9rem;
      align-items: start;
    }

    .brand-copy {
      min-width: 0;
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
      flex-shrink: 0;
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

    .pin-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.55rem;
      padding: 0.62rem 0.72rem;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.06);
      color: rgba(249, 244, 234, 0.92);
      box-shadow: none;
      width: 100%;
      min-height: 2.8rem;
    }

    .pin-toggle:hover {
      transform: none;
      box-shadow: none;
      background: rgba(255, 255, 255, 0.1);
    }

    .pin-toggle__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 2.2rem;
      min-height: 2rem;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.1);
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.06em;
    }

    nav {
      display: grid;
      gap: 0.35rem;
      align-content: start;
      min-height: 0;
      overflow-y: auto;
      padding-right: 0.1rem;
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
      grid-template-columns: 2.6rem minmax(0, 1fr);
      gap: 0.75rem;
      align-items: center;
      border-radius: 16px;
      padding: 0.78rem 0.78rem;
      color: inherit;
      text-decoration: none;
      background: transparent;
      border: 1px solid transparent;
      transition: background-color 140ms ease, border-color 140ms ease, transform 140ms ease;
      min-height: 3.35rem;
    }

    .sidebar:not(.expanded) nav a {
      grid-template-columns: 1fr;
      justify-items: center;
      padding-inline: 0.4rem;
    }

    nav a:hover {
      transform: translateX(2px);
      background: rgba(255, 255, 255, 0.05);
    }

    .sidebar:not(.expanded) nav a:hover {
      transform: translateY(-1px);
    }

    nav a.active {
      background: rgba(255, 255, 255, 0.11);
      border-color: rgba(255, 255, 255, 0.1);
      font-weight: 700;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    }

    .nav-icon {
      display: inline-grid;
      place-items: center;
      width: 2.35rem;
      height: 2.35rem;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.08);
      color: #f9f4ea;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.04em;
    }

    .nav-copy {
      display: grid;
      min-width: 0;
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

    .topbar-leading {
      display: flex;
      gap: 0.7rem;
      align-items: center;
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

    .topbar-actions {
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }

    .nav-toggle,
    .topbar-pin {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.68rem 0.85rem;
      border-radius: 14px;
      border: 1px solid rgba(23, 50, 37, 0.08);
      background: rgba(244, 247, 242, 0.92);
      color: var(--text-soft);
      box-shadow: none;
      font-size: 0.8rem;
    }

    .nav-toggle:hover,
    .topbar-pin:hover {
      transform: none;
      box-shadow: none;
      background: rgba(255, 255, 255, 0.98);
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
      .shell,
      .shell.sidebar-expanded {
        grid-template-columns: 1fr;
        height: auto;
        overflow: visible;
      }

      .sidebar {
        position: fixed;
        left: 1rem;
        top: 1rem;
        bottom: 1rem;
        height: auto;
        transform: translateX(calc(-100% - 1rem));
        width: min(20rem, calc(100vw - 2rem));
        max-width: min(20rem, calc(100vw - 2rem));
        box-shadow: 0 24px 48px rgba(17, 28, 21, 0.26);
      }

      .sidebar.mobile-open,
      .sidebar.expanded {
        transform: translateX(0);
        padding-right: 1.15rem;
      }

      .sidebar .brand-copy,
      .sidebar p,
      .sidebar .nav-copy,
      .sidebar .pin-toggle span:not(.pin-toggle__icon) {
        display: block;
      }

      nav a {
        grid-template-columns: 2.6rem minmax(0, 1fr);
        justify-items: stretch;
        padding-inline: 0.78rem;
      }

      nav a:hover {
        transform: none;
      }

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

      .topbar-actions {
        width: 100%;
        justify-content: space-between;
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
  protected readonly mobileNavOpen = signal(false);
  protected readonly sidebarPinned = signal(this.readPinnedPreference());
  protected readonly sidebarHovered = signal(false);
  protected readonly compactViewport = signal(this.readCompactViewport());
  protected readonly navItems: NavItem[] = [
    { path: '/dashboard', label: 'Dashboard', hint: 'Executive overview', icon: 'DB', exact: true, permission: 'dashboard.read' },
    { path: '/documents', label: 'Documents', hint: 'Controlled library', icon: 'DC', permission: 'documents.read' },
    { path: '/risks', label: 'Risks', hint: 'Assessment and treatment', icon: 'RK', permission: 'risks.read' },
    { path: '/capa', label: 'CAPA', hint: 'Corrective workflows', icon: 'CP', permission: 'capa.read' },
    { path: '/audits', label: 'Audits', hint: 'Plans and findings', icon: 'AU', permission: 'audits.read' },
    { path: '/management-review', label: 'Management Review', hint: 'Meetings and decisions', icon: 'MR', permission: 'management-review.read' },
    { path: '/kpis', label: 'KPIs', hint: 'Targets and trends', icon: 'KP', permission: 'kpis.read' },
    { path: '/training', label: 'Training', hint: 'Assignments and evidence', icon: 'TR', permission: 'training.read' },
    { path: '/actions', label: 'Actions', hint: 'Global follow-up tracker', icon: 'AC', permission: 'dashboard.read' },
    { path: '/ncr', label: 'NCR', hint: 'Nonconformance control', icon: 'NC', permission: 'ncr.read' },
    { path: '/context', label: 'Context', hint: 'Clause 4 issues and parties', icon: 'CX', permission: 'context.read' },
    { path: '/process-register', label: 'Process Register', hint: 'Business process links', icon: 'PR', permission: 'processes.read' },
    { path: '/reports', label: 'Reports', hint: 'Exports and summaries', icon: 'RP', permission: 'reports.read' },
    { path: '/users', label: 'Users', hint: 'Access and ownership', icon: 'US', permission: 'users.read' },
    { path: '/settings', label: 'Settings', hint: 'System configuration', icon: 'ST', permission: 'settings.read' }
  ];
  protected readonly visibleNavItems = computed(() =>
    this.navItems.filter((item) => !item.permission || this.authStore.hasPermission(item.permission))
  );

  protected sidebarExpanded() {
    if (this.isCompactViewport()) {
      return this.mobileNavOpen();
    }

    return this.sidebarPinned() || this.sidebarHovered();
  }

  protected isCompactViewport() {
    return this.compactViewport();
  }

  protected handleSidebarEnter() {
    if (!this.isCompactViewport() && !this.sidebarPinned()) {
      this.sidebarHovered.set(true);
    }
  }

  protected handleSidebarLeave() {
    if (!this.isCompactViewport() && !this.sidebarPinned()) {
      this.sidebarHovered.set(false);
    }
  }

  protected togglePin() {
    const next = !this.sidebarPinned();
    this.sidebarPinned.set(next);
    this.sidebarHovered.set(false);
    this.writePinnedPreference(next);
  }

  protected toggleMobileNav() {
    this.mobileNavOpen.update((value) => !value);
  }

  protected closeMobileNav() {
    this.mobileNavOpen.set(false);
  }

  protected toggleMenu(event: Event) {
    event.stopPropagation();
    this.menuOpen.update((value) => !value);
  }

  protected logout() {
    this.menuOpen.set(false);
    this.authStore.logout();
  }

  @HostListener('window:resize')
  protected onResize() {
    const compact = this.readCompactViewport();
    this.compactViewport.set(compact);
    if (!compact) {
      this.mobileNavOpen.set(false);
    }
  }

  @HostListener('document:click')
  protected closeMenu() {
    this.menuOpen.set(false);
  }

  private readPinnedPreference() {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.localStorage.getItem(SIDEBAR_PIN_KEY) === 'true';
  }

  private writePinnedPreference(value: boolean) {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(SIDEBAR_PIN_KEY, String(value));
  }

  private readCompactViewport() {
    return typeof window !== 'undefined' ? window.innerWidth <= 960 : false;
  }
}
