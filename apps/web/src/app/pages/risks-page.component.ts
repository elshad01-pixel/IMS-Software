import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { RecordWorkItemsComponent } from '../shared/record-work-items.component';

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type RiskStatus = 'OPEN' | 'IN_TREATMENT' | 'MITIGATED' | 'ACCEPTED' | 'CLOSED';

type RiskRow = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  likelihood: number;
  severity: number;
  score: number;
  treatmentPlan?: string | null;
  treatmentSummary?: string | null;
  ownerId?: string | null;
  targetDate?: string | null;
  status: RiskStatus;
  updatedAt: string;
};

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RecordWorkItemsComponent],
  template: `
    <section class="page-grid">
      <div class="card header">
        <div>
          <span class="pill">Risks</span>
          <h2>Risk register and treatment tracking</h2>
          <p>Assess likelihood and severity, assign ownership, and drive treatment actions into the dashboard.</p>
        </div>
      </div>

      <div class="workspace">
        <div class="card table-card">
          <div class="toolbar">
            <div>
              <strong>{{ risks().length }} risks</strong>
              <p class="subtle">Highest residual scores are shown first.</p>
            </div>
            <button type="button" class="ghost" (click)="resetForm()">New risk</button>
          </div>

          <div class="table-state" *ngIf="loading()">Loading register...</div>
          <table *ngIf="!loading()">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Score</th>
                <th>Status</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of risks()" (click)="select(item)" [class.selected]="item.id === selectedId()">
                <td>{{ item.title }}</td>
                <td>{{ item.category || 'General' }}</td>
                <td>{{ item.score }}</td>
                <td>{{ item.status }}</td>
                <td>{{ item.targetDate ? (item.targetDate | date:'yyyy-MM-dd') : 'N/A' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="side">
          <form class="card form-card" [formGroup]="form" (ngSubmit)="save()">
            <div class="toolbar">
              <div>
                <strong>{{ selectedId() ? 'Edit risk' : 'Create risk' }}</strong>
                <p class="subtle" *ngIf="selectedRisk()">Current score: {{ selectedRisk()?.score }}</p>
              </div>
              <span class="message" [class.error]="!!error()">{{ error() || message() }}</span>
            </div>

            <div class="inline">
              <label>
                <span>Title</span>
                <input formControlName="title" placeholder="Supplier delivery interruption">
              </label>
              <label>
                <span>Category</span>
                <input formControlName="category" placeholder="Operational">
              </label>
            </div>

            <label>
              <span>Description</span>
              <textarea formControlName="description" rows="3" placeholder="What could happen and why"></textarea>
            </label>

            <div class="inline">
              <label>
                <span>Likelihood</span>
                <input type="number" min="1" max="5" formControlName="likelihood">
              </label>
              <label>
                <span>Severity</span>
                <input type="number" min="1" max="5" formControlName="severity">
              </label>
            </div>

            <div class="score-card">
              <span>Calculated score</span>
              <strong>{{ currentScore() }}</strong>
            </div>

            <label>
              <span>Treatment plan</span>
              <textarea formControlName="treatmentPlan" rows="3" placeholder="Controls and planned mitigation"></textarea>
            </label>

            <label>
              <span>Treatment summary</span>
              <textarea formControlName="treatmentSummary" rows="2" placeholder="Current treatment progress"></textarea>
            </label>

            <div class="inline">
              <label>
                <span>Owner</span>
                <select formControlName="ownerId">
                  <option value="">Unassigned</option>
                  <option *ngFor="let user of users()" [value]="user.id">
                    {{ user.firstName }} {{ user.lastName }}
                  </option>
                </select>
              </label>
              <label>
                <span>Target date</span>
                <input type="date" formControlName="targetDate">
              </label>
            </div>

            <label>
              <span>Status</span>
              <select formControlName="status">
                <option>OPEN</option>
                <option>IN_TREATMENT</option>
                <option>MITIGATED</option>
                <option>ACCEPTED</option>
                <option>CLOSED</option>
              </select>
            </label>

            <button type="submit" [disabled]="form.invalid || saving()">
              {{ saving() ? 'Saving...' : (selectedId() ? 'Save changes' : 'Create risk') }}
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

    .header h2 {
      margin: 0.8rem 0 0.3rem;
    }

    .header p,
    .subtle,
    .message,
    label span,
    .table-state,
    .score-card span {
      color: var(--muted);
    }

    .workspace {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 1rem;
      align-items: start;
    }

    .side {
      display: grid;
      gap: 1rem;
    }

    .toolbar {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: start;
    }

    .subtle,
    .message {
      margin: 0.25rem 0 0;
      font-size: 0.92rem;
    }

    .message {
      min-height: 1.1rem;
      text-align: right;
    }

    .message.error {
      color: #a03535;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 1rem;
    }

    th,
    td {
      padding: 0.95rem 0.4rem;
      text-align: left;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }

    tbody tr {
      cursor: pointer;
    }

    tbody tr.selected {
      background: rgba(199, 139, 52, 0.12);
    }

    form {
      display: grid;
      gap: 0.9rem;
    }

    label {
      display: grid;
      gap: 0.45rem;
    }

    .inline {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }

    .score-card {
      border: 1px solid rgba(199, 139, 52, 0.22);
      background: rgba(199, 139, 52, 0.1);
      border-radius: 16px;
      padding: 0.9rem 1rem;
    }

    .score-card strong {
      display: block;
      margin-top: 0.2rem;
      font-size: 1.8rem;
      color: #8f5b15;
    }

    input,
    select,
    textarea,
    button {
      border-radius: 14px;
      border: 1px solid var(--panel-border);
      padding: 0.8rem 0.9rem;
    }

    button {
      border: 0;
      background: var(--brand);
      color: white;
      font-weight: 700;
    }

    .ghost {
      background: rgba(40, 89, 67, 0.1);
      color: var(--brand-strong);
    }

    @media (max-width: 1100px) {
      .workspace {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 700px) {
      .inline {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class RisksPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly risks = signal<RiskRow[]>([]);
  protected readonly users = signal<UserOption[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selectedRisk = signal<RiskRow | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    description: [''],
    category: [''],
    likelihood: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
    severity: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
    treatmentPlan: [''],
    treatmentSummary: [''],
    ownerId: [''],
    targetDate: [''],
    status: ['OPEN' as RiskStatus, Validators.required]
  });

  constructor() {
    this.loadUsers();
    this.reload();
  }

  select(item: RiskRow) {
    this.selectedId.set(item.id);
    this.fetchRisk(item.id);
  }

  resetForm() {
    this.selectedId.set(null);
    this.selectedRisk.set(null);
    this.form.reset({
      title: '',
      description: '',
      category: '',
      likelihood: 3,
      severity: 3,
      treatmentPlan: '',
      treatmentSummary: '',
      ownerId: '',
      targetDate: '',
      status: 'OPEN'
    });
    this.message.set('');
    this.error.set('');
  }

  save() {
    if (this.form.invalid) {
      this.error.set('Complete the required risk fields.');
      return;
    }

    this.saving.set(true);
    this.message.set('');
    this.error.set('');

    const payload = this.toPayload();
    const request = this.selectedId()
      ? this.api.patch<RiskRow>(`risks/${this.selectedId()}`, payload)
      : this.api.post<RiskRow>('risks', payload);

    request.subscribe({
      next: (risk) => {
        this.saving.set(false);
        this.message.set(this.selectedId() ? 'Risk updated.' : 'Risk created.');
        this.reload(() => this.select(risk));
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Risk save failed.'));
      }
    });
  }

  protected currentScore() {
    const raw = this.form.getRawValue();
    return Number(raw.likelihood) * Number(raw.severity);
  }

  private fetchRisk(id: string) {
    this.loading.set(true);
    this.api.get<RiskRow>(`risks/${id}`).subscribe({
      next: (risk) => {
        this.loading.set(false);
        this.selectedRisk.set(risk);
        this.form.reset({
          title: risk.title,
          description: risk.description ?? '',
          category: risk.category ?? '',
          likelihood: risk.likelihood,
          severity: risk.severity,
          treatmentPlan: risk.treatmentPlan ?? '',
          treatmentSummary: risk.treatmentSummary ?? '',
          ownerId: risk.ownerId ?? '',
          targetDate: risk.targetDate?.slice(0, 10) ?? '',
          status: risk.status
        });
        this.message.set('');
        this.error.set('');
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Risk details could not be loaded.'));
      }
    });
  }

  private reload(after?: () => void) {
    this.loading.set(true);
    this.api.get<RiskRow[]>('risks').subscribe({
      next: (items) => {
        this.loading.set(false);
        this.risks.set(items);

        if (this.selectedId()) {
          const match = items.find((item) => item.id === this.selectedId());
          if (match) {
            this.fetchRisk(match.id);
          }
        }

        after?.();
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Risk register could not be loaded.'));
      }
    });
  }

  private loadUsers() {
    this.api.get<UserOption[]>('users').subscribe((users) => this.users.set(users));
  }

  private toPayload() {
    const raw = this.form.getRawValue();
    return {
      ...raw,
      title: raw.title.trim(),
      description: raw.description.trim() || undefined,
      category: raw.category.trim() || undefined,
      treatmentPlan: raw.treatmentPlan.trim() || undefined,
      treatmentSummary: raw.treatmentSummary.trim() || undefined,
      ownerId: raw.ownerId || undefined,
      targetDate: raw.targetDate || undefined
    };
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}
