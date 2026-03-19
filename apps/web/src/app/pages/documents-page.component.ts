import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AttachmentPanelComponent } from '../shared/attachment-panel.component';
import { PageHeaderComponent } from '../shared/page-header.component';
import { RecordWorkItemsComponent } from '../shared/record-work-items.component';

type PageMode = 'list' | 'create' | 'detail' | 'edit';
type DocumentStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'OBSOLETE';

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

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
  selector: 'iso-documents-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, RecordWorkItemsComponent, AttachmentPanelComponent],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="'Documents'"
        [title]="pageTitle()"
        [description]="pageDescription()"
        [breadcrumbs]="breadcrumbs()"
      >
        <a *ngIf="mode() === 'list'" routerLink="/documents/new" class="button-link">+ New document</a>
        <a *ngIf="mode() === 'detail' && selectedDocument()" [routerLink]="['/documents', selectedDocument()?.id, 'edit']" class="button-link">Edit document</a>
        <a *ngIf="mode() !== 'list'" routerLink="/documents" class="button-link secondary">Back to register</a>
      </iso-page-header>

      <section *ngIf="mode() === 'list'" class="page-stack">
        <div class="card list-card">
          <div class="section-head">
            <div>
              <h3>Controlled document register</h3>
              <p class="subtle">Search and filter the library, then open a document for detail, review, or revision control.</p>
            </div>
          </div>

          <div class="filter-row filter-space">
            <label class="field">
              <span>Search</span>
              <input [value]="search()" (input)="search.set(readInputValue($event))" placeholder="Code, title, or type">
            </label>
            <label class="field">
              <span>Status</span>
              <select [value]="statusFilter()" (change)="statusFilter.set(readSelectValue($event))">
                <option value="">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="REVIEW">Review</option>
                <option value="APPROVED">Approved</option>
                <option value="OBSOLETE">Obsolete</option>
              </select>
            </label>
          </div>

          <div class="empty-state" *ngIf="loading()">Loading documents...</div>
          <table class="data-table" *ngIf="!loading()">
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th>Type</th>
                <th>Status</th>
                <th>Revision</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of filteredDocuments()" [routerLink]="['/documents', item.id]">
                <td><strong>{{ item.code }}</strong></td>
                <td>{{ item.title }}</td>
                <td>{{ item.type }}</td>
                <td><span class="status-badge" [class.success]="item.status === 'APPROVED'">{{ item.status }}</span></td>
                <td>V{{ item.version }}.{{ item.revision }}</td>
                <td>{{ item.updatedAt | date:'yyyy-MM-dd' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section *ngIf="mode() === 'create' || mode() === 'edit'" class="page-columns">
        <form class="card form-card page-stack" [formGroup]="form" (ngSubmit)="save()">
          <div class="section-head">
            <div>
              <h3>{{ mode() === 'create' ? 'New controlled document' : 'Edit document' }}</h3>
              <p class="subtle">Keep the form focused on core metadata. Attachments and follow-up remain separated below.</p>
            </div>
          </div>

          <p class="feedback" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <div class="form-grid-2">
            <label class="field">
              <span>Code</span>
              <input formControlName="code" placeholder="QMS-PRO-001">
            </label>
            <label class="field">
              <span>Type</span>
              <input formControlName="type" placeholder="Procedure">
            </label>
          </div>

          <label class="field">
            <span>Title</span>
            <input formControlName="title" placeholder="Control of documented information">
          </label>

          <label class="field">
            <span>Summary</span>
            <textarea rows="4" formControlName="summary" placeholder="Purpose, scope, and intended use"></textarea>
          </label>

          <div class="form-grid-2">
            <label class="field">
              <span>Owner</span>
              <select formControlName="ownerId">
                <option value="">Unassigned</option>
                <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
              </select>
            </label>
            <label class="field">
              <span>Status</span>
              <select formControlName="status">
                <option>DRAFT</option>
                <option>REVIEW</option>
                <option>APPROVED</option>
                <option>OBSOLETE</option>
              </select>
            </label>
          </div>

          <div class="form-grid-2">
            <label class="field">
              <span>Effective date</span>
              <input type="date" formControlName="effectiveDate">
            </label>
            <label class="field">
              <span>Review due date</span>
              <input type="date" formControlName="reviewDueDate">
            </label>
          </div>

          <label class="field">
            <span>Change summary</span>
            <textarea rows="3" formControlName="changeSummary" placeholder="What changed in this revision"></textarea>
          </label>

          <div class="button-row">
            <button type="submit" [disabled]="form.invalid || saving()">{{ saving() ? 'Saving...' : 'Save document' }}</button>
            <a [routerLink]="selectedId() ? ['/documents', selectedId()] : ['/documents']" class="button-link secondary">Cancel</a>
          </div>
        </form>

        <div class="page-stack">
          <section class="card panel-card">
            <div class="section-head">
              <div>
                <h3>Workflow guidance</h3>
                <p class="subtle">Create the document first, then add evidence and follow-up on the document record page.</p>
              </div>
            </div>

            <div class="entity-list">
              <div class="entity-item">
                <strong>1. Register the document</strong>
                <small>Save the controlled document with its code, title, owner, and review dates.</small>
              </div>
              <div class="entity-item">
                <strong>2. Review the record</strong>
                <small>Use the detail page for approval status changes, attachments, and action items.</small>
              </div>
              <div class="entity-item">
                <strong>3. Maintain revision history</strong>
                <small>Update the change summary whenever a substantive revision is made.</small>
              </div>
            </div>
          </section>

          <iso-attachment-panel *ngIf="selectedId()" [sourceType]="'document'" [sourceId]="selectedId()" />
          <iso-record-work-items *ngIf="selectedId()" [sourceType]="'document'" [sourceId]="selectedId()" />
        </div>
      </section>

      <section *ngIf="mode() === 'detail' && selectedDocument()" class="page-columns">
        <div class="page-stack">
          <section class="card detail-card">
            <div class="section-head">
              <div>
                <h3>{{ selectedDocument()?.title }}</h3>
                <p class="subtle">{{ selectedDocument()?.code }} | {{ selectedDocument()?.type }}</p>
              </div>
              <span class="status-badge" [class.success]="selectedDocument()?.status === 'APPROVED'">{{ selectedDocument()?.status }}</span>
            </div>

            <div class="summary-strip top-space">
              <article class="summary-item">
                <span>Current revision</span>
                <strong>V{{ selectedDocument()?.version }}.{{ selectedDocument()?.revision }}</strong>
              </article>
              <article class="summary-item">
                <span>Effective date</span>
                <strong>{{ selectedDocument()?.effectiveDate ? (selectedDocument()?.effectiveDate | date:'yyyy-MM-dd') : 'Not set' }}</strong>
              </article>
              <article class="summary-item">
                <span>Review due</span>
                <strong>{{ selectedDocument()?.reviewDueDate ? (selectedDocument()?.reviewDueDate | date:'yyyy-MM-dd') : 'Not set' }}</strong>
              </article>
            </div>

            <dl class="key-value top-space">
              <dt>Summary</dt>
              <dd>{{ selectedDocument()?.summary || 'No summary provided.' }}</dd>
              <dt>Change summary</dt>
              <dd>{{ selectedDocument()?.changeSummary || 'No revision note provided.' }}</dd>
              <dt>Approved at</dt>
              <dd>{{ selectedDocument()?.approvedAt ? (selectedDocument()?.approvedAt | date:'yyyy-MM-dd HH:mm') : 'Not approved yet' }}</dd>
              <dt>Obsoleted at</dt>
              <dd>{{ selectedDocument()?.obsoletedAt ? (selectedDocument()?.obsoletedAt | date:'yyyy-MM-dd HH:mm') : 'Active' }}</dd>
              <dt>Last updated</dt>
              <dd>{{ selectedDocument()?.updatedAt | date:'yyyy-MM-dd HH:mm' }}</dd>
            </dl>
          </section>

          <section class="card panel-card">
            <div class="section-head">
              <div>
                <h3>Lifecycle</h3>
                <p class="subtle">Move the record through review, approval, and obsolescence without opening the editor.</p>
              </div>
            </div>

            <div class="button-row top-space">
              <button *ngFor="let status of availableTransitions()" type="button" class="secondary" (click)="changeStatus(status)" [disabled]="saving()">
                {{ documentActionLabel(status) }}
              </button>
            </div>
            <p class="feedback top-space" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>
          </section>
        </div>

        <div class="page-stack">
          <iso-attachment-panel [sourceType]="'document'" [sourceId]="selectedId()" />
          <iso-record-work-items [sourceType]="'document'" [sourceId]="selectedId()" />
        </div>
      </section>
    </section>
  `,
  styles: [`
    .filter-space,
    .top-space {
      margin-top: 1rem;
    }

    tr[routerLink] {
      cursor: pointer;
    }
  `]
})
export class DocumentsPageComponent implements OnInit, OnChanges {
  @Input() forcedMode: PageMode | null = null;

  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
  protected readonly documents = signal<DocumentRow[]>([]);
  protected readonly selectedDocument = signal<DocumentRow | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly users = signal<UserOption[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal((history.state?.notice as string) || '');
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly statusFilter = signal('');

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

  ngOnInit() {
    this.loadUsers();

    if (this.forcedMode) {
      this.mode.set(this.forcedMode);
      this.handleRoute(this.route.snapshot.paramMap);
    } else {
      this.route.data.subscribe((data) => {
        this.mode.set((data['mode'] as PageMode) || 'list');
        this.handleRoute(this.route.snapshot.paramMap);
      });
    }

    this.route.paramMap.subscribe((params) => this.handleRoute(params));
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['forcedMode'] && this.forcedMode) {
      this.mode.set(this.forcedMode);
      this.handleRoute(this.route.snapshot.paramMap);
    }
  }

  protected pageTitle() {
    return {
      list: 'Controlled document register',
      create: 'Create controlled document',
      detail: this.selectedDocument()?.title || 'Document detail',
      edit: this.selectedDocument()?.title || 'Edit document'
    }[this.mode()];
  }

  protected pageDescription() {
    return {
      list: 'A focused register for controlled documents, status control, and revision history.',
      create: 'Create a new controlled document in a dedicated workflow without competing panels.',
      detail: 'Review controlled metadata, move status forward, and manage evidence and actions.',
      edit: 'Update document metadata in a dedicated editing view.'
    }[this.mode()];
  }

  protected breadcrumbs() {
    if (this.mode() === 'list') {
      return [{ label: 'Documents' }];
    }

    const base = [{ label: 'Documents', link: '/documents' }];
    if (this.mode() === 'create') {
      return [...base, { label: 'New document' }];
    }

    if (this.mode() === 'edit') {
      return [...base, { label: this.selectedDocument()?.code || 'Document', link: `/documents/${this.selectedId()}` }, { label: 'Edit' }];
    }

    return [...base, { label: this.selectedDocument()?.code || 'Document' }];
  }

  protected filteredDocuments() {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.documents().filter((item) => {
      const matchesStatus = !status || item.status === status;
      const matchesTerm =
        !term ||
        item.code.toLowerCase().includes(term) ||
        item.title.toLowerCase().includes(term) ||
        item.type.toLowerCase().includes(term);
      return matchesStatus && matchesTerm;
    });
  }

  protected availableTransitions() {
    const status = this.selectedDocument()?.status || this.form.getRawValue().status;
    return NEXT_STATUS_OPTIONS[status] ?? [];
  }

  protected documentActionLabel(status: DocumentStatus) {
    if (status === 'REVIEW') return 'Submit for review';
    if (status === 'APPROVED') return 'Approve';
    if (status === 'OBSOLETE') return 'Mark obsolete';
    return 'Return to draft';
  }

  protected save() {
    if (this.form.invalid) {
      this.error.set('Complete the required document fields.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    const payload = this.toPayload();
    const request = this.selectedId()
      ? this.api.patch<DocumentRow>(`documents/${this.selectedId()}`, payload)
      : this.api.post<DocumentRow>('documents', payload);

    request.subscribe({
      next: (document) => {
        this.saving.set(false);
        this.router.navigate(['/documents', document.id], { state: { notice: 'Document saved successfully.' } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Document save failed.'));
      }
    });
  }

  protected changeStatus(status: DocumentStatus) {
    if (!this.selectedId()) {
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.api.patch<DocumentRow>(`documents/${this.selectedId()}`, { status }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('Document status updated.');
        this.fetchDocument(this.selectedId() as string);
        this.reloadDocuments();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Document status update failed.'));
      }
    });
  }

  protected readInputValue(event: Event) {
    return (event.target as HTMLInputElement).value;
  }

  protected readSelectValue(event: Event) {
    return (event.target as HTMLSelectElement).value;
  }

  private handleRoute(params: ParamMap) {
    const mode = this.mode();
    const id = params.get('id');
    this.selectedId.set(id);
    this.message.set((history.state?.notice as string) || '');
    this.error.set('');

    if (mode === 'list') {
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
      this.reloadDocuments();
      return;
    }

    if (mode === 'create') {
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
      return;
    }

    if (id) {
      this.fetchDocument(id);
    }
  }

  private reloadDocuments() {
    this.loading.set(true);
    this.api.get<DocumentRow[]>('documents').subscribe({
      next: (items) => {
        this.loading.set(false);
        this.documents.set(items);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Document register could not be loaded.'));
      }
    });
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
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Document details could not be loaded.'));
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
      summary: raw.summary.trim() || undefined,
      ownerId: raw.ownerId || undefined,
      effectiveDate: raw.effectiveDate || undefined,
      reviewDueDate: raw.reviewDueDate || undefined,
      changeSummary: raw.changeSummary.trim() || undefined
    };
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}

@Component({
  standalone: true,
  imports: [DocumentsPageComponent],
  template: `<iso-documents-page [forcedMode]="'list'" />`
})
export class DocumentsRegisterPageComponent {}

@Component({
  standalone: true,
  imports: [DocumentsPageComponent],
  template: `<iso-documents-page [forcedMode]="'create'" />`
})
export class DocumentCreatePageComponent {}

@Component({
  standalone: true,
  imports: [DocumentsPageComponent],
  template: `<iso-documents-page [forcedMode]="'detail'" />`
})
export class DocumentDetailPageComponent {}

@Component({
  standalone: true,
  imports: [DocumentsPageComponent],
  template: `<iso-documents-page [forcedMode]="'edit'" />`
})
export class DocumentEditPageComponent {}
