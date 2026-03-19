import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { PageHeaderComponent } from '../shared/page-header.component';

type DashboardResponse = {
  metrics: Record<string, number>;
  riskSummary: { open: number; inTreatment: number; mitigated: number };
  capaSummary: { investigating: number; inProgress: number; verified: number };
  auditSummary: { planned: number; inProgress: number; completed: number };
  kpiSummaryCounts: { watch: number; breach: number };
  trainingSummaryCounts: { assigned: number; inProgress: number; completed: number };
  highRisks: Array<{ id: string; title: string; score: number; status: string }>;
  recentDocuments: Array<{ id: string; code: string; title: string; status: string; version: number; revision: number }>;
  recentCapas: Array<{ id: string; title: string; status: string; dueDate?: string }>;
  recentAudits: Array<{ id: string; title: string; status: string; scheduledAt?: string }>;
  kpiSummary: Array<{ id: string; name: string; actual: number; target: number; unit: string; status: string }>;
  trainingSummary: Array<{ id: string; title: string; completion: number; dueDate?: string }>;
  actionItems: Array<{
    id: string;
    title: string;
    status: string;
    dueDate?: string;
    sourceType: string;
    owner?: { firstName: string; lastName: string } | null;
  }>;
};

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeaderComponent],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="'Dashboard'"
        [title]="'Integrated management overview'"
        [description]="'A premium operating view of document control, risk exposure, CAPA execution, and cross-functional follow-up.'"
        [breadcrumbs]="[{ label: 'Dashboard' }]"
      >
        <a routerLink="/documents/new" class="button-link">Create document</a>
      </iso-page-header>

      <section class="metric-grid">
        <article class="metric-tile hero-metric" *ngFor="let item of topMetricEntries()">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <small>{{ item.copy }}</small>
        </article>
      </section>

      <section class="page-columns">
        <div class="page-stack">
          <section class="card panel-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Operations</span>
                <h3>Operational summaries</h3>
                <p class="subtle">A tighter read on cross-module workload, exposure, and active follow-up.</p>
              </div>
            </div>

            <div class="detail-grid top-space">
              <article class="detail-item">
                <span>Risks in treatment</span>
                <strong>{{ data().riskSummary.inTreatment }}</strong>
                <a routerLink="/risks" class="text-link">Open risks</a>
              </article>
              <article class="detail-item">
                <span>Open CAPA work</span>
                <strong>{{ data().capaSummary.inProgress }}</strong>
                <a routerLink="/capa" class="text-link">Open CAPA</a>
              </article>
              <article class="detail-item">
                <span>Audits in progress</span>
                <strong>{{ data().auditSummary.inProgress }}</strong>
                <a routerLink="/audits" class="text-link">Open audits</a>
              </article>
              <article class="detail-item">
                <span>KPI breaches</span>
                <strong>{{ data().kpiSummaryCounts.breach }}</strong>
                <a routerLink="/kpis" class="text-link">Open KPIs</a>
              </article>
              <article class="detail-item">
                <span>Training overdue</span>
                <strong>{{ data().metrics['overdueTrainingAssignments'] }}</strong>
                <a routerLink="/training" class="text-link">Open training</a>
              </article>
              <article class="detail-item">
                <span>Open actions</span>
                <strong>{{ data().metrics['openActionItems'] }}</strong>
                <a routerLink="/dashboard" class="text-link">Action overview</a>
              </article>
            </div>
          </section>

          <section class="card panel-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Execution</span>
                <h3>Open action items</h3>
                <p class="subtle">Cross-system work requiring follow-up, with ownership and due dates visible at a glance.</p>
              </div>
            </div>
            <div class="empty-state top-space" *ngIf="!data().actionItems.length">
              <strong>No open action items</strong>
              <span>Action-driven follow-up across modules will appear here.</span>
            </div>
            <div class="entity-list top-space" *ngIf="data().actionItems.length">
              <article class="entity-item" *ngFor="let item of data().actionItems">
                <strong>{{ item.title }}</strong>
                <small>
                  {{ item.sourceType }} | {{ item.status }}
                  {{ item.owner ? ' | ' + item.owner.firstName + ' ' + item.owner.lastName : '' }}
                  {{ item.dueDate ? ' | due ' + (item.dueDate | date:'yyyy-MM-dd') : '' }}
                </small>
              </article>
            </div>
          </section>
        </div>

        <div class="page-stack">
          <section class="card panel-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Recent activity</span>
                <h3>Recent records</h3>
                <p class="subtle">The latest movement across controlled records, CAPA, and audit work.</p>
              </div>
            </div>

            <div class="mini-group top-space">
              <h4>Documents</h4>
              <div class="empty-state" *ngIf="!data().recentDocuments.length">
                <span>No recent documents.</span>
              </div>
              <div class="entity-list" *ngIf="data().recentDocuments.length">
                <article class="entity-item" *ngFor="let document of data().recentDocuments">
                  <strong>{{ document.code }}</strong>
                  <small>{{ document.title }} | {{ document.status }} | V{{ document.version }}.{{ document.revision }}</small>
                </article>
              </div>
            </div>

            <div class="mini-group top-space">
              <h4>CAPA</h4>
              <div class="empty-state" *ngIf="!data().recentCapas.length">
                <span>No recent CAPA records.</span>
              </div>
              <div class="entity-list" *ngIf="data().recentCapas.length">
                <article class="entity-item" *ngFor="let capa of data().recentCapas">
                  <strong>{{ capa.title }}</strong>
                  <small>{{ capa.status }}{{ capa.dueDate ? ' | ' + (capa.dueDate | date:'yyyy-MM-dd') : '' }}</small>
                </article>
              </div>
            </div>

            <div class="mini-group top-space">
              <h4>Audits</h4>
              <div class="empty-state" *ngIf="!data().recentAudits.length">
                <span>No recent audits.</span>
              </div>
              <div class="entity-list" *ngIf="data().recentAudits.length">
                <article class="entity-item" *ngFor="let audit of data().recentAudits">
                  <strong>{{ audit.title }}</strong>
                  <small>{{ audit.status }}{{ audit.scheduledAt ? ' | ' + (audit.scheduledAt | date:'yyyy-MM-dd') : '' }}</small>
                </article>
              </div>
            </div>
          </section>

          <section class="card panel-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Watch list</span>
                <h3>Watch lists</h3>
                <p class="subtle">Current KPI, training, and high-risk items that warrant management attention.</p>
              </div>
            </div>

            <div class="mini-group top-space">
              <h4>KPIs</h4>
              <div class="empty-state" *ngIf="!data().kpiSummary.length">
                <span>No KPI watch items.</span>
              </div>
              <div class="entity-list" *ngIf="data().kpiSummary.length">
                <article class="entity-item" *ngFor="let item of data().kpiSummary">
                  <strong>{{ item.name }}</strong>
                  <small>{{ item.actual }}{{ item.unit }} vs {{ item.target }}{{ item.unit }} | {{ item.status }}</small>
                </article>
              </div>
            </div>

            <div class="mini-group top-space">
              <h4>Training</h4>
              <div class="empty-state" *ngIf="!data().trainingSummary.length">
                <span>No training watch items.</span>
              </div>
              <div class="entity-list" *ngIf="data().trainingSummary.length">
                <article class="entity-item" *ngFor="let item of data().trainingSummary">
                  <strong>{{ item.title }}</strong>
                  <small>{{ item.completion | number:'1.0-0' }}% complete{{ item.dueDate ? ' | ' + (item.dueDate | date:'yyyy-MM-dd') : '' }}</small>
                </article>
              </div>
            </div>

            <div class="mini-group top-space">
              <h4>High risks</h4>
              <div class="empty-state" *ngIf="!data().highRisks.length">
                <span>No high-risk entries.</span>
              </div>
              <div class="entity-list" *ngIf="data().highRisks.length">
                <article class="entity-item" *ngFor="let risk of data().highRisks">
                  <strong>{{ risk.title }}</strong>
                  <small>{{ risk.score }} | {{ risk.status }}</small>
                </article>
              </div>
            </div>
          </section>
        </div>
      </section>
    </section>
  `,
  styles: [`
    .hero-metric {
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(244, 246, 241, 0.98));
    }

    .hero-metric small {
      display: block;
      margin-top: 0.45rem;
      color: var(--muted);
      line-height: 1.45;
    }

    .mini-group h4 {
      margin: 0 0 0.6rem;
      font-size: 0.95rem;
      letter-spacing: -0.01em;
    }

    .text-link {
      display: inline-block;
      margin-top: 0.45rem;
      color: var(--brand-strong);
      text-decoration: none;
      font-weight: 700;
    }
  `]
})
export class DashboardPageComponent {
  private readonly api = inject(ApiService);
  protected readonly data = signal<DashboardResponse>({
    metrics: {},
    riskSummary: { open: 0, inTreatment: 0, mitigated: 0 },
    capaSummary: { investigating: 0, inProgress: 0, verified: 0 },
    auditSummary: { planned: 0, inProgress: 0, completed: 0 },
    kpiSummaryCounts: { watch: 0, breach: 0 },
    trainingSummaryCounts: { assigned: 0, inProgress: 0, completed: 0 },
    highRisks: [],
    recentDocuments: [],
    recentCapas: [],
    recentAudits: [],
    kpiSummary: [],
    trainingSummary: [],
    actionItems: []
  });

  constructor() {
    this.api.get<DashboardResponse>('dashboard/summary').subscribe((result) => this.data.set(result));
  }

  protected readonly metricEntries = () =>
    Object.entries(this.data().metrics).map(([label, value]) => ({
      label: label.replace(/([A-Z])/g, ' $1').trim(),
      value
    }));

  protected readonly topMetricEntries = () => {
    const metrics = this.data().metrics;
    return [
      {
        label: 'Controlled documents',
        value: metrics['documents'] ?? 0,
        copy: 'Active controlled records in the current tenant.'
      },
      {
        label: 'Open risks',
        value: metrics['openRisks'] ?? 0,
        copy: 'Risk items that still require treatment or acceptance.'
      },
      {
        label: 'Open CAPA',
        value: metrics['openCapas'] ?? 0,
        copy: 'Corrective and preventive actions still in flight.'
      },
      {
        label: 'Open actions',
        value: metrics['openActionItems'] ?? 0,
        copy: 'Cross-module follow-up work with due dates and owners.'
      }
    ];
  };
}
