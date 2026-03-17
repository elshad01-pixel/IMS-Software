import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith, switchMap } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../core/api.service';

type RiskRow = { id: string; title: string; score: number; status: string; mitigationPlan?: string };

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="page-grid">
      <div class="card split">
        <div>
          <span class="pill">Risks</span>
          <h2>Risk register</h2>
        </div>
        <form [formGroup]="form" (ngSubmit)="create()" class="inline-form">
          <input formControlName="title" placeholder="Supplier disruption">
          <input formControlName="likelihood" type="number" min="1" max="5">
          <input formControlName="impact" type="number" min="1" max="5">
          <input formControlName="mitigationPlan" placeholder="Dual-source critical items">
          <button type="submit">Add Risk</button>
        </form>
      </div>

      <div class="card table-card">
        <table>
          <thead>
            <tr><th>Title</th><th>Score</th><th>Status</th><th>Mitigation</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of risks() ?? []">
              <td>{{ item.title }}</td>
              <td>{{ item.score }}</td>
              <td>{{ item.status }}</td>
              <td>{{ item.mitigationPlan || 'N/A' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: [`
    .split,
    .table-card {
      padding: 1.2rem 1.3rem;
    }

    .inline-form {
      display: grid;
      grid-template-columns: 1.3fr repeat(2, 120px) 1.6fr auto;
      gap: 0.75rem;
    }

    input, button {
      border-radius: 14px;
      padding: 0.8rem 0.9rem;
      border: 1px solid var(--panel-border);
    }

    button {
      background: var(--brand);
      color: white;
      border: 0;
      font-weight: 700;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th, td {
      padding: 0.9rem 0.4rem;
      text-align: left;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }
  `]
})
export class RisksPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly reloadTrigger = this.fb.control(0, { nonNullable: true });

  protected readonly form = this.fb.nonNullable.group({
    title: ['Supplier disruption', Validators.required],
    likelihood: [3, Validators.required],
    impact: [4, Validators.required],
    mitigationPlan: ['Dual-source critical items']
  });

  protected readonly risks = toSignal(
    this.reloadTrigger.valueChanges.pipe(
      startWith(0),
      switchMap(() => this.api.get<RiskRow[]>('risks'))
    )
  );

  create() {
    if (this.form.invalid) {
      return;
    }

    this.api.post('risks', this.form.getRawValue()).subscribe(() => {
      this.form.patchValue({ title: '' });
      this.reloadTrigger.setValue(this.reloadTrigger.value + 1);
    });
  }
}
