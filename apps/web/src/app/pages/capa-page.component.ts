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

type CapaStatus = 'OPEN' | 'INVESTIGATING' | 'ACTION_PLANNED' | 'IN_PROGRESS' | 'VERIFIED' | 'CLOSED';

type CapaRow = {
  id: string;
  title: string;
  source: string;
  category?: string | null;
  problemStatement: string;
  containmentAction?: string | null;
  rootCause?: string | null;
  correction?: string | null;
  correctiveAction?: string | null;
  preventiveAction?: string | null;
  verificationMethod?: string | null;
  closureSummary?: string | null;
  ownerId?: string | null;
  dueDate?: string | null;
  closedAt?: string | null;
  status: CapaStatus;
  updatedAt: string;
};

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RecordWorkItemsComponent],
  template: `
    <section class="page-grid">
      <div class="card header">
        <div>
          <span class="pill">CAPA</span>
          <h2>Nonconformity and CAPA workflow</h2>
          <p>Raise issues, capture root cause, assign actions, verify effectiveness, and close cleanly.</p>
        </div>
      </div>

      <div class="workspace">
        <div class="card table-card">
          <div class="toolbar">
            <div>
              <strong>{{ capas().length }} CAPAs</strong>
              <p class="subtle">Track status, ownership, and due dates across nonconformities.</p>
            </div>
            <button *ngIf="selectedId()" type="button" class="ghost" (click)="resetForm()">Start new CAPA</button>
          </div>

          <div class="table-state" *ngIf="loading()">Loading CAPAs...</div>
          <table *ngIf="!loading()">
            <thead>
              <tr>
                <th>Title</th>
                <th>Source</th>
                <th>Status</th>
                <th>Due date</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of capas()" (click)="select(item)" [class.selected]="item.id === selectedId()">
                <td>{{ item.title }}</td>
                <td>{{ item.source }}</td>
                <td>{{ item.status }}</td>
                <td>{{ item.dueDate ? (item.dueDate | date:'yyyy-MM-dd') : 'N/A' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="side">
          <form class="card form-card" [formGroup]="form" (ngSubmit)="save()">
            <div class="toolbar">
              <div>
                <strong>{{ selectedId() ? 'Edit CAPA' : 'Raise CAPA' }}</strong>
                <p class="subtle" *ngIf="selectedCapa()">Status: {{ selectedCapa()?.status }}</p>
              </div>
              <span class="message" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</span>
            </div>

            <div class="inline">
              <label>
                <span>Title</span>
                <input formControlName="title" placeholder="Calibration missed for production gauge">
              </label>
              <label>
                <span>Source</span>
                <input formControlName="source" placeholder="Internal audit">
              </label>
            </div>

            <div class="inline">
              <label>
                <span>Category</span>
                <input formControlName="category" placeholder="Process">
              </label>
              <label>
                <span>Status</span>
                <select formControlName="status">
                  <option>OPEN</option>
                  <option>INVESTIGATING</option>
                  <option>ACTION_PLANNED</option>
                  <option>IN_PROGRESS</option>
                  <option>VERIFIED</option>
                  <option>CLOSED</option>
                </select>
              </label>
            </div>

            <label>
              <span>Problem statement</span>
              <textarea rows="3" formControlName="problemStatement" placeholder="Describe the nonconformity"></textarea>
            </label>

            <label>
              <span>Containment action</span>
              <textarea rows="2" formControlName="containmentAction" placeholder="Immediate containment taken"></textarea>
            </label>

            <label>
              <span>Root cause</span>
              <textarea rows="3" formControlName="rootCause" placeholder="Why did it happen"></textarea>
            </label>

            <label>
              <span>Correction</span>
              <textarea rows="2" formControlName="correction" placeholder="Immediate correction"></textarea>
            </label>

            <label>
              <span>Corrective action</span>
              <textarea rows="3" formControlName="correctiveAction" placeholder="Action to eliminate the cause"></textarea>
            </label>

            <label>
              <span>Preventive action</span>
              <textarea rows="2" formControlName="preventiveAction" placeholder="Action to prevent recurrence elsewhere"></textarea>
            </label>

            <label>
              <span>Verification method</span>
              <textarea rows="2" formControlName="verificationMethod" placeholder="How effectiveness will be verified"></textarea>
            </label>

            <label>
              <span>Closure summary</span>
              <textarea rows="2" formControlName="closureSummary" placeholder="Evidence supporting closure"></textarea>
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
                <span>Due date</span>
                <input type="date" formControlName="dueDate">
              </label>
            </div>

            <button type="submit" [disabled]="form.invalid || saving()">
              {{ saving() ? 'Saving...' : (selectedId() ? 'Save changes' : 'Create CAPA') }}
            </button>

            <div class="detail-grid" *ngIf="selectedCapa()">
              <article>
                <span class="detail-label">Updated</span>
                <strong>{{ selectedCapa()?.updatedAt | date:'yyyy-MM-dd HH:mm' }}</strong>
              </article>
              <article>
                <span class="detail-label">Closed</span>
                <strong>{{ selectedCapa()?.closedAt ? (selectedCapa()?.closedAt | date:'yyyy-MM-dd HH:mm') : 'Open' }}</strong>
              </article>
            </div>
          </form>

          <iso-record-work-items [sourceType]="'capa'" [sourceId]="selectedId()" />
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
    .detail-label,
    .table-state {
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

    .message.success {
      color: var(--brand-strong);
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
      background: rgba(40, 89, 67, 0.08);
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

    .detail-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
    }

    .detail-grid article {
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 16px;
      padding: 0.85rem;
    }

    .detail-grid strong {
      display: block;
      margin-top: 0.35rem;
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
      .inline,
      .detail-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class CapaPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly capas = signal<CapaRow[]>([]);
  protected readonly users = signal<UserOption[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selectedCapa = signal<CapaRow | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    source: ['', [Validators.required, Validators.maxLength(80)]],
    category: [''],
    problemStatement: ['', [Validators.required, Validators.maxLength(2000)]],
    containmentAction: [''],
    rootCause: [''],
    correction: [''],
    correctiveAction: [''],
    preventiveAction: [''],
    verificationMethod: [''],
    closureSummary: [''],
    ownerId: [''],
    dueDate: [''],
    status: ['OPEN' as CapaStatus, Validators.required]
  });

  constructor() {
    this.loadUsers();
    this.reload();
  }

  select(item: CapaRow) {
    this.selectedId.set(item.id);
    this.fetchCapa(item.id);
  }

  resetForm() {
    this.selectedId.set(null);
    this.selectedCapa.set(null);
    this.form.reset({
      title: '',
      source: '',
      category: '',
      problemStatement: '',
      containmentAction: '',
      rootCause: '',
      correction: '',
      correctiveAction: '',
      preventiveAction: '',
      verificationMethod: '',
      closureSummary: '',
      ownerId: '',
      dueDate: '',
      status: 'OPEN'
    });
    this.message.set('Ready to create a new CAPA.');
    this.error.set('');
  }

  save() {
    if (this.form.invalid) {
      this.error.set('Complete the required CAPA fields.');
      return;
    }

    this.saving.set(true);
    this.message.set('');
    this.error.set('');

    const payload = this.toPayload();
    const request = this.selectedId()
      ? this.api.patch<CapaRow>(`capa/${this.selectedId()}`, payload)
      : this.api.post<CapaRow>('capa', payload);

    request.subscribe({
      next: (capa) => {
        this.saving.set(false);
        this.message.set('CAPA saved successfully.');
        this.reload(() => this.select(capa));
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'CAPA save failed.'));
      }
    });
  }

  private fetchCapa(id: string) {
    this.loading.set(true);
    this.api.get<CapaRow>(`capa/${id}`).subscribe({
      next: (capa) => {
        this.loading.set(false);
        this.selectedCapa.set(capa);
        this.form.reset({
          title: capa.title,
          source: capa.source,
          category: capa.category ?? '',
          problemStatement: capa.problemStatement,
          containmentAction: capa.containmentAction ?? '',
          rootCause: capa.rootCause ?? '',
          correction: capa.correction ?? '',
          correctiveAction: capa.correctiveAction ?? '',
          preventiveAction: capa.preventiveAction ?? '',
          verificationMethod: capa.verificationMethod ?? '',
          closureSummary: capa.closureSummary ?? '',
          ownerId: capa.ownerId ?? '',
          dueDate: capa.dueDate?.slice(0, 10) ?? '',
          status: capa.status
        });
        this.message.set('');
        this.error.set('');
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'CAPA details could not be loaded.'));
      }
    });
  }

  private reload(after?: () => void) {
    this.loading.set(true);
    this.api.get<CapaRow[]>('capa').subscribe({
      next: (items) => {
        this.loading.set(false);
        this.capas.set(items);

        if (this.selectedId()) {
          const match = items.find((item) => item.id === this.selectedId());
          if (match) {
            this.fetchCapa(match.id);
          }
        }

        after?.();
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'CAPA register could not be loaded.'));
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
      source: raw.source.trim(),
      category: raw.category.trim() || undefined,
      problemStatement: raw.problemStatement.trim(),
      containmentAction: raw.containmentAction.trim() || undefined,
      rootCause: raw.rootCause.trim() || undefined,
      correction: raw.correction.trim() || undefined,
      correctiveAction: raw.correctiveAction.trim() || undefined,
      preventiveAction: raw.preventiveAction.trim() || undefined,
      verificationMethod: raw.verificationMethod.trim() || undefined,
      closureSummary: raw.closureSummary.trim() || undefined,
      ownerId: raw.ownerId || undefined,
      dueDate: raw.dueDate || undefined
    };
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}
