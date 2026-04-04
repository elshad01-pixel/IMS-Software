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

type DashboardModule = 'risks' | 'capa' | 'actions' | 'audits' | 'context';
type DashboardRange = 'month' | 'quarter' | 'year';
type DashboardChartType = 'bar' | 'line' | 'pie' | 'donut';

type DashboardPoint = {
  label: string;
  value: number;
  color: string;
  link: string | any[];
  width: number;
};

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
          <div>
            <span class="section-eyebrow">{{ currentRangeLabel() }}</span>
            <h3>{{ mainChartTitle() }}</h3>
            <p class="subtle">{{ mainChartDescription() }}</p>
          </div>
          <div class="dashboard-chart-action">
            <a [routerLink]="mainChartLink()" class="mini-link">Open {{ currentModuleLabel() }}</a>
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
              <div class="donut-chart" [class.is-pie]="selectedChartType() === 'pie'" [style.background]="donutBackground(mainChartPoints())">
                <div class="donut-center" *ngIf="selectedChartType() !== 'pie'">
                  <strong>{{ mainChartTotal() }}</strong>
                  <span>{{ currentModuleLabel() }}</span>
                </div>
              </div>

              <div class="chart-legend">
                <a class="legend-item legend-button" *ngFor="let item of mainChartPoints()" [routerLink]="item.link">
                  <span class="legend-swatch" [style.background]="item.color"></span>
                  <div>
                    <strong>{{ item.label }}</strong>
                    <small>{{ item.value }}</small>
                  </div>
                </a>
              </div>
            </div>
          </ng-container>
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
      padding-inline-end: 1.6rem;
    }

    .dashboard-chart-action {
      margin-inline-end: 1.6rem;
      padding-inline-start: 0.4rem;
      flex-shrink: 0;
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
      grid-template-columns: 190px minmax(0, 1fr);
      gap: 0.8rem;
      align-items: center;
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

    .chart-legend {
      display: grid;
      gap: 0.55rem;
    }

    .legend-item {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.7rem;
      align-items: center;
      text-decoration: none;
      color: inherit;
    }

    .legend-button {
      width: 100%;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.48);
      padding: 0.55rem 0.7rem;
      border: 1px solid rgba(23, 50, 37, 0.04);
    }

    .legend-item strong {
      display: block;
      font-size: 0.96rem;
    }

    .legend-item small {
      color: var(--muted);
    }

    .legend-swatch {
      width: 0.78rem;
      height: 0.78rem;
      border-radius: 50%;
      box-shadow: 0 0 0 4px rgba(23, 50, 37, 0.035);
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

      .dashboard-chart-action {
        margin-inline-end: 0;
        padding-inline-start: 0;
      }

      .dashboard-chart-head {
        padding-inline-end: 0;
      }

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
    kpiSummary: [],
    actionItems: []
  });

  protected readonly contextSummary = signal<ContextDashboardResponse | null>(null);
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
      }
    ];
  }

  protected currentModuleLabel() {
    return {
      risks: 'Risks',
      capa: 'CAPA',
      actions: 'Actions',
      audits: 'Audits',
      context: 'Context'
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
      context: '/context'
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

  private mainChartMetricLabel() {
    return {
      risks: 'Risk distribution',
      capa: 'Status distribution',
      actions: 'Status distribution',
      audits: 'Program status',
      context: 'Issue distribution'
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
