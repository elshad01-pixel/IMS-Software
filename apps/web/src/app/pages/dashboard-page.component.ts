import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page-grid">
      <div class="card page-head">
        <div>
          <span class="pill">Dashboard</span>
          <h2>Operational overview</h2>
        </div>
      </div>

      <div class="metrics">
        <article class="card metric" *ngFor="let item of metricEntries()">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </article>
      </div>

      <div class="card table-card">
        <div class="section-title">High risks</div>
        <table>
          <thead>
            <tr><th>Title</th><th>Score</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let risk of summary()?.highRisks ?? []">
              <td>{{ risk.title }}</td>
              <td>{{ risk.score }}</td>
              <td>{{ risk.status }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: [`
    .page-head,
    .table-card {
      padding: 1.2rem 1.3rem;
    }

    .page-head h2,
    .section-title {
      margin: 0.8rem 0 0;
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

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 1rem;
    }

    th, td {
      padding: 0.9rem 0.4rem;
      text-align: left;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }
  `]
})
export class DashboardPageComponent {
  private readonly api = inject(ApiService);
  protected readonly summary = toSignal(
    this.api.get<{ metrics: Record<string, number>; highRisks: Array<{ title: string; score: number; status: string }> }>('dashboard/summary')
  );

  protected readonly metricEntries = () =>
    Object.entries(this.summary()?.metrics ?? {}).map(([label, value]) => ({ label, value }));
}
