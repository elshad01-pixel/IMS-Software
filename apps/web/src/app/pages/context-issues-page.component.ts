import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnInit, SimpleChanges, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
import { ContentCategoryGroup, ContentSuggestion } from '../core/content-library.models';
import { ContentLibraryService } from '../core/content-library.service';
import { ContextApiService } from '../core/context-api.service';
import { ContextIssueProcessLink, ContextIssueRecord, ContextIssueRiskLink, ContextIssueStatus, ContextIssueType } from '../core/context.models';
import { IconActionButtonComponent } from '../shared/icon-action-button.component';
import { PageHeaderComponent } from '../shared/page-header.component';

type PageMode = 'list' | 'create' | 'edit';
type ProcessCandidate = { id: string; name: string; referenceNo?: string | null; status?: string; department?: string | null };

@Component({
  selector: 'iso-context-issues-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, IconActionButtonComponent],
  template: `
    <section class="page-grid">
      <iso-page-header [label]="'Clause 4'" [title]="pageTitle()" [description]="pageDescription()" [breadcrumbs]="breadcrumbs()">
        <a *ngIf="canWrite()" routerLink="/context/internal-issues/new" class="button-link">+ New internal issue</a>
        <a *ngIf="canWrite()" routerLink="/context/external-issues/new" class="button-link secondary">+ New external issue</a>
        <button *ngIf="canWrite() && mode() === 'edit' && selectedIssue()" type="button" class="button-link tertiary" (click)="createRiskFromIssue()">Create Risk</button>
        <a *ngIf="mode() !== 'list'" routerLink="/context" class="button-link tertiary">Back to context</a>
        <a *ngIf="mode() !== 'list'" [routerLink]="basePath()" class="button-link secondary">Back to list</a>
      </iso-page-header>

      <section *ngIf="!canRead()" class="card list-card">
        <div class="empty-state">
          <strong>{{ issueTypeLabel() }} access is not available</strong>
          <span>Your current role does not include context.read.</span>
        </div>
      </section>

      <section *ngIf="canRead() && mode() === 'list'" class="page-stack">
        <div class="card list-card">
          <div class="toolbar">
            <div class="toolbar-meta">
              <div>
                <p class="toolbar-title">{{ issueTypeLabel() }}</p>
                <p class="toolbar-copy">{{ registerCopy() }}</p>
              </div>
              <div class="toolbar-stats">
                <article class="toolbar-stat"><span>Total</span><strong>{{ issues().length }}</strong></article>
                <article class="toolbar-stat"><span>Open</span><strong>{{ countByStatus('OPEN') }}</strong></article>
                <article class="toolbar-stat"><span>Resolved</span><strong>{{ countByStatus('RESOLVED') }}</strong></article>
              </div>
            </div>
            <div class="filter-row">
              <label class="field">
                <span>Search</span>
                <input [value]="search()" (input)="search.set(readInputValue($event))" placeholder="Title, description, category">
              </label>
              <label class="field">
                <span>Status</span>
                <select [value]="statusFilter()" (change)="statusFilter.set(readSelectValue($event))">
                  <option value="">All statuses</option>
                  <option *ngFor="let item of statusOptions" [value]="item">{{ labelize(item) }}</option>
                </select>
              </label>
            </div>
          </div>

          <p class="feedback top-space" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <div class="empty-state top-space" *ngIf="loading()">
            <strong>Loading {{ issueTypeLabel().toLowerCase() }}</strong>
            <span>Refreshing Clause 4 issue records.</span>
          </div>

          <div class="empty-state top-space" *ngIf="!loading() && !filteredIssues().length">
            <strong>No {{ issueTypeLabel().toLowerCase() }} found</strong>
            <span>Create the first record to start maintaining this part of Clause 4.</span>
          </div>

          <div class="data-table-wrap top-space" *ngIf="!loading() && filteredIssues().length">
            <table class="data-table">
              <thead>
                <tr><th>Issue</th><th>Category</th><th>Status</th><th>Linked risks</th><th>Updated</th><th>Actions</th></tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of filteredIssues()">
                  <td><div class="table-title"><strong>{{ item.title }}</strong><small>{{ item.description }}</small></div></td>
                  <td>{{ item.category || 'Not set' }}</td>
                  <td><span class="status-badge" [ngClass]="statusClass(item.status)">{{ labelize(item.status) }}</span></td>
                  <td>{{ item.linkedRiskCount || 0 }}</td>
                  <td>{{ item.updatedAt | date:'yyyy-MM-dd' }}</td>
                  <td>
                    <div class="inline-actions">
                      <iso-icon-action-button [icon]="'view'" [label]="'Open issue'" [routerLink]="editRoute(item.id)" />
                      <iso-icon-action-button *ngIf="canDelete()" [icon]="'delete'" [label]="'Delete issue'" [variant]="'danger'" (pressed)="deleteIssue(item.id)" />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section *ngIf="canRead() && (mode() === 'create' || mode() === 'edit')" class="page-stack">
        <form class="card form-card page-stack" [formGroup]="form" (ngSubmit)="save()">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">{{ issueTypeLabel() }}</span>
              <h3>{{ mode() === 'create' ? 'Create record' : 'Edit record' }}</h3>
              <p class="subtle">Keep the issue concise, then move naturally into risk assessment if treatment or monitoring is needed.</p>
            </div>
          </div>

          <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <section class="feedback next-steps-banner success" *ngIf="message() && !error()">
            <strong>{{ message() }}</strong>
            <span>{{ nextStepsCopy() }}</span>
          </section>

          <section class="detail-section">
            <h4>Issue details</h4>
            <div class="form-grid-2 top-space">
              <label class="field"><span>Title</span><input formControlName="title" placeholder="Describe the issue"></label>
              <label class="field"><span>Status</span><select formControlName="status"><option *ngFor="let item of statusOptions" [value]="item">{{ labelize(item) }}</option></select></label>
            </div>
            <label class="field top-space"><span>Description</span><textarea formControlName="description" rows="5" placeholder="Describe the internal or external issue"></textarea></label>
            <label class="field top-space">
              <span>Impact on business</span>
              <textarea formControlName="impactOnBusiness" rows="3" placeholder="Describe the practical business effect if this issue is not addressed"></textarea>
            </label>
          </section>

          <section class="detail-section">
            <h4>Category and suggestions</h4>
            <div class="form-grid-2 top-space">
              <label class="field">
                <span>Category</span>
                <select [value]="selectedCategoryOption()" (change)="onCategoryOptionChange(readSelectValue($event))">
                  <option value="">Choose a starter category</option>
                  <option *ngFor="let category of categoryLabels()" [value]="category">{{ category }}</option>
                  <option value="__custom__">Custom category</option>
                </select>
              </label>
              <label class="field" *ngIf="customCategoryMode()">
                <span>Custom category</span>
                <input formControlName="category" placeholder="Enter a custom category">
              </label>
            </div>

            <div class="top-space page-stack" *ngIf="libraryReady()">
              <div class="content-guidance">
                <div class="guidance-head">
                  <div>
                    <h5>Suggested issues</h5>
                    <p class="subtle">Choose a starter suggestion, then edit it to match your organization.</p>
                  </div>
                </div>

                <div class="entity-list" *ngIf="suggestionsForCurrentCategory().length; else noIssueSuggestions">
                  <div class="entity-item suggestion-card" *ngFor="let suggestion of suggestionsForCurrentCategory()">
                    <div class="page-stack">
                      <strong>{{ suggestion.title }}</strong>
                      <small>{{ suggestion.description }}</small>
                    </div>
                    <button type="button" class="button-link secondary compact" (click)="applySuggestion(suggestion)">Use suggestion</button>
                  </div>
                </div>
                <ng-template #noIssueSuggestions>
                  <div class="empty-state compact-empty">
                    <strong>{{ suggestionEmptyStateTitle() }}</strong>
                    <span>{{ suggestionEmptyStateCopy() }}</span>
                  </div>
                </ng-template>
              </div>
            </div>
          </section>

          <section class="detail-section" *ngIf="mode() === 'edit' && selectedIssue()">
            <div class="section-head compact-head">
              <div>
                <h4>Traceability</h4>
                <p class="subtle">Keep this issue connected to the downstream records it shapes, without losing the Clause 4 context it started from.</p>
              </div>
            </div>

            <div class="summary-strip top-space">
              <article class="summary-item">
                <span>Status</span>
                <strong>{{ labelize(selectedIssue()?.status || 'OPEN') }}</strong>
              </article>
              <article class="summary-item">
                <span>Linked risks</span>
                <strong>{{ riskLinks().length }}</strong>
              </article>
              <article class="summary-item">
                <span>Linked processes</span>
                <strong>{{ processLinks().length }}</strong>
              </article>
            </div>

            <div class="button-row top-space">
              <button type="button" class="secondary" (click)="createRiskFromIssue()">Create Risk</button>
              <a *ngIf="firstRiskLinkPath()" [routerLink]="firstRiskLinkPath()" [state]="linkedRiskState()" class="button-link secondary">Open linked risk</a>
              <a *ngIf="firstProcessLinkPath()" [routerLink]="firstProcessLinkPath()" [state]="linkedProcessState()" class="button-link tertiary">Open linked process</a>
            </div>
          </section>

          <section class="detail-section" *ngIf="mode() === 'edit' && selectedIssue()">
            <div class="section-head compact-head">
              <div>
                <h4>Linked risks</h4>
                <p class="subtle">Risks raised from this issue stay visible here. Use the guided handoff to create a new risk when the issue needs assessment.</p>
              </div>
              <button type="button" class="button-link secondary compact" (click)="createRiskFromIssue()">Create Risk</button>
            </div>

            <div class="empty-state top-space" *ngIf="!riskLinks().length">
              <strong>No linked risks</strong>
              <span>Create the first risk from this issue when it needs formal assessment or mitigation tracking.</span>
            </div>

            <div class="entity-list top-space" *ngIf="riskLinks().length">
              <div class="entity-item" *ngFor="let link of riskLinks()">
                <div class="link-row">
                  <div>
                    <strong>{{ link.title }}</strong>
                    <small *ngIf="link.score !== null && link.score !== undefined">Risk score {{ link.score }}</small>
                  </div>
                  <div class="route-context">
                    <span *ngIf="link.status" class="status-badge neutral">{{ labelize(link.status) }}</span>
                    <a *ngIf="link.path && !link.missing" [routerLink]="link.path" [state]="linkedRiskState()" class="button-link secondary compact">Open</a>
                    <button type="button" class="button-link tertiary compact" (click)="removeRiskLink(link.id)">Remove</button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="detail-section" *ngIf="mode() === 'edit' && selectedIssue()">
            <div class="section-head compact-head">
              <div>
                <h4>Linked processes</h4>
                <p class="subtle">Link the relevant existing processes so Clause 4 context stays visible without duplicating process records.</p>
              </div>
            </div>

            <div class="empty-state top-space" *ngIf="!processLinks().length">
              <strong>No linked processes</strong>
              <span>Link the process records that are shaped by this issue.</span>
            </div>

            <div class="entity-list top-space" *ngIf="processLinks().length">
              <div class="entity-item" *ngFor="let link of processLinks()">
                <div class="link-row">
                  <div>
                    <strong>{{ link.title }}</strong>
                    <small *ngIf="link.subtitle">{{ link.subtitle }}</small>
                  </div>
                  <div class="route-context">
                    <span *ngIf="link.status" class="status-badge neutral">{{ labelize(link.status) }}</span>
                    <a *ngIf="link.path && !link.missing" [routerLink]="link.path" [state]="linkedProcessState()" class="button-link secondary compact">Open</a>
                    <button type="button" class="button-link tertiary compact" (click)="removeProcessLink(link.id)">Remove</button>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-grid-2 top-space">
              <label class="field">
                <span>Process</span>
                <select [value]="selectedProcessId()" (change)="selectedProcessId.set(readSelectValue($event))">
                  <option value="">Select an existing process</option>
                  <option *ngFor="let process of processCandidates()" [value]="process.id">{{ processLabel(process) }}</option>
                </select>
              </label>
              <div class="button-row align-end">
                <button type="button" [disabled]="!selectedProcessId() || processLinkSaving()" (click)="addProcessLink()">{{ processLinkSaving() ? 'Linking...' : 'Link process' }}</button>
              </div>
            </div>
          </section>

          <div class="button-row">
            <button type="submit" [disabled]="form.invalid || saving() || !canWrite()">{{ saving() ? 'Saving...' : 'Save record' }}</button>
            <a [routerLink]="listRoute()" class="button-link secondary">Cancel</a>
          </div>
        </form>

      </section>
    </section>
  `,
  styles: [`
    .link-row { display: flex; justify-content: space-between; align-items: start; gap: 1rem; }
    .compact-head { align-items: center; }
    .align-end { align-items: end; justify-content: flex-start; }
    .content-guidance {
      border: 1px solid var(--border-subtle);
      border-radius: 1rem;
      padding: 1rem;
      background: color-mix(in srgb, var(--surface-strong) 92%, white);
    }
    .guidance-head h5 { margin: 0; font-size: 1rem; }
    .compact-empty { min-height: 0; padding: 1rem 1.1rem; }
    .suggestion-card {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: start;
    }
  `]
})
export class ContextIssuesPageComponent implements OnInit, OnChanges {
  @Input() forcedMode: PageMode | null = null;
  @Input() forcedType: ContextIssueType = 'INTERNAL';

  private readonly authStore = inject(AuthStore);
  private readonly contextApi = inject(ContextApiService);
  private readonly api = inject(ApiService);
  private readonly contentLibrary = inject(ContentLibraryService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
  protected readonly issues = signal<ContextIssueRecord[]>([]);
  protected readonly selectedIssue = signal<ContextIssueRecord | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly processLinkSaving = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal((history.state?.notice as string) || '');
  protected readonly search = signal('');
  protected readonly statusFilter = signal('');
  protected readonly riskLinks = signal<ContextIssueRiskLink[]>([]);
  protected readonly processCandidates = signal<ProcessCandidate[]>([]);
  protected readonly processLinks = signal<ContextIssueProcessLink[]>([]);
  protected readonly selectedProcessId = signal('');
  protected readonly library = signal<ContentCategoryGroup[]>([]);
  protected readonly customCategoryMode = signal(false);
  protected readonly statusOptions: ContextIssueStatus[] = ['OPEN', 'MONITORING', 'RESOLVED', 'ARCHIVED'];
  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(180)]],
    description: ['', [Validators.required, Validators.maxLength(4000)]],
    impactOnBusiness: ['', [Validators.maxLength(2000)]],
    category: ['', [Validators.maxLength(120)]],
    status: ['OPEN' as ContextIssueStatus, Validators.required]
  });
  protected readonly filteredIssues = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.issues().filter((item) => {
      const matchesSearch = !term || [item.title, item.description, item.category || ''].some((value) => value.toLowerCase().includes(term));
      const matchesStatus = !this.statusFilter() || item.status === this.statusFilter();
      return matchesSearch && matchesStatus;
    });
  });

  ngOnInit() {
    this.loadContentLibrary();
    if (this.forcedMode) {
      this.mode.set(this.forcedMode);
      this.handleRoute(this.route.snapshot.paramMap);
    }
    this.route.paramMap.subscribe((params) => this.handleRoute(params));
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['forcedMode'] && this.forcedMode) {
      this.mode.set(this.forcedMode);
      this.handleRoute(this.route.snapshot.paramMap);
    }
  }

  protected canRead() { return this.authStore.hasPermission('context.read'); }
  protected canWrite() { return this.authStore.hasPermission('context.write'); }
  protected canDelete() { return this.authStore.hasPermission('admin.delete'); }
  protected issueTypeLabel() { return this.forcedType === 'INTERNAL' ? 'Internal Issues' : 'External Issues'; }
  protected itemLabel() { return this.forcedType === 'INTERNAL' ? 'Internal Issue' : 'External Issue'; }
  protected basePath() { return this.forcedType === 'INTERNAL' ? '/context/internal-issues' : '/context/external-issues'; }
  protected listRoute() { return this.forcedType === 'INTERNAL' ? ['/context', 'internal-issues'] : ['/context', 'external-issues']; }
  protected editRoute(id: string) { return this.forcedType === 'INTERNAL' ? ['/context', 'internal-issues', id, 'edit'] : ['/context', 'external-issues', id, 'edit']; }
  protected registerCopy() { return this.forcedType === 'INTERNAL' ? 'Capture internal organizational issues affecting the IMS.' : 'Capture external factors that influence the IMS environment.'; }
  protected guidanceCopy() { return this.forcedType === 'INTERNAL' ? 'Use internal issues for organizational, operational, culture, capability, or infrastructure factors.' : 'Use external issues for regulatory, supplier, market, stakeholder, or environmental factors.'; }
  protected libraryReady() { return this.library().length > 0; }
  protected issueTypeListId() { return this.forcedType === 'INTERNAL' ? 'internal-issue-categories' : 'external-issue-categories'; }
  protected categoryLabels() { return this.library().map((group) => group.label); }
  protected selectedCategoryOption() {
    const category = this.form.getRawValue().category.trim();
    if (!category) {
      return '';
    }
    return this.categoryLabels().includes(category) ? category : '__custom__';
  }
  protected suggestionsForCurrentCategory() {
    const currentCategory = this.form.getRawValue().category.trim();
    if (!currentCategory) {
      return [];
    }
    const matchingGroup = this.library().find((group) => group.label === currentCategory);
    return matchingGroup?.suggestions ?? [];
  }
  protected suggestionEmptyStateTitle() {
    const currentCategory = this.form.getRawValue().category.trim();
    return currentCategory ? 'No starter suggestion for this category yet' : 'Choose a category to see starter issues';
  }
  protected suggestionEmptyStateCopy() {
    const currentCategory = this.form.getRawValue().category.trim();
    return currentCategory
      ? 'Keep entering the issue manually, or choose another category for examples.'
      : 'Starter suggestions appear after you choose a category. You can still complete the issue manually.';
  }
  protected pageTitle() { return { list: this.issueTypeLabel(), create: `New ${this.itemLabel()}`, edit: `Edit ${this.itemLabel()}` }[this.mode()]; }
  protected pageDescription() { return this.mode() === 'list' ? this.registerCopy() : 'Capture the issue first, then link it to existing risks where needed.'; }
  protected breadcrumbs() {
    const base = [{ label: 'Context of Organization', link: '/context' }, { label: this.issueTypeLabel(), link: this.basePath() }];
    if (this.mode() === 'create') return [...base, { label: 'New' }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedIssue()?.title || 'Edit' }];
    return base;
  }
  protected countByStatus(status: ContextIssueStatus) { return this.issues().filter((item) => item.status === status).length; }
  protected labelize(value: string) { return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (part) => part.toUpperCase()); }
  protected statusClass(status: ContextIssueStatus) { return status === 'RESOLVED' ? 'success' : status === 'ARCHIVED' ? 'neutral' : 'warn'; }
  protected readInputValue(event: Event) { return (event.target as HTMLInputElement).value; }
  protected readSelectValue(event: Event) { return (event.target as HTMLSelectElement).value; }
  protected applyCategory(category: string) {
    this.customCategoryMode.set(false);
    this.form.patchValue({ category });
  }
  protected onCategoryOptionChange(category: string) {
    if (category === '__custom__') {
      this.customCategoryMode.set(true);
      if (this.categoryLabels().includes(this.form.getRawValue().category.trim())) {
        this.form.patchValue({ category: '' });
      }
      return;
    }

    this.customCategoryMode.set(false);
    this.form.patchValue({ category });
  }
  protected applySuggestion(suggestion: ContentSuggestion) {
    this.customCategoryMode.set(!this.categoryLabels().includes(suggestion.category));
    this.form.patchValue({
      title: suggestion.title,
      description: suggestion.description,
      category: suggestion.category
    });
  }
  protected processLabel(process: ProcessCandidate) {
    return `${process.referenceNo || 'Uncoded'} - ${process.name}`;
  }
  protected nextStepsCopy() {
    if (this.mode() === 'create') {
      return 'Next: review the issue, create a risk if it needs assessment, or link the affected process for clearer context.';
    }
    return 'Next: create a risk if the issue needs assessment, or keep the linked process and risks up to date as the context changes.';
  }
  protected firstRiskLinkPath() {
    return this.riskLinks().find((link) => !!link.path && !link.missing)?.path ?? null;
  }
  protected firstProcessLinkPath() {
    return this.processLinks().find((link) => !!link.path && !link.missing)?.path ?? null;
  }
  protected issueReturnNavigation() {
    const issue = this.selectedIssue();
    if (!issue?.id) {
      return null;
    }
    return {
      route: this.editRoute(issue.id),
      label: this.itemLabel().toLowerCase()
    };
  }
  protected linkedRiskState() {
    const navigation = this.issueReturnNavigation();
    return navigation ? { sourceContextNavigation: navigation } : undefined;
  }
  protected linkedProcessState() {
    const navigation = this.issueReturnNavigation();
    return navigation ? { returnNavigation: navigation } : undefined;
  }

  protected save() {
    if (this.form.invalid || !this.canWrite()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    const payload = { ...this.form.getRawValue(), type: this.forcedType };
    const request = this.mode() === 'edit' && this.selectedId()
      ? this.contextApi.updateIssue(this.selectedId()!, payload)
      : this.contextApi.createIssue(payload);

    request.subscribe({
      next: (issue) => {
        this.saving.set(false);
        void this.router.navigate(this.editRoute(issue.id), {
          state: { notice: this.mode() === 'edit' ? 'Issue updated.' : 'Issue created.' }
        });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Issue could not be saved.'));
      }
    });
  }

  protected deleteIssue(id: string) {
    if (!this.canDelete() || !window.confirm('Delete this issue?')) {
      return;
    }

    this.contextApi.removeIssue(id).subscribe({
      next: () => {
        this.message.set('Issue deleted.');
        this.reloadIssues();
      },
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'Issue deletion failed.'))
    });
  }

  protected createRiskFromIssue() {
    const issue = this.selectedIssue();
    if (!issue) {
      return;
    }
    void this.router.navigate(['/risks/new'], {
      state: {
        sourceContextNavigation: {
          route: this.editRoute(issue.id),
          label: this.itemLabel().toLowerCase()
        },
        riskPrefill: {
          issueId: issue.id,
          issueType: issue.type,
          issueTitle: issue.title,
          issueDescription: issue.description,
          impactOnBusiness: issue.impactOnBusiness,
          category: issue.category,
          processNames: this.processLinks().map((link) => link.title)
        }
      }
    });
  }

  protected removeRiskLink(linkId: string) {
    if (!this.selectedId()) {
      return;
    }

    this.contextApi.removeIssueRiskLink(this.selectedId()!, linkId).subscribe({
      next: () => {
        this.loadRiskLinks(this.selectedId()!);
        this.message.set('Risk link removed.');
      },
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'Risk unlink failed.'))
    });
  }

  protected addProcessLink() {
    if (!this.selectedId() || !this.selectedProcessId()) {
      return;
    }

    this.processLinkSaving.set(true);
    this.contextApi.addIssueProcessLink(this.selectedId()!, this.selectedProcessId()).subscribe({
      next: () => {
        this.processLinkSaving.set(false);
        this.selectedProcessId.set('');
        void this.router.navigate(this.listRoute(), {
          state: { notice: 'Process linked to the issue successfully.' }
        });
      },
      error: (error: HttpErrorResponse) => {
        this.processLinkSaving.set(false);
        this.error.set(this.readError(error, 'Process link failed.'));
      }
    });
  }

  protected removeProcessLink(linkId: string) {
    if (!this.selectedId()) {
      return;
    }

    this.contextApi.removeIssueProcessLink(this.selectedId()!, linkId).subscribe({
      next: () => {
        this.loadProcessLinks(this.selectedId()!);
        this.message.set('Process link removed.');
      },
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'Process unlink failed.'))
    });
  }

  private handleRoute(params: ParamMap) {
    if (!this.canRead()) return;
    const id = params.get('id');
    this.selectedId.set(id);
    if (this.mode() === 'list') {
      this.selectedIssue.set(null);
      this.reloadIssues();
      return;
    }
    if (this.mode() === 'create' || !id) {
      this.resetForm();
      this.riskLinks.set([]);
      this.processLinks.set([]);
      this.loadProcessCandidates();
      return;
    }
    this.loadIssue(id);
    this.loadRiskLinks(id);
    this.loadProcessLinks(id);
    this.loadProcessCandidates();
  }

  private reloadIssues() {
    this.loading.set(true);
    this.contextApi.listIssues({ type: this.forcedType }).subscribe({
      next: (issues) => {
        this.loading.set(false);
        this.issues.set(issues);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Issues could not be loaded.'));
      }
    });
  }

  private loadIssue(id: string) {
    this.loading.set(true);
    this.contextApi.getIssue(id).subscribe({
      next: (issue) => {
        this.loading.set(false);
        this.selectedIssue.set(issue);
        this.customCategoryMode.set(!!issue.category && !this.categoryLabels().includes(issue.category));
        this.form.reset({
          title: issue.title,
          description: issue.description,
          impactOnBusiness: issue.impactOnBusiness ?? '',
          category: issue.category || '',
          status: issue.status
        });
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Issue details could not be loaded.'));
      }
    });
  }

  private loadRiskLinks(id: string) {
    this.contextApi.listIssueRiskLinks(id).subscribe({
      next: (links) => this.riskLinks.set(links),
      error: () => this.riskLinks.set([])
    });
  }

  private loadProcessLinks(id: string) {
    this.contextApi.listIssueProcessLinks(id).subscribe({
      next: (links) => this.processLinks.set(links),
      error: () => this.processLinks.set([])
    });
  }

  private loadProcessCandidates() {
    this.api.get<ProcessCandidate[]>('process-register').subscribe({
      next: (processes) => this.processCandidates.set(processes.filter((process) => process.status !== 'ARCHIVED')),
      error: () => this.processCandidates.set([])
    });
  }

  private resetForm() {
    this.customCategoryMode.set(false);
    this.form.reset({ title: '', description: '', impactOnBusiness: '', category: '', status: 'OPEN' });
  }

  private loadContentLibrary() {
    this.contentLibrary.getLibrary().subscribe({
      next: (library) => {
        this.library.set(this.forcedType === 'INTERNAL' ? library.context.internalIssueCategories : library.context.externalIssueCategories);
      },
      error: () => this.library.set([])
    });
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}

@Component({ standalone: true, imports: [ContextIssuesPageComponent], template: `<iso-context-issues-page [forcedMode]="'list'" [forcedType]="'INTERNAL'" />` })
export class InternalIssuesListPageComponent {}
@Component({ standalone: true, imports: [ContextIssuesPageComponent], template: `<iso-context-issues-page [forcedMode]="'create'" [forcedType]="'INTERNAL'" />` })
export class InternalIssueCreatePageComponent {}
@Component({ standalone: true, imports: [ContextIssuesPageComponent], template: `<iso-context-issues-page [forcedMode]="'edit'" [forcedType]="'INTERNAL'" />` })
export class InternalIssueEditPageComponent {}
@Component({ standalone: true, imports: [ContextIssuesPageComponent], template: `<iso-context-issues-page [forcedMode]="'list'" [forcedType]="'EXTERNAL'" />` })
export class ExternalIssuesListPageComponent {}
@Component({ standalone: true, imports: [ContextIssuesPageComponent], template: `<iso-context-issues-page [forcedMode]="'create'" [forcedType]="'EXTERNAL'" />` })
export class ExternalIssueCreatePageComponent {}
@Component({ standalone: true, imports: [ContextIssuesPageComponent], template: `<iso-context-issues-page [forcedMode]="'edit'" [forcedType]="'EXTERNAL'" />` })
export class ExternalIssueEditPageComponent {}
