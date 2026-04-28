import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import { ContextApiService } from '../core/context-api.service';
import { ContextDashboardResponse } from '../core/context.models';
import { I18nService } from '../core/i18n.service';
import { PageHeaderComponent } from '../shared/page-header.component';

@Component({
  selector: 'iso-context-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeaderComponent, TranslatePipe],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="t('contextDashboard.page.label')"
        [title]="t('contextDashboard.page.title')"
        [description]="t('contextDashboard.page.description')"
        [breadcrumbs]="[{ label: t('contextDashboard.page.breadcrumb') }]"
      >
        <a *ngIf="canWrite()" routerLink="/context/internal-issues/new" class="button-link">+ {{ 'contextDashboard.actions.newInternalIssue' | translate }}</a>
        <a *ngIf="canWrite()" routerLink="/context/external-issues/new" class="button-link secondary">+ {{ 'contextDashboard.actions.newExternalIssue' | translate }}</a>
      </iso-page-header>

      <section *ngIf="!canRead()" class="card list-card">
        <div class="empty-state">
          <strong>{{ 'contextDashboard.empty.noAccessTitle' | translate }}</strong>
          <span>{{ 'contextDashboard.empty.noAccessCopy' | translate }}</span>
        </div>
      </section>

      <section *ngIf="canRead()" class="page-stack">
        <section class="card focus-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">{{ 'contextDashboard.focus.eyebrow' | translate }}</span>
              <h3>{{ reviewHeadline() }}</h3>
              <p class="subtle">{{ reviewNarrative() }}</p>
            </div>
          </div>
          <div class="summary-strip compact-summary-strip top-space">
            <article class="summary-item">
              <span>{{ 'contextDashboard.focus.open' | translate }}</span>
              <strong>{{ recentIssueCount('OPEN') }}</strong>
            </article>
            <article class="summary-item">
              <span>{{ 'contextDashboard.focus.monitoring' | translate }}</span>
              <strong>{{ recentIssueCount('MONITORING') }}</strong>
            </article>
            <article class="summary-item">
              <span>{{ 'contextDashboard.focus.resolved' | translate }}</span>
              <strong>{{ recentIssueCount('RESOLVED') }}</strong>
            </article>
            <article class="summary-item">
              <span>{{ 'contextDashboard.focus.customerFeedback' | translate }}</span>
              <strong>{{ customerFeedbackHeadline() }}</strong>
            </article>
          </div>
        </section>

        <section class="card areas-card">
          <div class="section-head compact-head">
            <div>
              <span class="section-eyebrow">{{ 'contextDashboard.areas.eyebrow' | translate }}</span>
              <h3>{{ 'contextDashboard.areas.title' | translate }}</h3>
              <p class="subtle">{{ 'contextDashboard.areas.copy' | translate }}</p>
            </div>
          </div>

          <div class="areas-grid top-space">
            <article class="area-card">
              <div class="area-copy">
                <span>{{ 'contextDashboard.areas.internalIssues.label' | translate }}</span>
                <p>{{ 'contextDashboard.areas.internalIssues.copy' | translate }}</p>
              </div>
              <strong>{{ dashboard()?.summary?.internalIssues ?? 0 }}</strong>
              <div class="area-actions">
                <a routerLink="/context/internal-issues" class="button-link secondary compact">{{ 'common.open' | translate }}</a>
                <a *ngIf="canWrite()" routerLink="/context/internal-issues/new" class="button-link tertiary compact">{{ 'contextDashboard.actions.add' | translate }}</a>
              </div>
            </article>

            <article class="area-card">
              <div class="area-copy">
                <span>{{ 'contextDashboard.areas.externalIssues.label' | translate }}</span>
                <p>{{ 'contextDashboard.areas.externalIssues.copy' | translate }}</p>
              </div>
              <strong>{{ dashboard()?.summary?.externalIssues ?? 0 }}</strong>
              <div class="area-actions">
                <a routerLink="/context/external-issues" class="button-link secondary compact">{{ 'common.open' | translate }}</a>
                <a *ngIf="canWrite()" routerLink="/context/external-issues/new" class="button-link tertiary compact">{{ 'contextDashboard.actions.add' | translate }}</a>
              </div>
            </article>

            <article class="area-card">
              <div class="area-copy">
                <span>{{ 'contextDashboard.areas.interestedParties.label' | translate }}</span>
                <p>{{ 'contextDashboard.areas.interestedParties.copy' | translate }}</p>
              </div>
              <strong>{{ dashboard()?.summary?.interestedParties ?? 0 }}</strong>
              <div class="area-actions">
                <a routerLink="/context/interested-parties" class="button-link secondary compact">{{ 'common.open' | translate }}</a>
                <a *ngIf="canWrite()" routerLink="/context/interested-parties/new" class="button-link tertiary compact">{{ 'contextDashboard.actions.add' | translate }}</a>
              </div>
            </article>

            <article class="area-card">
              <div class="area-copy">
                <span>{{ 'contextDashboard.areas.needs.label' | translate }}</span>
                <p>{{ 'contextDashboard.areas.needs.copy' | translate }}</p>
              </div>
              <strong>{{ dashboard()?.summary?.needsExpectations ?? 0 }}</strong>
              <div class="area-actions">
                <a routerLink="/context/needs-expectations" class="button-link secondary compact">{{ 'common.open' | translate }}</a>
                <a *ngIf="canWrite()" routerLink="/context/needs-expectations/new" class="button-link tertiary compact">{{ 'contextDashboard.actions.add' | translate }}</a>
              </div>
            </article>
          </div>
        </section>

        <section class="card detail-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">{{ 'contextDashboard.recent.eyebrow' | translate }}</span>
              <h3>{{ 'contextDashboard.recent.title' | translate }}</h3>
              <p class="subtle">{{ 'contextDashboard.recent.copy' | translate }}</p>
            </div>
          </div>

          <p class="feedback" [class.is-empty]="!error()" [class.error]="!!error()">{{ error() || '' }}</p>

          <div class="empty-state top-space" *ngIf="loading()">
            <strong>{{ 'contextDashboard.empty.loadingTitle' | translate }}</strong>
            <span>{{ 'contextDashboard.empty.loadingCopy' | translate }}</span>
          </div>

          <div class="empty-state top-space" *ngIf="!loading() && !(dashboard()?.recentIssues?.length)">
            <strong>{{ 'contextDashboard.empty.noIssuesTitle' | translate }}</strong>
            <span>{{ 'contextDashboard.empty.noIssuesCopy' | translate }}</span>
          </div>

          <div class="entity-list top-space" *ngIf="!loading() && dashboard()?.recentIssues?.length">
            <div class="entity-item" *ngFor="let item of dashboard()?.recentIssues">
              <div class="link-row">
                <div>
                  <strong>{{ item.title }}</strong>
                  <small>{{ item.type === 'INTERNAL' ? t('contextDashboard.recent.internalIssue') : t('contextDashboard.recent.externalIssue') }}<span *ngIf="item.category"> • {{ item.category }}</span></small>
                  <small *ngIf="item.linkedRiskCount || item.linkedProcesses?.length">{{ t('contextDashboard.recent.linkedFollowUp') }}: {{ issueLinkSummary(item) }}</small>
                </div>
                <div class="route-context">
                  <span class="status-badge" [ngClass]="item.status === 'RESOLVED' ? 'success' : item.status === 'ARCHIVED' ? 'neutral' : 'warn'">{{ labelize(item.status) }}</span>
                  <a [routerLink]="issueEditPath(item)" class="button-link secondary compact">{{ 'common.open' | translate }}</a>
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
      padding: 1rem 1rem 0.9rem;
      border: 1px solid rgba(31, 41, 51, 0.08);
      border-radius: 1rem;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(251, 252, 250, 0.94)),
        color-mix(in srgb, var(--surface-strong) 94%, white);
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.85);
      position: relative;
      overflow: hidden;
    }

    .area-card::before {
      content: '';
      position: absolute;
      inset: 0 auto auto 0;
      width: 100%;
      height: 4px;
      background: var(--area-accent, rgba(23, 59, 47, 0.4));
    }

    .area-card:nth-child(1) { --area-accent: #173B2F; }
    .area-card:nth-child(2) { --area-accent: #1E467F; }
    .area-card:nth-child(3) { --area-accent: #6A4C93; }
    .area-card:nth-child(4) { --area-accent: #9A6B1F; }

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
      gap: 0.42rem;
      min-width: 0;
    }

    .area-card span {
      color: var(--muted-strong);
      font-size: 0.74rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .area-copy p {
      margin: 0;
      color: var(--muted);
      line-height: 1.4;
      font-size: 0.9rem;
    }

    .area-card strong {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 2.6rem;
      height: 2.35rem;
      padding: 0 0.7rem;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--area-accent) 18%, white);
      background: color-mix(in srgb, var(--area-accent) 10%, white);
      font-size: 1.35rem;
      line-height: 1;
      letter-spacing: -0.03em;
      color: var(--text-soft);
      text-align: right;
    }

    .area-actions {
      display: flex;
      gap: 0.45rem;
      flex-wrap: wrap;
      grid-column: 1 / -1;
      padding-top: 0.7rem;
      border-top: 1px solid rgba(31, 41, 51, 0.08);
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
      .area-card strong {
        justify-self: start;
        text-align: left;
      }
    }
  `]
})
export class ContextDashboardPageComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly contextApi = inject(ContextApiService);
  private readonly i18n = inject(I18nService);

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
        this.error.set(this.readError(error, this.t('contextDashboard.errors.load')));
      }
    });
  }

  protected canRead() {
    return this.authStore.hasPermission('context.read');
  }

  protected canWrite() {
    return this.authStore.hasPermission('context.write');
  }

  protected t(key: string, params?: Record<string, unknown>) {
    return this.i18n.t(key, params);
  }

  protected labelize(value: string) {
    this.i18n.language();
    const map: Record<string, string> = {
      OPEN: this.t('contextDashboard.status.open'),
      MONITORING: this.t('contextDashboard.status.monitoring'),
      RESOLVED: this.t('contextDashboard.status.resolved'),
      ARCHIVED: this.t('contextDashboard.status.archived')
    };
    return map[value] ?? value;
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
    this.i18n.language();
    if (this.recentIssueCount('OPEN') > 0) {
      return this.t('contextDashboard.focus.headlines.open');
    }
    if (this.recentIssueCount('MONITORING') > 0) {
      return this.t('contextDashboard.focus.headlines.monitoring');
    }
    return this.t('contextDashboard.focus.headlines.stable');
  }

  protected reviewNarrative() {
    this.i18n.language();
    if (this.recentIssueCount('OPEN') > 0) {
      return this.t('contextDashboard.focus.narratives.open');
    }
    if (this.recentIssueCount('MONITORING') > 0) {
      return this.t('contextDashboard.focus.narratives.monitoring');
    }
    return this.t('contextDashboard.focus.narratives.stable');
  }

  protected issueLinkSummary(item: ContextDashboardResponse['recentIssues'][number]) {
    const parts: string[] = [];
    if (item.linkedRiskCount) {
      parts.push(this.t('contextDashboard.recent.links.risks', { count: item.linkedRiskCount }));
    }
    if (item.linkedProcesses?.length) {
      parts.push(this.t('contextDashboard.recent.links.processes', { count: item.linkedProcesses.length }));
    }
    return parts.join(' | ');
  }

  protected customerFeedbackHeadline() {
    const summary = this.dashboard()?.summary;
    if (!summary || !summary.customerSurveyResponses) {
      return this.t('dashboard.metrics.customerFeedback.noData');
    }
    return `${summary.customerSurveyAverage ?? 0}/10`;
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}
