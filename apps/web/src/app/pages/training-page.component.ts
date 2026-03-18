import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type TrainingAssignmentStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED';

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
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="page-grid">
      <div class="card header">
        <div>
          <span class="pill">Training</span>
          <h2>Courses, assignments, and completion evidence</h2>
          <p>Create training courses, assign them to users, track completion, and keep evidence notes by person.</p>
        </div>
      </div>

      <div class="workspace">
        <div class="card table-card">
          <div class="toolbar">
            <div>
              <strong>{{ trainings().length }} courses</strong>
              <p class="subtle">Completion reflects assignment status across users.</p>
            </div>
            <button type="button" class="ghost" (click)="resetForm()">New course</button>
          </div>

          <div class="table-state" *ngIf="loading()">Loading courses...</div>
          <table *ngIf="!loading()">
            <thead>
              <tr>
                <th>Title</th>
                <th>Method</th>
                <th>Due</th>
                <th>Completion</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of trainings()" (click)="select(item)" [class.selected]="item.id === selectedId()">
                <td>{{ item.title }}</td>
                <td>{{ item.deliveryMethod || 'Unspecified' }}</td>
                <td>{{ item.dueDate ? (item.dueDate | date:'yyyy-MM-dd') : 'Open' }}</td>
                <td>{{ item.completion | number:'1.0-0' }}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="side">
          <form class="card form-card" [formGroup]="trainingForm" (ngSubmit)="saveTraining()">
            <div class="toolbar">
              <div>
                <strong>{{ selectedId() ? 'Edit course' : 'Create course' }}</strong>
                <p class="subtle" *ngIf="selectedTraining()">Completion: {{ selectedTraining()?.completion | number:'1.0-0' }}%</p>
              </div>
              <span class="message" [class.error]="!!error()">{{ error() || message() }}</span>
            </div>

            <label><span>Title</span><input formControlName="title" placeholder="Internal auditor awareness"></label>
            <div class="inline">
              <label><span>Audience</span><input formControlName="audience" placeholder="Quality team"></label>
              <label><span>Delivery method</span><input formControlName="deliveryMethod" placeholder="Workshop"></label>
            </div>
            <label><span>Description</span><textarea rows="2" formControlName="description" placeholder="Course scope and expected competence"></textarea></label>
            <div class="inline">
              <label>
                <span>Course owner</span>
                <select formControlName="ownerId">
                  <option value="">Unassigned</option>
                  <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
                </select>
              </label>
              <label><span>Course due date</span><input type="date" formControlName="dueDate"></label>
            </div>
            <button type="submit" [disabled]="trainingForm.invalid || saving()">
              {{ saving() ? 'Saving...' : (selectedId() ? 'Save changes' : 'Create course') }}
            </button>
          </form>

          <section class="card nested-card" *ngIf="selectedTraining()">
            <div class="panel-title">Assignments</div>
            <form [formGroup]="assignmentForm" class="stack" (ngSubmit)="addAssignment()">
              <div class="inline">
                <select formControlName="userId">
                  <option value="">Select user</option>
                  <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
                </select>
                <input type="date" formControlName="dueDate">
                <select formControlName="status">
                  <option>ASSIGNED</option>
                  <option>IN_PROGRESS</option>
                  <option>COMPLETED</option>
                </select>
              </div>
              <textarea rows="2" formControlName="notes" placeholder="Assignment notes"></textarea>
              <textarea rows="2" formControlName="evidenceSummary" placeholder="Evidence or completion notes"></textarea>
              <button type="submit" [disabled]="assignmentForm.invalid || saving()">Assign training</button>
            </form>

            <ul class="list">
              <li *ngFor="let assignment of selectedTraining()?.assignments || []">
                <div>
                  <strong>{{ assignment.user?.firstName }} {{ assignment.user?.lastName }}</strong>
                  <p>{{ assignment.displayStatus }}{{ assignment.dueDate ? ' | due ' + assignment.dueDate.slice(0, 10) : '' }}</p>
                  <small>{{ assignment.evidenceSummary || assignment.notes || 'No notes' }}</small>
                </div>
                <button
                  type="button"
                  class="ghost"
                  [disabled]="assignment.status === 'COMPLETED' || saving()"
                  (click)="markAssignmentComplete(assignment)"
                >
                  {{ assignment.status === 'COMPLETED' ? 'Completed' : 'Mark complete' }}
                </button>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .header, .table-card, .form-card, .nested-card { padding: 1.2rem 1.3rem; }
    .header h2 { margin: 0.8rem 0 0.3rem; }
    .header p, .subtle, .message, .table-state, p, small { color: var(--muted); }
    .workspace { display: grid; grid-template-columns: 1.1fr 1fr; gap: 1rem; align-items: start; }
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
    .inline { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    label { display: grid; gap: 0.45rem; }
    input, select, textarea, button { border-radius: 14px; border: 1px solid var(--panel-border); padding: 0.8rem 0.9rem; }
    button { border: 0; background: var(--brand); color: white; font-weight: 700; }
    .ghost { background: rgba(40,89,67,0.1); color: var(--brand-strong); }
    .panel-title { font-weight: 700; }
    .list { list-style: none; padding: 0; margin: 1rem 0 0; display: grid; gap: 0.75rem; }
    .list li { border: 1px solid rgba(0,0,0,0.08); border-radius: 16px; padding: 0.85rem; display: flex; justify-content: space-between; gap: 1rem; align-items: start; }
    p, small { margin: 0.25rem 0 0; }
    @media (max-width: 1100px) { .workspace { grid-template-columns: 1fr; } }
    @media (max-width: 700px) { .inline { grid-template-columns: 1fr; } .list li { display: grid; } }
  `]
})
export class TrainingPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly trainings = signal<TrainingRecord[]>([]);
  protected readonly users = signal<UserOption[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selectedTraining = signal<TrainingRecord | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal('');
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
    this.reload();
  }

  select(item: TrainingRecord) {
    this.selectedId.set(item.id);
    this.fetchTraining(item.id);
  }

  resetForm() {
    this.selectedId.set(null);
    this.selectedTraining.set(null);
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
    this.message.set('');
    this.error.set('');
  }

  saveTraining() {
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
        this.message.set(this.selectedId() ? 'Training updated.' : 'Training created.');
        this.reload(() => this.select(training));
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Training save failed.'));
      }
    });
  }

  addAssignment() {
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

  markAssignmentComplete(assignment: TrainingAssignment) {
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

  private reload(after?: () => void) {
    this.loading.set(true);
    this.api.get<TrainingRecord[]>('training').subscribe({
      next: (items) => {
        this.loading.set(false);
        this.trainings.set(items);
        after?.();
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
