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
        [description]="'A quieter operational view of document control, risks, CAPA, audits, reviews, KPIs, training, and actions.'"
        [breadcrumbs]="[{ label: 'Dashboard' }]"
      />

      <section class="metrics-grid">
        <article class="card metric-card" *ngFor="let item of metricEntries()">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </article>
      </section>

      <section class="page-columns">
        <div class="page-stack">
          <section class="card panel-card">
            <div class="section-head">
              <div>
                <h3>Operational summaries</h3>
                <p class="subtle">Key operational counts without forcing all modules into one crowded canvas.</p>
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
                <a routerLink="/dashboard" class="text-link">Stay on dashboard</a>
              </article>
            </div>
          </section>

          <section class="card panel-card">
            <div class="section-head">
              <div>
                <h3>Open action items</h3>
                <p class="subtle">Follow-up items across the system with source, owner, and due date.</p>
              </div>
            </div>
            <div class="entity-list top-space">
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
                <h3>Recent records</h3>
                <p class="subtle">Keep the newest activity readable by module.</p>
              </div>
            </div>

            <div class="mini-group top-space">
              <h4>Documents</h4>
              <div class="entity-list">
                <article class="entity-item" *ngFor="let document of data().recentDocuments">
                  <strong>{{ document.code }}</strong>
                  <small>{{ document.title }} | {{ document.status }} | V{{ document.version }}.{{ document.revision }}</small>
                </article>
              </div>
            </div>

            <div class="mini-group top-space">
              <h4>CAPA</h4>
              <div class="entity-list">
                <article class="entity-item" *ngFor="let capa of data().recentCapas">
                  <strong>{{ capa.title }}</strong>
                  <small>{{ capa.status }}{{ capa.dueDate ? ' | ' + (capa.dueDate | date:'yyyy-MM-dd') : '' }}</small>
                </article>
              </div>
            </div>

            <div class="mini-group top-space">
              <h4>Audits</h4>
              <div class="entity-list">
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
                <h3>Watch lists</h3>
                <p class="subtle">Current KPI and training watch points.</p>
              </div>
            </div>

            <div class="mini-group top-space">
              <h4>KPIs</h4>
              <div class="entity-list">
                <article class="entity-item" *ngFor="let item of data().kpiSummary">
                  <strong>{{ item.name }}</strong>
                  <small>{{ item.actual }}{{ item.unit }} vs {{ item.target }}{{ item.unit }} | {{ item.status }}</small>
                </article>
              </div>
            </div>

            <div class="mini-group top-space">
              <h4>Training</h4>
              <div class="entity-list">
                <article class="entity-item" *ngFor="let item of data().trainingSummary">
                  <strong>{{ item.title }}</strong>
                  <small>{{ item.completion | number:'1.0-0' }}% complete{{ item.dueDate ? ' | ' + (item.dueDate | date:'yyyy-MM-dd') : '' }}</small>
                </article>
              </div>
            </div>

            <div class="mini-group top-space">
              <h4>High risks</h4>
              <div class="entity-list">
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
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 1rem;
    }

    .metric-card {
      padding: 1rem 1.1rem;
    }

    .metric-card span {
      color: var(--muted);
    }

    .metric-card strong {
      display: block;
      margin-top: 0.35rem;
      font-size: 1.9rem;
    }

    .top-space {
      margin-top: 1rem;
    }

    .mini-group h4 {
      margin: 0 0 0.6rem;
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
}
