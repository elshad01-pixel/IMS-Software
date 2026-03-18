import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';

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
  imports: [CommonModule, RouterLink],
  template: `
    <section class="page-grid">
      <div class="card page-head">
        <div>
          <span class="pill">Dashboard</span>
          <h2>Integrated management system overview</h2>
          <p>Track PHASE 1 and PHASE 2 operations across controlled documents, risks, CAPAs, audits, reviews, KPIs, training, and actions.</p>
        </div>
      </div>

      <div class="metrics">
        <article class="card metric" *ngFor="let item of metricEntries()">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </article>
      </div>

      <div class="panels">
        <section class="card panel">
          <div class="section-title">Risk summary</div>
          <div class="summary-grid">
            <article><span>Open</span><strong>{{ data().riskSummary.open }}</strong></article>
            <article><span>In treatment</span><strong>{{ data().riskSummary.inTreatment }}</strong></article>
            <article><span>Mitigated</span><strong>{{ data().riskSummary.mitigated }}</strong></article>
          </div>
          <a routerLink="/risks" class="link">Open risk register</a>
        </section>

        <section class="card panel">
          <div class="section-title">CAPA summary</div>
          <div class="summary-grid">
            <article><span>Investigating</span><strong>{{ data().capaSummary.investigating }}</strong></article>
            <article><span>In progress</span><strong>{{ data().capaSummary.inProgress }}</strong></article>
            <article><span>Verified</span><strong>{{ data().capaSummary.verified }}</strong></article>
          </div>
          <a routerLink="/capa" class="link">Open CAPA register</a>
        </section>

        <section class="card panel">
          <div class="section-title">Audit summary</div>
          <div class="summary-grid">
            <article><span>Planned</span><strong>{{ data().auditSummary.planned }}</strong></article>
            <article><span>In progress</span><strong>{{ data().auditSummary.inProgress }}</strong></article>
            <article><span>Completed</span><strong>{{ data().auditSummary.completed }}</strong></article>
          </div>
          <a routerLink="/audits" class="link">Open audits</a>
        </section>

        <section class="card panel">
          <div class="section-title">KPI and training watch</div>
          <div class="summary-grid">
            <article><span>KPI watch</span><strong>{{ data().kpiSummaryCounts.watch }}</strong></article>
            <article><span>KPI breaches</span><strong>{{ data().kpiSummaryCounts.breach }}</strong></article>
            <article><span>Training overdue</span><strong>{{ data().metrics['overdueTrainingAssignments'] }}</strong></article>
          </div>
          <a routerLink="/kpis" class="link">Open KPIs</a>
        </section>

        <section class="card panel">
          <div class="section-title">Recent audits</div>
          <ul>
            <li *ngFor="let audit of data().recentAudits">
              <strong>{{ audit.title }}</strong>
              <span>{{ audit.status }}{{ audit.scheduledAt ? ' | ' + (audit.scheduledAt | date:'yyyy-MM-dd') : '' }}</span>
            </li>
          </ul>
        </section>

        <section class="card panel">
          <div class="section-title">KPI summary</div>
          <ul>
            <li *ngFor="let item of data().kpiSummary">
              <strong>{{ item.name }}</strong>
              <span>{{ item.actual }}{{ item.unit }} vs {{ item.target }}{{ item.unit }} | {{ item.status }}</span>
            </li>
          </ul>
        </section>

        <section class="card panel">
          <div class="section-title">Training summary</div>
          <ul>
            <li *ngFor="let item of data().trainingSummary">
              <strong>{{ item.title }}</strong>
              <span>{{ item.completion | number:'1.0-0' }}% complete{{ item.dueDate ? ' | ' + (item.dueDate | date:'yyyy-MM-dd') : '' }}</span>
            </li>
          </ul>
        </section>

        <section class="card panel">
          <div class="section-title">High risks</div>
          <ul>
            <li *ngFor="let risk of data().highRisks">
              <strong>{{ risk.title }}</strong>
              <span>{{ risk.score }} | {{ risk.status }}</span>
            </li>
          </ul>
        </section>

        <section class="card panel">
          <div class="section-title">Recent documents</div>
          <ul>
            <li *ngFor="let document of data().recentDocuments">
              <strong>{{ document.code }}</strong>
              <span>{{ document.title }} | {{ document.status }} | V{{ document.version }}.{{ document.revision }}</span>
            </li>
          </ul>
        </section>

        <section class="card panel">
          <div class="section-title">Recent CAPAs</div>
          <ul>
            <li *ngFor="let capa of data().recentCapas">
              <strong>{{ capa.title }}</strong>
              <span>{{ capa.status }}{{ capa.dueDate ? ' | ' + (capa.dueDate | date:'yyyy-MM-dd') : '' }}</span>
            </li>
          </ul>
        </section>

        <section class="card panel">
          <div class="section-title">Open action items</div>
          <ul>
            <li *ngFor="let item of data().actionItems">
              <strong>{{ item.title }}</strong>
              <span>
                {{ item.sourceType }} | {{ item.status }}
                {{ item.owner ? ' | ' + item.owner.firstName + ' ' + item.owner.lastName : '' }}
                {{ item.dueDate ? ' | ' + (item.dueDate | date:'yyyy-MM-dd') : '' }}
              </span>
            </li>
          </ul>
        </section>
      </div>
    </section>
  `,
  styles: [`
    .page-head, .panel { padding: 1.2rem 1.3rem; }
    .page-head h2 { margin: 0.8rem 0 0.3rem; }
    .page-head p, .metric span, .summary-grid span, li span { color: var(--muted); }
    .page-head p { margin: 0; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
    .metric { padding: 1rem 1.1rem; }
    .metric strong { display: block; margin-top: 0.45rem; font-size: 2rem; }
    .panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; }
    .section-title { font-weight: 700; margin-bottom: 0.9rem; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
    .summary-grid article { border: 1px solid rgba(0,0,0,0.08); border-radius: 16px; padding: 0.8rem; }
    .summary-grid strong { display: block; margin-top: 0.25rem; font-size: 1.4rem; }
    .link { display: inline-block; margin-top: 0.9rem; color: var(--brand-strong); text-decoration: none; font-weight: 700; }
    ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.75rem; }
    li { display: grid; gap: 0.25rem; border-bottom: 1px solid rgba(0,0,0,0.08); padding-bottom: 0.75rem; }
    @media (max-width: 700px) { .summary-grid { grid-template-columns: 1fr; } }
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
}
