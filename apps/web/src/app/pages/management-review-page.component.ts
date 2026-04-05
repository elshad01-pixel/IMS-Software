import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
import { PageHeaderComponent } from '../shared/page-header.component';
import { RecordWorkItemsComponent } from '../shared/record-work-items.component';

type PageMode = 'list' | 'create' | 'detail' | 'edit';
type ReviewStatus = 'PLANNED' | 'HELD' | 'CLOSED';

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type ReviewRecord = {
  id: string;
  title: string;
  reviewDate?: string | null;
  chairpersonId?: string | null;
  agenda?: string | null;
  auditResults?: string | null;
  capaStatus?: string | null;
  kpiPerformance?: string | null;
  risksOpportunities?: string | null;
  changesAffectingSystem?: string | null;
  previousActions?: string | null;
  minutes?: string | null;
  decisions?: string | null;
  improvementActions?: string | null;
  resourceNeeds?: string | null;
  summary?: string | null;
  status: ReviewStatus;
};

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, RecordWorkItemsComponent],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="'Management Review'"
        [title]="pageTitle()"
        [description]="pageDescription()"
        [breadcrumbs]="breadcrumbs()"
      >
        <a *ngIf="mode() === 'list' && canWrite()" routerLink="/management-review/new" class="button-link">+ New review meeting</a>
        <a *ngIf="mode() === 'detail' && selectedReview() && canWrite()" [routerLink]="['/management-review', selectedReview()?.id, 'edit']" class="button-link">Edit meeting</a>
        <button *ngIf="mode() === 'detail' && canArchiveReview()" type="button" class="button-link secondary" (click)="archiveReview()">Archive meeting</button>
        <a *ngIf="mode() !== 'list'" routerLink="/management-review" class="button-link secondary">Back to meetings</a>
      </iso-page-header>

      <section *ngIf="mode() === 'list'" class="page-stack">
        <div class="card list-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Meetings</span>
              <h3>Structured management reviews</h3>
              <p class="subtle">Run ISO management review meetings with explicit inputs, outputs, decisions, and action follow-up.</p>
            </div>
          </div>

          <div class="empty-state" *ngIf="loading()">
            <strong>Loading management reviews</strong>
            <span>Refreshing meetings, status, and linked inputs.</span>
          </div>

          <div class="data-table-wrap" *ngIf="!loading() && reviews().length">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Meeting</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Input coverage</th>
                  <th>Outputs readiness</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of reviews()" [routerLink]="['/management-review', item.id]">
                  <td>
                    <div class="table-title">
                      <strong>{{ item.title }}</strong>
                      <small>{{ item.summary || 'No summary' }}</small>
                    </div>
                  </td>
                  <td>{{ item.reviewDate ? (item.reviewDate | date:'yyyy-MM-dd') : 'TBD' }}</td>
                  <td><span class="status-badge" [class.success]="item.status === 'CLOSED'" [class.warn]="item.status === 'HELD'">{{ item.status }}</span></td>
                  <td>{{ reviewInputCoverage(item) }}/6</td>
                  <td>
                    <span class="status-badge" [class.success]="reviewOutputsReady(item)" [class.warn]="item.status !== 'PLANNED' && !reviewOutputsReady(item)">
                      {{ reviewOutputsReady(item) ? 'Recorded' : 'Pending' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section *ngIf="mode() === 'create' || mode() === 'edit'" class="page-columns">
        <form class="card form-card page-stack" [formGroup]="reviewForm" (ngSubmit)="saveReview()">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Meeting record</span>
              <h3>{{ mode() === 'create' ? 'Create management review' : 'Edit management review' }}</h3>
              <p class="subtle">Use the built-in ISO structure for inputs and outputs instead of a single free-form note.</p>
            </div>
          </div>

          <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <section class="readiness-strip">
            <article class="readiness-card">
              <span>Inputs captured</span>
              <strong>{{ completedInputCount() }}/6</strong>
              <small>{{ completedInputCount() >= 4 ? 'Sufficient input coverage for review discussion.' : 'Record the main audit, CAPA, KPI, and risk inputs before the meeting.' }}</small>
            </article>
            <article class="readiness-card">
              <span>Outputs captured</span>
              <strong>{{ completedOutputCount() }}/5</strong>
              <small>{{ completedOutputCount() >= 3 ? 'Outputs are taking shape for controlled follow-up.' : 'Decisions, actions, and resource needs should be explicit.' }}</small>
            </article>
            <article class="readiness-card">
              <span>Meeting readiness</span>
              <strong>{{ reviewReadinessLabel() }}</strong>
              <small>{{ reviewReadinessHint() }}</small>
            </article>
          </section>

          <label class="field"><span>Title</span><input formControlName="title" placeholder="Q1 2026 management review"></label>
          <div class="form-grid-3">
            <label class="field"><span>Meeting date</span><input type="date" formControlName="reviewDate"></label>
            <label class="field">
              <span>Chairperson</span>
              <select formControlName="chairpersonId">
                <option value="">Unassigned</option>
                <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
              </select>
            </label>
            <label class="field">
              <span>Status</span>
              <select formControlName="status">
                <option>PLANNED</option>
                <option>HELD</option>
                <option>CLOSED</option>
              </select>
            </label>
          </div>

          <section class="detail-section">
            <h4>Inputs</h4>
            <div class="page-stack top-space">
              <label class="field"><span>Audit results</span><textarea rows="3" formControlName="auditResults" placeholder="Summarize audit outcomes and themes"></textarea></label>
              <label class="field"><span>CAPA status</span><textarea rows="3" formControlName="capaStatus" placeholder="Summarize open, overdue, and effective CAPA"></textarea></label>
              <label class="field"><span>KPI performance</span><textarea rows="3" formControlName="kpiPerformance" placeholder="Summarize KPI performance, breaches, and trends"></textarea></label>
              <label class="field"><span>Risks and opportunities</span><textarea rows="3" formControlName="risksOpportunities" placeholder="Summarize current risk exposure and opportunities"></textarea></label>
              <label class="field"><span>Changes affecting the system</span><textarea rows="3" formControlName="changesAffectingSystem" placeholder="Regulatory, organizational, supplier, or process changes"></textarea></label>
              <label class="field"><span>Previous actions</span><textarea rows="3" formControlName="previousActions" placeholder="Status of previous management review outputs"></textarea></label>
            </div>
          </section>

          <section class="detail-section">
            <h4>Outputs</h4>
            <div class="page-stack top-space">
              <label class="field"><span>Minutes</span><textarea rows="4" formControlName="minutes" placeholder="Formal meeting minutes"></textarea></label>
              <label class="field"><span>Decisions</span><textarea rows="3" formControlName="decisions" placeholder="Decisions made by management"></textarea></label>
              <label class="field"><span>Improvement actions</span><textarea rows="3" formControlName="improvementActions" placeholder="Improvement commitments and actions"></textarea></label>
              <label class="field"><span>Resource needs</span><textarea rows="3" formControlName="resourceNeeds" placeholder="People, budget, competence, or infrastructure needs"></textarea></label>
              <label class="field"><span>Summary</span><textarea rows="2" formControlName="summary" placeholder="Executive summary of the review"></textarea></label>
            </div>
          </section>

          <div class="button-row">
            <button type="submit" [disabled]="reviewForm.invalid || saving() || !canWrite()">{{ saving() ? 'Saving...' : 'Save meeting' }}</button>
            <a [routerLink]="selectedId() ? ['/management-review', selectedId()] : ['/management-review']" class="button-link secondary">Cancel</a>
          </div>
        </form>
      </section>

          <section *ngIf="mode() === 'detail' && selectedReview()" class="page-columns">
        <div class="page-stack">
          <section class="card detail-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Management review</span>
                <h3>{{ selectedReview()?.title }}</h3>
                <p class="subtle">{{ selectedReview()?.reviewDate ? (selectedReview()?.reviewDate | date:'yyyy-MM-dd') : 'Date not set' }}</p>
              </div>
              <span class="status-badge" [class.success]="selectedReview()?.status === 'CLOSED'" [class.warn]="selectedReview()?.status === 'HELD'">{{ selectedReview()?.status }}</span>
            </div>

            <section class="readiness-strip top-space">
              <article class="readiness-card">
                <span>Inputs recorded</span>
                <strong>{{ detailInputCount() }}/6</strong>
                <small>Core management review inputs are recorded directly in the meeting itself.</small>
              </article>
              <article class="readiness-card">
                <span>Outputs recorded</span>
                <strong>{{ detailOutputCount() }}/5</strong>
                <small>{{ detailOutputCount() >= 3 ? 'Decisions and actions are recorded for follow-up.' : 'Capture decisions, improvement actions, and resource needs before closure.' }}</small>
              </article>
              <article class="readiness-card">
                <span>Management position</span>
                <strong>{{ managementPositionLabel() }}</strong>
                <small>{{ managementPositionHint() }}</small>
              </article>
            </section>

            <section class="guidance-card top-space" *ngIf="needsMeetingContentAttention()">
              <strong>Complete the meeting record before raising actions</strong>
              <p>This review still needs written meeting content. Use Edit meeting first, then create actions from the sections that contain actual decisions or follow-up needs.</p>
              <small>Action buttons stay available only where section content already exists.</small>
            </section>

            <div class="page-stack top-space">
              <section class="detail-section" *ngFor="let section of reviewSections()">
                <div class="section-head">
                  <div>
                    <h4>{{ section.label }}</h4>
                    <p class="subtle">{{ section.value || 'No content recorded yet.' }}</p>
                  </div>
                  <button type="button" class="secondary" [disabled]="!canCreateActionFromSection(section.value)" [title]="createActionTooltip(section.value)" (click)="prepareAction(section.label, section.value)">Prepare follow-up action</button>
                </div>
              </section>
            </div>
          </section>

          <iso-record-work-items
            [sourceType]="'management-review'"
            [sourceId]="selectedId()"
            [draftTitle]="draftActionTitle()"
            [draftDescription]="draftActionDescription()"
          />
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

    .readiness-strip {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    }

    .readiness-card {
      padding: 1rem 1.1rem;
      border: 1px solid rgba(46, 67, 56, 0.1);
      border-radius: 1rem;
      background: rgba(252, 253, 250, 0.8);
    }

    .readiness-card span,
    .readiness-card small {
      display: block;
    }

    .readiness-card span {
      color: #5e6e63;
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .readiness-card strong {
      display: block;
      margin-top: 0.45rem;
      font-size: 1.35rem;
      color: #203427;
    }

    .readiness-card small {
      margin-top: 0.45rem;
      color: #617165;
      line-height: 1.45;
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
      color: #617165;
      line-height: 1.45;
    }
  `]
})
export class ManagementReviewPageComponent {
  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
  protected readonly reviews = signal<ReviewRecord[]>([]);
  protected readonly users = signal<UserOption[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selectedReview = signal<ReviewRecord | null>(null);
  protected readonly draftActionTitle = signal<string | null>(null);
  protected readonly draftActionDescription = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal((history.state?.notice as string) || '');
  protected readonly error = signal('');

  protected readonly reviewForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    reviewDate: [''],
    chairpersonId: [''],
    agenda: [''],
    auditResults: [''],
    capaStatus: [''],
    kpiPerformance: [''],
    risksOpportunities: [''],
    changesAffectingSystem: [''],
    previousActions: [''],
    minutes: [''],
    decisions: [''],
    improvementActions: [''],
    resourceNeeds: [''],
    summary: [''],
    status: ['PLANNED' as ReviewStatus, Validators.required]
  });

  constructor() {
    this.loadUsers();
    this.route.data.subscribe((data) => {
      this.mode.set((data['mode'] as PageMode) || 'list');
      this.handleRoute(this.route.snapshot.paramMap);
    });
    this.route.paramMap.subscribe((params) => this.handleRoute(params));
  }

  protected pageTitle() {
    return {
      list: 'Management reviews',
      create: 'Create management review',
      detail: this.selectedReview()?.title || 'Management review detail',
      edit: this.selectedReview()?.title || 'Edit management review'
    }[this.mode()];
  }

  protected pageDescription() {
    return {
      list: 'Run structured ISO management reviews with clear inputs, decisions, and action outputs.',
      create: 'Capture the meeting against a structured ISO template and reference live system records.',
      detail: 'Review management inputs, outputs, and linked actions in one calm operational workspace.',
      edit: 'Update the meeting record while preserving the linked evidence and action context.'
    }[this.mode()];
  }

  protected breadcrumbs() {
    if (this.mode() === 'list') return [{ label: 'Management Review' }];
    const base = [{ label: 'Management Review', link: '/management-review' }];
    if (this.mode() === 'create') return [...base, { label: 'New review' }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedReview()?.title || 'Review', link: `/management-review/${this.selectedId()}` }, { label: 'Edit' }];
    return [...base, { label: this.selectedReview()?.title || 'Review' }];
  }

  protected reviewSections() {
    const review = this.selectedReview();
    if (!review) return [];
    return [
      { label: 'Audit results', value: review.auditResults },
      { label: 'CAPA status', value: review.capaStatus },
      { label: 'KPI performance', value: review.kpiPerformance },
      { label: 'Risks and opportunities', value: review.risksOpportunities },
      { label: 'Changes affecting the system', value: review.changesAffectingSystem },
      { label: 'Previous actions', value: review.previousActions },
      { label: 'Minutes', value: review.minutes },
      { label: 'Decisions', value: review.decisions },
      { label: 'Improvement actions', value: review.improvementActions },
      { label: 'Resource needs', value: review.resourceNeeds }
    ];
  }

  protected completedInputCount() {
    const raw = this.reviewForm.getRawValue();
    return [
      raw.auditResults,
      raw.capaStatus,
      raw.kpiPerformance,
      raw.risksOpportunities,
      raw.changesAffectingSystem,
      raw.previousActions
    ].filter((value) => value.trim()).length;
  }

  protected completedOutputCount() {
    const raw = this.reviewForm.getRawValue();
    return [
      raw.minutes,
      raw.decisions,
      raw.improvementActions,
      raw.resourceNeeds,
      raw.summary
    ].filter((value) => value.trim()).length;
  }

  protected reviewReadinessLabel() {
    const status = this.reviewForm.getRawValue().status;
    if (status === 'CLOSED') {
      return this.completedOutputCount() >= 3 ? 'Ready to close' : 'Closure gaps';
    }
    if (status === 'HELD') {
      return this.completedOutputCount() >= 2 ? 'Follow-up forming' : 'Outputs still thin';
    }
    return this.completedInputCount() >= 4 ? 'Agenda ready' : 'Build inputs';
  }

  protected reviewReadinessHint() {
    const status = this.reviewForm.getRawValue().status;
    if (status === 'CLOSED') {
      return 'A closed review should show clear decisions, actions, and resource needs.';
    }
    if (status === 'HELD') {
      return 'Held meetings should already show minutes, decisions, and at least initial actions.';
    }
    return 'Planned meetings should bring together the main system-performance inputs before discussion starts.';
  }

  protected reviewOutputsReady(review: ReviewRecord) {
    return [review.minutes, review.decisions, review.improvementActions, review.resourceNeeds, review.summary]
      .filter((value) => (value || '').trim()).length >= 3;
  }

  protected reviewInputCoverage(review: ReviewRecord) {
    return [review.auditResults, review.capaStatus, review.kpiPerformance, review.risksOpportunities, review.changesAffectingSystem, review.previousActions]
      .filter((value) => (value || '').trim()).length;
  }

  protected detailOutputCount() {
    const review = this.selectedReview();
    if (!review) {
      return 0;
    }
    return [review.minutes, review.decisions, review.improvementActions, review.resourceNeeds, review.summary]
      .filter((value) => (value || '').trim()).length;
  }

  protected detailInputCount() {
    const review = this.selectedReview();
    if (!review) {
      return 0;
    }
    return this.reviewInputCoverage(review);
  }

  protected managementPositionLabel() {
    const review = this.selectedReview();
    if (!review) {
      return 'Pending';
    }
    if (review.status === 'CLOSED') {
      return this.detailOutputCount() >= 3 ? 'Decision recorded' : 'Closure incomplete';
    }
    if (review.status === 'HELD') {
      return 'Awaiting follow-up';
    }
    return 'Planned discussion';
  }

  protected managementPositionHint() {
    const review = this.selectedReview();
    if (!review) {
      return 'Management review outputs will appear once the meeting record is saved.';
    }
    if (review.status === 'CLOSED') {
      return 'The meeting can be complete even while resulting actions continue afterward.';
    }
    if (review.status === 'HELD') {
      return 'Review the decisions and actions before treating this meeting as closed.';
    }
    return 'Use linked inputs to prepare evidence before the meeting is held.';
  }

  protected needsMeetingContentAttention() {
    const review = this.selectedReview();
    if (!review || review.status === 'CLOSED') {
      return false;
    }
    const hasCoreInputs = [review.auditResults, review.capaStatus, review.kpiPerformance, review.risksOpportunities]
      .some((value) => (value || '').trim());
    const hasCoreOutputs = [review.minutes, review.decisions, review.improvementActions, review.summary]
      .some((value) => (value || '').trim());
    return !hasCoreInputs || !hasCoreOutputs;
  }

  protected saveReview() {
    if (!this.canWrite()) {
      this.error.set('You do not have permission to update management reviews.');
      return;
    }

    if (this.reviewForm.invalid) {
      this.error.set('Complete the required management review fields.');
      return;
    }

    this.saving.set(true);
    this.message.set('');
    this.error.set('');
    const raw = this.reviewForm.getRawValue();
    const payload = {
      ...raw,
      title: raw.title.trim(),
      reviewDate: raw.reviewDate || undefined,
      chairpersonId: raw.chairpersonId || undefined,
      agenda: raw.agenda.trim() || undefined,
      auditResults: raw.auditResults.trim() || undefined,
      capaStatus: raw.capaStatus.trim() || undefined,
      kpiPerformance: raw.kpiPerformance.trim() || undefined,
      risksOpportunities: raw.risksOpportunities.trim() || undefined,
      changesAffectingSystem: raw.changesAffectingSystem.trim() || undefined,
      previousActions: raw.previousActions.trim() || undefined,
      minutes: raw.minutes.trim() || undefined,
      decisions: raw.decisions.trim() || undefined,
      improvementActions: raw.improvementActions.trim() || undefined,
      resourceNeeds: raw.resourceNeeds.trim() || undefined,
      summary: raw.summary.trim() || undefined,
      inputs: []
    };

    const request = this.selectedId()
      ? this.api.patch<ReviewRecord>(`management-review/${this.selectedId()}`, payload)
      : this.api.post<ReviewRecord>('management-review', payload);

    request.subscribe({
      next: (review) => {
        this.saving.set(false);
        this.router.navigate(['/management-review', review.id], { state: { notice: 'Management review saved successfully.' } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Management review save failed.'));
      }
    });
  }

  protected prepareAction(sectionLabel: string, content?: string | null) {
    if (!this.canCreateActions()) {
      this.error.set('You do not have permission to create actions.');
      return;
    }

    this.draftActionTitle.set(`Management review action: ${sectionLabel}`);
    this.draftActionDescription.set(content || '');
    this.message.set(`Follow-up action draft opened below from ${sectionLabel.toLowerCase()}.`);
  }

  protected canWrite() {
    return this.authStore.hasPermission('management-review.write');
  }

  protected canCreateActions() {
    return this.authStore.hasPermission('action-items.write');
  }

  protected canCreateActionFromSection(value?: string | null) {
    return this.canCreateActions() && !!(value || '').trim();
  }

  protected createActionTooltip(value?: string | null) {
    if (!this.canCreateActions()) {
      return 'You do not have permission to create actions.';
    }
    if (!(value || '').trim()) {
      return 'Add meeting content first, then prepare an action from that section.';
    }
    return 'Prepare a follow-up action from this section.';
  }

  protected canArchiveReview() {
    return this.authStore.hasPermission('admin.delete') && !!this.selectedId();
  }

  protected archiveReview() {
    if (!this.selectedId() || !this.canArchiveReview()) {
      return;
    }

    if (!window.confirm('Archive this management review? It will be removed from the active meeting list but kept in the audit trail.')) {
      return;
    }

    this.saving.set(true);
    this.message.set('');
    this.error.set('');
    this.api.patch(`management-review/${this.selectedId()}/archive`, {}).subscribe({
      next: () => {
        this.saving.set(false);
        void this.router.navigate(['/management-review'], { state: { notice: 'Management review archived.' } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Management review archive failed.'));
      }
    });
  }

  private handleRoute(params: ParamMap) {
    const id = params.get('id');
    this.selectedId.set(id);
    this.message.set((history.state?.notice as string) || '');
    this.error.set('');
    this.draftActionTitle.set(null);
    this.draftActionDescription.set(null);

    if (this.mode() === 'list') {
      this.selectedReview.set(null);
      this.resetFormValues();
      this.reload();
      return;
    }

    if (this.mode() === 'create') {
      this.selectedReview.set(null);
      this.resetFormValues();
      return;
    }

    if (id) {
      this.fetchReview(id);
    }
  }

  private resetFormValues() {
    this.reviewForm.reset({
      title: '',
      reviewDate: '',
      chairpersonId: '',
      agenda: 'Review performance of the integrated management system.',
      auditResults: '',
      capaStatus: '',
      kpiPerformance: '',
      risksOpportunities: '',
      changesAffectingSystem: '',
      previousActions: '',
      minutes: '',
      decisions: '',
      improvementActions: '',
      resourceNeeds: '',
      summary: '',
      status: 'PLANNED'
    });
  }

  private fetchReview(id: string) {
    this.loading.set(true);
    this.api.get<ReviewRecord>(`management-review/${id}`).subscribe({
      next: (review) => {
        this.loading.set(false);
        this.selectedReview.set(review);
        this.reviewForm.reset({
          title: review.title,
          reviewDate: review.reviewDate?.slice(0, 10) ?? '',
          chairpersonId: review.chairpersonId ?? '',
          agenda: review.agenda ?? '',
          auditResults: review.auditResults ?? '',
          capaStatus: review.capaStatus ?? '',
          kpiPerformance: review.kpiPerformance ?? '',
          risksOpportunities: review.risksOpportunities ?? '',
          changesAffectingSystem: review.changesAffectingSystem ?? '',
          previousActions: review.previousActions ?? '',
          minutes: review.minutes ?? '',
          decisions: review.decisions ?? '',
          improvementActions: review.improvementActions ?? '',
          resourceNeeds: review.resourceNeeds ?? '',
          summary: review.summary ?? '',
          status: review.status
        });
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Management review details could not be loaded.'));
      }
    });
  }

  private reload() {
    this.loading.set(true);
    this.api.get<ReviewRecord[]>('management-review').subscribe({
      next: (items) => {
        this.loading.set(false);
        this.reviews.set(items);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Management reviews could not be loaded.'));
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
