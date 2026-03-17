import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../core/api.service';

type DashboardResponse = {
  metrics: Record<string, number>;
  highRisks: Array<{ id: string; title: string; score: number; status: string }>;
  recentDocuments: Array<{ id: string; code: string; title: string; status: string }>;
  recentCapas: Array<{ id: string; title: string; status: string; dueDate?: string }>;
  actionItems: Array<{ id: string; title: string; status: string; dueDate?: string; sourceType: string }>;
};

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page-grid">
      <div class="card page-head">
        <div>
          <span class="pill">Dashboard</span>
          <h2>Management system overview</h2>
          <p>Review document control, risk exposure, corrective actions, and open follow-up in one place.</p>
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
          <div class="section-title">High risks</div>
          <ul>
            <li *ngFor="let risk of data().highRisks">
              <strong>{{ risk.title }}</strong>
              <span>{{ risk.score }} • {{ risk.status }}</span>
            </li>
          </ul>
        </section>

        <section class="card panel">
          <div class="section-title">Recent documents</div>
          <ul>
            <li *ngFor="let document of data().recentDocuments">
              <strong>{{ document.code }}</strong>
              <span>{{ document.title }} • {{ document.status }}</span>
            </li>
          </ul>
        </section>

        <section class="card panel">
          <div class="section-title">Recent CAPAs</div>
          <ul>
            <li *ngFor="let capa of data().recentCapas">
              <strong>{{ capa.title }}</strong>
              <span>{{ capa.status }}{{ capa.dueDate ? ' • ' + (capa.dueDate | date:'yyyy-MM-dd') : '' }}</span>
            </li>
          </ul>
        </section>

        <section class="card panel">
          <div class="section-title">Open action items</div>
          <ul>
            <li *ngFor="let item of data().actionItems">
              <strong>{{ item.title }}</strong>
              <span>{{ item.sourceType }} • {{ item.status }}{{ item.dueDate ? ' • ' + (item.dueDate | date:'yyyy-MM-dd') : '' }}</span>
            </li>
          </ul>
        </section>
      </div>
    </section>
  `,
  styles: [`
    .page-head,
    .panel {
      padding: 1.2rem 1.3rem;
    }

    .page-head h2 {
      margin: 0.8rem 0 0.3rem;
    }

    .page-head p {
      margin: 0;
      color: var(--muted);
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
    }

    .metric {
      padding: 1rem 1.1rem;
    }

    .metric span {
      color: var(--muted);
    }

    .metric strong {
      display: block;
      margin-top: 0.45rem;
      font-size: 2rem;
    }

    .panels {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
    }

    .section-title {
      font-weight: 700;
      margin-bottom: 0.9rem;
    }

    ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 0.75rem;
    }

    li {
      display: grid;
      gap: 0.25rem;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      padding-bottom: 0.75rem;
    }

    li span {
      color: var(--muted);
      font-size: 0.92rem;
    }
  `]
})
export class DashboardPageComponent {
  private readonly api = inject(ApiService);
  protected readonly data = signal<DashboardResponse>({
    metrics: {},
    highRisks: [],
    recentDocuments: [],
    recentCapas: [],
    actionItems: []
  });

  constructor() {
    this.api.get<DashboardResponse>('dashboard/summary').subscribe((result) => this.data.set(result));
  }

  protected readonly metricEntries = () =>
    Object.entries(this.data().metrics).map(([label, value]) => ({ label, value }));
}
