import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { I18nService } from '../core/i18n.service';
import { PageHeaderComponent } from '../shared/page-header.component';

type PageMode = 'list' | 'create' | 'detail' | 'edit';
type TrainingAssignmentStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED';

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type TrainingAssignment = {
  id: string;
  userId: string;
  dueDate?: string | null;
  completedAt?: string | null;
  status: TrainingAssignmentStatus;
  displayStatus: TrainingAssignmentStatus | 'OVERDUE';
  notes?: string | null;
  evidenceSummary?: string | null;
  user?: UserOption;
};

type TrainingRecord = {
  id: string;
  title: string;
  audience?: string | null;
  description?: string | null;
  ownerId?: string | null;
  deliveryMethod?: string | null;
  dueDate?: string | null;
  completion: number;
  assignments: TrainingAssignment[];
};

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="t('training.page.label')"
        [title]="pageTitle()"
        [description]="pageDescription()"
        [breadcrumbs]="breadcrumbs()"
      >
        <a *ngIf="mode() === 'list'" routerLink="/training/new" class="button-link">+ {{ t('training.actions.new') }}</a>
        <a *ngIf="mode() === 'detail' && selectedTraining()" [routerLink]="['/training', selectedTraining()?.id, 'edit']" class="button-link">{{ t('training.actions.edit') }}</a>
        <a *ngIf="mode() !== 'list'" routerLink="/training" class="button-link secondary">{{ t('training.actions.backToList') }}</a>
      </iso-page-header>

      <section *ngIf="mode() === 'list'" class="page-stack">
        <div class="card list-card">
          <div class="section-head">
            <div>
              <h3>{{ t('training.list.title') }}</h3>
              <p class="subtle">{{ t('training.list.copy') }}</p>
            </div>
          </div>

          <div class="empty-state" *ngIf="loading()">{{ t('training.list.loading') }}</div>
          <table class="data-table" *ngIf="!loading()">
            <thead>
              <tr>
                <th>{{ t('training.list.table.title') }}</th>
                <th>{{ t('training.list.table.method') }}</th>
                <th>{{ t('training.list.table.due') }}</th>
                <th>{{ t('training.list.table.completion') }}</th>
                <th>{{ t('training.list.table.followUp') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of trainings()" [routerLink]="['/training', item.id]">
                <td><strong>{{ item.title }}</strong></td>
                <td>{{ item.deliveryMethod || t('training.common.unspecified') }}</td>
                <td>{{ item.dueDate ? (item.dueDate | date:'yyyy-MM-dd') : t('training.common.open') }}</td>
                <td>{{ item.completion | number:'1.0-0' }}%</td>
                <td>{{ trainingFollowUpLabel(item) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section *ngIf="mode() === 'create' || mode() === 'edit'" class="page-stack">
        <form class="card form-card page-stack" [formGroup]="trainingForm" (ngSubmit)="saveTraining()">
          <div class="section-head">
            <div>
              <h3>{{ mode() === 'create' ? t('training.form.createTitle') : t('training.form.editTitle') }}</h3>
              <p class="subtle">{{ t('training.form.copy') }}</p>
            </div>
          </div>

          <p class="feedback" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <section class="guidance-card">
            <strong>{{ t('training.form.guidanceTitle') }}</strong>
            <p>{{ t('training.form.guidanceCopy') }}</p>
            <small>{{ t('training.form.guidanceNote') }}</small>
          </section>

          <label class="field"><span>{{ t('training.form.fields.title') }}</span><input formControlName="title" [placeholder]="t('training.form.placeholders.title')"></label>
          <div class="form-grid-2">
            <label class="field"><span>{{ t('training.form.fields.audience') }}</span><input formControlName="audience" [placeholder]="t('training.form.placeholders.audience')"></label>
            <label class="field"><span>{{ t('training.form.fields.deliveryMethod') }}</span><input formControlName="deliveryMethod" [placeholder]="t('training.form.placeholders.deliveryMethod')"></label>
          </div>
          <label class="field"><span>{{ t('training.form.fields.description') }}</span><textarea rows="3" formControlName="description" [placeholder]="t('training.form.placeholders.description')"></textarea></label>
          <div class="form-grid-2">
            <label class="field">
              <span>{{ t('training.form.fields.owner') }}</span>
              <select formControlName="ownerId">
                <option value="">{{ t('training.common.unassigned') }}</option>
                <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
              </select>
            </label>
            <label class="field"><span>{{ t('training.form.fields.dueDate') }}</span><input type="date" formControlName="dueDate"></label>
          </div>

          <div class="button-row">
            <button type="submit" [disabled]="trainingForm.invalid || saving()">{{ saving() ? t('training.actions.saving') : t('training.actions.save') }}</button>
            <a [routerLink]="selectedId() ? ['/training', selectedId()] : ['/training']" class="button-link secondary">{{ t('common.cancel') }}</a>
          </div>
        </form>

      </section>

      <section *ngIf="mode() === 'detail' && selectedTraining()" class="page-columns">
        <div class="page-stack">
          <section class="card detail-card">
            <div class="section-head">
              <div>
                <h3>{{ selectedTraining()?.title }}</h3>
                <p class="subtle">{{ selectedTraining()?.audience || t('training.detail.audienceNotSet') }}</p>
              </div>
              <span class="status-badge success">{{ selectedTraining()?.completion | number:'1.0-0' }}% {{ t('training.detail.completeSuffix') }}</span>
            </div>

            <section class="summary-strip top-space">
              <article class="summary-item">
                <span>{{ t('training.detail.summary.assigned') }}</span>
                <strong>{{ assignmentCount('ASSIGNED') }}</strong>
              </article>
              <article class="summary-item">
                <span>{{ t('training.detail.summary.inProgress') }}</span>
                <strong>{{ assignmentCount('IN_PROGRESS') }}</strong>
              </article>
              <article class="summary-item">
                <span>{{ t('training.detail.summary.completed') }}</span>
                <strong>{{ assignmentCount('COMPLETED') }}</strong>
              </article>
              <article class="summary-item">
                <span>{{ t('training.detail.summary.overdue') }}</span>
                <strong>{{ overdueAssignmentCount() }}</strong>
              </article>
            </section>

            <section class="guidance-card top-space">
              <strong>{{ trainingReadinessHeadline() }}</strong>
              <p>{{ trainingReadinessNarrative() }}</p>
              <small>{{ trainingReadinessHint() }}</small>
            </section>

            <dl class="key-value top-space">
              <dt>{{ t('training.detail.fields.description') }}</dt>
              <dd>{{ selectedTraining()?.description || t('training.detail.noDescription') }}</dd>
              <dt>{{ t('training.detail.fields.deliveryMethod') }}</dt>
              <dd>{{ selectedTraining()?.deliveryMethod || t('common.notSet') }}</dd>
              <dt>{{ t('training.detail.fields.dueDate') }}</dt>
              <dd>{{ selectedTraining()?.dueDate ? (selectedTraining()?.dueDate | date:'yyyy-MM-dd') : t('training.common.open') }}</dd>
            </dl>
          </section>

          <section class="card panel-card">
            <div class="section-head">
              <div>
                <h3>{{ t('training.assignments.title') }}</h3>
                <p class="subtle">{{ t('training.assignments.copy') }}</p>
              </div>
            </div>

            <form [formGroup]="assignmentForm" class="page-stack top-space" (ngSubmit)="addAssignment()">
              <div class="form-grid-3">
                <label class="field">
                  <span>{{ t('training.assignments.fields.user') }}</span>
                  <select formControlName="userId">
                    <option value="">{{ t('training.assignments.selectUser') }}</option>
                    <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
                  </select>
                </label>
                <label class="field"><span>{{ t('training.assignments.fields.dueDate') }}</span><input type="date" formControlName="dueDate"></label>
                <label class="field">
                  <span>{{ t('training.assignments.fields.status') }}</span>
                  <select formControlName="status">
                    <option value="ASSIGNED">{{ statusLabel('ASSIGNED') }}</option>
                    <option value="IN_PROGRESS">{{ statusLabel('IN_PROGRESS') }}</option>
                    <option value="COMPLETED">{{ statusLabel('COMPLETED') }}</option>
                  </select>
                </label>
              </div>
              <label class="field"><span>{{ t('training.assignments.fields.notes') }}</span><textarea rows="2" formControlName="notes" [placeholder]="t('training.assignments.placeholders.notes')"></textarea></label>
              <label class="field"><span>{{ t('training.assignments.fields.evidenceSummary') }}</span><textarea rows="2" formControlName="evidenceSummary" [placeholder]="t('training.assignments.placeholders.evidenceSummary')"></textarea></label>
              <p class="subtle form-note">{{ t('training.assignments.formNote') }}</p>
              <button type="submit" [disabled]="assignmentForm.invalid || saving()">{{ t('training.assignments.assignAction') }}</button>
            </form>

            <div class="entity-list top-space">
              <article class="entity-item" *ngFor="let assignment of selectedTraining()?.assignments || []">
                <div class="section-head">
                  <div>
                    <strong>{{ assignment.user?.firstName }} {{ assignment.user?.lastName }}</strong>
                    <small>{{ assignmentStatusLine(assignment) }}</small>
                  </div>
                  <button type="button" class="secondary" [disabled]="assignment.status === 'COMPLETED' || saving()" (click)="markAssignmentComplete(assignment)">
                    {{ assignment.status === 'COMPLETED' ? t('training.assignments.completedAction') : t('training.assignments.markComplete') }}
                  </button>
                </div>
                <p class="subtle">{{ assignment.evidenceSummary || assignment.notes || assignmentGuidance(assignment) }}</p>
              </article>
            </div>
          </section>
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
      color: #617165;
      line-height: 1.45;
    }

    .form-note {
      margin: 0;
    }
  `]
})
export class TrainingPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
  protected readonly trainings = signal<TrainingRecord[]>([]);
  protected readonly users = signal<UserOption[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selectedTraining = signal<TrainingRecord | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal((history.state?.notice as string) || '');
  protected readonly error = signal('');

  protected t(key: string, params?: Record<string, unknown>) {
    return this.i18n.t(key, params);
  }

  protected readonly trainingForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    audience: [''],
    description: [''],
    ownerId: [''],
    deliveryMethod: [''],
    dueDate: ['']
  });

  protected readonly assignmentForm = this.fb.nonNullable.group({
    userId: ['', Validators.required],
    dueDate: [''],
    status: ['ASSIGNED' as TrainingAssignmentStatus, Validators.required],
    notes: [''],
    evidenceSummary: ['']
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
      list: this.t('training.page.titles.list'),
      create: this.t('training.page.titles.create'),
      detail: this.selectedTraining()?.title || this.t('training.page.titles.detail'),
      edit: this.selectedTraining()?.title || this.t('training.page.titles.edit')
    }[this.mode()];
  }

  protected pageDescription() {
    return {
      list: this.t('training.page.descriptions.list'),
      create: this.t('training.page.descriptions.create'),
      detail: this.t('training.page.descriptions.detail'),
      edit: this.t('training.page.descriptions.edit')
    }[this.mode()];
  }

  protected breadcrumbs() {
    if (this.mode() === 'list') return [{ label: this.t('training.page.label') }];
    const base = [{ label: this.t('training.page.label'), link: '/training' }];
    if (this.mode() === 'create') return [...base, { label: this.t('training.breadcrumbs.new') }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedTraining()?.title || this.t('training.breadcrumbs.record'), link: `/training/${this.selectedId()}` }, { label: this.t('training.breadcrumbs.edit') }];
    return [...base, { label: this.selectedTraining()?.title || this.t('training.breadcrumbs.record') }];
  }

  protected saveTraining() {
    if (this.trainingForm.invalid) {
      this.error.set(this.t('training.messages.completeRequired'));
      return;
    }

    this.saving.set(true);
    this.message.set('');
    this.error.set('');
    const raw = this.trainingForm.getRawValue();
    const payload = {
      ...raw,
      title: raw.title.trim(),
      audience: raw.audience.trim() || undefined,
      description: raw.description.trim() || undefined,
      ownerId: raw.ownerId || undefined,
      deliveryMethod: raw.deliveryMethod.trim() || undefined,
      dueDate: raw.dueDate || undefined
    };

    const request = this.selectedId()
      ? this.api.patch<TrainingRecord>(`training/${this.selectedId()}`, payload)
      : this.api.post<TrainingRecord>('training', payload);

    request.subscribe({
      next: (training) => {
        this.saving.set(false);
        this.router.navigate(['/training', training.id], { state: { notice: this.t('training.messages.saved') } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, this.t('training.messages.saveFailed')));
      }
    });
  }

  protected addAssignment() {
    if (!this.selectedId() || this.assignmentForm.invalid) {
      return;
    }

    this.saving.set(true);
    const raw = this.assignmentForm.getRawValue();
    this.api.post(`training/${this.selectedId()}/assignments`, {
      ...raw,
      dueDate: raw.dueDate || undefined,
      notes: raw.notes.trim() || undefined,
      evidenceSummary: raw.evidenceSummary.trim() || undefined
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set(this.t('training.messages.assignmentAdded'));
        this.assignmentForm.reset({ userId: '', dueDate: '', status: 'ASSIGNED', notes: '', evidenceSummary: '' });
        this.fetchTraining(this.selectedId() as string);
        this.reload();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, this.t('training.messages.assignmentSaveFailed')));
      }
    });
  }

  protected markAssignmentComplete(assignment: TrainingAssignment) {
    this.saving.set(true);
    this.api.patch(`training/assignments/${assignment.id}`, {
      status: 'COMPLETED',
      evidenceSummary: assignment.evidenceSummary || assignment.notes || this.t('training.messages.completedAndVerified')
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set(this.t('training.messages.assignmentCompleted'));
        this.fetchTraining(this.selectedId() as string);
        this.reload();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, this.t('training.messages.assignmentUpdateFailed')));
      }
    });
  }

  protected trainingFollowUpLabel(training: TrainingRecord) {
    if (training.completion >= 100) {
      return this.t('training.followUp.complete');
    }
    if (training.assignments.some((assignment) => assignment.displayStatus === 'OVERDUE')) {
      return this.t('training.followUp.overdue');
    }
    if (training.assignments.some((assignment) => assignment.status === 'IN_PROGRESS')) {
      return this.t('training.followUp.evidenceInProgress');
    }
    if (training.assignments.length) {
      return this.t('training.followUp.assignmentsOpen');
    }
    return this.t('training.followUp.assignLearners');
  }

  protected assignmentCount(status: TrainingAssignmentStatus) {
    return (this.selectedTraining()?.assignments || []).filter((assignment) => assignment.status === status).length;
  }

  protected overdueAssignmentCount() {
    return (this.selectedTraining()?.assignments || []).filter((assignment) => assignment.displayStatus === 'OVERDUE').length;
  }

  protected trainingReadinessHeadline() {
    const training = this.selectedTraining();
    if (!training) {
      return this.t('training.readiness.headlineDefault');
    }
    if (training.completion >= 100) {
      return this.t('training.readiness.headlineComplete');
    }
    if (this.overdueAssignmentCount() > 0) {
      return this.t('training.readiness.headlineOverdue');
    }
    if (this.assignmentCount('IN_PROGRESS') > 0) {
      return this.t('training.readiness.headlineGathering');
    }
    return this.t('training.readiness.headlineAssigned');
  }

  protected trainingReadinessNarrative() {
    const training = this.selectedTraining();
    if (!training) {
      return this.t('training.readiness.narrativeDefault');
    }
    if (training.completion >= 100) {
      return this.t('training.readiness.narrativeComplete');
    }
    if (this.overdueAssignmentCount() > 0) {
      return this.t('training.readiness.narrativeOverdue');
    }
    if (this.assignmentCount('IN_PROGRESS') > 0) {
      return this.t('training.readiness.narrativeGathering');
    }
    return this.t('training.readiness.narrativeAssigned');
  }

  protected trainingReadinessHint() {
    const training = this.selectedTraining();
    if (!training) {
      return this.t('training.readiness.hintDefault');
    }
    if (training.completion >= 100) {
      return this.t('training.readiness.hintComplete');
    }
    if (this.overdueAssignmentCount() > 0) {
      return this.t('training.readiness.hintOverdue');
    }
    return this.t('training.readiness.hintAssigned');
  }

  protected assignmentGuidance(assignment: TrainingAssignment) {
    if (assignment.displayStatus === 'OVERDUE') {
      return this.t('training.assignmentGuidance.overdue');
    }
    if (assignment.status === 'COMPLETED') {
      return this.t('training.assignmentGuidance.completed');
    }
    if (assignment.status === 'IN_PROGRESS') {
      return this.t('training.assignmentGuidance.inProgress');
    }
    return this.t('training.assignmentGuidance.assigned');
  }

  protected statusLabel(status: TrainingAssignmentStatus | 'OVERDUE') {
    if (status === 'OVERDUE') {
      return this.t('training.status.OVERDUE');
    }
    return this.t(`training.status.${status}`);
  }

  protected assignmentStatusLine(assignment: TrainingAssignment) {
    const base = this.statusLabel(assignment.displayStatus);
    if (!assignment.dueDate) {
      return base;
    }
    return `${base} | ${this.t('training.assignments.duePrefix')} ${assignment.dueDate.slice(0, 10)}`;
  }

  private handleRoute(params: ParamMap) {
    const id = params.get('id');
    this.selectedId.set(id);
    this.message.set((history.state?.notice as string) || '');
    this.error.set('');

    if (this.mode() === 'list') {
      this.selectedTraining.set(null);
      this.resetForms();
      this.reload();
      return;
    }

    if (this.mode() === 'create') {
      this.selectedTraining.set(null);
      this.resetForms();
      return;
    }

    if (id) {
      this.fetchTraining(id);
    }
  }

  private resetForms() {
    this.trainingForm.reset({
      title: '',
      audience: '',
      description: '',
      ownerId: '',
      deliveryMethod: '',
      dueDate: ''
    });
    this.assignmentForm.reset({
      userId: '',
      dueDate: '',
      status: 'ASSIGNED',
      notes: '',
      evidenceSummary: ''
    });
  }

  private fetchTraining(id: string) {
    this.loading.set(true);
    this.api.get<TrainingRecord>(`training/${id}`).subscribe({
      next: (training) => {
        this.loading.set(false);
        this.selectedTraining.set(training);
        this.trainingForm.reset({
          title: training.title,
          audience: training.audience ?? '',
          description: training.description ?? '',
          ownerId: training.ownerId ?? '',
          deliveryMethod: training.deliveryMethod ?? '',
          dueDate: training.dueDate?.slice(0, 10) ?? ''
        });
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, this.t('training.messages.loadDetailsFailed')));
      }
    });
  }

  private reload() {
    this.loading.set(true);
    this.api.get<TrainingRecord[]>('training').subscribe({
      next: (items) => {
        this.loading.set(false);
        this.trainings.set(items);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, this.t('training.messages.loadListFailed')));
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
