import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
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

type SettingsConfig = {
  document: {
    types: string[];
    numberingPrefix: string;
    versionFormat: string;
  };
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
        <a *ngIf="mode() === 'list' && canWrite()" routerLink="/documents/new" class="button-link">+ New document</a>
        <a *ngIf="mode() === 'detail' && selectedDocument() && canWrite()" [routerLink]="['/documents', selectedDocument()?.id, 'edit']" class="button-link">Edit document</a>
        <button *ngIf="mode() === 'detail' && canArchiveDocument()" type="button" class="button-link secondary" (click)="archiveDocument()">Obsolete document</button>
        <button *ngIf="mode() === 'detail' && canDeleteDocument()" type="button" class="button-link danger" (click)="deleteDocument()">Delete draft</button>
        <a *ngIf="mode() !== 'list'" routerLink="/documents" class="button-link secondary">Back to register</a>
      </iso-page-header>

      <section *ngIf="mode() === 'list'" class="page-stack">
        <div class="card list-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Register</span>
              <h3>Controlled document register</h3>
              <p class="subtle">A premium document-control register for status, revision, and ownership without inline form clutter.</p>
            </div>
          </div>

          <div class="toolbar filter-space">
            <div class="toolbar-meta">
              <div>
                <p class="toolbar-title">Register filters</p>
                <p class="toolbar-copy">Search by code, title, or type, then open a record for review or revision control.</p>
              </div>
              <div class="toolbar-stats">
                <article class="toolbar-stat">
                  <span>Total</span>
                  <strong>{{ documents().length }}</strong>
                </article>
                <article class="toolbar-stat">
                  <span>Approved</span>
                  <strong>{{ countByStatus('APPROVED') }}</strong>
                </article>
                <article class="toolbar-stat">
                  <span>In review</span>
                  <strong>{{ countByStatus('REVIEW') }}</strong>
                </article>
              </div>
            </div>

            <div class="filter-row">
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
          </div>

          <div class="empty-state" *ngIf="loading()">
            <strong>Loading documents</strong>
            <span>Refreshing the controlled document register.</span>
          </div>

          <div class="empty-state top-space" *ngIf="!loading() && !filteredDocuments().length">
            <strong>No documents match the current filter</strong>
            <span>Adjust the search or create the first controlled document for this tenant.</span>
          </div>

          <div class="data-table-wrap" *ngIf="!loading() && filteredDocuments().length">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Revision</th>
                  <th>Review due</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of filteredDocuments()" [routerLink]="['/documents', item.id]">
                  <td>
                    <div class="table-title">
                      <strong>{{ item.code }}</strong>
                      <small>{{ item.title }}</small>
                    </div>
                  </td>
                  <td>{{ item.type }}</td>
                  <td><span class="status-badge" [ngClass]="statusClass(item.status)">{{ item.status }}</span></td>
                  <td>V{{ item.version }}.{{ item.revision }}</td>
                  <td>{{ item.reviewDueDate ? (item.reviewDueDate | date:'yyyy-MM-dd') : 'Not set' }}</td>
                  <td>{{ item.updatedAt | date:'yyyy-MM-dd' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section *ngIf="mode() === 'create' || mode() === 'edit'" class="page-stack">
        <form class="card form-card page-stack" [formGroup]="form" (ngSubmit)="save()">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Metadata</span>
              <h3>{{ mode() === 'create' ? 'New controlled document' : 'Edit document' }}</h3>
              <p class="subtle">Keep the record metadata focused here. Evidence and actions stay in dedicated panels once the record exists.</p>
            </div>
          </div>

          <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <section class="detail-section">
            <h4>Document identity</h4>
            <div class="form-grid-2 top-space">
              <label class="field">
                <span>Code</span>
                <input formControlName="code" [placeholder]="documentCodePlaceholder()">
              </label>
              <label class="field">
                <span>Type</span>
                <select formControlName="type">
                  <option value="">Select type</option>
                  <option *ngFor="let type of documentTypes()" [value]="type">{{ type }}</option>
                </select>
              </label>
            </div>

            <label class="field top-space">
              <span>Title</span>
              <input formControlName="title" placeholder="Control of documented information">
            </label>

            <label class="field top-space">
              <span>Summary</span>
              <textarea rows="4" formControlName="summary" placeholder="Purpose, scope, and intended use"></textarea>
            </label>
          </section>

          <section class="detail-section">
            <h4>Lifecycle and ownership</h4>
            <section class="compliance-note top-space">
              <strong>{{ documentLifecycleHeading(form.getRawValue().status) }}</strong>
              <span>{{ documentLifecycleHint(form.getRawValue().status) }}</span>
            </section>
            <div class="form-grid-2 top-space">
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

            <div class="form-grid-2 top-space">
              <label class="field">
                <span>Effective date</span>
                <input type="date" formControlName="effectiveDate">
              </label>
              <label class="field">
                <span>Review due date</span>
                <input type="date" formControlName="reviewDueDate">
              </label>
            </div>

            <label class="field top-space">
              <span>Change summary</span>
              <textarea rows="3" formControlName="changeSummary" placeholder="What changed in this revision"></textarea>
            </label>
          </section>

          <div class="button-row">
            <button type="submit" [disabled]="form.invalid || saving() || !canWrite()">{{ saving() ? 'Saving...' : 'Save document' }}</button>
            <a [routerLink]="selectedId() ? ['/documents', selectedId()] : ['/documents']" class="button-link secondary">Cancel</a>
          </div>
        </form>

        <iso-attachment-panel *ngIf="selectedId()" [sourceType]="'document'" [sourceId]="selectedId()" />
      </section>

      <section *ngIf="mode() === 'detail' && selectedDocument()" class="page-columns">
        <div class="page-stack">
          <section class="card detail-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Controlled record</span>
                <h3>{{ selectedDocument()?.title }}</h3>
                <p class="subtle">{{ selectedDocument()?.code }} | {{ selectedDocument()?.type }}</p>
              </div>
              <span class="status-badge" [ngClass]="statusClass(selectedDocument()?.status || 'DRAFT')">{{ selectedDocument()?.status }}</span>
            </div>

            <div class="summary-strip top-space">
              <article class="summary-item">
                <span>Control state</span>
                <strong>{{ documentStatusLabel(selectedDocument()?.status || 'DRAFT') }}</strong>
              </article>
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

            <section class="detail-section top-space">
              <h4>Lifecycle position</h4>
              <div class="lifecycle-strip top-space">
                <article *ngFor="let step of documentLifecycleSteps()" class="lifecycle-step" [ngClass]="documentLifecycleStepClass(step, selectedDocument()?.status || 'DRAFT')">
                  <span>{{ step.label }}</span>
                  <strong>{{ step.title }}</strong>
                </article>
              </div>
              <p class="subtle top-space">{{ documentLifecycleHint(selectedDocument()?.status || 'DRAFT') }}</p>
            </section>

            <section class="feedback next-steps-banner warning top-space" *ngIf="reviewDueSummary(selectedDocument()) as reviewSummary">
              <strong>{{ reviewSummary.heading }}</strong>
              <span>{{ reviewSummary.copy }}</span>
            </section>

            <section class="feedback next-steps-banner success top-space" *ngIf="message() && !error()">
              <strong>{{ message() }}</strong>
              <span>{{ documentNextStepsCopy() }}</span>
              <div class="button-row top-space">
                <button type="button" (click)="scrollToLifecycle()">Review lifecycle</button>
                <button type="button" class="secondary" (click)="scrollToDocumentActions()">Review actions</button>
                <button type="button" class="secondary" (click)="scrollToDocumentEvidence()">Review evidence</button>
              </div>
            </section>

            <div class="page-stack top-space">
              <section class="detail-section">
                <h4>Summary</h4>
                <p>{{ selectedDocument()?.summary || 'No summary provided.' }}</p>
              </section>
              <section class="detail-section">
                <h4>Revision note</h4>
                <p>{{ selectedDocument()?.changeSummary || 'No revision note provided.' }}</p>
              </section>
            </div>

            <dl class="key-value top-space">
              <dt>Approved at</dt>
              <dd>{{ selectedDocument()?.approvedAt ? (selectedDocument()?.approvedAt | date:'yyyy-MM-dd HH:mm') : 'Not approved yet' }}</dd>
              <dt>Obsoleted at</dt>
              <dd>{{ selectedDocument()?.obsoletedAt ? (selectedDocument()?.obsoletedAt | date:'yyyy-MM-dd HH:mm') : 'Active' }}</dd>
              <dt>Last updated</dt>
              <dd>{{ selectedDocument()?.updatedAt | date:'yyyy-MM-dd HH:mm' }}</dd>
            </dl>
          </section>

          <section id="document-lifecycle-section" class="card panel-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Lifecycle</span>
                <h3>Lifecycle</h3>
                <p class="subtle">Move the record through review, approval, and obsolescence without opening the editor.</p>
              </div>
            </div>

            <div class="button-row top-space" *ngIf="canWrite()">
              <button *ngFor="let status of availableTransitions()" type="button" class="secondary" (click)="changeStatus(status)" [disabled]="saving()">
                {{ documentActionLabel(status) }}
              </button>
            </div>
            <section class="compliance-note top-space" *ngIf="selectedDocument()">
              <strong>{{ documentLifecycleHeading(selectedDocument()!.status) }}</strong>
              <span>{{ detailLifecycleGuidance(selectedDocument()!.status) }}</span>
            </section>
            <p class="feedback top-space" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>
          </section>

          <div id="document-actions-section">
            <iso-record-work-items [sourceType]="'document'" [sourceId]="selectedId()" />
          </div>
        </div>

        <div class="page-stack">
          <section class="card panel-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Evidence trail</span>
                <h3>Document evidence</h3>
                <p class="subtle">Keep supporting files and related actions with the controlled record so lifecycle review and revision history stay easy to follow.</p>
              </div>
            </div>
          </section>
          <div id="document-evidence-section">
            <iso-attachment-panel [sourceType]="'document'" [sourceId]="selectedId()" />
          </div>
        </div>
      </section>
    </section>
  `,
  styles: [`
    .filter-space,
    .top-space {
      margin-top: 1rem;
    }

    .next-steps-banner {
      display: grid;
      gap: 0.35rem;
      padding: 1rem 1.1rem;
      border-radius: 1rem;
      border: 1px solid rgba(47, 107, 69, 0.16);
      background: rgba(47, 107, 69, 0.08);
    }

    .next-steps-banner.warning,
    .compliance-note {
      display: grid;
      gap: 0.35rem;
      padding: 0.95rem 1rem;
      border-radius: 1rem;
      border: 1px solid rgba(138, 99, 34, 0.16);
      background: rgba(138, 99, 34, 0.08);
    }

    .lifecycle-strip {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.75rem;
    }

    .lifecycle-step {
      display: grid;
      gap: 0.2rem;
      padding: 0.9rem 1rem;
      border-radius: 1rem;
      border: 1px solid var(--border-subtle);
      background: color-mix(in srgb, var(--surface-strong) 90%, white);
    }

    .lifecycle-step span {
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
      font-weight: 700;
    }

    .lifecycle-step strong {
      color: var(--text-strong);
    }

    .lifecycle-step.is-current {
      border-color: rgba(47, 107, 69, 0.18);
      background: rgba(47, 107, 69, 0.08);
    }

    .lifecycle-step.is-complete {
      border-color: rgba(47, 107, 69, 0.12);
      background: rgba(47, 107, 69, 0.04);
    }

    @media (max-width: 900px) {
      .lifecycle-strip {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    tr[routerLink] {
      cursor: pointer;
    }
  `]
})
export class DocumentsPageComponent implements OnInit, OnChanges {
  @Input() forcedMode: PageMode | null = null;

  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
  protected readonly documents = signal<DocumentRow[]>([]);
  protected readonly selectedDocument = signal<DocumentRow | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly users = signal<UserOption[]>([]);
  protected readonly settings = signal<SettingsConfig | null>(null);
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
    this.loadSettings();

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

  protected countByStatus(status: DocumentStatus) {
    return this.documents().filter((item) => item.status === status).length;
  }

  protected statusClass(status: DocumentStatus) {
    if (status === 'APPROVED') {
      return 'success';
    }

    if (status === 'REVIEW') {
      return 'warn';
    }

    if (status === 'OBSOLETE') {
      return 'danger';
    }

    return 'neutral';
  }

  protected documentActionLabel(status: DocumentStatus) {
    if (status === 'REVIEW') return 'Submit for review';
    if (status === 'APPROVED') return 'Approve';
    if (status === 'OBSOLETE') return 'Mark obsolete';
    return 'Return to draft';
  }

  protected documentStatusLabel(status: DocumentStatus) {
    if (status === 'DRAFT') return 'Working draft';
    if (status === 'REVIEW') return 'Under review';
    if (status === 'APPROVED') return 'Controlled live version';
    return 'Retained as obsolete';
  }

  protected documentLifecycleSteps() {
    return [
      { status: 'DRAFT' as DocumentStatus, label: 'Step 1', title: 'Draft' },
      { status: 'REVIEW' as DocumentStatus, label: 'Step 2', title: 'Review' },
      { status: 'APPROVED' as DocumentStatus, label: 'Step 3', title: 'Approved' },
      { status: 'OBSOLETE' as DocumentStatus, label: 'Step 4', title: 'Obsolete' }
    ];
  }

  protected documentLifecycleStepClass(step: { status: DocumentStatus }, current: DocumentStatus) {
    const order = this.documentLifecycleSteps().map((item) => item.status);
    const currentIndex = order.indexOf(current);
    const stepIndex = order.indexOf(step.status);
    if (stepIndex < currentIndex) {
      return 'is-complete';
    }
    if (stepIndex === currentIndex) {
      return 'is-current';
    }
    return '';
  }

  protected documentLifecycleHeading(status: DocumentStatus) {
    if (status === 'DRAFT') return 'Draft control';
    if (status === 'REVIEW') return 'Review control';
    if (status === 'APPROVED') return 'Approved document control';
    return 'Obsolete document control';
  }

  protected documentLifecycleHint(status: DocumentStatus) {
    if (status === 'DRAFT') {
      return 'Use draft while content is being prepared. Only draft records can be deleted if a document should be withdrawn before release.';
    }
    if (status === 'REVIEW') {
      return 'Use review when the content is ready for checking and approval. Keep the revision note and supporting evidence current before approval.';
    }
    if (status === 'APPROVED') {
      return 'Approved records represent the controlled live version. Keep the effective date and review due date current so periodic review stays visible.';
    }
    return 'Obsolete keeps the historical record available for traceability. It should replace deletion once a live document has been superseded.';
  }

  protected detailLifecycleGuidance(status: DocumentStatus) {
    if (status === 'DRAFT') {
      return 'Next control point: complete the revision note, assign ownership, and move the document into review when the draft is ready.';
    }
    if (status === 'REVIEW') {
      return this.authStore.hasPermission('documents.approve')
        ? 'Next control point: review the evidence trail and approve the document when the content and metadata are complete.'
        : 'Next control point: confirm evidence and revision details, then hand the document to an approver with documents.approve permission.';
    }
    if (status === 'APPROVED') {
      return 'Next control point: maintain review due dates and linked actions, and mark the record obsolete rather than deleting it when superseded.';
    }
    return 'Next control point: keep the obsolete record for traceability and make sure the replacement live document is available in the register.';
  }

  protected documentNextStepsCopy() {
    const status = this.selectedDocument()?.status;
    if (status === 'APPROVED') {
      return 'Next: review evidence, confirm linked actions, and keep the review due date current.';
    }
    if (status === 'REVIEW') {
      return 'Next: review the lifecycle step, confirm evidence is complete, and move the document toward approval.';
    }
    return 'Next: confirm lifecycle details, review evidence, and keep linked actions up to date.';
  }

  protected reviewDueSummary(document: DocumentRow | null) {
    if (!document?.reviewDueDate || document.status === 'OBSOLETE') {
      return null;
    }

    const today = new Date();
    const dueDate = new Date(document.reviewDueDate);
    const diffDays = Math.floor((dueDate.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);

    if (diffDays < 0) {
      return {
        heading: 'Review is overdue',
        copy: `This controlled document passed its review due date on ${document.reviewDueDate.slice(0, 10)}. Review the content, confirm relevance, and either revise or reapprove it.`
      };
    }

    if (diffDays <= 30) {
      return {
        heading: 'Review due soon',
        copy: `This document is due for review on ${document.reviewDueDate.slice(0, 10)}. Confirm the owner, evidence, and revision note before the review date passes.`
      };
    }

    return null;
  }

  protected save() {
    if (!this.canWrite()) {
      this.error.set('You do not have permission to update documents.');
      return;
    }

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

  protected canDeleteDocument() {
    return this.authStore.hasPermission('admin.delete') && this.selectedDocument()?.status === 'DRAFT';
  }

  protected canWrite() {
    return this.authStore.hasPermission('documents.write');
  }

  protected canArchiveDocument() {
    return this.authStore.hasPermission('admin.delete') && this.selectedDocument()?.status === 'APPROVED';
  }
  protected scrollToLifecycle() {
    document.getElementById('document-lifecycle-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  protected scrollToDocumentActions() {
    document.getElementById('document-actions-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  protected scrollToDocumentEvidence() {
    document.getElementById('document-evidence-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected deleteDocument() {
    if (!this.selectedId() || !this.canDeleteDocument()) {
      return;
    }

    if (!window.confirm('Delete this draft document? Approved and obsolete documents cannot be deleted.')) {
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.api.delete(`documents/${this.selectedId()}`).subscribe({
      next: () => {
        this.saving.set(false);
        void this.router.navigate(['/documents'], { state: { notice: 'Draft document deleted.' } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Document deletion failed.'));
      }
    });
  }

  protected archiveDocument() {
    if (!this.selectedId() || !this.canArchiveDocument()) {
      return;
    }

    if (!window.confirm('Mark this approved document as obsolete? This preserves traceability instead of deleting the record.')) {
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.api.patch<DocumentRow>(`documents/${this.selectedId()}`, { status: 'OBSOLETE' }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('Document marked obsolete.');
        this.fetchDocument(this.selectedId() as string);
        this.reloadDocuments();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Document obsolescence failed.'));
      }
    });
  }

  protected changeStatus(status: DocumentStatus) {
    if (!this.selectedId() || !this.canWrite()) {
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
        code: this.defaultDocumentCode(),
        title: '',
        type: this.documentTypes()[0] ?? '',
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
        code: this.defaultDocumentCode(),
        title: '',
        type: this.documentTypes()[0] ?? '',
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

  private loadSettings() {
    this.api.get<SettingsConfig>('settings/config').subscribe({
      next: (settings) => {
        this.settings.set(settings);
        if (this.mode() === 'create') {
          this.form.patchValue({
            code: this.defaultDocumentCode(),
            type: this.documentTypes()[0] ?? this.form.getRawValue().type
          });
        }
      }
    });
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

  protected documentTypes() {
    return this.settings()?.document.types?.length
      ? this.settings()!.document.types
      : ['Procedure', 'Policy', 'Work Instruction', 'Form'];
  }

  protected documentCodePlaceholder() {
    const prefix = this.settings()?.document.numberingPrefix || 'QMS-PRO';
    return `${prefix}-001`;
  }

  private defaultDocumentCode() {
    const prefix = this.settings()?.document.numberingPrefix || 'QMS-PRO';
    return `${prefix}-`;
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
