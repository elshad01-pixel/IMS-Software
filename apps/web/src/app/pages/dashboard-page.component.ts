import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { I18nService } from '../core/i18n.service';
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
  queryParams?: Record<string, string>;
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
  imports: [CommonModule, RouterLink, PageHeaderComponent, TranslatePipe],
  template: `
    <section class="page-grid dashboard-page">
      <iso-page-header
        [label]="t('dashboard.page.label')"
        [title]="t('dashboard.page.title')"
        [description]="t('dashboard.page.description')"
        [supportingLine]="t('dashboard.page.supportingLine')"
        [breadcrumbs]="[{ label: t('dashboard.page.breadcrumb') }]"
      />

      <section class="dashboard-section dashboard-strip">
        <div class="section-head compact">
          <div>
            <span class="section-eyebrow">{{ summaryEyebrow() }}</span>
            <h3>{{ summaryTitle() }}</h3>
            <p class="subtle">{{ 'dashboard.summary.copy' | translate }}</p>
          </div>
        </div>

        <div class="kpi-strip top-space">
          <a
            class="kpi-item"
            *ngFor="let item of summaryCards()"
            [routerLink]="item.link"
            [queryParams]="item.queryParams || null"
            [style.--kpi-accent]="item.accent"
            [style.--kpi-surface]="item.surface"
          >
            <div class="kpi-item__head">
              <span class="kpi-item__dot" aria-hidden="true"></span>
              <span>{{ item.label }}</span>
            </div>
            <strong>{{ item.value }}</strong>
            <p>{{ item.copy }}</p>
          </a>
        </div>
      </section>

      <section class="dashboard-section dashboard-control-shell">
        <div class="dashboard-controls">
          <label class="control-field">
            <span>{{ filterModuleLabel() }}</span>
            <select aria-label="Module" [value]="selectedModule()" (change)="setModule($any($event.target).value)">
              <option value="risks">{{ 'dashboard.modules.risks' | translate }}</option>
              <option value="capa">{{ 'dashboard.modules.capa' | translate }}</option>
              <option value="actions">{{ 'dashboard.modules.actions' | translate }}</option>
              <option value="audits">{{ 'dashboard.modules.audits' | translate }}</option>
              <option value="context">{{ 'dashboard.modules.context' | translate }}</option>
              <option value="feedback">{{ 'dashboard.modules.feedback' | translate }}</option>
            </select>
          </label>

          <label class="control-field">
            <span>{{ filterPeriodLabel() }}</span>
            <select aria-label="Time range" [value]="selectedTimeRange()" (change)="setTimeRange($any($event.target).value)">
              <option value="month">{{ 'dashboard.ranges.monthOption' | translate }}</option>
              <option value="quarter">{{ 'dashboard.ranges.quarterOption' | translate }}</option>
              <option value="year">{{ 'dashboard.ranges.yearOption' | translate }}</option>
            </select>
          </label>

          <label class="control-field">
            <span>{{ filterChartTypeLabel() }}</span>
            <select aria-label="Chart type" [value]="selectedChartType()" (change)="setChartType($any($event.target).value)">
              <option value="bar">{{ 'dashboard.chartTypes.barOption' | translate }}</option>
              <option value="line">{{ 'dashboard.chartTypes.lineOption' | translate }}</option>
              <option value="pie">{{ 'dashboard.chartTypes.pieOption' | translate }}</option>
              <option value="donut">{{ 'dashboard.chartTypes.donutOption' | translate }}</option>
            </select>
          </label>
        </div>
      </section>

      <section class="dashboard-section dashboard-main-chart">
        <div class="main-chart-surface">
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
                  <strong>{{ t('dashboard.chart.moduleOverview', { module: currentModuleLabel() }) }}</strong>
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
    :host ::ng-deep .dashboard-page > iso-page-header .page-hero {
      padding: 1.18rem 1.4rem;
    }

    :host ::ng-deep .dashboard-page > iso-page-header .page-hero__body {
      gap: 0.9rem;
    }

    :host ::ng-deep .dashboard-page > iso-page-header .hero-copy {
      gap: 0.08rem;
    }

    :host ::ng-deep .dashboard-page > iso-page-header .page-hero h2 {
      margin: 0.7rem 0 0.28rem;
      font-size: clamp(1.7rem, 2.5vw, 2.15rem);
    }

    :host ::ng-deep .dashboard-page > iso-page-header .page-hero p {
      line-height: 1.48;
    }

    :host ::ng-deep .dashboard-page > iso-page-header .hero-supporting-line {
      margin-top: 0.55rem;
    }

    .dashboard-page {
      gap: 1rem;
    }

    .dashboard-section {
      display: grid;
      gap: 0.45rem;
    }

    .dashboard-strip {
      gap: 0.28rem;
    }

    .dashboard-strip .top-space {
      margin-top: 0.75rem;
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
      gap: 0.75rem;
      padding-top: 0.2rem;
    }

    .kpi-item {
      display: grid;
      gap: 0.3rem;
      padding: 1rem 1rem 0.9rem;
      border-left: 7px solid var(--kpi-accent, rgba(23, 50, 37, 0.18));
      border-radius: 20px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.52), rgba(255, 255, 255, 0.2)),
        var(--kpi-surface, rgba(255, 255, 255, 0.92));
      border: 1px solid rgba(22, 32, 26, 0.12);
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.58);
      text-decoration: none;
      color: #17251f;
      transition: transform 140ms ease, box-shadow 140ms ease, background 140ms ease;
    }

    .kpi-item:hover {
      transform: translateY(-1px);
      box-shadow: 0 18px 36px rgba(15, 23, 42, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.88);
    }

    .kpi-item__head {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 0.55rem;
    }

    .kpi-item__dot {
      width: 0.72rem;
      height: 0.72rem;
      border-radius: 999px;
      background: var(--kpi-accent, rgba(23, 50, 37, 0.2));
      box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.56);
      flex: 0 0 auto;
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
      margin-top: 0.55rem;
      font-size: 2.7rem;
      line-height: 0.95;
      letter-spacing: -0.07em;
      color: #111827;
    }

    .kpi-item p {
      margin: 0.16rem 0 0;
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
      gap: 0.35rem;
    }

    .control-field span {
      color: var(--muted-strong);
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding-inline: 0.95rem 0.25rem;
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
      padding: 0.75rem 0.8rem 0.8rem;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.52);
      border: 1px solid rgba(23, 50, 37, 0.05);
      box-shadow: 0 10px 22px rgba(29, 42, 33, 0.03);
    }

    .bar-chart {
      display: grid;
      gap: 0.75rem;
    }

    .bar-row {
      display: grid;
      gap: 0.5rem;
      color: inherit;
      text-decoration: none;
    }

    .bar-row--interactive {
      padding: 0.2rem 0;
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
      gap: 0.55rem;
    }

    .line-chart {
      width: 100%;
      height: 170px;
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
      gap: 0.45rem;
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
      gap: 0.65rem;
      align-items: stretch;
    }

    .donut-layout--main {
      min-height: 188px;
    }

    .donut-chart {
      position: relative;
      width: 158px;
      height: 158px;
      border-radius: 50%;
      display: grid;
      place-items: center;
    }

    .donut-chart-shell {
      display: grid;
      min-height: 100%;
      place-items: center;
      padding: 0.05rem 0;
    }

    .donut-chart::after {
      content: '';
      position: absolute;
      inset: 19px;
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
      font-size: 1.7rem;
      line-height: 1;
      letter-spacing: -0.04em;
    }

    .donut-center span {
      margin-top: 0.2rem;
      color: var(--muted);
      font-size: 0.82rem;
    }

    .secondary-chart-panel {
      display: grid;
      gap: 0.55rem;
      align-self: stretch;
      padding: 0.62rem 0.7rem;
      border-radius: 16px;
      background: rgba(248, 250, 246, 0.88);
      border: 1px solid rgba(23, 50, 37, 0.05);
    }

    .secondary-chart-panel--compact {
      padding-top: 0.62rem;
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
      gap: 0.6rem;
    }

    .secondary-chart-head {
      display: grid;
      gap: 0.08rem;
    }

    .secondary-chart-head strong {
      font-size: 0.92rem;
    }

    .secondary-chart-head--centered {
      justify-items: center;
      text-align: center;
    }

    .mini-bar-chart {
      display: grid;
      gap: 0.5rem;
    }

    .mini-bar-row {
      display: grid;
      gap: 0.24rem;
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
      font-size: 0.84rem;
    }

    .mini-bar-row__head strong {
      font-size: 0.9rem;
    }

    .mini-bar-track {
      height: 0.46rem;
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
      .dashboard-page {
        gap: 0.95rem;
      }

      .kpi-strip {
        grid-template-columns: 1fr;
      }

      .kpi-item {
        border-left: none;
        border-top: 6px solid var(--kpi-accent, rgba(23, 50, 37, 0.12));
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
        width: 150px;
        height: 150px;
      }

      .donut-chart::after {
        inset: 18px;
      }

      .kpi-item strong {
        font-size: 2.2rem;
      }
    }
  `]
})
export class DashboardPageComponent {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);

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
        label: this.t('dashboard.metrics.openRisks.label'),
        value: this.data().riskSummary.open + this.data().riskSummary.inTreatment,
        copy: this.t('dashboard.metrics.openRisks.copy'),
        link: '/risks',
        accent: '#8B5E16',
        surface: '#E7D7B7'
      },
      {
        label: this.t('dashboard.metrics.openCapa.label'),
        value: metrics['openCapas'] ?? 0,
        copy: this.t('dashboard.metrics.openCapa.copy'),
        link: '/capa',
        accent: '#1E467F',
        surface: '#DCE6F3'
      },
      {
        label: this.t('dashboard.metrics.activeAudits.label'),
        value: metrics['openAudits'] ?? 0,
        copy: this.t('dashboard.metrics.activeAudits.copy'),
        link: '/audits',
        accent: '#344150',
        surface: '#DDE4EA'
      },
      {
        label: this.t('dashboard.metrics.overdueActions.label'),
        value: metrics['overdueActions'] ?? 0,
        copy: this.t('dashboard.metrics.overdueActions.copy'),
        link: '/actions',
        queryParams: { dueState: 'overdue' },
        accent: '#94401B',
        surface: '#EDD7CC'
      },
      {
        label: this.t('dashboard.metrics.kpiBreaches.label'),
        value: this.data().kpiSummary.length,
        copy: this.t('dashboard.metrics.kpiBreaches.copy'),
        link: '/kpis',
        accent: '#18543F',
        surface: '#D8E7DF'
      },
      {
        label: this.t('dashboard.metrics.customerFeedback.label'),
        value: this.data().feedbackSummary.averageScore != null ? `${this.data().feedbackSummary.averageScore}/10` : this.t('dashboard.metrics.customerFeedback.noData'),
        copy:
          this.data().feedbackSummary.responseCount > 0
            ? this.t('dashboard.metrics.customerFeedback.responses', { count: this.data().feedbackSummary.responseCount })
            : this.t('dashboard.metrics.customerFeedback.awaiting'),
        link: '/context/interested-parties',
        accent: '#474B8C',
        surface: '#DDDEF2'
      }
    ];
  }

  protected currentModuleLabel() {
    this.i18n.language();
    return {
      risks: this.t('dashboard.modules.risks'),
      capa: this.t('dashboard.modules.capa'),
      actions: this.t('dashboard.modules.actions'),
      audits: this.t('dashboard.modules.audits'),
      context: this.t('dashboard.modules.context'),
      feedback: this.t('dashboard.modules.feedback')
    }[this.selectedModule()];
  }

  protected currentRangeLabel() {
    this.i18n.language();
    return {
      month: this.t('dashboard.ranges.month'),
      quarter: this.t('dashboard.ranges.quarter'),
      year: this.t('dashboard.ranges.year')
    }[this.selectedTimeRange()];
  }

  protected summaryEyebrow() {
    return this.dashboardCopy().summaryEyebrow;
  }

  protected summaryTitle() {
    return this.dashboardCopy().summaryTitle;
  }

  protected filterModuleLabel() {
    return this.dashboardCopy().filterModuleLabel;
  }

  protected filterPeriodLabel() {
    return this.dashboardCopy().filterPeriodLabel;
  }

  protected filterChartTypeLabel() {
    return this.dashboardCopy().filterChartTypeLabel;
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
    this.i18n.language();
    return {
      bar: this.t('dashboard.chartTypes.bar'),
      line: this.t('dashboard.chartTypes.line'),
      pie: this.t('dashboard.chartTypes.pie'),
      donut: this.t('dashboard.chartTypes.donut')
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
    return this.dashboardCopy().watchlistTitle;
  }

  protected watchlistNarrative() {
    return this.dashboardCopy().watchlistCopy;
  }

  protected watchlistPoints(): DashboardPoint[] {
    const raw = [
      {
        label: this.t('dashboard.watchlist.items.incidents'),
        value: this.incidents().filter((item) => item.status !== 'CLOSED' && item.status !== 'ARCHIVED').length,
        color: '#b45a47',
        link: '/incidents'
      },
      {
        label: this.t('dashboard.watchlist.items.providers'),
        value: this.providers().filter((item) => item.status === 'UNDER_REVIEW' || item.evaluationOutcome === 'ESCALATED' || item.evaluationOutcome === 'DISQUALIFIED' || (!!item.supplierAuditRequired && !item.supplierAuditLinked)).length,
        color: '#9a6e2d',
        link: '/external-providers'
      },
      {
        label: this.t('dashboard.watchlist.items.obligations'),
        value: this.obligations().filter((item) => item.status === 'UNDER_REVIEW' || this.isOverdue(item.nextReviewDate ?? undefined)).length,
        color: '#446d8e',
        link: '/compliance-obligations'
      },
      {
        label: this.t('dashboard.watchlist.items.hazards'),
        value: this.hazards().filter((item) => item.status !== 'OBSOLETE' && item.severity === 'HIGH').length,
        color: '#8c3f36',
        link: '/hazards'
      },
      {
        label: this.t('dashboard.watchlist.items.aspects'),
        value: this.aspects().filter((item) => item.status !== 'OBSOLETE' && item.significance === 'HIGH').length,
        color: '#3f6f59',
        link: '/environmental-aspects'
      }
    ];
    const total = Math.max(raw.reduce((sum, item) => sum + item.value, 0), 1);
    return raw.map((item) => ({ ...item, width: (item.value / total) * 100 }));
  }

  protected breakdownTitle() {
    return this.t('dashboard.breakdown.title', { module: this.currentModuleLabel() });
  }

  protected breakdownNarrative() {
    return this.t('dashboard.breakdown.copy', {
      metric: this.mainChartMetricLabel().toLowerCase(),
      chart: this.currentChartTypeLabel().toLowerCase()
    });
  }

  protected mainChartMetricLabel() {
    this.i18n.language();
    return {
      risks: this.t('dashboard.mainMetrics.risks'),
      capa: this.t('dashboard.mainMetrics.capa'),
      actions: this.t('dashboard.mainMetrics.actions'),
      audits: this.t('dashboard.mainMetrics.audits'),
      context: this.t('dashboard.mainMetrics.context'),
      feedback: this.t('dashboard.mainMetrics.feedback')
    }[this.selectedModule()];
  }

  protected mainChartSummaryLabel() {
    const count = this.mainChartTotal();
    return this.dashboardCopy().chartSummary(this.selectedModule(), count);
  }

  private dashboardCopy() {
    const language = this.i18n.language();
    if (language === 'az') {
      return {
        summaryEyebrow: 'Baxış',
        summaryTitle: 'Rəhbərlik icmalı',
        filterModuleLabel: 'Modul',
        filterPeriodLabel: 'Dövr',
        filterChartTypeLabel: 'Qrafik növü',
        watchlistTitle: 'Diqqət tələb edən sahələr',
        watchlistCopy: 'Hazırda baxış tələb edən modullara qısa baxış.',
        chartSummary: (module: DashboardModule, count: number) =>
          ({
            risks: `${count} açıq risk`,
            capa: `${count} CAPA qeydi`,
            actions: `${count} tapşırıq`,
            audits: `${count} aktiv audit`,
            context: `${count} kontekst qeydi`,
            feedback: `${count} rəy cavabı`
          } satisfies Record<DashboardModule, string>)[module]
      };
    }

    if (language === 'ru') {
      return {
        summaryEyebrow: 'Обзор',
        summaryTitle: 'Обзор для руководства',
        filterModuleLabel: 'Модуль',
        filterPeriodLabel: 'Период',
        filterChartTypeLabel: 'Тип графика',
        watchlistTitle: 'Области, требующие внимания',
        watchlistCopy: 'Краткий обзор модулей, которые сейчас требуют проверки.',
        chartSummary: (module: DashboardModule, count: number) =>
          ({
            risks: `${count} открытых рисков`,
            capa: `${count} записей CAPA`,
            actions: `${count} задач`,
            audits: `${count} активных аудитов`,
            context: `${count} записей контекста`,
            feedback: `${count} ответов`
          } satisfies Record<DashboardModule, string>)[module]
      };
    }

    return {
      summaryEyebrow: 'Overview',
      summaryTitle: 'Management overview',
      filterModuleLabel: 'Module',
      filterPeriodLabel: 'Period',
      filterChartTypeLabel: 'Chart type',
      watchlistTitle: 'Areas needing attention',
      watchlistCopy: 'A quick view of the modules that currently need review.',
      chartSummary: (module: DashboardModule, count: number) =>
        ({
          risks: `${count} open risks`,
          capa: `${count} CAPA items`,
          actions: `${count} action items`,
          audits: `${count} active audits`,
          context: `${count} context items`,
          feedback: `${count} feedback responses`
        } satisfies Record<DashboardModule, string>)[module]
    };
  }

  private baseChartPoints(): Omit<DashboardPoint, 'width'>[] {
    switch (this.selectedModule()) {
      case 'capa': {
        const open = this.data().capaSummary.investigating + this.actionPlannedCount();
        const inProgress = this.data().capaSummary.inProgress;
        const closed = Math.max((this.data().metrics['capas'] ?? 0) - (this.data().metrics['openCapas'] ?? 0), 0);
        return [
          { label: this.t('dashboard.status.open'), value: open, color: '#9a6e2d', link: '/capa' },
          { label: this.t('dashboard.status.inProgress'), value: inProgress, color: '#3f6f59', link: '/capa' },
          { label: this.t('dashboard.status.closed'), value: closed, color: '#244f3d', link: '/capa' }
        ];
      }
      case 'actions': {
        const actionItems = this.data().actionItems;
        const open = actionItems.filter((item) => item.status === 'OPEN').length;
        const inProgress = actionItems.filter((item) => item.status === 'IN_PROGRESS').length;
        const done = actionItems.filter((item) => item.status === 'DONE').length;
        const overdue = actionItems.filter((item) => this.isOverdue(item.dueDate)).length;
        return [
          { label: this.t('dashboard.status.open'), value: open, color: '#446d8e', link: '/actions' },
          { label: this.t('dashboard.status.inProgress'), value: inProgress, color: '#3f6f59', link: '/actions' },
          { label: this.t('dashboard.status.done'), value: done, color: '#6f9d7f', link: '/actions' },
          { label: this.t('dashboard.status.overdue'), value: overdue, color: '#b45a47', link: '/actions' }
        ];
      }
      case 'audits':
        return [
          { label: this.t('dashboard.status.planned'), value: this.data().auditSummary.planned, color: '#446d8e', link: '/audits' },
          { label: this.t('dashboard.status.inProgress'), value: this.data().auditSummary.inProgress, color: '#c39545', link: '/audits' },
          { label: this.t('dashboard.status.completed'), value: this.data().auditSummary.completed, color: '#244f3d', link: '/audits' }
        ];
      case 'context': {
        const summary = this.contextSummary()?.summary;
        return [
          { label: this.t('dashboard.context.internalIssues'), value: summary?.internalIssues ?? 0, color: '#3f6f59', link: '/context/internal-issues' },
          { label: this.t('dashboard.context.externalIssues'), value: summary?.externalIssues ?? 0, color: '#9a6e2d', link: '/context/external-issues' },
          { label: this.t('dashboard.context.interestedParties'), value: summary?.interestedParties ?? 0, color: '#446d8e', link: '/context/interested-parties' },
          { label: this.t('dashboard.context.needs'), value: summary?.needsExpectations ?? 0, color: '#6f9d7f', link: '/context/needs-expectations' }
        ];
      }
      case 'feedback':
        return [
          { label: this.t('dashboard.feedback.low'), value: this.data().feedbackSummary.lowScoreCount, color: '#b45a47', link: '/context/interested-parties' },
          { label: this.t('dashboard.feedback.medium'), value: this.data().feedbackSummary.mediumScoreCount, color: '#c39545', link: '/context/interested-parties' },
          { label: this.t('dashboard.feedback.high'), value: this.data().feedbackSummary.highScoreCount, color: '#3f6f59', link: '/context/interested-parties' },
          { label: this.t('dashboard.feedback.openLinks'), value: this.data().feedbackSummary.openRequestCount, color: '#446d8e', link: '/context/interested-parties' }
        ];
      case 'risks':
      default:
        return [
          { label: this.t('dashboard.riskLevels.low'), value: this.data().riskDistribution.low, color: '#6f9d7f', link: '/risks' },
          { label: this.t('dashboard.riskLevels.medium'), value: this.data().riskDistribution.medium, color: '#c39545', link: '/risks' },
          { label: this.t('dashboard.riskLevels.high'), value: this.data().riskDistribution.high, color: '#b45a47', link: '/risks' }
        ];
    }
  }

  protected t(key: string, params?: Record<string, unknown>) {
    return this.i18n.t(key, params);
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
