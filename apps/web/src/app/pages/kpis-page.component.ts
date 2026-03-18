import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type KpiDirection = 'AT_LEAST' | 'AT_MOST';

type KpiReading = {
  id: string;
  value: number;
  readingDate: string;
  notes?: string | null;
};

type KpiRecord = {
  id: string;
  name: string;
  description?: string | null;
  ownerId?: string | null;
  target: number;
  warningThreshold?: number | null;
  actual: number;
  unit: string;
  periodLabel: string;
  direction: KpiDirection;
  status: 'ON_TARGET' | 'WATCH' | 'BREACH';
  trend: number;
  readings: KpiReading[];
};

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="page-grid">
      <div class="card header">
        <div>
          <span class="pill">KPIs</span>
          <h2>KPI definitions, readings, and trends</h2>
          <p>Define targets and thresholds, add readings over time, and highlight performance breaches.</p>
        </div>
      </div>

      <div class="workspace">
        <div class="card table-card">
          <div class="toolbar">
            <div>
              <strong>{{ kpis().length }} KPIs</strong>
              <p class="subtle">Breaches and current direction are visible in the register.</p>
            </div>
            <button type="button" class="ghost" (click)="resetForm()">New KPI</button>
          </div>

          <div class="table-state" *ngIf="loading()">Loading KPIs...</div>
          <table *ngIf="!loading()">
            <thead>
              <tr>
                <th>Name</th>
                <th>Current</th>
                <th>Target</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of kpis()" (click)="select(item)" [class.selected]="item.id === selectedId()">
                <td>{{ item.name }}</td>
                <td>{{ item.actual }} {{ item.unit }}</td>
                <td>{{ item.target }} {{ item.unit }}</td>
                <td><span class="status" [class.breach]="item.status === 'BREACH'" [class.watch]="item.status === 'WATCH'">{{ item.status }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="side">
          <form class="card form-card" [formGroup]="kpiForm" (ngSubmit)="saveKpi()">
            <div class="toolbar">
              <div>
                <strong>{{ selectedId() ? 'Edit KPI' : 'Create KPI' }}</strong>
                <p class="subtle" *ngIf="selectedKpi()">Current status: {{ selectedKpi()?.status }}</p>
              </div>
              <span class="message" [class.error]="!!error()">{{ error() || message() }}</span>
            </div>

            <label><span>Name</span><input formControlName="name" placeholder="Supplier OTIF"></label>
            <label><span>Description</span><textarea rows="2" formControlName="description" placeholder="On-time in-full supplier delivery rate"></textarea></label>
            <div class="inline">
              <label>
                <span>Owner</span>
                <select formControlName="ownerId">
                  <option value="">Unassigned</option>
                  <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
                </select>
              </label>
              <label>
                <span>Direction</span>
                <select formControlName="direction">
                  <option>AT_LEAST</option>
                  <option>AT_MOST</option>
                </select>
              </label>
            </div>
            <div class="inline">
              <label><span>Target</span><input type="number" step="0.01" formControlName="target"></label>
              <label><span>Warning threshold</span><input type="number" step="0.01" formControlName="warningThreshold"></label>
            </div>
            <div class="inline">
              <label><span>Unit</span><input formControlName="unit" placeholder="%"></label>
              <label><span>Period label</span><input formControlName="periodLabel" placeholder="Monthly"></label>
            </div>
            <button type="submit" [disabled]="kpiForm.invalid || saving()">
              {{ saving() ? 'Saving...' : (selectedId() ? 'Save changes' : 'Create KPI') }}
            </button>
          </form>

          <section class="card nested-card" *ngIf="selectedKpi()">
            <div class="panel-title">Readings</div>
            <form [formGroup]="readingForm" class="inline-form" (ngSubmit)="addReading()">
              <input type="number" step="0.01" formControlName="value" placeholder="Value">
              <input type="date" formControlName="readingDate">
              <button type="submit" [disabled]="readingForm.invalid || saving()">Add reading</button>
            </form>
            <textarea class="notes-field" rows="2" formControlName="notes" [formGroup]="readingForm" placeholder="Reading notes"></textarea>

            <div class="trend-card" *ngIf="selectedKpi()">
              <span>Trend</span>
              <strong>{{ selectedKpi()?.trend }}</strong>
            </div>

            <ul class="list">
              <li *ngFor="let reading of selectedKpi()?.readings || []">
                <strong>{{ reading.value }} {{ selectedKpi()?.unit }}</strong>
                <small>{{ reading.readingDate | date:'yyyy-MM-dd' }} | {{ reading.notes || 'No notes' }}</small>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .header, .table-card, .form-card, .nested-card { padding: 1.2rem 1.3rem; }
    .header h2 { margin: 0.8rem 0 0.3rem; }
    .header p, .subtle, .message, .table-state, small, .trend-card span { color: var(--muted); }
    .workspace { display: grid; grid-template-columns: 1.1fr 1fr; gap: 1rem; align-items: start; }
    .side { display: grid; gap: 1rem; }
    .toolbar { display: flex; justify-content: space-between; gap: 1rem; align-items: start; }
    .subtle, .message { margin: 0.25rem 0 0; font-size: 0.92rem; }
    .message { min-height: 1.1rem; text-align: right; }
    .message.error { color: #a03535; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { padding: 0.95rem 0.4rem; text-align: left; border-bottom: 1px solid rgba(0,0,0,0.08); }
    tbody tr { cursor: pointer; }
    tbody tr.selected { background: rgba(199,139,52,0.12); }
    form { display: grid; gap: 0.9rem; }
    .inline, .inline-form { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .inline-form { grid-template-columns: 1fr 1fr auto; margin-top: 1rem; }
    label { display: grid; gap: 0.45rem; }
    input, select, textarea, button { border-radius: 14px; border: 1px solid var(--panel-border); padding: 0.8rem 0.9rem; }
    button { border: 0; background: var(--brand); color: white; font-weight: 700; }
    .ghost { background: rgba(40,89,67,0.1); color: var(--brand-strong); }
    .panel-title { font-weight: 700; }
    .list { list-style: none; padding: 0; margin: 1rem 0 0; display: grid; gap: 0.75rem; }
    .list li { border: 1px solid rgba(0,0,0,0.08); border-radius: 16px; padding: 0.85rem; display: grid; gap: 0.25rem; }
    .status { font-weight: 700; }
    .status.watch { color: #8f5b15; }
    .status.breach { color: #a03535; }
    .trend-card { border: 1px solid rgba(0,0,0,0.08); border-radius: 16px; padding: 0.85rem; margin-top: 1rem; }
    .trend-card strong { display: block; margin-top: 0.25rem; font-size: 1.6rem; }
    .notes-field { margin-top: 0.75rem; width: 100%; }
    @media (max-width: 1100px) { .workspace { grid-template-columns: 1fr; } }
    @media (max-width: 700px) { .inline, .inline-form { grid-template-columns: 1fr; } }
  `]
})
export class KpisPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly kpis = signal<KpiRecord[]>([]);
  protected readonly users = signal<UserOption[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selectedKpi = signal<KpiRecord | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');

  protected readonly kpiForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    description: [''],
    ownerId: [''],
    target: [0, Validators.required],
    warningThreshold: [0],
    unit: ['', [Validators.required, Validators.maxLength(20)]],
    periodLabel: ['', [Validators.required, Validators.maxLength(60)]],
    direction: ['AT_LEAST' as KpiDirection, Validators.required]
  });

  protected readonly readingForm = this.fb.nonNullable.group({
    value: [0, Validators.required],
    readingDate: ['', Validators.required],
    notes: ['']
  });

  constructor() {
    this.loadUsers();
    this.reload();
  }

  select(item: KpiRecord) {
    this.selectedId.set(item.id);
    this.fetchKpi(item.id);
  }

  resetForm() {
    this.selectedId.set(null);
    this.selectedKpi.set(null);
    this.kpiForm.reset({
      name: '',
      description: '',
      ownerId: '',
      target: 0,
      warningThreshold: 0,
      unit: '',
      periodLabel: '',
      direction: 'AT_LEAST'
    });
    this.readingForm.reset({ value: 0, readingDate: '', notes: '' });
    this.message.set('');
    this.error.set('');
  }

  saveKpi() {
    if (this.kpiForm.invalid) {
      this.error.set('Complete the required KPI fields.');
      return;
    }

    this.saving.set(true);
    this.message.set('');
    this.error.set('');
    const raw = this.kpiForm.getRawValue();
    const payload = {
      ...raw,
      name: raw.name.trim(),
      description: raw.description.trim() || undefined,
      ownerId: raw.ownerId || undefined,
      warningThreshold: raw.warningThreshold || undefined,
      unit: raw.unit.trim(),
      periodLabel: raw.periodLabel.trim()
    };

    const request = this.selectedId()
      ? this.api.patch<KpiRecord>(`kpis/${this.selectedId()}`, payload)
      : this.api.post<KpiRecord>('kpis', payload);

    request.subscribe({
      next: (kpi) => {
        this.saving.set(false);
        this.message.set(this.selectedId() ? 'KPI updated.' : 'KPI created.');
        this.reload(() => this.select(kpi));
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'KPI save failed.'));
      }
    });
  }

  addReading() {
    if (!this.selectedId() || this.readingForm.invalid) {
      return;
    }

    this.saving.set(true);
    this.api.post(`kpis/${this.selectedId()}/readings`, {
      ...this.readingForm.getRawValue(),
      notes: this.readingForm.getRawValue().notes.trim() || undefined
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('KPI reading added.');
        this.readingForm.reset({ value: 0, readingDate: '', notes: '' });
        this.fetchKpi(this.selectedId() as string);
        this.reload();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'KPI reading save failed.'));
      }
    });
  }

  private fetchKpi(id: string) {
    this.loading.set(true);
    this.api.get<KpiRecord>(`kpis/${id}`).subscribe({
      next: (kpi) => {
        this.loading.set(false);
        this.selectedKpi.set(kpi);
        this.kpiForm.reset({
          name: kpi.name,
          description: kpi.description ?? '',
          ownerId: kpi.ownerId ?? '',
          target: kpi.target,
          warningThreshold: kpi.warningThreshold ?? 0,
          unit: kpi.unit,
          periodLabel: kpi.periodLabel,
          direction: kpi.direction
        });
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'KPI details could not be loaded.'));
      }
    });
  }

  private reload(after?: () => void) {
    this.loading.set(true);
    this.api.get<KpiRecord[]>('kpis').subscribe({
      next: (items) => {
        this.loading.set(false);
        this.kpis.set(items);
        after?.();
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'KPIs could not be loaded.'));
      }
    });
  }

  private loadUsers() {
    this.api.get<UserOption[]>('users').subscribe((users) => this.users.set(users));
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}
