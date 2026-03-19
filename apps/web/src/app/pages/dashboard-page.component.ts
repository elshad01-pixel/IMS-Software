import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { PageHeaderComponent } from '../shared/page-header.component';

type DashboardResponse = {
  metrics: Record<string, number>;
  riskSummary: { open: number; inTreatment: number; mitigated: number };
  riskDistribution: { low: number; medium: number; high: number };
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

type ChartSegment = {
  label: string;
  value: number;
  color: string;
};

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeaderComponent],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="'Dashboard'"
        [title]="'Operational overview'"
        [description]="'A structured command view for exposure, corrective action pressure, and the most recent system activity.'"
        [breadcrumbs]="[{ label: 'Dashboard' }]"
      >
        <a routerLink="/documents/new" class="button-link">Create document</a>
      </iso-page-header>

      <section class="dashboard-section">
        <div class="section-head">
          <div>
            <span class="section-eyebrow">Summary</span>
            <h3>KPI summary</h3>
            <p class="subtle">Keep the top of the dashboard focused on the few indicators leadership needs first.</p>
          </div>
        </div>

        <div class="kpi-card-grid top-space">
          <article class="card kpi-card" *ngFor="let item of summaryCards()">
            <div class="kpi-card__head">
              <span>{{ item.label }}</span>
              <a [routerLink]="item.link" class="mini-link">Open</a>
            </div>
            <strong>{{ item.value }}</strong>
            <p>{{ item.copy }}</p>
          </article>
        </div>
      </section>

      <section class="dashboard-section">
        <div class="section-head">
          <div>
            <span class="section-eyebrow">Charts</span>
            <h3>Operational distribution</h3>
            <p class="subtle">Visualize risk concentration and CAPA movement without crowding the page.</p>
          </div>
        </div>

        <div class="chart-grid top-space">
          <section class="card chart-card">
            <div class="section-head compact">
              <div>
                <h4>Risk distribution</h4>
                <p class="subtle">Open and active risks grouped by score band.</p>
              </div>
            </div>

            <div class="donut-layout top-space">
              <div class="donut-chart" [style.background]="donutBackground(riskSegments())">
                <div class="donut-center">
                  <strong>{{ activeRiskCount() }}</strong>
                  <span>Active risks</span>
                </div>
              </div>

              <div class="chart-legend">
                <div class="legend-item" *ngFor="let segment of riskSegments()">
                  <span class="legend-swatch" [style.background]="segment.color"></span>
                  <div>
                    <strong>{{ segment.label }}</strong>
                    <small>{{ segment.value }} risk{{ segment.value === 1 ? '' : 's' }}</small>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="card chart-card">
            <div class="section-head compact">
              <div>
                <h4>CAPA status</h4>
                <p class="subtle">A clean view of open, in-progress, and closed corrective workflow volume.</p>
              </div>
            </div>

            <div class="bar-chart top-space">
              <article class="bar-row" *ngFor="let item of capaBars()">
                <div class="bar-row__label">
                  <strong>{{ item.label }}</strong>
                  <small>{{ item.value }}</small>
                </div>
                <div class="bar-track">
                  <div class="bar-fill" [style.width.%]="item.width" [style.background]="item.color"></div>
                </div>
              </article>
            </div>
          </section>

          <section class="card chart-card">
            <div class="section-head compact">
              <div>
                <h4>KPI pressure</h4>
                <p class="subtle">Current watch and breach counts, alongside overdue follow-up pressure.</p>
              </div>
            </div>

            <div class="bar-chart top-space">
              <article class="bar-row" *ngFor="let item of pressureBars()">
                <div class="bar-row__label">
                  <strong>{{ item.label }}</strong>
                  <small>{{ item.value }}</small>
                </div>
                <div class="bar-track soft">
                  <div class="bar-fill" [style.width.%]="item.width" [style.background]="item.color"></div>
                </div>
              </article>
            </div>
          </section>
        </div>
      </section>

      <section class="dashboard-section">
        <div class="section-head">
          <div>
            <span class="section-eyebrow">Activity</span>
            <h3>Recent activity and action items</h3>
            <p class="subtle">Keep execution visible, but secondary to the operational indicators above.</p>
          </div>
        </div>

        <div class="activity-grid top-space">
          <section class="card panel-card">
            <div class="section-head compact">
              <div>
                <h4>Recent records</h4>
                <p class="subtle">Latest updates across documents, CAPA, and audits.</p>
              </div>
            </div>

            <div class="activity-groups top-space">
              <div class="activity-group">
                <h5>Documents</h5>
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

              <div class="activity-group">
                <h5>CAPA</h5>
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

              <div class="activity-group">
                <h5>Audits</h5>
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
            </div>
          </section>

          <section class="card panel-card">
            <div class="section-head compact">
              <div>
                <h4>Open action items</h4>
                <p class="subtle">Cross-system work that still needs ownership or completion.</p>
              </div>
            </div>

            <div class="empty-state top-space" *ngIf="!data().actionItems.length">
              <strong>No open action items</strong>
              <span>Action-driven follow-up across modules will appear here.</span>
            </div>

            <div class="entity-list top-space" *ngIf="data().actionItems.length">
              <article class="entity-item action-item" *ngFor="let item of data().actionItems">
                <div class="action-item__copy">
                  <strong>{{ item.title }}</strong>
                  <small>
                    {{ item.sourceType }} | {{ item.status }}
                    {{ item.owner ? ' | ' + item.owner.firstName + ' ' + item.owner.lastName : '' }}
                    {{ item.dueDate ? ' | due ' + (item.dueDate | date:'yyyy-MM-dd') : '' }}
                  </small>
                </div>
                <span class="status-badge" [class.warn]="item.status === 'IN_PROGRESS'">{{ item.status }}</span>
              </article>
            </div>
          </section>
        </div>
      </section>
    </section>
  `,
  styles: [`
    .dashboard-section {
      display: grid;
      gap: 0.9rem;
    }

    .kpi-card-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 1rem;
    }

    .kpi-card {
      padding: 1.2rem 1.25rem;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(242, 246, 240, 0.96));
    }

    .kpi-card__head {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      align-items: center;
    }

    .kpi-card__head span {
      color: var(--muted-strong);
      font-size: 0.85rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .kpi-card strong {
      display: block;
      margin-top: 1rem;
      font-size: 2.35rem;
      line-height: 1;
      letter-spacing: -0.05em;
    }

    .kpi-card p {
      margin: 0.55rem 0 0;
      color: var(--muted);
      line-height: 1.5;
    }

    .mini-link {
      color: var(--brand-strong);
      text-decoration: none;
      font-size: 0.84rem;
      font-weight: 700;
    }

    .chart-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }

    .chart-card {
      padding: 1.3rem;
    }

    .compact {
      align-items: start;
    }

    .donut-layout {
      display: grid;
      grid-template-columns: 220px minmax(0, 1fr);
      gap: 1.25rem;
      align-items: center;
    }

    .donut-chart {
      position: relative;
      width: 220px;
      height: 220px;
      border-radius: 50%;
      display: grid;
      place-items: center;
    }

    .donut-chart::after {
      content: '';
      position: absolute;
      inset: 26px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.94);
      box-shadow: inset 0 0 0 1px rgba(23, 50, 37, 0.06);
    }

    .donut-center {
      position: relative;
      z-index: 1;
      display: grid;
      place-items: center;
      text-align: center;
    }

    .donut-center strong {
      font-size: 2rem;
      line-height: 1;
      letter-spacing: -0.04em;
    }

    .donut-center span {
      margin-top: 0.35rem;
      color: var(--muted);
      font-size: 0.9rem;
    }

    .chart-legend {
      display: grid;
      gap: 0.8rem;
    }

    .legend-item {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.7rem;
      align-items: center;
    }

    .legend-item strong {
      display: block;
      font-size: 0.96rem;
    }

    .legend-item small {
      color: var(--muted);
    }

    .legend-swatch {
      width: 0.8rem;
      height: 0.8rem;
      border-radius: 50%;
      box-shadow: 0 0 0 4px rgba(23, 50, 37, 0.04);
    }

    .bar-chart {
      display: grid;
      gap: 1rem;
    }

    .bar-row {
      display: grid;
      gap: 0.5rem;
    }

    .bar-row__label {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: center;
    }

    .bar-row__label strong {
      font-size: 0.95rem;
    }

    .bar-row__label small {
      color: var(--muted);
      font-weight: 700;
    }

    .bar-track {
      height: 0.8rem;
      border-radius: 999px;
      background: rgba(23, 50, 37, 0.08);
      overflow: hidden;
    }

    .bar-track.soft {
      background: rgba(184, 132, 51, 0.1);
    }

    .bar-fill {
      height: 100%;
      border-radius: inherit;
      min-width: 0.8rem;
    }

    .activity-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.95fr);
      gap: 1rem;
    }

    .activity-groups {
      display: grid;
      gap: 1rem;
    }

    .activity-group h5 {
      margin: 0 0 0.65rem;
      font-size: 0.94rem;
      letter-spacing: -0.01em;
    }

    .action-item {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
    }

    .action-item__copy {
      display: grid;
      gap: 0.25rem;
      min-width: 0;
    }

    @media (max-width: 1200px) {
      .kpi-card-grid,
      .chart-grid,
      .activity-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 760px) {
      .donut-layout {
        grid-template-columns: 1fr;
        justify-items: center;
      }

      .donut-chart {
        width: 180px;
        height: 180px;
      }

      .donut-chart::after {
        inset: 22px;
      }

      .kpi-card strong {
        font-size: 2rem;
      }

      .action-item {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class DashboardPageComponent {
  private readonly api = inject(ApiService);
  protected readonly data = signal<DashboardResponse>({
    metrics: {},
    riskSummary: { open: 0, inTreatment: 0, mitigated: 0 },
    riskDistribution: { low: 0, medium: 0, high: 0 },
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

  protected summaryCards() {
    const metrics = this.data().metrics;
    return [
      {
        label: 'Open risks',
        value: this.data().riskSummary.open + this.data().riskSummary.inTreatment,
        copy: 'Exposure still awaiting treatment or acceptance.',
        link: '/risks'
      },
      {
        label: 'Open CAPA',
        value: metrics['openCapas'] ?? 0,
        copy: 'Corrective and preventive actions still active.',
        link: '/capa'
      },
      {
        label: 'Active audits',
        value: metrics['openAudits'] ?? 0,
        copy: 'Planned or in-progress internal audits.',
        link: '/audits'
      },
      {
        label: 'Overdue actions',
        value: metrics['overdueActions'] ?? 0,
        copy: 'Action items beyond their due date.',
        link: '/dashboard'
      },
      {
        label: 'KPI breaches',
        value: this.data().kpiSummaryCounts.breach,
        copy: 'Performance indicators currently outside target.',
        link: '/kpis'
      }
    ];
  }

  protected riskSegments(): ChartSegment[] {
    return [
      { label: 'Low', value: this.data().riskDistribution.low, color: '#6f9d7f' },
      { label: 'Medium', value: this.data().riskDistribution.medium, color: '#c39545' },
      { label: 'High', value: this.data().riskDistribution.high, color: '#b45a47' }
    ];
  }

  protected capaBars() {
    const total = Math.max(this.totalCapasForChart(), 1);
    const open = this.data().capaSummary.investigating + this.actionPlannedCount();
    const inProgress = this.data().capaSummary.inProgress;
    const closed = Math.max((this.data().metrics['capas'] ?? 0) - (this.data().metrics['openCapas'] ?? 0), 0);

    return [
      { label: 'Open', value: open, width: (open / total) * 100, color: '#9a6e2d' },
      { label: 'In progress', value: inProgress, width: (inProgress / total) * 100, color: '#3f6f59' },
      { label: 'Closed', value: closed, width: (closed / total) * 100, color: '#244f3d' }
    ];
  }

  protected pressureBars() {
    const overdueActions = this.data().metrics['overdueActions'] ?? 0;
    const kpiBreaches = this.data().kpiSummaryCounts.breach;
    const kpiWatch = this.data().kpiSummaryCounts.watch;
    const overdueTraining = this.data().metrics['overdueTrainingAssignments'] ?? 0;
    const total = Math.max(overdueActions, kpiBreaches, kpiWatch, overdueTraining, 1);

    return [
      { label: 'KPI breaches', value: kpiBreaches, width: (kpiBreaches / total) * 100, color: '#b45a47' },
      { label: 'KPI watch', value: kpiWatch, width: (kpiWatch / total) * 100, color: '#c39545' },
      { label: 'Overdue actions', value: overdueActions, width: (overdueActions / total) * 100, color: '#7b8f55' },
      { label: 'Overdue training', value: overdueTraining, width: (overdueTraining / total) * 100, color: '#446d8e' }
    ];
  }

  protected donutBackground(segments: ChartSegment[]) {
    const total = Math.max(segments.reduce((sum, segment) => sum + segment.value, 0), 1);
    let cursor = 0;
    const stops = segments.map((segment) => {
      const start = cursor;
      cursor += (segment.value / total) * 100;
      return `${segment.color} ${start}% ${cursor}%`;
    });

    return `conic-gradient(${stops.join(', ')})`;
  }

  protected activeRiskCount() {
    return this.riskSegments().reduce((sum, segment) => sum + segment.value, 0);
  }

  private totalCapasForChart() {
    const open = this.data().capaSummary.investigating + this.actionPlannedCount();
    const inProgress = this.data().capaSummary.inProgress;
    const closed = Math.max((this.data().metrics['capas'] ?? 0) - (this.data().metrics['openCapas'] ?? 0), 0);
    return open + inProgress + closed;
  }

  private actionPlannedCount() {
    const openCapas = this.data().metrics['openCapas'] ?? 0;
    return Math.max(openCapas - this.data().capaSummary.investigating - this.data().capaSummary.inProgress - this.data().capaSummary.verified, 0);
  }
}
