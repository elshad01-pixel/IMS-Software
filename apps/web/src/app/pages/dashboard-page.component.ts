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
  feedbackSummary: {
    responseCount: number;
    openRequestCount: number;
    averageScore?: number | null;
    lowScoreCount: number;
    mediumScoreCount: number;
    highScoreCount: number;
    health: 'NO_DATA' | 'ATTENTION' | 'WATCH' | 'STRONG';
  };
  kpiSummary: Array<{ id: string; name: string; actual: number; target: number; unit: string; status: string }>;
  actionItems: Array<{
    id: string;
    title: string;
    status: string;
    dueDate?: string;
    sourceType: string;
    owner?: { firstName: string; lastName: string } | null;
  }>;
};

type ContextDashboardResponse = {
  summary: {
    internalIssues: number;
    externalIssues: number;
    interestedParties: number;
    needsExpectations: number;
  };
};

type DashboardModule = 'risks' | 'capa' | 'actions' | 'audits' | 'context' | 'feedback';
type DashboardRange = 'month' | 'quarter' | 'year';
type DashboardChartType = 'bar' | 'line' | 'pie' | 'donut';

type DashboardPoint = {
  label: string;
  value: number;
  color: string;
  link: string | any[];
  width: number;
};

type IncidentSummaryRow = { id: string; status: string; severity: string };
type ProviderSummaryRow = {
  id: string;
  status: string;
  criticality: string;
  evaluationOutcome?: string | null;
  supplierAuditRequired?: boolean;
  supplierAuditLinked?: boolean;
};
type ObligationSummaryRow = { id: string; status: string; nextReviewDate?: string | null };
type HazardSummaryRow = { id: string; status: string; severity: string };
type AspectSummaryRow = { id: string; status: string; significance: string };

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeaderComponent],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="'Dashboard'"
        [title]="'Integrated Management System'"
        [description]="'A structured operational workspace for quality, environmental, and health and safety management.'"
        [supportingLine]="'ISO 9001 &bull; ISO 14001 &bull; ISO 45001'"
        [breadcrumbs]="[{ label: 'Dashboard' }]"
      />

      <section class="dashboard-section dashboard-strip">
        <div class="section-head compact">
          <div>
            <span class="section-eyebrow">Summary</span>
            <h3>KPI summary</h3>
            <p class="subtle">Key metrics</p>
          </div>
        </div>

        <div class="kpi-strip top-space">
          <a class="kpi-item" *ngFor="let item of summaryCards()" [ngClass]="item.tone" [routerLink]="item.link">
            <div class="kpi-item__head">
              <span>{{ item.label }}</span>
            </div>
            <strong>{{ item.value }}</strong>
            <p>{{ item.copy }}</p>
          </a>
        </div>
      </section>

      <section class="dashboard-section dashboard-control-shell">
        <div class="section-head compact">
          <div>
            <span class="section-eyebrow">Controls</span>
            <h3>Dashboard view</h3>
          </div>
        </div>

        <div class="dashboard-controls top-space">
          <label class="control-field">
            <span class="sr-only">Module</span>
            <select aria-label="Module" [value]="selectedModule()" (change)="setModule($any($event.target).value)">
              <option value="risks">Risks</option>
              <option value="capa">CAPA</option>
              <option value="actions">Actions</option>
              <option value="audits">Audits</option>
              <option value="context">Context</option>
              <option value="feedback">Customer Feedback</option>
            </select>
          </label>

          <label class="control-field">
            <span class="sr-only">Time range</span>
            <select aria-label="Time range" [value]="selectedTimeRange()" (change)="setTimeRange($any($event.target).value)">
              <option value="month">Month</option>
              <option value="quarter">Quarter</option>
              <option value="year">Year</option>
            </select>
          </label>

          <label class="control-field">
            <span class="sr-only">Chart type</span>
            <select aria-label="Chart type" [value]="selectedChartType()" (change)="setChartType($any($event.target).value)">
              <option value="bar">Bar</option>
              <option value="line">Line</option>
              <option value="pie">Pie</option>
              <option value="donut">Donut</option>
            </select>
          </label>
        </div>
      </section>

      <section class="dashboard-section dashboard-main-chart">
        <div class="section-head dashboard-chart-head">
          <div class="dashboard-chart-copy">
            <span class="section-eyebrow">{{ currentRangeLabel() }}</span>
            <h3>{{ mainChartTitle() }}</h3>
            <p class="subtle">{{ mainChartDescription() }}</p>
            <a [routerLink]="mainChartLink()" class="mini-link dashboard-chart-inline-link">Open {{ currentModuleLabel() }}</a>
          </div>
        </div>

        <div class="main-chart-surface top-space">
          <ng-container [ngSwitch]="selectedChartType()">
            <div *ngSwitchCase="'bar'" class="bar-chart">
              <a class="bar-row bar-row--interactive" *ngFor="let item of mainChartPoints()" [routerLink]="item.link">
                <div class="bar-row__label">
                  <strong>{{ item.label }}</strong>
                  <small>{{ item.value }}</small>
                </div>
                <div class="bar-track">
                  <div class="bar-fill" [style.width.%]="item.width" [style.background]="item.color"></div>
                </div>
              </a>
            </div>

            <div *ngSwitchCase="'line'" class="line-chart-shell">
              <svg class="line-chart" viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true">
                <polyline class="line-chart__stroke" [attr.points]="lineChartPoints()" />
              </svg>
              <div class="line-chart__labels">
                <a class="line-chart__item" *ngFor="let item of mainChartPoints()" [routerLink]="item.link">
                  <span class="line-chart__swatch" [style.background]="item.color"></span>
                  <strong>{{ item.value }}</strong>
                  <small>{{ item.label }}</small>
                </a>
              </div>
            </div>

            <div *ngSwitchDefault class="donut-layout donut-layout--main">
              <div class="secondary-chart-panel secondary-chart-panel--primary">
                <div class="secondary-chart-head secondary-chart-head--centered">
                  <strong>{{ currentModuleLabel() }} overview</strong>
                  <small>{{ mainChartMetricLabel() }}</small>
                </div>

                <div class="donut-chart-shell">
                  <div class="donut-chart" [class.is-pie]="selectedChartType() === 'pie'" [style.background]="donutBackground(mainChartPoints())">
                    <div class="donut-center" *ngIf="selectedChartType() !== 'pie'">
                      <strong>{{ mainChartTotal() }}</strong>
                      <span>{{ currentModuleLabel() }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="secondary-chart-panel secondary-chart-panel--compact">
                <div class="secondary-chart-head">
                  <strong>{{ breakdownTitle() }}</strong>
                  <small>{{ breakdownNarrative() }}</small>
                </div>
                <div class="mini-bar-chart">
                  <a class="mini-bar-row" *ngFor="let item of mainChartPoints()" [routerLink]="item.link">
                    <div class="mini-bar-row__head">
                      <span>{{ item.label }}</span>
                      <strong>{{ item.value }}</strong>
                    </div>
                    <div class="mini-bar-track">
                      <div class="mini-bar-fill" [style.width.%]="item.width" [style.background]="item.color"></div>
                    </div>
                  </a>
                </div>
              </div>

              <div class="secondary-chart-panel">
                <div class="secondary-chart-head">
                  <strong>{{ watchlistTitle() }}</strong>
                  <small>{{ watchlistNarrative() }}</small>
                </div>
                <div class="mini-bar-chart">
                  <a class="mini-bar-row" *ngFor="let item of watchlistPoints()" [routerLink]="item.link">
                    <div class="mini-bar-row__head">
                      <span>{{ item.label }}</span>
                      <strong>{{ item.value }}</strong>
                    </div>
                    <div class="mini-bar-track">
                      <div class="mini-bar-fill" [style.width.%]="item.width" [style.background]="item.color"></div>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </ng-container>

          <div class="secondary-chart-grid top-space" *ngIf="selectedChartType() === 'bar' || selectedChartType() === 'line'">
            <div class="secondary-chart-panel secondary-chart-panel--stacked">
              <div class="secondary-chart-head">
                <strong>{{ breakdownTitle() }}</strong>
                <small>{{ breakdownNarrative() }}</small>
              </div>
              <div class="mini-bar-chart">
                <a class="mini-bar-row" *ngFor="let item of mainChartPoints()" [routerLink]="item.link">
                  <div class="mini-bar-row__head">
                    <span>{{ item.label }}</span>
                    <strong>{{ item.value }}</strong>
                  </div>
                  <div class="mini-bar-track">
                    <div class="mini-bar-fill" [style.width.%]="item.width" [style.background]="item.color"></div>
                  </div>
                </a>
              </div>
            </div>

            <div class="secondary-chart-panel secondary-chart-panel--stacked">
              <div class="secondary-chart-head">
                <strong>{{ watchlistTitle() }}</strong>
                <small>{{ watchlistNarrative() }}</small>
              </div>
              <div class="mini-bar-chart">
                <a class="mini-bar-row" *ngFor="let item of watchlistPoints()" [routerLink]="item.link">
                  <div class="mini-bar-row__head">
                    <span>{{ item.label }}</span>
                    <strong>{{ item.value }}</strong>
                  </div>
                  <div class="mini-bar-track">
                    <div class="mini-bar-fill" [style.width.%]="item.width" [style.background]="item.color"></div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>

      </section>
    </section>
  `,
  styles: [`
    .dashboard-section {
      display: grid;
      gap: 0.75rem;
    }

    .dashboard-strip {
      gap: 0.45rem;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .kpi-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 0.45rem;
      padding-top: 0.15rem;
    }

    .kpi-item {
      display: grid;
      gap: 0.2rem;
      padding: 0.85rem 0.9rem 0.7rem;
      border-left: 1px solid rgba(23, 50, 37, 0.08);
      background: transparent;
      text-decoration: none;
      color: inherit;
    }

    .kpi-item.warning {
      border-left-color: rgba(195, 149, 69, 0.38);
      background: linear-gradient(90deg, rgba(195, 149, 69, 0.06), transparent 72%);
    }

    .kpi-item.critical {
      border-left-color: rgba(180, 90, 71, 0.42);
      background: linear-gradient(90deg, rgba(180, 90, 71, 0.07), transparent 74%);
    }

    .kpi-item__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .kpi-item__head span {
      color: var(--muted-strong);
      font-size: 0.8rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .kpi-item strong {
      display: block;
      margin-top: 0.45rem;
      font-size: 2.7rem;
      line-height: 0.95;
      letter-spacing: -0.07em;
    }

    .kpi-item p {
      margin: 0.08rem 0 0;
      color: var(--muted);
      line-height: 1.35;
    }

    .mini-link {
      color: var(--brand-strong);
      text-decoration: none;
      font-size: 0.84rem;
      font-weight: 700;
    }

    .dashboard-controls {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.55rem;
      align-items: center;
      padding: 0.35rem;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.5);
      border: 1px solid rgba(23, 50, 37, 0.05);
      box-shadow: 0 10px 22px rgba(29, 42, 33, 0.025);
    }

    .control-field {
      display: grid;
      gap: 0;
    }

    .control-field select {
      min-height: 2.7rem;
      padding-inline: 0.95rem 2.1rem;
      border-radius: 999px;
      border-color: transparent;
      background: rgba(255, 255, 255, 0.88);
      font-weight: 600;
      box-shadow: inset 0 0 0 1px rgba(23, 50, 37, 0.05);
    }

    .main-chart-surface {
      padding: 1rem 1rem 0.95rem;
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.52);
      border: 1px solid rgba(23, 50, 37, 0.05);
      box-shadow: 0 12px 26px rgba(29, 42, 33, 0.035);
    }

    .dashboard-chart-head {
      padding-inline-end: 0.3rem;
    }

    .dashboard-chart-copy {
      display: grid;
      gap: 0.12rem;
    }

    .dashboard-chart-inline-link {
      justify-self: start;
      margin-top: 0.15rem;
    }

    .bar-chart {
      display: grid;
      gap: 0.95rem;
    }

    .bar-row {
      display: grid;
      gap: 0.5rem;
      color: inherit;
      text-decoration: none;
    }

    .bar-row--interactive {
      padding: 0.35rem 0;
    }

    .bar-row__label {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: center;
    }

    .bar-row__label strong {
      font-size: 0.96rem;
    }

    .bar-row__label small {
      color: var(--muted);
      font-weight: 700;
    }

    .bar-track {
      height: 0.85rem;
      border-radius: 999px;
      background: rgba(23, 50, 37, 0.08);
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: inherit;
      min-width: 0.8rem;
    }

    .line-chart-shell {
      display: grid;
      gap: 0.75rem;
    }

    .line-chart {
      width: 100%;
      height: 220px;
      overflow: visible;
    }

    .line-chart__stroke {
      fill: none;
      stroke: #244f3d;
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .line-chart__labels {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 0.55rem;
    }

    .line-chart__item {
      display: grid;
      gap: 0.18rem;
      padding: 0.55rem 0.1rem 0;
      border-radius: 0;
      text-decoration: none;
      color: inherit;
      background: transparent;
      border: none;
    }

    .line-chart__swatch {
      width: 0.85rem;
      height: 0.3rem;
      border-radius: 999px;
    }

    .donut-layout {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.8rem;
      align-items: stretch;
    }

    .donut-layout--main {
      min-height: 232px;
    }

    .donut-chart {
      position: relative;
      width: 190px;
      height: 190px;
      border-radius: 50%;
      display: grid;
      place-items: center;
    }

    .donut-chart-shell {
      display: grid;
      min-height: 100%;
      place-items: center;
      padding: 0.2rem 0;
    }

    .donut-chart::after {
      content: '';
      position: absolute;
      inset: 22px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.95);
      box-shadow: inset 0 0 0 1px rgba(23, 50, 37, 0.06);
    }

    .donut-chart.is-pie::after {
      display: none;
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

    .secondary-chart-panel {
      display: grid;
      gap: 0.8rem;
      align-self: stretch;
      padding: 0.8rem 0.85rem;
      border-radius: 18px;
      background: rgba(248, 250, 246, 0.88);
      border: 1px solid rgba(23, 50, 37, 0.05);
    }

    .secondary-chart-panel--compact {
      padding-top: 0.72rem;
    }

    .secondary-chart-panel--primary {
      justify-items: center;
      text-align: center;
    }

    .secondary-chart-panel--stacked {
      max-width: none;
    }

    .secondary-chart-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
    }

    .secondary-chart-head {
      display: grid;
      gap: 0.2rem;
    }

    .secondary-chart-head strong {
      font-size: 0.96rem;
    }

    .secondary-chart-head small {
      color: var(--muted);
      line-height: 1.45;
    }

    .secondary-chart-head--centered {
      justify-items: center;
      text-align: center;
    }

    .mini-bar-chart {
      display: grid;
      gap: 0.65rem;
    }

    .mini-bar-row {
      display: grid;
      gap: 0.32rem;
      text-decoration: none;
      color: inherit;
    }

    .mini-bar-row__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .mini-bar-row__head span {
      color: var(--muted-strong);
      font-size: 0.88rem;
    }

    .mini-bar-row__head strong {
      font-size: 0.94rem;
    }

    .mini-bar-track {
      height: 0.55rem;
      border-radius: 999px;
      background: rgba(23, 50, 37, 0.08);
      overflow: hidden;
    }

    .mini-bar-fill {
      height: 100%;
      border-radius: inherit;
      min-width: 0.55rem;
    }

    @media (max-width: 1200px) {
      .dashboard-controls {
        grid-template-columns: 1fr;
        border-radius: 22px;
      }
    }

    @media (max-width: 760px) {
      .kpi-strip {
        grid-template-columns: 1fr;
      }

      .kpi-item {
        border-left: none;
        border-top: 1px solid rgba(23, 50, 37, 0.08);
        padding-left: 0;
      }

      .dashboard-chart-head {
        padding-inline-end: 0;
      }

      .donut-layout {
        grid-template-columns: 1fr;
        justify-items: center;
      }

      .secondary-chart-grid {
        grid-template-columns: 1fr;
      }

      .secondary-chart-panel--stacked {
        max-width: none;
      }

      .donut-chart {
        width: 180px;
        height: 180px;
      }

      .donut-chart::after {
        inset: 22px;
      }

      .kpi-item strong {
        font-size: 2.2rem;
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
    feedbackSummary: {
      responseCount: 0,
      openRequestCount: 0,
      averageScore: null,
      lowScoreCount: 0,
      mediumScoreCount: 0,
      highScoreCount: 0,
      health: 'NO_DATA'
    },
    kpiSummary: [],
    actionItems: []
  });

  protected readonly contextSummary = signal<ContextDashboardResponse | null>(null);
  protected readonly incidents = signal<IncidentSummaryRow[]>([]);
  protected readonly providers = signal<ProviderSummaryRow[]>([]);
  protected readonly obligations = signal<ObligationSummaryRow[]>([]);
  protected readonly hazards = signal<HazardSummaryRow[]>([]);
  protected readonly aspects = signal<AspectSummaryRow[]>([]);
  protected readonly selectedModule = signal<DashboardModule>('risks');
  protected readonly selectedTimeRange = signal<DashboardRange>('quarter');
  protected readonly selectedChartType = signal<DashboardChartType>('donut');

  constructor() {
    this.api.get<DashboardResponse>('dashboard/summary').subscribe({
      next: (result) => this.data.set(result),
      error: () => this.data.set(this.data())
    });
    this.api.get<ContextDashboardResponse>('context/dashboard').subscribe({
      next: (result) => this.contextSummary.set(result),
      error: () => this.contextSummary.set(null)
    });
    this.api.get<IncidentSummaryRow[]>('incidents').subscribe({
      next: (result) => this.incidents.set(result),
      error: () => this.incidents.set([])
    });
    this.api.get<ProviderSummaryRow[]>('external-providers').subscribe({
      next: (result) => this.providers.set(result),
      error: () => this.providers.set([])
    });
    this.api.get<ObligationSummaryRow[]>('compliance-obligations').subscribe({
      next: (result) => this.obligations.set(result),
      error: () => this.obligations.set([])
    });
    this.api.get<HazardSummaryRow[]>('hazards').subscribe({
      next: (result) => this.hazards.set(result),
      error: () => this.hazards.set([])
    });
    this.api.get<AspectSummaryRow[]>('environmental-aspects').subscribe({
      next: (result) => this.aspects.set(result),
      error: () => this.aspects.set([])
    });
  }

  protected setModule(value: DashboardModule) {
    this.selectedModule.set(value);
  }

  protected setTimeRange(value: DashboardRange) {
    this.selectedTimeRange.set(value);
  }

  protected setChartType(value: DashboardChartType) {
    this.selectedChartType.set(value);
  }

  protected summaryCards() {
    const metrics = this.data().metrics;
    return [
      {
        label: 'Open risks',
        value: this.data().riskSummary.open + this.data().riskSummary.inTreatment,
        copy: 'Open',
        link: '/risks',
        tone: 'focus'
      },
      {
        label: 'Open CAPA',
        value: metrics['openCapas'] ?? 0,
        copy: 'In progress',
        link: '/capa',
        tone: (metrics['openCapas'] ?? 0) > 0 ? 'warning' : 'focus'
      },
      {
        label: 'Active audits',
        value: metrics['openAudits'] ?? 0,
        copy: 'In progress',
        link: '/audits',
        tone: 'focus'
      },
      {
        label: 'Overdue actions',
        value: metrics['overdueActions'] ?? 0,
        copy: 'Overdue',
        link: '/actions',
        tone: (metrics['overdueActions'] ?? 0) > 0 ? 'critical' : 'focus'
      },
      {
        label: 'KPI breaches',
        value: this.data().kpiSummaryCounts.breach,
        copy: 'Breaches',
        link: '/kpis',
        tone: this.data().kpiSummaryCounts.breach > 0 ? 'critical' : 'focus'
      },
      {
        label: 'Customer feedback',
        value: this.data().feedbackSummary.averageScore != null ? `${this.data().feedbackSummary.averageScore}/10` : 'No data',
        copy:
          this.data().feedbackSummary.responseCount > 0
            ? `${this.data().feedbackSummary.responseCount} responses`
            : 'Awaiting responses',
        link: '/context/interested-parties',
        tone:
          this.data().feedbackSummary.health === 'ATTENTION'
            ? 'critical'
            : this.data().feedbackSummary.health === 'WATCH'
              ? 'warning'
              : 'focus'
      }
    ];
  }

  protected currentModuleLabel() {
    return {
      risks: 'Risks',
      capa: 'CAPA',
      actions: 'Actions',
      audits: 'Audits',
      context: 'Context',
      feedback: 'Customer Feedback'
    }[this.selectedModule()];
  }

  protected currentRangeLabel() {
    return {
      month: 'This month',
      quarter: 'This quarter',
      year: 'This year'
    }[this.selectedTimeRange()];
  }

  protected mainChartTitle() {
    return `${this.currentModuleLabel()} — ${this.mainChartMetricLabel()}`;
  }

  protected mainChartDescription() {
    return `${this.currentRangeLabel()} • ${this.currentChartTypeLabel()}`;
  }

  protected mainChartLink() {
    return {
      risks: '/risks',
      capa: '/capa',
      actions: '/actions',
      audits: '/audits',
      context: '/context',
      feedback: '/context/interested-parties'
    }[this.selectedModule()];
  }

  protected mainChartPoints(): DashboardPoint[] {
    const raw = this.baseChartPoints();
    const total = Math.max(raw.reduce((sum, item) => sum + item.value, 0), 1);
    return raw.map((item) => ({
      ...item,
      width: (item.value / total) * 100
    }));
  }

  protected mainChartTotal() {
    return this.mainChartPoints().reduce((sum, item) => sum + item.value, 0);
  }

  protected currentChartTypeLabel() {
    return {
      bar: 'Bar chart',
      line: 'Line chart',
      pie: 'Pie chart',
      donut: 'Donut chart'
    }[this.selectedChartType()];
  }

  protected donutBackground(points: DashboardPoint[]) {
    const total = Math.max(points.reduce((sum, point) => sum + point.value, 0), 1);
    let cursor = 0;
    const stops = points.map((point) => {
      const start = cursor;
      cursor += (point.value / total) * 100;
      return `${point.color} ${start}% ${cursor}%`;
    });

    return `conic-gradient(${stops.join(', ')})`;
  }

  protected lineChartPoints() {
    const points = this.mainChartPoints();
    if (!points.length) {
      return '0,34 100,34';
    }
    const max = Math.max(...points.map((point) => point.value), 1);
    const step = points.length === 1 ? 100 : 100 / (points.length - 1);
    return points
      .map((point, index) => {
        const x = Number((index * step).toFixed(2));
        const y = Number((38 - (point.value / max) * 30).toFixed(2));
        return `${x},${y}`;
      })
      .join(' ');
  }

  protected watchlistTitle() {
    return 'Cross-module watchlist';
  }

  protected watchlistNarrative() {
    return 'A quick view of the new ISO/QHSE modules that currently need attention.';
  }

  protected watchlistPoints(): DashboardPoint[] {
    const raw = [
      {
        label: 'Incidents',
        value: this.incidents().filter((item) => item.status !== 'CLOSED' && item.status !== 'ARCHIVED').length,
        color: '#b45a47',
        link: '/incidents'
      },
      {
        label: 'Provider review',
        value: this.providers().filter((item) => item.status === 'UNDER_REVIEW' || item.evaluationOutcome === 'ESCALATED' || item.evaluationOutcome === 'DISQUALIFIED' || (!!item.supplierAuditRequired && !item.supplierAuditLinked)).length,
        color: '#9a6e2d',
        link: '/external-providers'
      },
      {
        label: 'Obligations',
        value: this.obligations().filter((item) => item.status === 'UNDER_REVIEW' || this.isOverdue(item.nextReviewDate ?? undefined)).length,
        color: '#446d8e',
        link: '/compliance-obligations'
      },
      {
        label: 'High hazards',
        value: this.hazards().filter((item) => item.status !== 'OBSOLETE' && item.severity === 'HIGH').length,
        color: '#8c3f36',
        link: '/hazards'
      },
      {
        label: 'High aspects',
        value: this.aspects().filter((item) => item.status !== 'OBSOLETE' && item.significance === 'HIGH').length,
        color: '#3f6f59',
        link: '/environmental-aspects'
      }
    ];
    const total = Math.max(raw.reduce((sum, item) => sum + item.value, 0), 1);
    return raw.map((item) => ({ ...item, width: (item.value / total) * 100 }));
  }

  protected breakdownTitle() {
    return `${this.currentModuleLabel()} breakdown`;
  }

  protected breakdownNarrative() {
    return `A compact view of the ${this.mainChartMetricLabel().toLowerCase()} behind the main ${this.selectedChartType()} chart.`;
  }

  protected mainChartMetricLabel() {
    return {
      risks: 'Risk distribution',
      capa: 'Status distribution',
      actions: 'Status distribution',
      audits: 'Program status',
      context: 'Issue distribution',
      feedback: 'Score distribution'
    }[this.selectedModule()];
  }

  private baseChartPoints(): Omit<DashboardPoint, 'width'>[] {
    switch (this.selectedModule()) {
      case 'capa': {
        const open = this.data().capaSummary.investigating + this.actionPlannedCount();
        const inProgress = this.data().capaSummary.inProgress;
        const closed = Math.max((this.data().metrics['capas'] ?? 0) - (this.data().metrics['openCapas'] ?? 0), 0);
        return [
          { label: 'Open', value: open, color: '#9a6e2d', link: '/capa' },
          { label: 'In progress', value: inProgress, color: '#3f6f59', link: '/capa' },
          { label: 'Closed', value: closed, color: '#244f3d', link: '/capa' }
        ];
      }
      case 'actions': {
        const actionItems = this.data().actionItems;
        const open = actionItems.filter((item) => item.status === 'OPEN').length;
        const inProgress = actionItems.filter((item) => item.status === 'IN_PROGRESS').length;
        const done = actionItems.filter((item) => item.status === 'DONE').length;
        const overdue = actionItems.filter((item) => this.isOverdue(item.dueDate)).length;
        return [
          { label: 'Open', value: open, color: '#446d8e', link: '/actions' },
          { label: 'In progress', value: inProgress, color: '#3f6f59', link: '/actions' },
          { label: 'Done', value: done, color: '#6f9d7f', link: '/actions' },
          { label: 'Overdue', value: overdue, color: '#b45a47', link: '/actions' }
        ];
      }
      case 'audits':
        return [
          { label: 'Planned', value: this.data().auditSummary.planned, color: '#446d8e', link: '/audits' },
          { label: 'In progress', value: this.data().auditSummary.inProgress, color: '#c39545', link: '/audits' },
          { label: 'Completed', value: this.data().auditSummary.completed, color: '#244f3d', link: '/audits' }
        ];
      case 'context': {
        const summary = this.contextSummary()?.summary;
        return [
          { label: 'Internal issues', value: summary?.internalIssues ?? 0, color: '#3f6f59', link: '/context/internal-issues' },
          { label: 'External issues', value: summary?.externalIssues ?? 0, color: '#9a6e2d', link: '/context/external-issues' },
          { label: 'Interested parties', value: summary?.interestedParties ?? 0, color: '#446d8e', link: '/context/interested-parties' },
          { label: 'Needs', value: summary?.needsExpectations ?? 0, color: '#6f9d7f', link: '/context/needs-expectations' }
        ];
      }
      case 'feedback':
        return [
          { label: 'Needs attention (0-6)', value: this.data().feedbackSummary.lowScoreCount, color: '#b45a47', link: '/context/interested-parties' },
          { label: 'Acceptable (7-8)', value: this.data().feedbackSummary.mediumScoreCount, color: '#c39545', link: '/context/interested-parties' },
          { label: 'Strong (9-10)', value: this.data().feedbackSummary.highScoreCount, color: '#3f6f59', link: '/context/interested-parties' },
          { label: 'Open links', value: this.data().feedbackSummary.openRequestCount, color: '#446d8e', link: '/context/interested-parties' }
        ];
      case 'risks':
      default:
        return [
          { label: 'Low', value: this.data().riskDistribution.low, color: '#6f9d7f', link: '/risks' },
          { label: 'Medium', value: this.data().riskDistribution.medium, color: '#c39545', link: '/risks' },
          { label: 'High', value: this.data().riskDistribution.high, color: '#b45a47', link: '/risks' }
        ];
    }
  }

  private actionPlannedCount() {
    const openCapas = this.data().metrics['openCapas'] ?? 0;
    return Math.max(openCapas - this.data().capaSummary.investigating - this.data().capaSummary.inProgress - this.data().capaSummary.verified, 0);
  }

  private isOverdue(dueDate?: string) {
    if (!dueDate) {
      return false;
    }
    return new Date(dueDate).getTime() < Date.now();
  }
}
