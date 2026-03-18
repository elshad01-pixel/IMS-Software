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

type AuditStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED';
type FindingSeverity = 'OBSERVATION' | 'MINOR' | 'MAJOR';
type FindingStatus = 'OPEN' | 'CAPA_CREATED' | 'CLOSED';

type AuditChecklistItem = {
  id: string;
  title: string;
  notes?: string | null;
  isComplete: boolean;
  sortOrder: number;
};

type AuditFinding = {
  id: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  ownerId?: string | null;
  dueDate?: string | null;
  linkedCapaId?: string | null;
  status: FindingStatus;
};

type AuditRecord = {
  id: string;
  code: string;
  title: string;
  type: string;
  scope?: string | null;
  leadAuditorId?: string | null;
  auditeeArea?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  summary?: string | null;
  status: AuditStatus;
  checklistCount?: number;
  completedChecklistCount?: number;
  findingCount?: number;
  openFindingCount?: number;
  checklistItems?: AuditChecklistItem[];
  findings?: AuditFinding[];
};

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RecordWorkItemsComponent],
  template: `
    <section class="page-grid">
      <div class="card header">
        <div>
          <span class="pill">Audits</span>
          <h2>Internal audit planning and follow-up</h2>
          <p>Plan audits, maintain checklist execution, record findings, and raise CAPAs from audit evidence.</p>
        </div>
      </div>

      <div class="workspace">
        <div class="card table-card">
          <div class="toolbar">
            <div>
              <strong>{{ audits().length }} audits</strong>
              <p class="subtle">Checklist completion and open findings are shown directly in the register.</p>
            </div>
            <button type="button" class="ghost" (click)="resetForm()">New audit</button>
          </div>

          <div class="table-state" *ngIf="loading()">Loading audits...</div>
          <table *ngIf="!loading()">
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th>Status</th>
                <th>Checklist</th>
                <th>Open findings</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of audits()" (click)="select(item)" [class.selected]="item.id === selectedId()">
                <td>{{ item.code }}</td>
                <td>{{ item.title }}</td>
                <td>{{ item.status }}</td>
                <td>{{ item.completedChecklistCount || 0 }}/{{ item.checklistCount || 0 }}</td>
                <td>{{ item.openFindingCount || 0 }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="side">
          <form class="card form-card" [formGroup]="auditForm" (ngSubmit)="saveAudit()">
            <div class="toolbar">
              <div>
                <strong>{{ selectedId() ? 'Edit audit' : 'Create audit plan' }}</strong>
                <p class="subtle" *ngIf="selectedAudit()">
                  {{ selectedAudit()?.code }} | {{ selectedAudit()?.status }}
                </p>
              </div>
              <span class="message" [class.error]="!!error()">{{ error() || message() }}</span>
            </div>

            <div class="inline">
              <label><span>Code</span><input formControlName="code" placeholder="IA-2026-001"></label>
              <label><span>Type</span><input formControlName="type" placeholder="Internal process audit"></label>
            </div>
            <label><span>Title</span><input formControlName="title" placeholder="Purchasing process audit"></label>
            <label><span>Scope</span><textarea rows="2" formControlName="scope" placeholder="Suppliers, receiving, and approvals"></textarea></label>
            <div class="inline">
              <label>
                <span>Lead auditor</span>
                <select formControlName="leadAuditorId">
                  <option value="">Unassigned</option>
                  <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
                </select>
              </label>
              <label><span>Auditee area</span><input formControlName="auditeeArea" placeholder="Operations"></label>
            </div>
            <div class="inline">
              <label><span>Scheduled date</span><input type="date" formControlName="scheduledAt"></label>
              <label>
                <span>Status</span>
                <select formControlName="status">
                  <option>PLANNED</option>
                  <option>IN_PROGRESS</option>
                  <option>COMPLETED</option>
                  <option>CLOSED</option>
                </select>
              </label>
            </div>
            <label><span>Summary</span><textarea rows="2" formControlName="summary" placeholder="Scope notes or conclusions"></textarea></label>
            <button type="submit" [disabled]="auditForm.invalid || saving()">
              {{ saving() ? 'Saving...' : (selectedId() ? 'Save changes' : 'Create audit') }}
            </button>
          </form>

          <section class="card nested-card" *ngIf="selectedAudit()">
            <div class="panel-title">Checklist</div>
            <form [formGroup]="checklistForm" class="inline-form" (ngSubmit)="addChecklistItem()">
              <input formControlName="title" placeholder="Verify approved supplier list is current">
              <input formControlName="sortOrder" type="number" min="0" placeholder="Order">
              <button type="submit" [disabled]="checklistForm.invalid || saving()">Add item</button>
            </form>

            <ul class="list">
              <li *ngFor="let item of selectedAudit()?.checklistItems || []">
                <label class="checkbox">
                  <input type="checkbox" [checked]="item.isComplete" (change)="toggleChecklistItem(item, $event)">
                  <span>{{ item.title }}</span>
                </label>
                <small>{{ item.notes || 'No notes' }}</small>
              </li>
            </ul>
          </section>

          <section class="card nested-card" *ngIf="selectedAudit()">
            <div class="panel-title">Findings</div>
            <form [formGroup]="findingForm" class="stack" (ngSubmit)="addFinding()">
              <input formControlName="title" placeholder="Approved supplier evaluation missing">
              <textarea rows="2" formControlName="description" placeholder="Describe the observation or nonconformity"></textarea>
              <div class="inline">
                <select formControlName="severity">
                  <option>OBSERVATION</option>
                  <option>MINOR</option>
                  <option>MAJOR</option>
                </select>
                <select formControlName="ownerId">
                  <option value="">Owner</option>
                  <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
                </select>
                <input type="date" formControlName="dueDate">
              </div>
              <button type="submit" [disabled]="findingForm.invalid || saving()">Add finding</button>
            </form>

            <ul class="list findings-list">
              <li *ngFor="let finding of selectedAudit()?.findings || []">
                <div>
                  <strong>{{ finding.title }}</strong>
                  <p>{{ finding.description }}</p>
                  <small>{{ finding.severity }} | {{ finding.status }}{{ finding.dueDate ? ' | due ' + finding.dueDate.slice(0, 10) : '' }}</small>
                </div>
                <button
                  type="button"
                  class="ghost"
                  [disabled]="!!finding.linkedCapaId || saving()"
                  (click)="createCapaFromFinding(finding)"
                >
                  {{ finding.linkedCapaId ? 'CAPA linked' : 'Create CAPA' }}
                </button>
              </li>
            </ul>
          </section>

          <iso-record-work-items [sourceType]="'audit'" [sourceId]="selectedId()" />
        </div>
      </div>
    </section>
  `,
  styles: [`
    .header, .table-card, .form-card, .nested-card { padding: 1.2rem 1.3rem; }
    .header h2 { margin: 0.8rem 0 0.3rem; }
    .header p, .subtle, .message, .table-state { color: var(--muted); }
    .workspace { display: grid; grid-template-columns: 1.2fr 1fr; gap: 1rem; align-items: start; }
    .side { display: grid; gap: 1rem; }
    .toolbar { display: flex; justify-content: space-between; gap: 1rem; align-items: start; }
    .subtle, .message { margin: 0.25rem 0 0; font-size: 0.92rem; }
    .message { min-height: 1.1rem; text-align: right; }
    .message.error { color: #a03535; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { padding: 0.95rem 0.4rem; text-align: left; border-bottom: 1px solid rgba(0,0,0,0.08); }
    tbody tr { cursor: pointer; }
    tbody tr.selected { background: rgba(40,89,67,0.08); }
    form, .stack { display: grid; gap: 0.9rem; }
    .inline, .inline-form { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .inline-form { grid-template-columns: 1fr 120px auto; margin-top: 0.9rem; }
    label { display: grid; gap: 0.45rem; }
    input, select, textarea, button { border-radius: 14px; border: 1px solid var(--panel-border); padding: 0.8rem 0.9rem; }
    button { border: 0; background: var(--brand); color: white; font-weight: 700; }
    .ghost { background: rgba(40,89,67,0.1); color: var(--brand-strong); }
    .panel-title { font-weight: 700; }
    .list { list-style: none; padding: 0; margin: 1rem 0 0; display: grid; gap: 0.75rem; }
    .list li { border: 1px solid rgba(0,0,0,0.08); border-radius: 16px; padding: 0.85rem; display: grid; gap: 0.35rem; }
    .findings-list li { display: flex; justify-content: space-between; gap: 1rem; align-items: start; }
    .checkbox { display: flex; gap: 0.6rem; align-items: center; }
    .checkbox input { width: 18px; height: 18px; }
    p, small { margin: 0; color: var(--muted); }
    @media (max-width: 1100px) { .workspace { grid-template-columns: 1fr; } }
    @media (max-width: 700px) { .inline, .inline-form { grid-template-columns: 1fr; } .findings-list li { display: grid; } }
  `]
})
export class AuditsPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly audits = signal<AuditRecord[]>([]);
  protected readonly users = signal<UserOption[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selectedAudit = signal<AuditRecord | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');

  protected readonly auditForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(40)]],
    title: ['', [Validators.required, Validators.maxLength(160)]],
    type: ['', [Validators.required, Validators.maxLength(80)]],
    scope: [''],
    leadAuditorId: [''],
    auditeeArea: [''],
    scheduledAt: [''],
    summary: [''],
    status: ['PLANNED' as AuditStatus, Validators.required]
  });

  protected readonly checklistForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    sortOrder: [0, [Validators.required, Validators.min(0)]]
  });

  protected readonly findingForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    description: ['', [Validators.required, Validators.maxLength(2000)]],
    severity: ['OBSERVATION' as FindingSeverity, Validators.required],
    ownerId: [''],
    dueDate: ['']
  });

  constructor() {
    this.loadUsers();
    this.reload();
  }

  select(item: AuditRecord) {
    this.selectedId.set(item.id);
    this.fetchAudit(item.id);
  }

  resetForm() {
    this.selectedId.set(null);
    this.selectedAudit.set(null);
    this.auditForm.reset({
      code: '',
      title: '',
      type: '',
      scope: '',
      leadAuditorId: '',
      auditeeArea: '',
      scheduledAt: '',
      summary: '',
      status: 'PLANNED'
    });
    this.checklistForm.reset({ title: '', sortOrder: 0 });
    this.findingForm.reset({ title: '', description: '', severity: 'OBSERVATION', ownerId: '', dueDate: '' });
    this.message.set('');
    this.error.set('');
  }

  saveAudit() {
    if (this.auditForm.invalid) {
      this.error.set('Complete the required audit fields.');
      return;
    }

    this.saving.set(true);
    this.message.set('');
    this.error.set('');
    const payload = this.toAuditPayload();
    const request = this.selectedId()
      ? this.api.patch<AuditRecord>(`audits/${this.selectedId()}`, payload)
      : this.api.post<AuditRecord>('audits', payload);

    request.subscribe({
      next: (audit) => {
        this.saving.set(false);
        this.message.set(this.selectedId() ? 'Audit updated.' : 'Audit created.');
        this.reload(() => this.select(audit));
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Audit save failed.'));
      }
    });
  }

  addChecklistItem() {
    if (!this.selectedId() || this.checklistForm.invalid) {
      return;
    }

    this.saving.set(true);
    this.api.post(`audits/${this.selectedId()}/checklist-items`, this.checklistForm.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('Checklist item added.');
        this.checklistForm.reset({ title: '', sortOrder: 0 });
        this.fetchAudit(this.selectedId() as string);
        this.reload();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Checklist item save failed.'));
      }
    });
  }

  toggleChecklistItem(item: AuditChecklistItem, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.saving.set(true);
    this.api.patch(`audits/checklist-items/${item.id}`, { isComplete: checked }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('Checklist item updated.');
        this.fetchAudit(this.selectedId() as string);
        this.reload();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Checklist update failed.'));
      }
    });
  }

  addFinding() {
    if (!this.selectedId() || this.findingForm.invalid) {
      return;
    }

    this.saving.set(true);
    this.api.post(`audits/${this.selectedId()}/findings`, {
      ...this.findingForm.getRawValue(),
      ownerId: this.findingForm.getRawValue().ownerId || undefined,
      dueDate: this.findingForm.getRawValue().dueDate || undefined
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('Finding added.');
        this.findingForm.reset({ title: '', description: '', severity: 'OBSERVATION', ownerId: '', dueDate: '' });
        this.fetchAudit(this.selectedId() as string);
        this.reload();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Finding save failed.'));
      }
    });
  }

  createCapaFromFinding(finding: AuditFinding) {
    this.saving.set(true);
    this.api.post<{ id: string }>(`audits/findings/${finding.id}/create-capa`, {
      title: `Audit finding CAPA: ${finding.title}`,
      problemStatement: finding.description,
      ownerId: finding.ownerId || undefined,
      dueDate: finding.dueDate || undefined
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('CAPA created from audit finding.');
        this.fetchAudit(this.selectedId() as string);
        this.reload();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'CAPA creation failed.'));
      }
    });
  }

  private fetchAudit(id: string) {
    this.loading.set(true);
    this.api.get<AuditRecord>(`audits/${id}`).subscribe({
      next: (audit) => {
        this.loading.set(false);
        this.selectedAudit.set(audit);
        this.auditForm.reset({
          code: audit.code,
          title: audit.title,
          type: audit.type,
          scope: audit.scope ?? '',
          leadAuditorId: audit.leadAuditorId ?? '',
          auditeeArea: audit.auditeeArea ?? '',
          scheduledAt: audit.scheduledAt?.slice(0, 10) ?? '',
          summary: audit.summary ?? '',
          status: audit.status
        });
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Audit details could not be loaded.'));
      }
    });
  }

  private reload(after?: () => void) {
    this.loading.set(true);
    this.api.get<AuditRecord[]>('audits').subscribe({
      next: (items) => {
        this.loading.set(false);
        this.audits.set(items);
        after?.();
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Audits could not be loaded.'));
      }
    });
  }

  private loadUsers() {
    this.api.get<UserOption[]>('users').subscribe((users) => this.users.set(users));
  }

  private toAuditPayload() {
    const raw = this.auditForm.getRawValue();
    return {
      ...raw,
      code: raw.code.trim(),
      title: raw.title.trim(),
      type: raw.type.trim(),
      scope: raw.scope.trim() || undefined,
      leadAuditorId: raw.leadAuditorId || undefined,
      auditeeArea: raw.auditeeArea.trim() || undefined,
      scheduledAt: raw.scheduledAt || undefined,
      summary: raw.summary.trim() || undefined
    };
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}
