import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
import { I18nService } from '../core/i18n.service';
import { AttachmentPanelComponent } from '../shared/attachment-panel.component';
import { PageHeaderComponent } from '../shared/page-header.component';

type PageMode = 'list' | 'create' | 'detail' | 'edit';
type CapaStatus = 'OPEN' | 'INVESTIGATING' | 'ACTION_PLANNED' | 'IN_PROGRESS' | 'VERIFIED' | 'CLOSED';
type CapaSortOption = 'attention' | 'dueDate' | 'updated' | 'status';
type ReturnNavigation = {
  route: string[];
  label: string;
  state?: Record<string, unknown>;
};

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

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
  selector: 'iso-capa-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, AttachmentPanelComponent],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="t('capa.common.label')"
        [title]="pageTitle()"
        [description]="pageDescription()"
        [breadcrumbs]="breadcrumbs()"
      >
        <a *ngIf="mode() === 'list' && canWrite()" routerLink="/capa/new" class="button-link">{{ t('capa.actions.new') }}</a>
        <a *ngIf="mode() === 'detail' && selectedCapa() && canWrite()" [routerLink]="['/capa', selectedCapa()?.id, 'edit']" [state]="returnLinkState()" class="button-link">{{ t('capa.actions.edit') }}</a>
        <button *ngIf="mode() === 'detail' && canDeleteCapa()" type="button" class="button-link danger" (click)="deleteCapa()">{{ t('capa.actions.delete') }}</button>
        <a *ngIf="mode() !== 'list' && returnNavigation()" [routerLink]="returnNavigation()!.route" [state]="returnNavigation()!.state" class="button-link secondary">{{ t('capa.actions.backTo', { label: returnNavigation()!.label }) }}</a>
        <a *ngIf="mode() !== 'list'" routerLink="/capa" class="button-link secondary">{{ t('capa.actions.backToRegister') }}</a>
      </iso-page-header>

      <section *ngIf="mode() === 'list'" class="page-stack">
        <div class="card list-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">{{ t('capa.list.eyebrow') }}</span>
              <h3>{{ t('capa.list.title') }}</h3>
              <p class="subtle">{{ t('capa.list.copy') }}</p>
            </div>
          </div>

          <div class="toolbar top-space">
            <div class="toolbar-meta">
              <div>
                <p class="toolbar-title">{{ t('capa.list.filtersTitle') }}</p>
                <p class="toolbar-copy">{{ t('capa.list.filtersCopy') }}</p>
              </div>
              <div class="toolbar-stats">
                <article class="toolbar-stat">
                  <span>{{ t('capa.list.stats.total') }}</span>
                  <strong>{{ capas().length }}</strong>
                </article>
                <article class="toolbar-stat">
                  <span>{{ t('capa.list.stats.inProgress') }}</span>
                  <strong>{{ countByStatus('IN_PROGRESS') }}</strong>
                </article>
                <article class="toolbar-stat">
                  <span>{{ t('capa.list.stats.closed') }}</span>
                  <strong>{{ countByStatus('CLOSED') }}</strong>
                </article>
                <article class="toolbar-stat">
                  <span>{{ t('capa.list.stats.overdue') }}</span>
                  <strong>{{ overdueCount() }}</strong>
                </article>
              </div>
            </div>

            <div class="filter-row standard-filter-grid">
              <label class="field compact-field search-field">
                <span>{{ t('capa.list.filters.search') }}</span>
                <input [value]="search()" (input)="search.set(readInputValue($event))" [placeholder]="t('capa.list.placeholders.search')">
              </label>
              <label class="field compact-field">
                <span>{{ t('capa.common.status') }}</span>
                <select [value]="statusFilter()" (change)="statusFilter.set(readSelectValue($event))">
                  <option value="">{{ t('capa.list.filters.allStatuses') }}</option>
                  <option>OPEN</option>
                  <option>INVESTIGATING</option>
                  <option>ACTION_PLANNED</option>
                  <option>IN_PROGRESS</option>
                  <option>VERIFIED</option>
                  <option>CLOSED</option>
                </select>
              </label>
              <label class="field compact-field">
                <span>{{ t('capa.list.filters.sortBy') }}</span>
                <select [value]="sortBy()" (change)="setSortBy(readSelectValue($event))">
                  <option value="attention">{{ t('capa.list.sort.attention') }}</option>
                  <option value="dueDate">{{ t('capa.list.sort.dueDate') }}</option>
                  <option value="updated">{{ t('capa.list.sort.updated') }}</option>
                  <option value="status">{{ t('capa.common.status') }}</option>
                </select>
              </label>
            </div>
          </div>

          <div class="empty-state" *ngIf="loading()">
            <strong>{{ t('capa.empty.loadingTitle') }}</strong>
            <span>{{ t('capa.empty.loadingCopy') }}</span>
          </div>

          <div class="empty-state top-space" *ngIf="!loading() && !filteredCapas().length">
            <strong>{{ t('capa.empty.noneTitle') }}</strong>
            <span>{{ t('capa.empty.noneCopy') }}</span>
          </div>

          <div class="data-table-wrap" *ngIf="!loading() && filteredCapas().length">
            <table class="data-table">
              <thead>
                <tr>
                  <th>{{ t('capa.table.capa') }}</th>
                  <th>{{ t('capa.table.source') }}</th>
                  <th>{{ t('capa.table.owner') }}</th>
                  <th>{{ t('capa.common.status') }}</th>
                  <th>{{ t('capa.common.dueDate') }}</th>
                  <th>{{ t('capa.table.attention') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of filteredCapas()" [routerLink]="['/capa', item.id]">
                  <td>
                    <div class="table-title">
                      <strong>{{ item.title }}</strong>
                      <small>{{ item.category || t('capa.common.general') }}</small>
                    </div>
                  </td>
                  <td>{{ item.source }}</td>
                  <td>{{ ownerName(item.ownerId) }}</td>
                  <td><span class="status-badge" [ngClass]="statusClass(item.status)">{{ labelize(item.status) }}</span></td>
                  <td>{{ item.dueDate ? (item.dueDate | date:'yyyy-MM-dd') : t('capa.common.na') }}</td>
                  <td><span class="status-badge" [ngClass]="attentionClass(item)">{{ attentionLabel(item) }}</span></td>
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
              <span class="section-eyebrow">{{ t('capa.form.eyebrow') }}</span>
              <h3>{{ mode() === 'create' ? t('capa.page.titleCreate') : t('capa.page.titleEdit') }}</h3>
              <p class="subtle">{{ t('capa.form.copy') }}</p>
            </div>
          </div>

          <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <section class="guidance-card">
            <strong>{{ capaWorkflowHeadline(form.getRawValue().status) }}</strong>
            <p>{{ capaWorkflowNarrative(form.getRawValue().status) }}</p>
            <small>{{ capaWorkflowHint() }}</small>
          </section>

          <nav class="capa-stage-strip" [attr.aria-label]="t('capa.form.lifecycleAriaLabel')">
            <div class="capa-stage" [class.active]="capaLifecycleStage(form.getRawValue().status) === 'define'">
              <strong>{{ t('capa.form.stages.defineTitle') }}</strong>
              <small>{{ t('capa.form.stages.defineCopy') }}</small>
            </div>
            <div class="capa-stage" [class.active]="capaLifecycleStage(form.getRawValue().status) === 'investigate'">
              <strong>{{ t('capa.form.stages.investigateTitle') }}</strong>
              <small>{{ t('capa.form.stages.investigateCopy') }}</small>
            </div>
            <div class="capa-stage" [class.active]="capaLifecycleStage(form.getRawValue().status) === 'act'">
              <strong>{{ t('capa.form.stages.actTitle') }}</strong>
              <small>{{ t('capa.form.stages.actCopy') }}</small>
            </div>
            <div class="capa-stage" [class.active]="capaLifecycleStage(form.getRawValue().status) === 'verify'">
              <strong>{{ t('capa.form.stages.verifyTitle') }}</strong>
              <small>{{ t('capa.form.stages.verifyCopy') }}</small>
            </div>
          </nav>

          <section class="detail-section">
            <h4>Issue definition</h4>
            <div class="form-grid-2 top-space">
              <label class="field">
                <span>Title</span>
                <input formControlName="title" placeholder="Calibration missed for production gauge">
              </label>
              <label class="field">
                <span>Source</span>
                <input formControlName="source" placeholder="Internal audit">
              </label>
            </div>

            <div class="form-grid-2 top-space">
              <label class="field">
                <span>Category</span>
                <input formControlName="category" placeholder="Process">
              </label>
              <label class="field">
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

            <label class="field top-space">
              <span>Problem statement</span>
              <textarea rows="4" formControlName="problemStatement" placeholder="Describe the nonconformity"></textarea>
            </label>
          </section>

          <section class="detail-section">
            <h4>Containment and cause</h4>
            <div class="form-grid-2 top-space">
              <label class="field">
                <span>Containment action</span>
                <textarea rows="3" formControlName="containmentAction" placeholder="Immediate containment"></textarea>
              </label>
              <label class="field">
                <span>Root cause</span>
                <textarea rows="3" formControlName="rootCause" placeholder="Why it happened"></textarea>
              </label>
            </div>
          </section>

          <section class="detail-section">
            <h4>Action design</h4>
            <div class="form-grid-2 top-space">
              <label class="field">
                <span>Correction</span>
                <textarea rows="3" formControlName="correction" placeholder="Immediate correction"></textarea>
              </label>
              <label class="field">
                <span>Corrective action</span>
                <textarea rows="3" formControlName="correctiveAction" placeholder="Action to eliminate the cause"></textarea>
              </label>
            </div>

            <div class="form-grid-2 top-space">
              <label class="field">
                <span>Preventive action</span>
                <textarea rows="3" formControlName="preventiveAction" placeholder="Action to prevent recurrence"></textarea>
              </label>
              <label class="field">
                <span>Owner</span>
                <select formControlName="ownerId">
                  <option value="">Unassigned</option>
                  <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
                </select>
              </label>
            </div>

            <div class="form-grid-2 top-space">
              <label class="field">
                <span>Due date</span>
                <input type="date" formControlName="dueDate">
              </label>
              <div class="detail-section inner-note">
                <h4>Action control</h4>
                <p>{{ capaActionControlCopy() }}</p>
              </div>
            </div>
          </section>

          <section class="detail-section">
            <h4>Verification and closure</h4>
            <div class="form-grid-2 top-space">
              <label class="field">
                <span>Verification method</span>
                <textarea rows="3" formControlName="verificationMethod" placeholder="How effectiveness will be checked"></textarea>
              </label>
              <div class="detail-section inner-note">
                <h4>Closure readiness</h4>
                <p>{{ capaClosureReadinessCopy(form.getRawValue().status) }}</p>
              </div>
            </div>

            <label class="field top-space">
              <span>Closure summary</span>
              <textarea rows="3" formControlName="closureSummary" placeholder="Evidence supporting closure"></textarea>
            </label>

            <section class="closure-blocker-note top-space" *ngIf="form.getRawValue().status === 'CLOSED' && capaClosureBlockers().length">
              <strong>CAPA cannot close yet</strong>
              <span>{{ capaClosureBlockers().join(' | ') }}</span>
            </section>
          </section>

          <div class="button-row">
            <button type="submit" [disabled]="form.invalid || saving() || !canWrite()">{{ saving() ? t('capa.actions.saving') : t('capa.actions.save') }}</button>
            <a [routerLink]="selectedId() ? ['/capa', selectedId()] : ['/capa']" [state]="returnLinkState()" class="button-link secondary">{{ t('common.cancel') }}</a>
          </div>
        </form>

        <iso-attachment-panel *ngIf="selectedId()" [sourceType]="'capa'" [sourceId]="selectedId()" />
      </section>

      <section *ngIf="mode() === 'detail' && selectedCapa()" class="page-columns">
        <div class="page-stack">
          <section class="card detail-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">{{ t('capa.detail.eyebrow') }}</span>
                <h3>{{ selectedCapa()?.title }}</h3>
                <p class="subtle">{{ selectedCapa()?.source }}{{ selectedCapa()?.category ? ' | ' + selectedCapa()?.category : '' }}</p>
              </div>
              <span class="status-badge" [ngClass]="statusClass(selectedCapa()?.status || 'OPEN')">{{ labelize(selectedCapa()?.status || 'OPEN') }}</span>
            </div>

            <div class="summary-strip top-space">
              <article class="summary-item">
                <span>{{ t('capa.common.owner') }}</span>
                <strong>{{ ownerName(selectedCapa()?.ownerId) }}</strong>
              </article>
              <article class="summary-item">
                <span>{{ t('capa.common.dueDate') }}</span>
                <strong>{{ selectedCapa()?.dueDate ? (selectedCapa()?.dueDate | date:'yyyy-MM-dd') : t('capa.common.notSet') }}</strong>
              </article>
              <article class="summary-item">
                <span>{{ t('capa.detail.closedAt') }}</span>
                <strong>{{ selectedCapa()?.closedAt ? (selectedCapa()?.closedAt | date:'yyyy-MM-dd HH:mm') : t('capa.detail.open') }}</strong>
              </article>
              <article class="summary-item">
                <span>{{ t('capa.detail.lastUpdated') }}</span>
                <strong>{{ selectedCapa()?.updatedAt | date:'yyyy-MM-dd HH:mm' }}</strong>
              </article>
            </div>

            <section class="guidance-card top-space">
              <strong>{{ capaReadinessHeadline() }}</strong>
              <p>{{ capaReadinessNarrative() }}</p>
              <small>{{ capaReadinessHint() }}</small>
            </section>

            <section class="guidance-card top-space">
              <strong>{{ attentionHeadline() }}</strong>
              <p>{{ attentionNarrative() }}</p>
            </section>

            <nav class="capa-stage-strip top-space" [attr.aria-label]="t('capa.form.lifecycleAriaLabel')">
              <div class="capa-stage" [class.active]="capaLifecycleStage(selectedCapa()?.status || 'OPEN') === 'define'">
                <strong>{{ t('capa.form.stages.defineTitle') }}</strong>
                <small>{{ t('capa.form.stages.defineCopy') }}</small>
              </div>
              <div class="capa-stage" [class.active]="capaLifecycleStage(selectedCapa()?.status || 'OPEN') === 'investigate'">
                <strong>{{ t('capa.form.stages.investigateTitle') }}</strong>
                <small>{{ t('capa.form.stages.investigateCopy') }}</small>
              </div>
              <div class="capa-stage" [class.active]="capaLifecycleStage(selectedCapa()?.status || 'OPEN') === 'act'">
                <strong>{{ t('capa.form.stages.actTitle') }}</strong>
                <small>{{ t('capa.form.stages.actCopy') }}</small>
              </div>
              <div class="capa-stage" [class.active]="capaLifecycleStage(selectedCapa()?.status || 'OPEN') === 'verify'">
                <strong>{{ t('capa.form.stages.verifyTitle') }}</strong>
                <small>{{ t('capa.form.stages.verifyCopy') }}</small>
              </div>
            </nav>

            <section class="detail-section top-space">
              <h4>Issue definition</h4>
              <p><strong>Problem:</strong> {{ selectedCapa()?.problemStatement }}</p>
              <p><strong>Source:</strong> {{ selectedCapa()?.source }}</p>
              <p><strong>Category:</strong> {{ selectedCapa()?.category || 'Not set' }}</p>
            </section>

            <div class="section-grid-2 top-space">
              <section class="detail-section">
                <h4>Containment</h4>
                <p>{{ selectedCapa()?.containmentAction || 'No containment action recorded.' }}</p>
              </section>
              <section class="detail-section">
                <h4>Root cause</h4>
                <p>{{ selectedCapa()?.rootCause || 'No root cause recorded.' }}</p>
              </section>
              <section class="detail-section">
                <h4>Correction</h4>
                <p>{{ selectedCapa()?.correction || 'No correction recorded.' }}</p>
              </section>
              <section class="detail-section">
                <h4>Corrective action</h4>
                <p>{{ selectedCapa()?.correctiveAction || 'No corrective action recorded.' }}</p>
              </section>
              <section class="detail-section">
                <h4>Preventive action</h4>
                <p>{{ selectedCapa()?.preventiveAction || 'No preventive action recorded.' }}</p>
              </section>
              <section class="detail-section">
                <h4>Verification method</h4>
                <p>{{ selectedCapa()?.verificationMethod || 'No verification method recorded.' }}</p>
              </section>
            </div>

            <section class="detail-section top-space">
              <h4>Closure and effectiveness</h4>
              <p><strong>Closure summary:</strong> {{ selectedCapa()?.closureSummary || 'No closure summary recorded.' }}</p>
              <p><strong>Current readiness:</strong> {{ capaReadinessHint() }}</p>
            </section>
          </section>
        </div>

        <div class="page-stack">
          <iso-attachment-panel [sourceType]="'capa'" [sourceId]="selectedId()" />
        </div>
      </section>
    </section>
  `,
  styles: [`
    .top-space {
      margin-top: 1rem;
    }

    tr[routerLink] {
      cursor: pointer;
    }

    .guidance-card {
      padding: 1rem 1.1rem;
      border: 1px solid rgba(46, 67, 56, 0.1);
      border-radius: 1rem;
      background: rgba(252, 253, 250, 0.82);
    }

    .guidance-card strong,
    .guidance-card p,
    .guidance-card small {
      display: block;
    }

    .guidance-card p,
    .guidance-card small {
      margin-top: 0.4rem;
      color: var(--muted);
      line-height: 1.45;
    }

    .capa-stage-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      gap: 0.75rem;
    }

    .capa-stage {
      border: 1px solid rgba(46, 67, 56, 0.1);
      border-radius: 1rem;
      padding: 0.85rem 0.95rem;
      background: rgba(248, 250, 246, 0.92);
      display: grid;
      gap: 0.15rem;
    }

    .capa-stage.active {
      border-color: rgba(36, 79, 61, 0.3);
      background: rgba(255, 255, 255, 0.98);
      box-shadow: 0 12px 28px rgba(24, 45, 32, 0.06);
    }

    .capa-stage small {
      color: var(--muted);
      line-height: 1.4;
    }

    .inner-note {
      background: rgba(248, 250, 247, 0.92);
      border-radius: 1rem;
      padding: 0.9rem 1rem;
      height: 100%;
    }

    .closure-blocker-note {
      display: grid;
      gap: 0.35rem;
      padding: 1rem 1.1rem;
      border-radius: 1rem;
      border: 1px solid rgba(145, 80, 63, 0.18);
      background: rgba(253, 244, 240, 0.95);
    }
  `]
})
export class CapaPageComponent implements OnInit, OnChanges {
  @Input() forcedMode: PageMode | null = null;

  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
  protected readonly capas = signal<CapaRow[]>([]);
  protected readonly selectedCapa = signal<CapaRow | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly users = signal<UserOption[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal((history.state?.notice as string) || '');
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly statusFilter = signal('');
  protected readonly sortBy = signal<CapaSortOption>('attention');
  protected readonly returnNavigation = signal<ReturnNavigation | null>(null);

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

  protected t(key: string, params?: Record<string, unknown>) {
    return this.i18n.t(key, params);
  }

  protected pageTitle() {
    return {
      list: this.t('capa.page.titleList'),
      create: this.t('capa.page.titleCreate'),
      detail: this.selectedCapa()?.title || this.t('capa.page.titleDetail'),
      edit: this.selectedCapa()?.title || this.t('capa.page.titleEdit')
    }[this.mode()];
  }

  protected pageDescription() {
    return {
      list: this.t('capa.page.descriptionList'),
      create: this.t('capa.page.descriptionCreate'),
      detail: this.t('capa.page.descriptionDetail'),
      edit: this.t('capa.page.descriptionEdit')
    }[this.mode()];
  }

  protected breadcrumbs() {
    if (this.mode() === 'list') return [{ label: this.t('capa.common.label') }];
    const base = [{ label: this.t('capa.common.label'), link: '/capa' }];
    if (this.mode() === 'create') return [...base, { label: this.t('capa.breadcrumbs.new') }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedCapa()?.title || this.t('capa.common.label'), link: `/capa/${this.selectedId()}` }, { label: this.t('capa.breadcrumbs.edit') }];
    return [...base, { label: this.selectedCapa()?.title || this.t('capa.common.label') }];
  }

  protected filteredCapas() {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.capas().filter((item) => {
      const matchesStatus = !status || item.status === status;
      const matchesTerm =
        !term ||
        item.title.toLowerCase().includes(term) ||
        item.source.toLowerCase().includes(term);
      return matchesStatus && matchesTerm;
    }).sort((left, right) => this.compareCapas(left, right));
  }

  protected countByStatus(status: CapaStatus) {
    return this.capas().filter((item) => item.status === status).length;
  }

  protected statusClass(status: CapaStatus) {
    if (status === 'CLOSED' || status === 'VERIFIED') {
      return 'success';
    }

    if (status === 'IN_PROGRESS' || status === 'ACTION_PLANNED') {
      return 'warn';
    }

    if (status === 'INVESTIGATING') {
      return 'neutral';
    }

    return 'danger';
  }

  protected capaWorkflowHeadline(status: CapaStatus) {
    return {
      OPEN: this.t('capa.workflow.headline.OPEN'),
      INVESTIGATING: this.t('capa.workflow.headline.INVESTIGATING'),
      ACTION_PLANNED: this.t('capa.workflow.headline.ACTION_PLANNED'),
      IN_PROGRESS: this.t('capa.workflow.headline.IN_PROGRESS'),
      VERIFIED: this.t('capa.workflow.headline.VERIFIED'),
      CLOSED: this.t('capa.workflow.headline.CLOSED')
    }[status];
  }

  protected capaWorkflowNarrative(status: CapaStatus) {
    return {
      OPEN: this.t('capa.workflow.copy.OPEN'),
      INVESTIGATING: this.t('capa.workflow.copy.INVESTIGATING'),
      ACTION_PLANNED: this.t('capa.workflow.copy.ACTION_PLANNED'),
      IN_PROGRESS: this.t('capa.workflow.copy.IN_PROGRESS'),
      VERIFIED: this.t('capa.workflow.copy.VERIFIED'),
      CLOSED: this.t('capa.workflow.copy.CLOSED')
    }[status];
  }

  protected capaWorkflowHint() {
    const raw = this.form.getRawValue();
    return raw.ownerId
      ? this.t('capa.workflow.hint.assigned')
      : this.t('capa.workflow.hint.unassigned');
  }

  protected capaLifecycleStage(status: CapaStatus) {
    if (status === 'OPEN') return 'define';
    if (status === 'INVESTIGATING') return 'investigate';
    if (status === 'ACTION_PLANNED' || status === 'IN_PROGRESS') return 'act';
    return 'verify';
  }

  protected capaActionControlCopy() {
    const raw = this.form.getRawValue();
    if (!raw.ownerId && !raw.dueDate) {
      return this.t('capa.actionControl.noOwnerNoDate');
    }
    if (!raw.ownerId) {
      return this.t('capa.actionControl.noOwner');
    }
    if (!raw.dueDate) {
      return this.t('capa.actionControl.noDueDate');
    }
    return this.t('capa.actionControl.ready');
  }

  protected capaClosureBlockers() {
    const raw = this.form.getRawValue();
    const blockers: string[] = [];
    if (!raw.rootCause.trim()) blockers.push('Root cause is missing');
    if (!raw.correctiveAction.trim()) blockers.push('Corrective action is missing');
    if (!raw.verificationMethod.trim()) blockers.push('Verification method is missing');
    if (!raw.closureSummary.trim()) blockers.push('Closure summary is missing');
    return blockers;
  }

  protected capaClosureReadinessCopy(status: CapaStatus) {
    if (status === 'CLOSED') {
      const blockers = this.capaClosureBlockers();
      return blockers.length
        ? `This CAPA is marked for closure, but it still needs: ${blockers.join(', ')}.`
        : 'Closure requirements are in place. Save the record to complete closure when the evidence is ready.';
    }
    if (status === 'VERIFIED') {
      return 'Verification is the last review point before closure. Make sure the closure summary explains why recurrence is controlled.';
    }
    return 'Keep verification method and closure summary ready before the CAPA moves into final closure.';
  }

  protected readInputValue(event: Event) {
    return (event.target as HTMLInputElement).value;
  }

  protected readSelectValue(event: Event) {
    return (event.target as HTMLSelectElement).value;
  }

  protected setSortBy(value: string) {
    this.sortBy.set((value as CapaSortOption) || 'attention');
  }

  protected save() {
    if (!this.canWrite()) {
      this.error.set(this.t('capa.messages.noPermission'));
      return;
    }

    if (this.form.invalid) {
      this.error.set(this.t('capa.messages.completeRequired'));
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    const payload = this.toPayload();
    const request = this.selectedId()
      ? this.api.patch<CapaRow>(`capa/${this.selectedId()}`, payload)
      : this.api.post<CapaRow>('capa', payload);

    request.subscribe({
      next: (capa) => {
        this.saving.set(false);
        this.router.navigate(['/capa', capa.id], {
          state: {
            notice: this.t('capa.messages.saved'),
            returnNavigation: this.returnNavigation()
          }
        });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, this.t('capa.messages.saveFailed')));
      }
    });
  }

  protected canDeleteCapa() {
    return this.authStore.hasPermission('admin.delete') && !!this.selectedId() && this.selectedCapa()?.status !== 'CLOSED';
  }

  protected capaReadinessHeadline() {
    const capa = this.selectedCapa();
    if (!capa) {
      return 'CAPA readiness';
    }
    if (capa.status === 'CLOSED') {
      return capa.closureSummary ? 'Closure evidence is recorded' : 'Closure status needs support';
    }
    if (capa.status === 'VERIFIED') {
      return 'Verification is the next review point';
    }
    if (capa.status === 'IN_PROGRESS' || capa.status === 'ACTION_PLANNED') {
      return 'Action follow-up is active';
    }
    return 'Investigation quality will determine the CAPA outcome';
  }

  protected capaReadinessNarrative() {
    const capa = this.selectedCapa();
    if (!capa) {
      return 'Save the CAPA first to review readiness and closure cues.';
    }
    if (capa.status === 'CLOSED') {
      return capa.closureSummary
        ? 'The CAPA is closed and already includes closure evidence in the record.'
        : 'The CAPA is marked closed, but the closure explanation is still thin.';
    }
    if (capa.status === 'VERIFIED') {
      return 'Verification should now confirm that the corrective response was effective before final closure.';
    }
    if (capa.status === 'IN_PROGRESS' || capa.status === 'ACTION_PLANNED') {
      return 'The CAPA already has an active response. Continue through ownership, due dates, and effectiveness review.';
    }
    return 'The record still depends on solid containment, cause analysis, and action design before it can mature.';
  }

  protected capaReadinessHint() {
    const capa = this.selectedCapa();
    if (!capa) {
      return 'Use the staged sections below to move from problem definition to verified closure.';
    }
    if (capa.status === 'CLOSED') {
      return 'Keep the closure summary strong enough that another reviewer can understand why closure was justified.';
    }
    if (!capa.ownerId || !capa.dueDate) {
      return 'Next step: make sure ownership and due date are set so follow-up is controllable.';
    }
    return 'Next step: keep the action, verification, and closure sections aligned with the CAPA status.';
  }

  protected overdueCount() {
    return this.capas().filter((item) => this.isOverdue(item)).length;
  }

  protected ownerName(ownerId?: string | null) {
    if (!ownerId) {
      return this.t('capa.common.unassigned');
    }
    const user = this.users().find((item) => item.id === ownerId);
    return user ? `${user.firstName} ${user.lastName}` : this.t('capa.common.assigned');
  }

  protected labelize(value: string) {
    const map: Record<string, string> = {
      OPEN: 'capa.enums.status.OPEN',
      INVESTIGATING: 'capa.enums.status.INVESTIGATING',
      ACTION_PLANNED: 'capa.enums.status.ACTION_PLANNED',
      IN_PROGRESS: 'capa.enums.status.IN_PROGRESS',
      VERIFIED: 'capa.enums.status.VERIFIED',
      CLOSED: 'capa.enums.status.CLOSED'
    };
    const key = map[value];
    return key ? this.t(key) : value.toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }

  protected attentionLabel(item: CapaRow) {
    const reasons = this.capaAttentionReasons(item);
    if (!reasons.length) return this.t('capa.attention.underControl');
    return reasons.length > 1 ? `${reasons[0]} +${reasons.length - 1}` : reasons[0];
  }

  protected attentionClass(item: CapaRow) {
    const reasons = this.capaAttentionReasons(item);
    if (!reasons.length) return 'success';
    if (reasons.includes('Overdue')) return 'danger';
    return 'warn';
  }

  protected attentionHeadline() {
    const capa = this.selectedCapa();
    return capa && this.capaAttentionReasons(capa).length
      ? this.t('capa.attention.headline.needsAttention')
      : this.t('capa.attention.headline.underControl');
  }

  protected attentionNarrative() {
    const capa = this.selectedCapa();
    if (!capa) return this.t('capa.attention.narrative.unsaved');
    const reasons = this.capaAttentionReasons(capa);
    if (!reasons.length) {
      return this.t('capa.attention.narrative.underControl');
    }
    return this.t('capa.attention.narrative.needsAttention', {
      reasons: reasons.map((reason) => reason.toLowerCase()).join(', ')
    });
  }

  protected returnLinkState() {
    const returnNavigation = this.returnNavigation();
    return returnNavigation ? { returnNavigation } : undefined;
  }

  protected canWrite() {
    return this.authStore.hasPermission('capa.write');
  }

  protected deleteCapa() {
    if (!this.selectedId() || !this.canDeleteCapa()) {
      return;
    }

    if (!window.confirm(this.t('capa.messages.deleteConfirm'))) {
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.api.delete(`capa/${this.selectedId()}`).subscribe({
      next: () => {
        this.saving.set(false);
        void this.router.navigate(['/capa'], { state: { notice: this.t('capa.messages.deleted') } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, this.t('capa.messages.deleteFailed')));
      }
    });
  }

  private handleRoute(params: ParamMap) {
    const id = params.get('id');
    this.selectedId.set(id);
    this.message.set((history.state?.notice as string) || '');
    this.error.set('');
    this.returnNavigation.set((history.state?.returnNavigation as ReturnNavigation | undefined) ?? null);

    if (this.mode() === 'list') {
      this.selectedCapa.set(null);
      this.resetFormValues();
      this.reloadCapas();
      return;
    }

    if (this.mode() === 'create') {
      this.selectedCapa.set(null);
      this.resetFormValues();
      return;
    }

    if (id) {
      this.fetchCapa(id);
    }
  }

  private resetFormValues() {
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
  }

  private reloadCapas() {
    this.loading.set(true);
    this.api.get<CapaRow[]>('capa').subscribe({
      next: (items) => {
        this.loading.set(false);
        this.capas.set(items);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, this.t('capa.messages.loadListFailed')));
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
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, this.t('capa.messages.loadDetailFailed')));
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

  private isOverdue(item: CapaRow) {
    return !!item.dueDate && item.status !== 'CLOSED' && new Date(item.dueDate) < new Date();
  }

  private capaAttentionReasons(item: CapaRow) {
    if (item.status === 'CLOSED') {
      return [];
    }
    const reasons: string[] = [];
    if (!item.ownerId) {
      reasons.push('Owner needed');
    }
    if (this.isOverdue(item)) {
      reasons.push('Overdue');
    }
    if (item.status === 'VERIFIED' && !item.closureSummary) {
      reasons.push('Closure evidence needed');
    }
    const updated = new Date(item.updatedAt);
    const days = (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24);
    if (days > 45) {
      reasons.push('Stale');
    }
    return reasons;
  }

  private compareCapas(left: CapaRow, right: CapaRow) {
    switch (this.sortBy()) {
      case 'dueDate':
        return this.compareOptionalDateAsc(left.dueDate, right.dueDate) || this.compareDateDesc(left.updatedAt, right.updatedAt);
      case 'updated':
        return this.compareDateDesc(left.updatedAt, right.updatedAt) || this.compareOptionalDateAsc(left.dueDate, right.dueDate);
      case 'status':
        return this.capaStatusRank(left.status) - this.capaStatusRank(right.status) || this.compareOptionalDateAsc(left.dueDate, right.dueDate);
      case 'attention':
      default:
        return (
          this.capaAttentionRank(left) - this.capaAttentionRank(right) ||
          this.compareOptionalDateAsc(left.dueDate, right.dueDate) ||
          this.compareDateDesc(left.updatedAt, right.updatedAt)
        );
    }
  }

  private capaAttentionRank(item: CapaRow) {
    const reasons = this.capaAttentionReasons(item);
    if (reasons.includes('Overdue')) return 0;
    if (reasons.includes('Owner needed')) return 1;
    if (reasons.includes('Closure evidence needed')) return 2;
    if (reasons.includes('Stale')) return 3;
    if (item.status !== 'CLOSED') return 4;
    return 5;
  }

  private capaStatusRank(status: CapaStatus) {
    return {
      OPEN: 0,
      INVESTIGATING: 1,
      ACTION_PLANNED: 2,
      IN_PROGRESS: 3,
      VERIFIED: 4,
      CLOSED: 5
    }[status];
  }

  private compareOptionalDateAsc(left?: string | null, right?: string | null) {
    const leftTime = left ? new Date(left).getTime() : Number.POSITIVE_INFINITY;
    const rightTime = right ? new Date(right).getTime() : Number.POSITIVE_INFINITY;
    return leftTime - rightTime;
  }

  private compareDateDesc(left?: string | null, right?: string | null) {
    const leftTime = left ? new Date(left).getTime() : 0;
    const rightTime = right ? new Date(right).getTime() : 0;
    return rightTime - leftTime;
  }
}

@Component({
  standalone: true,
  imports: [CapaPageComponent],
  template: `<iso-capa-page [forcedMode]="'list'" />`
})
export class CapaRegisterPageComponent {}

@Component({
  standalone: true,
  imports: [CapaPageComponent],
  template: `<iso-capa-page [forcedMode]="'create'" />`
})
export class CapaCreatePageComponent {}

@Component({
  standalone: true,
  imports: [CapaPageComponent],
  template: `<iso-capa-page [forcedMode]="'detail'" />`
})
export class CapaDetailPageComponent {}

@Component({
  standalone: true,
  imports: [CapaPageComponent],
  template: `<iso-capa-page [forcedMode]="'edit'" />`
})
export class CapaEditPageComponent {}
