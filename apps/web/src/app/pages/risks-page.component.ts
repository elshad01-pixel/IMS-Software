import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { RecordWorkItemsComponent } from '../shared/record-work-items.component';

type RiskRow = {
  id: string;
  title: string;
  description?: string;
  likelihood: number;
  impact: number;
  score: number;
  mitigationPlan?: string;
  status: string;
};

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RecordWorkItemsComponent],
  template: `
    <section class="page-grid">
      <div class="card header">
        <div>
          <span class="pill">Risks</span>
          <h2>Risk register and mitigation tracking</h2>
          <p>Score risks consistently, maintain treatment plans, and drive follow-up items.</p>
        </div>
      </div>

      <div class="workspace">
        <div class="card table-card">
          <div class="toolbar">
            <strong>{{ risks().length }} risks</strong>
            <button type="button" class="ghost" (click)="resetForm()">New risk</button>
          </div>

          <table>
            <thead>
              <tr><th>Title</th><th>Score</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of risks()" (click)="select(item)" [class.selected]="item.id === selectedId()">
                <td>{{ item.title }}</td>
                <td>{{ item.score }}</td>
                <td>{{ item.status }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="side">
          <form class="card form-card" [formGroup]="form" (ngSubmit)="save()">
            <div class="toolbar">
              <strong>{{ selectedId() ? 'Edit risk' : 'Create risk' }}</strong>
              <span class="message">{{ message() }}</span>
            </div>

            <label>
              <span>Title</span>
              <input formControlName="title">
            </label>
            <label>
              <span>Description</span>
              <textarea formControlName="description" rows="3"></textarea>
            </label>
            <div class="inline">
              <label>
                <span>Likelihood</span>
                <input type="number" min="1" max="5" formControlName="likelihood">
              </label>
              <label>
                <span>Impact</span>
                <input type="number" min="1" max="5" formControlName="impact">
              </label>
            </div>
            <label>
              <span>Mitigation plan</span>
              <textarea formControlName="mitigationPlan" rows="3"></textarea>
            </label>
            <label>
              <span>Status</span>
              <select formControlName="status">
                <option>OPEN</option>
                <option>MITIGATED</option>
                <option>ACCEPTED</option>
                <option>CLOSED</option>
              </select>
            </label>

            <div class="score">Calculated score: {{ form.getRawValue().likelihood * form.getRawValue().impact }}</div>
            <button type="submit" [disabled]="form.invalid || saving()">
              {{ saving() ? 'Saving...' : (selectedId() ? 'Update risk' : 'Create risk') }}
            </button>
          </form>

          <iso-record-work-items [sourceType]="'risk'" [sourceId]="selectedId()" />
        </div>
      </div>
    </section>
  `,
  styles: [`
    .header,
    .table-card,
    .form-card {
      padding: 1.2rem 1.3rem;
    }

    .header h2 { margin: 0.8rem 0 0.3rem; }
    .header p, .message, label span { color: var(--muted); }
    .workspace { display: grid; grid-template-columns: 1.2fr 1fr; gap: 1rem; align-items: start; }
    .side { display: grid; gap: 1rem; }
    .toolbar { display: flex; justify-content: space-between; gap: 1rem; align-items: center; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { padding: 0.95rem 0.4rem; text-align: left; border-bottom: 1px solid rgba(0,0,0,0.08); }
    tbody tr { cursor: pointer; }
    tbody tr.selected { background: rgba(199, 139, 52, 0.12); }
    form { display: grid; gap: 0.9rem; }
    label { display: grid; gap: 0.45rem; }
    .inline { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    input, select, textarea, button { border-radius: 14px; border: 1px solid var(--panel-border); padding: 0.8rem 0.9rem; }
    button { border: 0; background: var(--brand); color: white; font-weight: 700; }
    .ghost { background: rgba(40, 89, 67, 0.1); color: var(--brand-strong); }
    .score { font-weight: 700; color: var(--brand-strong); }
    @media (max-width: 1100px) { .workspace { grid-template-columns: 1fr; } }
  `]
})
export class RisksPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly risks = signal<RiskRow[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly message = signal('');

  protected readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: [''],
    likelihood: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
    impact: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
    mitigationPlan: [''],
    status: ['OPEN', Validators.required]
  });

  constructor() {
    this.reload();
  }

  select(item: RiskRow) {
    this.selectedId.set(item.id);
    this.form.setValue({
      title: item.title,
      description: item.description || '',
      likelihood: item.likelihood,
      impact: item.impact,
      mitigationPlan: item.mitigationPlan || '',
      status: item.status
    });
    this.message.set('');
  }

  resetForm() {
    this.selectedId.set(null);
    this.form.reset({
      title: '',
      description: '',
      likelihood: 3,
      impact: 3,
      mitigationPlan: '',
      status: 'OPEN'
    });
    this.message.set('');
  }

  save() {
    if (this.form.invalid) {
      return;
    }

    this.saving.set(true);
    const request = this.selectedId()
      ? this.api.patch(`risks/${this.selectedId()}`, this.form.getRawValue())
      : this.api.post<RiskRow>('risks', this.form.getRawValue());

    request.subscribe({
      next: (response: unknown) => {
        this.saving.set(false);
        this.message.set(this.selectedId() ? 'Risk updated.' : 'Risk created.');
        this.reload(() => {
          const created = response as RiskRow;
          if (!this.selectedId() && created?.id) {
            this.select(created);
          }
        });
      },
      error: () => {
        this.saving.set(false);
        this.message.set('Save failed.');
      }
    });
  }

  private reload(after?: () => void) {
    this.api.get<RiskRow[]>('risks').subscribe((items) => {
      this.risks.set(items);
      if (this.selectedId()) {
        const match = items.find((item) => item.id === this.selectedId());
        if (match) {
          this.select(match);
        }
      }
      after?.();
    });
  }
}
