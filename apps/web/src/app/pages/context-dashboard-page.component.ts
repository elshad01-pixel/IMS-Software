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
        [description]="'Manage the issues, parties, and expectations that shape the management system.'"
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
        <section class="card focus-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Review focus</span>
              <h3>{{ reviewHeadline() }}</h3>
              <p class="subtle">{{ reviewNarrative() }}</p>
            </div>
          </div>
          <div class="summary-strip compact-summary-strip top-space">
            <article class="summary-item">
              <span>Open</span>
              <strong>{{ recentIssueCount('OPEN') }}</strong>
            </article>
            <article class="summary-item">
              <span>Monitoring</span>
              <strong>{{ recentIssueCount('MONITORING') }}</strong>
            </article>
            <article class="summary-item">
              <span>Resolved</span>
              <strong>{{ recentIssueCount('RESOLVED') }}</strong>
            </article>
            <article class="summary-item">
              <span>Customer feedback</span>
              <strong>{{ customerFeedbackHeadline() }}</strong>
            </article>
          </div>
        </section>

        <section class="card areas-card">
          <div class="section-head compact-head">
            <div>
              <span class="section-eyebrow">Context areas</span>
              <h3>Open one working area at a time</h3>
              <p class="subtle">Choose the register you want to review, then work inside that area without losing the Clause 4 view.</p>
            </div>
          </div>

          <div class="areas-grid top-space">
            <article class="area-card">
              <div class="area-copy">
                <span>Internal issues</span>
                <p>Operational, organizational, and culture factors inside the business.</p>
              </div>
              <strong>{{ dashboard()?.summary?.internalIssues ?? 0 }}</strong>
              <div class="area-actions">
                <a routerLink="/context/internal-issues" class="button-link secondary compact">Open</a>
                <a *ngIf="canWrite()" routerLink="/context/internal-issues/new" class="button-link tertiary compact">Add</a>
              </div>
            </article>

            <article class="area-card">
              <div class="area-copy">
                <span>External issues</span>
                <p>Regulatory, supplier, market, and stakeholder influences on the IMS.</p>
              </div>
              <strong>{{ dashboard()?.summary?.externalIssues ?? 0 }}</strong>
              <div class="area-actions">
                <a routerLink="/context/external-issues" class="button-link secondary compact">Open</a>
                <a *ngIf="canWrite()" routerLink="/context/external-issues/new" class="button-link tertiary compact">Add</a>
              </div>
            </article>

            <article class="area-card">
              <div class="area-copy">
                <span>Interested parties</span>
                <p>Customers, regulators, employees, suppliers, and other key stakeholders.</p>
              </div>
              <strong>{{ dashboard()?.summary?.interestedParties ?? 0 }}</strong>
              <div class="area-actions">
                <a routerLink="/context/interested-parties" class="button-link secondary compact">Open</a>
                <a *ngIf="canWrite()" routerLink="/context/interested-parties/new" class="button-link tertiary compact">Add</a>
              </div>
            </article>

            <article class="area-card">
              <div class="area-copy">
                <span>Needs & expectations</span>
                <p>The requirements and expectations that should stay visible in planning and review.</p>
              </div>
              <strong>{{ dashboard()?.summary?.needsExpectations ?? 0 }}</strong>
              <div class="area-actions">
                <a routerLink="/context/needs-expectations" class="button-link secondary compact">Open</a>
                <a *ngIf="canWrite()" routerLink="/context/needs-expectations/new" class="button-link tertiary compact">Add</a>
              </div>
            </article>
          </div>
        </section>

        <section class="card detail-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Recent issues</span>
              <h3>Latest context records</h3>
              <p class="subtle">Review the latest internal and external issues, then continue into risk or process follow-up where needed.</p>
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
                  <small *ngIf="item.linkedRiskCount || item.linkedProcesses?.length">Linked follow-up: {{ issueLinkSummary(item) }}</small>
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
    .top-space {
      margin-top: 1rem;
    }

    .focus-card {
      padding: 1.05rem;
    }

    .areas-card {
      padding: 1.05rem;
    }

    .areas-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(220px, 300px));
      gap: 0.9rem;
      justify-content: start;
    }

    .area-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0.8rem 1rem;
      align-items: start;
      padding: 1rem;
      border: 1px solid var(--border-subtle);
      border-radius: 1rem;
      background: color-mix(in srgb, var(--surface-strong) 94%, white);
    }

    .compact-summary-strip {
      display: grid;
      grid-template-columns: repeat(4, minmax(180px, 260px));
      gap: 0.75rem;
      justify-content: start;
      align-items: stretch;
    }

    .compact-summary-strip .summary-item {
      min-height: 0;
    }

    .area-copy {
      display: grid;
      gap: 0.3rem;
      min-width: 0;
    }

    .area-card span {
      color: var(--muted);
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .area-copy p {
      margin: 0;
      color: var(--muted);
      line-height: 1.35;
      font-size: 0.92rem;
    }

    .area-card strong {
      font-size: 1.75rem;
      line-height: 1;
      letter-spacing: -0.04em;
      color: var(--text-soft);
      min-width: 2.2rem;
      text-align: right;
    }

    .area-actions {
      display: flex;
      gap: 0.45rem;
      flex-wrap: wrap;
      grid-column: 1 / -1;
    }

    .link-row {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: start;
    }

    .compact-head {
      align-items: center;
    }

    @media (max-width: 1100px) {
      .compact-summary-strip {
        grid-template-columns: repeat(2, minmax(180px, 260px));
      }

      .areas-grid { grid-template-columns: repeat(2, minmax(240px, 1fr)); }
    }

    @media (max-width: 760px) {
      .compact-summary-strip {
        grid-template-columns: minmax(0, 1fr);
      }

      .areas-grid { grid-template-columns: minmax(0, 1fr); }
      .area-card { grid-template-columns: minmax(0, 1fr); }
      .area-card strong { text-align: left; }
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
    return item.type === 'INTERNAL'
      ? ['/context/internal-issues', item.id, 'edit']
      : ['/context/external-issues', item.id, 'edit'];
  }

  protected recentIssueCount(status: 'OPEN' | 'MONITORING' | 'RESOLVED') {
    return (this.dashboard()?.recentIssues || []).filter((item) => item.status === status).length;
  }

  protected reviewHeadline() {
    if (this.recentIssueCount('OPEN') > 0) {
      return 'Open context issues still need active review';
    }
    if (this.recentIssueCount('MONITORING') > 0) {
      return 'Context is under monitoring';
    }
    return 'Clause 4 position is currently stable';
  }

  protected reviewNarrative() {
    if (this.recentIssueCount('OPEN') > 0) {
      return 'Use the open issues as management inputs. Where needed, continue into risk assessment or process review so the issue has visible follow-up.';
    }
    if (this.recentIssueCount('MONITORING') > 0) {
      return 'Monitoring issues remain visible for review and can still be escalated into risks or process changes if the situation worsens.';
    }
    return 'Recent context records are either resolved or not currently driving immediate management attention.';
  }

  protected issueLinkSummary(item: ContextDashboardResponse['recentIssues'][number]) {
    const parts: string[] = [];
    if (item.linkedRiskCount) {
      parts.push(`${item.linkedRiskCount} risk${item.linkedRiskCount === 1 ? '' : 's'}`);
    }
    if (item.linkedProcesses?.length) {
      parts.push(`${item.linkedProcesses.length} process${item.linkedProcesses.length === 1 ? '' : 'es'}`);
    }
    return parts.join(' | ');
  }

  protected customerFeedbackHeadline() {
    const summary = this.dashboard()?.summary;
    if (!summary || !summary.customerSurveyResponses) {
      return 'No data';
    }
    return `${summary.customerSurveyAverage ?? 0}/10`;
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}
