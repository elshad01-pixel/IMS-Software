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

type DocumentStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'OBSOLETE';

type DocumentRow = {
  id: string;
  code: string;
  title: string;
  type: string;
  summary?: string | null;
  ownerId?: string | null;
  version: number;
  revision: number;
  status: DocumentStatus;
  effectiveDate?: string | null;
  reviewDueDate?: string | null;
  approvedAt?: string | null;
  obsoletedAt?: string | null;
  changeSummary?: string | null;
  createdAt: string;
  updatedAt: string;
};

const NEXT_STATUS_OPTIONS: Record<DocumentStatus, DocumentStatus[]> = {
  DRAFT: ['REVIEW'],
  REVIEW: ['DRAFT', 'APPROVED'],
  APPROVED: ['OBSOLETE'],
  OBSOLETE: []
};

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RecordWorkItemsComponent],
  template: `
    <section class="page-grid">
      <div class="card header">
        <div>
          <span class="pill">Documents</span>
          <h2>Controlled document register</h2>
          <p>Manage revision-controlled ISO documents with approval flow, ownership, and evidence.</p>
        </div>
      </div>

      <div class="workspace">
        <div class="card table-card">
          <div class="toolbar">
            <div>
              <strong>{{ documents().length }} documents</strong>
              <p class="subtle">Latest items update immediately after save and status changes.</p>
            </div>
            <button type="button" class="ghost" (click)="resetForm()">New document</button>
          </div>

          <div class="table-state" *ngIf="loading()">Loading register...</div>
          <table *ngIf="!loading()">
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th>Type</th>
                <th>Revision</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of documents()" (click)="select(item)" [class.selected]="item.id === selectedId()">
                <td>{{ item.code }}</td>
                <td>{{ item.title }}</td>
                <td>{{ item.type }}</td>
                <td>V{{ item.version }}.{{ item.revision }}</td>
                <td>{{ item.status }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="side">
          <form class="card form-card" [formGroup]="form" (ngSubmit)="save()">
            <div class="toolbar">
              <div>
                <strong>{{ selectedId() ? 'Edit document' : 'Create document' }}</strong>
                <p class="subtle" *ngIf="selectedDocument()">
                  {{ selectedDocument()?.code }} | V{{ selectedDocument()?.version }}.{{ selectedDocument()?.revision }}
                </p>
              </div>
              <span class="message" [class.error]="!!error()">{{ error() || message() }}</span>
            </div>

            <div class="inline">
              <label>
                <span>Code</span>
                <input formControlName="code" placeholder="QMS-PRO-001">
              </label>
              <label>
                <span>Type</span>
                <input formControlName="type" placeholder="Procedure">
              </label>
            </div>

            <label>
              <span>Title</span>
              <input formControlName="title" placeholder="Control of documented information">
            </label>

            <label>
              <span>Summary</span>
              <textarea formControlName="summary" rows="3" placeholder="Purpose and scope"></textarea>
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
                <span>Status</span>
                <input [value]="form.getRawValue().status" disabled>
              </label>
            </div>

            <div class="inline">
              <label>
                <span>Effective date</span>
                <input type="date" formControlName="effectiveDate">
              </label>
              <label>
                <span>Review due date</span>
                <input type="date" formControlName="reviewDueDate">
              </label>
            </div>

            <label>
              <span>Change summary</span>
              <textarea formControlName="changeSummary" rows="2" placeholder="What changed in this revision"></textarea>
            </label>

            <div class="actions">
              <button type="submit" [disabled]="form.invalid || saving()">
                {{ saving() ? 'Saving...' : (selectedId() ? 'Save changes' : 'Create document') }}
              </button>
              <button
                *ngFor="let status of availableTransitions()"
                type="button"
                class="ghost"
                [disabled]="!selectedId() || saving()"
                (click)="changeStatus(status)"
              >
                {{ documentActionLabel(status) }}
              </button>
            </div>

            <div class="detail-grid" *ngIf="selectedDocument()">
              <article>
                <span class="detail-label">Approved</span>
                <strong>{{ selectedDocument()?.approvedAt ? (selectedDocument()?.approvedAt | date:'yyyy-MM-dd HH:mm') : 'Not yet' }}</strong>
              </article>
              <article>
                <span class="detail-label">Obsoleted</span>
                <strong>{{ selectedDocument()?.obsoletedAt ? (selectedDocument()?.obsoletedAt | date:'yyyy-MM-dd HH:mm') : 'Active' }}</strong>
              </article>
              <article>
                <span class="detail-label">Updated</span>
                <strong>{{ selectedDocument()?.updatedAt | date:'yyyy-MM-dd HH:mm' }}</strong>
              </article>
            </div>
          </form>

          <iso-record-work-items [sourceType]="'document'" [sourceId]="selectedId()" />
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
      grid-template-columns: 1.35fr 1fr;
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

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.75rem;
      margin-top: 0.35rem;
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
export class DocumentsPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly documents = signal<DocumentRow[]>([]);
  protected readonly users = signal<UserOption[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selectedDocument = signal<DocumentRow | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(40)]],
    title: ['', [Validators.required, Validators.maxLength(160)]],
    type: ['', [Validators.required, Validators.maxLength(80)]],
    summary: [''],
    ownerId: [''],
    status: ['DRAFT' as DocumentStatus, Validators.required],
    effectiveDate: [''],
    reviewDueDate: [''],
    changeSummary: ['']
  });

  constructor() {
    this.loadUsers();
    this.reload();
  }

  select(item: DocumentRow) {
    this.selectedId.set(item.id);
    this.fetchDocument(item.id);
  }

  resetForm() {
    this.selectedId.set(null);
    this.selectedDocument.set(null);
    this.form.reset({
      code: '',
      title: '',
      type: '',
      summary: '',
      ownerId: '',
      status: 'DRAFT',
      effectiveDate: '',
      reviewDueDate: '',
      changeSummary: ''
    });
    this.message.set('');
    this.error.set('');
  }

  save() {
    if (this.form.invalid) {
      this.error.set('Complete the required document fields.');
      return;
    }

    this.saving.set(true);
    this.message.set('');
    this.error.set('');

    const payload = this.toPayload();
    const request = this.selectedId()
      ? this.api.patch<DocumentRow>(`documents/${this.selectedId()}`, payload)
      : this.api.post<DocumentRow>('documents', payload);

    request.subscribe({
      next: (document) => {
        this.saving.set(false);
        this.message.set(this.selectedId() ? 'Document updated.' : 'Document created.');
        this.reload(() => {
          this.select(document);
        });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Document save failed.'));
      }
    });
  }

  changeStatus(status: DocumentStatus) {
    if (!this.selectedId()) {
      return;
    }

    this.form.patchValue({ status });
    this.save();
  }

  protected documentActionLabel(status: DocumentStatus) {
    if (status === 'REVIEW') {
      return 'Submit for review';
    }

    if (status === 'APPROVED') {
      return 'Approve';
    }

    if (status === 'OBSOLETE') {
      return 'Mark obsolete';
    }

    return 'Return to draft';
  }

  protected availableTransitions() {
    return NEXT_STATUS_OPTIONS[this.form.getRawValue().status] ?? [];
  }

  private fetchDocument(id: string) {
    this.loading.set(true);
    this.api.get<DocumentRow>(`documents/${id}`).subscribe({
      next: (document) => {
        this.loading.set(false);
        this.selectedDocument.set(document);
        this.form.reset({
          code: document.code,
          title: document.title,
          type: document.type,
          summary: document.summary ?? '',
          ownerId: document.ownerId ?? '',
          status: document.status,
          effectiveDate: document.effectiveDate?.slice(0, 10) ?? '',
          reviewDueDate: document.reviewDueDate?.slice(0, 10) ?? '',
          changeSummary: document.changeSummary ?? ''
        });
        this.message.set('');
        this.error.set('');
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Document details could not be loaded.'));
      }
    });
  }

  private reload(after?: () => void) {
    this.loading.set(true);
    this.api.get<DocumentRow[]>('documents').subscribe({
      next: (items) => {
        this.loading.set(false);
        this.documents.set(items);

        if (this.selectedId()) {
          const match = items.find((item) => item.id === this.selectedId());
          if (match) {
            this.fetchDocument(match.id);
          }
        }

        after?.();
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Document register could not be loaded.'));
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
      code: raw.code.trim(),
      title: raw.title.trim(),
      type: raw.type.trim(),
      ownerId: raw.ownerId || undefined,
      effectiveDate: raw.effectiveDate || undefined,
      reviewDueDate: raw.reviewDueDate || undefined,
      summary: raw.summary.trim() || undefined,
      changeSummary: raw.changeSummary.trim() || undefined
    };
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}
