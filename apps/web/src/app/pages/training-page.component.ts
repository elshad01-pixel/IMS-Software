import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
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
        [label]="'Training'"
        [title]="pageTitle()"
        [description]="pageDescription()"
        [breadcrumbs]="breadcrumbs()"
      >
        <a *ngIf="mode() === 'list'" routerLink="/training/new" class="button-link">+ New course</a>
        <a *ngIf="mode() === 'detail' && selectedTraining()" [routerLink]="['/training', selectedTraining()?.id, 'edit']" class="button-link">Edit course</a>
        <a *ngIf="mode() !== 'list'" routerLink="/training" class="button-link secondary">Back to training</a>
      </iso-page-header>

      <section *ngIf="mode() === 'list'" class="page-stack">
        <div class="card list-card">
          <div class="section-head">
            <div>
              <h3>Training courses</h3>
              <p class="subtle">A focused list of courses with delivery method, due date, and overall completion.</p>
            </div>
          </div>

          <div class="empty-state" *ngIf="loading()">Loading courses...</div>
          <table class="data-table" *ngIf="!loading()">
            <thead>
              <tr>
                <th>Title</th>
                <th>Method</th>
                <th>Due</th>
                <th>Completion</th>
                <th>Follow-up</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of trainings()" [routerLink]="['/training', item.id]">
                <td><strong>{{ item.title }}</strong></td>
                <td>{{ item.deliveryMethod || 'Unspecified' }}</td>
                <td>{{ item.dueDate ? (item.dueDate | date:'yyyy-MM-dd') : 'Open' }}</td>
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
              <h3>{{ mode() === 'create' ? 'Create course' : 'Edit course' }}</h3>
              <p class="subtle">Keep the course definition separate from assignments and completion evidence.</p>
            </div>
          </div>

          <p class="feedback" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <section class="guidance-card">
            <strong>Competence planning</strong>
            <p>Define the expected audience, delivery method, and due date so the course can be assigned and later evidenced as completed.</p>
            <small>Training becomes audit-ready when assignment records clearly show due date, completion status, and evidence summary by person.</small>
          </section>

          <label class="field"><span>Title</span><input formControlName="title" placeholder="Internal auditor awareness"></label>
          <div class="form-grid-2">
            <label class="field"><span>Audience</span><input formControlName="audience" placeholder="Quality team"></label>
            <label class="field"><span>Delivery method</span><input formControlName="deliveryMethod" placeholder="Workshop"></label>
          </div>
          <label class="field"><span>Description</span><textarea rows="3" formControlName="description" placeholder="Course scope and expected competence"></textarea></label>
          <div class="form-grid-2">
            <label class="field">
              <span>Course owner</span>
              <select formControlName="ownerId">
                <option value="">Unassigned</option>
                <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
              </select>
            </label>
            <label class="field"><span>Course due date</span><input type="date" formControlName="dueDate"></label>
          </div>

          <div class="button-row">
            <button type="submit" [disabled]="trainingForm.invalid || saving()">{{ saving() ? 'Saving...' : 'Save course' }}</button>
            <a [routerLink]="selectedId() ? ['/training', selectedId()] : ['/training']" class="button-link secondary">Cancel</a>
          </div>
        </form>

      </section>

      <section *ngIf="mode() === 'detail' && selectedTraining()" class="page-columns">
        <div class="page-stack">
          <section class="card detail-card">
            <div class="section-head">
              <div>
                <h3>{{ selectedTraining()?.title }}</h3>
                <p class="subtle">{{ selectedTraining()?.audience || 'Audience not set' }}</p>
              </div>
              <span class="status-badge success">{{ selectedTraining()?.completion | number:'1.0-0' }}% complete</span>
            </div>

            <section class="summary-strip top-space">
              <article class="summary-item">
                <span>Assigned</span>
                <strong>{{ assignmentCount('ASSIGNED') }}</strong>
              </article>
              <article class="summary-item">
                <span>In progress</span>
                <strong>{{ assignmentCount('IN_PROGRESS') }}</strong>
              </article>
              <article class="summary-item">
                <span>Completed</span>
                <strong>{{ assignmentCount('COMPLETED') }}</strong>
              </article>
              <article class="summary-item">
                <span>Overdue</span>
                <strong>{{ overdueAssignmentCount() }}</strong>
              </article>
            </section>

            <section class="guidance-card top-space">
              <strong>{{ trainingReadinessHeadline() }}</strong>
              <p>{{ trainingReadinessNarrative() }}</p>
              <small>{{ trainingReadinessHint() }}</small>
            </section>

            <dl class="key-value top-space">
              <dt>Description</dt>
              <dd>{{ selectedTraining()?.description || 'No description provided.' }}</dd>
              <dt>Delivery method</dt>
              <dd>{{ selectedTraining()?.deliveryMethod || 'Not set' }}</dd>
              <dt>Due date</dt>
              <dd>{{ selectedTraining()?.dueDate ? (selectedTraining()?.dueDate | date:'yyyy-MM-dd') : 'Open' }}</dd>
            </dl>
          </section>

          <section class="card panel-card">
            <div class="section-head">
              <div>
                <h3>Assignments</h3>
                <p class="subtle">Assign training, track completion, and keep evidence of competence by user.</p>
              </div>
            </div>

            <form [formGroup]="assignmentForm" class="page-stack top-space" (ngSubmit)="addAssignment()">
              <div class="form-grid-3">
                <label class="field">
                  <span>User</span>
                  <select formControlName="userId">
                    <option value="">Select user</option>
                    <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
                  </select>
                </label>
                <label class="field"><span>Due date</span><input type="date" formControlName="dueDate"></label>
                <label class="field">
                  <span>Status</span>
                  <select formControlName="status">
                    <option>ASSIGNED</option>
                    <option>IN_PROGRESS</option>
                    <option>COMPLETED</option>
                  </select>
                </label>
              </div>
              <label class="field"><span>Notes</span><textarea rows="2" formControlName="notes" placeholder="Assignment notes"></textarea></label>
              <label class="field"><span>Evidence summary</span><textarea rows="2" formControlName="evidenceSummary" placeholder="Completion evidence or notes"></textarea></label>
              <p class="subtle form-note">When an assignment is marked complete, the evidence summary should explain what demonstrated competence: attendance, test result, observation, or signed record.</p>
              <button type="submit" [disabled]="assignmentForm.invalid || saving()">Assign training</button>
            </form>

            <div class="entity-list top-space">
              <article class="entity-item" *ngFor="let assignment of selectedTraining()?.assignments || []">
                <div class="section-head">
                  <div>
                    <strong>{{ assignment.user?.firstName }} {{ assignment.user?.lastName }}</strong>
                    <small>{{ assignment.displayStatus }}{{ assignment.dueDate ? ' | due ' + assignment.dueDate.slice(0, 10) : '' }}</small>
                  </div>
                  <button type="button" class="secondary" [disabled]="assignment.status === 'COMPLETED' || saving()" (click)="markAssignmentComplete(assignment)">
                    {{ assignment.status === 'COMPLETED' ? 'Completed' : 'Mark complete' }}
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
      list: 'Training courses',
      create: 'Create training course',
      detail: this.selectedTraining()?.title || 'Training detail',
      edit: this.selectedTraining()?.title || 'Edit training course'
    }[this.mode()];
  }

  protected pageDescription() {
    return {
      list: 'A focused training list for course setup, due dates, and completion progress.',
      create: 'Create a course in a dedicated page instead of mixing course setup with assignments.',
      detail: 'Review assignments, completion, and evidence in one clean course detail page.',
      edit: 'Update the course definition without the noise of assignment management.'
    }[this.mode()];
  }

  protected breadcrumbs() {
    if (this.mode() === 'list') return [{ label: 'Training' }];
    const base = [{ label: 'Training', link: '/training' }];
    if (this.mode() === 'create') return [...base, { label: 'New course' }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedTraining()?.title || 'Course', link: `/training/${this.selectedId()}` }, { label: 'Edit' }];
    return [...base, { label: this.selectedTraining()?.title || 'Course' }];
  }

  protected saveTraining() {
    if (this.trainingForm.invalid) {
      this.error.set('Complete the required training fields.');
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
        this.router.navigate(['/training', training.id], { state: { notice: 'Training course saved successfully.' } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Training save failed.'));
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
        this.message.set('Training assignment added.');
        this.assignmentForm.reset({ userId: '', dueDate: '', status: 'ASSIGNED', notes: '', evidenceSummary: '' });
        this.fetchTraining(this.selectedId() as string);
        this.reload();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Training assignment save failed.'));
      }
    });
  }

  protected markAssignmentComplete(assignment: TrainingAssignment) {
    this.saving.set(true);
    this.api.patch(`training/assignments/${assignment.id}`, {
      status: 'COMPLETED',
      evidenceSummary: assignment.evidenceSummary || assignment.notes || 'Completed and verified'
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('Training assignment completed.');
        this.fetchTraining(this.selectedId() as string);
        this.reload();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Training assignment update failed.'));
      }
    });
  }

  protected trainingFollowUpLabel(training: TrainingRecord) {
    if (training.completion >= 100) {
      return 'Complete';
    }
    if (training.assignments.some((assignment) => assignment.displayStatus === 'OVERDUE')) {
      return 'Overdue follow-up';
    }
    if (training.assignments.some((assignment) => assignment.status === 'IN_PROGRESS')) {
      return 'Evidence in progress';
    }
    if (training.assignments.length) {
      return 'Assignments open';
    }
    return 'Assign learners';
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
      return 'Training follow-up';
    }
    if (training.completion >= 100) {
      return 'Training completion is evidenced';
    }
    if (this.overdueAssignmentCount() > 0) {
      return 'Training follow-up is overdue';
    }
    if (this.assignmentCount('IN_PROGRESS') > 0) {
      return 'Competence evidence is still being gathered';
    }
    return 'Assignments are in place';
  }

  protected trainingReadinessNarrative() {
    const training = this.selectedTraining();
    if (!training) {
      return 'Assignments and evidence will appear once the course is saved.';
    }
    if (training.completion >= 100) {
      return 'All current assignments are complete. Keep the evidence summaries clear enough to demonstrate competence during review or audit.';
    }
    if (this.overdueAssignmentCount() > 0) {
      return 'At least one learner is past due. Management follow-up should confirm whether the course is delayed, reassigned, or needs additional support.';
    }
    if (this.assignmentCount('IN_PROGRESS') > 0) {
      return 'Learners are progressing through the course, but the record still needs completion evidence before competence can be treated as verified.';
    }
    return 'The course is defined, but ongoing evidence depends on assigning people and maintaining assignment updates.';
  }

  protected trainingReadinessHint() {
    const training = this.selectedTraining();
    if (!training) {
      return 'Save the course first, then assign people and record their evidence of completion.';
    }
    if (training.completion >= 100) {
      return 'Next step: keep refresher timing and reassignment under control if this competence needs periodic renewal.';
    }
    if (this.overdueAssignmentCount() > 0) {
      return 'Next step: review the overdue learners and update due dates or status before the record falls behind further.';
    }
    return 'Next step: keep assignment notes and evidence summaries current so auditors can see how competence was confirmed.';
  }

  protected assignmentGuidance(assignment: TrainingAssignment) {
    if (assignment.displayStatus === 'OVERDUE') {
      return 'Assignment is overdue. Update the learner status or due date and record the current follow-up.';
    }
    if (assignment.status === 'COMPLETED') {
      return 'Completion should be supported by a short evidence summary.';
    }
    if (assignment.status === 'IN_PROGRESS') {
      return 'Record how the learner is progressing and what evidence is still expected.';
    }
    return 'Assignment created. Add evidence once the learner completes the course.';
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
        this.error.set(this.readError(error, 'Training details could not be loaded.'));
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
        this.error.set(this.readError(error, 'Training courses could not be loaded.'));
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
