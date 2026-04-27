import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
import { I18nService } from '../core/i18n.service';
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
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, RecordWorkItemsComponent, AttachmentPanelComponent, TranslatePipe],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="t('documents.page.label')"
        [title]="pageTitle()"
        [description]="pageDescription()"
        [breadcrumbs]="breadcrumbs()"
      >
        <a *ngIf="showStartHereBackLink()" [routerLink]="['/implementation']" class="button-link secondary">{{ 'documents.actions.backToStartHere' | translate }}</a>
        <a *ngIf="mode() === 'list' && canWrite()" routerLink="/documents/new" class="button-link">+ {{ 'documents.actions.new' | translate }}</a>
        <a *ngIf="mode() === 'detail' && selectedDocument() && canWrite()" [routerLink]="['/documents', selectedDocument()?.id, 'edit']" class="button-link">{{ 'documents.actions.edit' | translate }}</a>
        <button *ngIf="mode() === 'detail' && canArchiveDocument()" type="button" class="button-link secondary" (click)="archiveDocument()">{{ 'documents.actions.obsolete' | translate }}</button>
        <button *ngIf="mode() === 'detail' && canDeleteDocument()" type="button" class="button-link danger" (click)="deleteDocument()">{{ 'documents.actions.deleteDraft' | translate }}</button>
        <a *ngIf="mode() !== 'list'" routerLink="/documents" class="button-link secondary">{{ 'documents.actions.backToRegister' | translate }}</a>
      </iso-page-header>

      <section *ngIf="mode() === 'list'" class="page-stack">
        <div class="card list-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">{{ 'documents.list.eyebrow' | translate }}</span>
              <h3>{{ 'documents.list.title' | translate }}</h3>
              <p class="subtle">{{ 'documents.list.copy' | translate }}</p>
            </div>
          </div>

          <div class="toolbar filter-space">
            <div class="toolbar-meta">
              <div>
                <p class="toolbar-title">{{ 'documents.list.filtersTitle' | translate }}</p>
                <p class="toolbar-copy">{{ 'documents.list.filtersCopy' | translate }}</p>
              </div>
              <div class="toolbar-stats">
                <article class="toolbar-stat">
                  <span>{{ 'documents.list.stats.total' | translate }}</span>
                  <strong>{{ documents().length }}</strong>
                </article>
                <article class="toolbar-stat">
                  <span>{{ 'documents.list.stats.approved' | translate }}</span>
                  <strong>{{ countByStatus('APPROVED') }}</strong>
                </article>
                <article class="toolbar-stat">
                  <span>{{ 'documents.list.stats.inReview' | translate }}</span>
                  <strong>{{ countByStatus('REVIEW') }}</strong>
                </article>
              </div>
            </div>

            <div class="filter-row standard-filter-grid">
              <label class="field compact-field search-field">
                <span>{{ 'documents.list.searchLabel' | translate }}</span>
                <input [value]="search()" (input)="search.set(readInputValue($event))" [placeholder]="t('documents.list.searchPlaceholder')">
              </label>
              <label class="field compact-field">
                <span>{{ 'documents.list.statusLabel' | translate }}</span>
                <select [value]="statusFilter()" (change)="statusFilter.set(readSelectValue($event))">
                  <option value="">{{ 'documents.list.allStatuses' | translate }}</option>
                  <option value="DRAFT">{{ 'documents.status.draft' | translate }}</option>
                  <option value="REVIEW">{{ 'documents.status.review' | translate }}</option>
                  <option value="APPROVED">{{ 'documents.status.approved' | translate }}</option>
                  <option value="OBSOLETE">{{ 'documents.status.obsolete' | translate }}</option>
                </select>
              </label>
            </div>
          </div>

          <div class="empty-state" *ngIf="loading()">
            <strong>{{ 'documents.list.loadingTitle' | translate }}</strong>
            <span>{{ 'documents.list.loadingCopy' | translate }}</span>
          </div>

          <div class="empty-state top-space" *ngIf="!loading() && !filteredDocuments().length">
            <strong>{{ 'documents.list.emptyTitle' | translate }}</strong>
            <span>{{ 'documents.list.emptyCopy' | translate }}</span>
          </div>

          <div class="data-table-wrap" *ngIf="!loading() && filteredDocuments().length">
            <table class="data-table">
              <thead>
                <tr>
                  <th>{{ 'documents.list.table.document' | translate }}</th>
                  <th>{{ 'documents.list.table.type' | translate }}</th>
                  <th>{{ 'documents.list.table.status' | translate }}</th>
                  <th>{{ 'documents.list.table.revision' | translate }}</th>
                  <th>{{ 'documents.list.table.reviewDue' | translate }}</th>
                  <th>{{ 'documents.list.table.updated' | translate }}</th>
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
                  <td><span class="status-badge" [ngClass]="statusClass(item.status)">{{ documentStatusLabel(item.status) }}</span></td>
                  <td>V{{ item.version }}.{{ item.revision }}</td>
                  <td>{{ item.reviewDueDate ? (item.reviewDueDate | date:'yyyy-MM-dd') : t('common.notSet') }}</td>
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
              <span class="section-eyebrow">{{ 'documents.form.eyebrow' | translate }}</span>
              <h3>{{ mode() === 'create' ? t('documents.form.createTitle') : t('documents.form.editTitle') }}</h3>
              <p class="subtle">{{ 'documents.form.copy' | translate }}</p>
            </div>
          </div>

          <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <section class="detail-section">
            <h4>{{ 'documents.form.identityTitle' | translate }}</h4>
            <div class="form-grid-2 top-space">
              <label class="field">
                <span>{{ 'documents.form.code' | translate }}</span>
                <input formControlName="code" [placeholder]="documentCodePlaceholder()">
              </label>
              <label class="field">
                <span>{{ 'documents.form.type' | translate }}</span>
                <select formControlName="type">
                  <option value="">{{ 'documents.form.selectType' | translate }}</option>
                  <option *ngFor="let type of documentTypes()" [value]="type">{{ type }}</option>
                </select>
              </label>
            </div>

            <label class="field top-space">
              <span>{{ 'documents.form.title' | translate }}</span>
              <input formControlName="title" [placeholder]="t('documents.form.titlePlaceholder')">
            </label>

            <label class="field top-space">
              <span>{{ 'documents.form.summary' | translate }}</span>
              <textarea rows="4" formControlName="summary" [placeholder]="t('documents.form.summaryPlaceholder')"></textarea>
            </label>
          </section>

          <section class="detail-section">
            <h4>{{ 'documents.form.lifecycleTitle' | translate }}</h4>
            <section class="compliance-note top-space">
              <strong>{{ documentLifecycleHeading(form.getRawValue().status) }}</strong>
              <span>{{ documentLifecycleHint(form.getRawValue().status) }}</span>
            </section>
            <div class="form-grid-2 top-space">
              <label class="field">
                <span>{{ 'documents.form.owner' | translate }}</span>
                <select formControlName="ownerId">
                  <option value="">{{ 'documents.form.unassigned' | translate }}</option>
                  <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
                </select>
              </label>
              <label class="field">
                <span>{{ 'documents.list.statusLabel' | translate }}</span>
                <select formControlName="status">
                  <option value="DRAFT">{{ 'documents.status.draft' | translate }}</option>
                  <option value="REVIEW">{{ 'documents.status.review' | translate }}</option>
                  <option value="APPROVED">{{ 'documents.status.approved' | translate }}</option>
                  <option value="OBSOLETE">{{ 'documents.status.obsolete' | translate }}</option>
                </select>
              </label>
            </div>

            <div class="form-grid-2 top-space">
              <label class="field">
                <span>{{ 'documents.form.effectiveDate' | translate }}</span>
                <input type="date" formControlName="effectiveDate">
              </label>
              <label class="field">
                <span>{{ 'documents.form.reviewDueDate' | translate }}</span>
                <input type="date" formControlName="reviewDueDate">
              </label>
            </div>

            <label class="field top-space">
              <span>{{ 'documents.form.changeSummary' | translate }}</span>
              <textarea rows="3" formControlName="changeSummary" [placeholder]="t('documents.form.changeSummaryPlaceholder')"></textarea>
            </label>
          </section>

          <div class="button-row">
            <button type="submit" [disabled]="form.invalid || saving() || !canWrite()">{{ saving() ? t('documents.form.saving') : t('documents.form.save') }}</button>
            <a [routerLink]="selectedId() ? ['/documents', selectedId()] : ['/documents']" class="button-link secondary">{{ 'common.cancel' | translate }}</a>
          </div>
        </form>

        <iso-attachment-panel *ngIf="selectedId()" [sourceType]="'document'" [sourceId]="selectedId()" />
      </section>

      <section *ngIf="mode() === 'detail' && selectedDocument()" class="page-columns">
        <div class="page-stack">
          <section class="card detail-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">{{ 'documents.detail.eyebrow' | translate }}</span>
                <h3>{{ selectedDocument()?.title }}</h3>
                <p class="subtle">{{ selectedDocument()?.code }} | {{ selectedDocument()?.type }}</p>
              </div>
              <span class="status-badge" [ngClass]="statusClass(selectedDocument()?.status || 'DRAFT')">{{ documentStatusLabel(selectedDocument()?.status || 'DRAFT') }}</span>
            </div>

            <div class="summary-strip top-space">
              <article class="summary-item">
                <span>{{ 'documents.detail.controlState' | translate }}</span>
                <strong>{{ documentStatusLabel(selectedDocument()?.status || 'DRAFT') }}</strong>
              </article>
              <article class="summary-item">
                <span>{{ 'documents.detail.currentRevision' | translate }}</span>
                <strong>V{{ selectedDocument()?.version }}.{{ selectedDocument()?.revision }}</strong>
              </article>
              <article class="summary-item">
                <span>{{ 'documents.form.effectiveDate' | translate }}</span>
                <strong>{{ selectedDocument()?.effectiveDate ? (selectedDocument()?.effectiveDate | date:'yyyy-MM-dd') : t('common.notSet') }}</strong>
              </article>
              <article class="summary-item">
                <span>{{ 'documents.detail.reviewDue' | translate }}</span>
                <strong>{{ selectedDocument()?.reviewDueDate ? (selectedDocument()?.reviewDueDate | date:'yyyy-MM-dd') : t('common.notSet') }}</strong>
              </article>
            </div>

            <section class="detail-section top-space">
              <h4>{{ 'documents.detail.lifecyclePosition' | translate }}</h4>
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
                <button type="button" (click)="scrollToLifecycle()">{{ 'documents.detail.reviewLifecycle' | translate }}</button>
                <button type="button" class="secondary" (click)="scrollToDocumentActions()">{{ 'documents.detail.reviewActions' | translate }}</button>
                <button type="button" class="secondary" (click)="scrollToDocumentEvidence()">{{ 'documents.detail.reviewEvidence' | translate }}</button>
              </div>
            </section>

            <div class="page-stack top-space">
              <section class="detail-section">
                <h4>{{ 'documents.form.summary' | translate }}</h4>
                <p>{{ selectedDocument()?.summary || t('documents.detail.noSummary') }}</p>
              </section>
              <section class="detail-section">
                <h4>{{ 'documents.detail.revisionNote' | translate }}</h4>
                <p>{{ selectedDocument()?.changeSummary || t('documents.detail.noRevisionNote') }}</p>
              </section>
            </div>

            <dl class="key-value top-space">
              <dt>{{ 'documents.detail.approvedAt' | translate }}</dt>
              <dd>{{ selectedDocument()?.approvedAt ? (selectedDocument()?.approvedAt | date:'yyyy-MM-dd HH:mm') : t('documents.detail.notApprovedYet') }}</dd>
              <dt>{{ 'documents.detail.obsoletedAt' | translate }}</dt>
              <dd>{{ selectedDocument()?.obsoletedAt ? (selectedDocument()?.obsoletedAt | date:'yyyy-MM-dd HH:mm') : t('documents.detail.active') }}</dd>
              <dt>{{ 'documents.detail.lastUpdated' | translate }}</dt>
              <dd>{{ selectedDocument()?.updatedAt | date:'yyyy-MM-dd HH:mm' }}</dd>
            </dl>
          </section>

          <section id="document-lifecycle-section" class="card panel-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">{{ 'documents.detail.lifecycleEyebrow' | translate }}</span>
                <h3>{{ 'documents.detail.lifecycleTitle' | translate }}</h3>
                <p class="subtle">{{ 'documents.detail.lifecycleCopy' | translate }}</p>
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
                <span class="section-eyebrow">{{ 'documents.detail.evidenceEyebrow' | translate }}</span>
                <h3>{{ 'documents.detail.evidenceTitle' | translate }}</h3>
                <p class="subtle">{{ 'documents.detail.evidenceCopy' | translate }}</p>
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
  private readonly i18n = inject(I18nService);

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

  protected showStartHereBackLink() {
    return this.route.snapshot.queryParamMap.get('from') === 'start-here';
  }

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
    this.i18n.language();
    return {
      list: this.t('documents.page.titles.list'),
      create: this.t('documents.page.titles.create'),
      detail: this.selectedDocument()?.title || this.t('documents.page.titles.detail'),
      edit: this.selectedDocument()?.title || this.t('documents.page.titles.edit')
    }[this.mode()];
  }

  protected pageDescription() {
    this.i18n.language();
    return {
      list: this.t('documents.page.descriptions.list'),
      create: this.t('documents.page.descriptions.create'),
      detail: this.t('documents.page.descriptions.detail'),
      edit: this.t('documents.page.descriptions.edit')
    }[this.mode()];
  }

  protected breadcrumbs() {
    if (this.mode() === 'list') {
      return [{ label: this.t('documents.page.label') }];
    }

    const base = [{ label: this.t('documents.page.label'), link: '/documents' }];
    if (this.mode() === 'create') {
      return [...base, { label: this.t('documents.page.breadcrumbs.new') }];
    }

    if (this.mode() === 'edit') {
      return [...base, { label: this.selectedDocument()?.code || this.t('documents.page.breadcrumbs.document'), link: `/documents/${this.selectedId()}` }, { label: this.t('documents.page.breadcrumbs.edit') }];
    }

    return [...base, { label: this.selectedDocument()?.code || this.t('documents.page.breadcrumbs.document') }];
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
    this.i18n.language();
    if (status === 'DRAFT') return this.t('documents.status.draft');
    if (status === 'REVIEW') return this.t('documents.status.review');
    if (status === 'APPROVED') return this.t('documents.status.approved');
    return this.t('documents.status.obsolete');
  }

  protected documentLifecycleSteps() {
    return [
      { status: 'DRAFT' as DocumentStatus, label: this.t('documents.lifecycle.step1'), title: this.t('documents.status.draft') },
      { status: 'REVIEW' as DocumentStatus, label: this.t('documents.lifecycle.step2'), title: this.t('documents.status.review') },
      { status: 'APPROVED' as DocumentStatus, label: this.t('documents.lifecycle.step3'), title: this.t('documents.status.approved') },
      { status: 'OBSOLETE' as DocumentStatus, label: this.t('documents.lifecycle.step4'), title: this.t('documents.status.obsolete') }
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
    this.i18n.language();
    if (status === 'DRAFT') return this.t('documents.lifecycle.headings.draft');
    if (status === 'REVIEW') return this.t('documents.lifecycle.headings.review');
    if (status === 'APPROVED') return this.t('documents.lifecycle.headings.approved');
    return this.t('documents.lifecycle.headings.obsolete');
  }

  protected documentLifecycleHint(status: DocumentStatus) {
    this.i18n.language();
    if (status === 'DRAFT') {
      return this.t('documents.lifecycle.hints.draft');
    }
    if (status === 'REVIEW') {
      return this.t('documents.lifecycle.hints.review');
    }
    if (status === 'APPROVED') {
      return this.t('documents.lifecycle.hints.approved');
    }
    return this.t('documents.lifecycle.hints.obsolete');
  }

  protected detailLifecycleGuidance(status: DocumentStatus) {
    if (status === 'DRAFT') {
      return this.t('documents.guidance.detailLifecycle.draft');
    }
    if (status === 'REVIEW') {
      return this.authStore.hasPermission('documents.approve')
        ? this.t('documents.guidance.detailLifecycle.reviewWithApprove')
        : this.t('documents.guidance.detailLifecycle.reviewWithoutApprove');
    }
    if (status === 'APPROVED') {
      return this.t('documents.guidance.detailLifecycle.approved');
    }
    return this.t('documents.guidance.detailLifecycle.obsolete');
  }

  protected documentNextStepsCopy() {
    const status = this.selectedDocument()?.status;
    if (status === 'APPROVED') {
      return this.t('documents.guidance.nextSteps.approved');
    }
    if (status === 'REVIEW') {
      return this.t('documents.guidance.nextSteps.review');
    }
    return this.t('documents.guidance.nextSteps.default');
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
        heading: this.t('documents.guidance.reviewDue.overdueTitle'),
        copy: this.t('documents.guidance.reviewDue.overdueCopy', { date: document.reviewDueDate.slice(0, 10) })
      };
    }

    if (diffDays <= 30) {
      return {
        heading: this.t('documents.guidance.reviewDue.soonTitle'),
        copy: this.t('documents.guidance.reviewDue.soonCopy', { date: document.reviewDueDate.slice(0, 10) })
      };
    }

    return null;
  }

  protected save() {
    if (!this.canWrite()) {
      this.error.set(this.t('documents.messages.noPermission'));
      return;
    }

    if (this.form.invalid) {
      this.error.set(this.t('documents.messages.completeRequired'));
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
        this.router.navigate(['/documents', document.id], { state: { notice: this.t('documents.messages.saved') } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, this.t('documents.messages.saveFailed')));
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

    if (!window.confirm(this.t('documents.messages.confirmDeleteDraft'))) {
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.api.delete(`documents/${this.selectedId()}`).subscribe({
      next: () => {
        this.saving.set(false);
        void this.router.navigate(['/documents'], { state: { notice: this.t('documents.messages.deletedDraft') } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, this.t('documents.messages.deleteFailed')));
      }
    });
  }

  protected archiveDocument() {
    if (!this.selectedId() || !this.canArchiveDocument()) {
      return;
    }

    if (!window.confirm(this.t('documents.messages.confirmObsolete'))) {
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.api.patch<DocumentRow>(`documents/${this.selectedId()}`, { status: 'OBSOLETE' }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set(this.t('documents.messages.markedObsolete'));
        this.fetchDocument(this.selectedId() as string);
        this.reloadDocuments();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, this.t('documents.messages.obsolescenceFailed')));
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
        this.message.set(this.t('documents.messages.statusUpdated'));
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

  protected t(key: string, params?: Record<string, unknown>) {
    return this.i18n.t(key, params);
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
