import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import { ContextApiService } from '../core/context-api.service';
import { ContextDashboardResponse } from '../core/context.models';
import { PageHeaderComponent } from '../shared/page-header.component';

@Component({
  selector: 'iso-context-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeaderComponent],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="'Clause 4'"
        [title]="'Context of Organization'"
        [description]="'Keep internal and external issues, interested parties, needs, and risk links visible in one lightweight place.'"
        [breadcrumbs]="[{ label: 'Context of Organization' }]"
      >
        <a *ngIf="canWrite()" routerLink="/context/internal-issues/new" class="button-link">+ New internal issue</a>
        <a *ngIf="canWrite()" routerLink="/context/external-issues/new" class="button-link secondary">+ New external issue</a>
      </iso-page-header>

      <section *ngIf="!canRead()" class="card list-card">
        <div class="empty-state">
          <strong>Context access is not available</strong>
          <span>Your current role does not include context.read.</span>
        </div>
      </section>

      <section *ngIf="canRead()" class="page-stack">
        <div class="summary-grid">
          <article class="card summary-card">
            <div class="summary-copy">
              <span>Internal Issues</span>
              <small>Operational and organizational factors inside the IMS.</small>
            </div>
            <strong>{{ dashboard()?.summary?.internalIssues ?? 0 }}</strong>
            <div class="summary-actions">
              <a routerLink="/context/internal-issues" class="button-link secondary compact">Open Register</a>
              <a *ngIf="canWrite()" routerLink="/context/internal-issues/new" class="button-link tertiary compact">Create</a>
            </div>
          </article>
          <article class="card summary-card">
            <div class="summary-copy">
              <span>External Issues</span>
              <small>Regulatory, supplier, market, and stakeholder factors.</small>
            </div>
            <strong>{{ dashboard()?.summary?.externalIssues ?? 0 }}</strong>
            <div class="summary-actions">
              <a routerLink="/context/external-issues" class="button-link secondary compact">Open Register</a>
              <a *ngIf="canWrite()" routerLink="/context/external-issues/new" class="button-link tertiary compact">Create</a>
            </div>
          </article>
          <article class="card summary-card">
            <div class="summary-copy">
              <span>Interested Parties</span>
              <small>Customers, regulators, employees, suppliers, and others.</small>
            </div>
            <strong>{{ dashboard()?.summary?.interestedParties ?? 0 }}</strong>
            <div class="summary-actions">
              <a routerLink="/context/interested-parties" class="button-link secondary compact">Open Register</a>
              <a *ngIf="canWrite()" routerLink="/context/interested-parties/new" class="button-link tertiary compact">Create</a>
            </div>
          </article>
          <article class="card summary-card">
            <div class="summary-copy">
              <span>Needs & Expectations</span>
              <small>What interested parties need or expect from the IMS.</small>
            </div>
            <strong>{{ dashboard()?.summary?.needsExpectations ?? 0 }}</strong>
            <div class="summary-actions">
              <a routerLink="/context/needs-expectations" class="button-link secondary compact">Open Register</a>
              <a *ngIf="canWrite()" routerLink="/context/needs-expectations/new" class="button-link tertiary compact">Create</a>
            </div>
          </article>
        </div>

        <section class="card detail-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Recent issues</span>
              <h3>Latest context records</h3>
              <p class="subtle">Review the latest internal and external issues and continue from the relevant register.</p>
            </div>
          </div>

          <p class="feedback" [class.is-empty]="!error()" [class.error]="!!error()">{{ error() || '' }}</p>

          <div class="empty-state top-space" *ngIf="loading()">
            <strong>Loading context dashboard</strong>
            <span>Refreshing Clause 4 records.</span>
          </div>

          <div class="empty-state top-space" *ngIf="!loading() && !(dashboard()?.recentIssues?.length)">
            <strong>No issues recorded yet</strong>
            <span>Start by adding internal or external issues.</span>
          </div>

          <div class="entity-list top-space" *ngIf="!loading() && dashboard()?.recentIssues?.length">
            <div class="entity-item" *ngFor="let item of dashboard()?.recentIssues">
              <div class="link-row">
                <div>
                  <strong>{{ item.title }}</strong>
                  <small>{{ item.type === 'INTERNAL' ? 'Internal issue' : 'External issue' }}<span *ngIf="item.category"> • {{ item.category }}</span></small>
                </div>
                <div class="route-context">
                  <span class="status-badge" [ngClass]="item.status === 'RESOLVED' ? 'success' : item.status === 'ARCHIVED' ? 'neutral' : 'warn'">{{ labelize(item.status) }}</span>
                  <a [routerLink]="issueEditPath(item)" class="button-link secondary compact">Open</a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </section>
    </section>
  `,
  styles: [`
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.85rem;
    }
    .summary-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      align-items: center;
      gap: 0.9rem;
      padding: 0.95rem 1.05rem;
      min-height: 0;
    }
    .summary-copy {
      display: grid;
      gap: 0.2rem;
      min-width: 0;
    }
    .summary-card span {
      color: var(--muted);
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .summary-copy small {
      color: var(--muted);
      line-height: 1.35;
    }
    .summary-card strong {
      font-size: 1.85rem;
      line-height: 1;
      letter-spacing: -0.04em;
      color: var(--text-soft);
      min-width: 2.2rem;
      text-align: right;
    }
    .summary-actions {
      display: flex;
      gap: 0.45rem;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .link-row { display: flex; justify-content: space-between; gap: 1rem; align-items: start; }
    @media (max-width: 1100px) {
      .summary-grid { grid-template-columns: minmax(0, 1fr); }
      .summary-card { grid-template-columns: minmax(0, 1fr) auto; }
      .summary-actions { grid-column: 1 / -1; justify-content: flex-start; }
    }
    @media (max-width: 760px) {
      .summary-card { grid-template-columns: minmax(0, 1fr); }
      .summary-card strong { text-align: left; }
    }
  `]
})
export class ContextDashboardPageComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly contextApi = inject(ContextApiService);

  protected readonly dashboard = signal<ContextDashboardResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  ngOnInit() {
    if (!this.canRead()) {
      return;
    }

    this.loading.set(true);
    this.contextApi.dashboard().subscribe({
      next: (dashboard) => {
        this.loading.set(false);
        this.dashboard.set(dashboard);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Context dashboard could not be loaded.'));
      }
    });
  }

  protected canRead() {
    return this.authStore.hasPermission('context.read');
  }

  protected canWrite() {
    return this.authStore.hasPermission('context.write');
  }

  protected labelize(value: string) {
    return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (part) => part.toUpperCase());
  }

  protected issueEditPath(item: { type: 'INTERNAL' | 'EXTERNAL'; id: string }) {
    return item.type === 'INTERNAL' ? ['/context/internal-issues', item.id, 'edit'] : ['/context/external-issues', item.id, 'edit'];
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}
