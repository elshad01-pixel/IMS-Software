import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { PageHeaderComponent } from '../shared/page-header.component';

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type ActionStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

type ActionRecord = {
  id: string;
  title: string;
  description?: string | null;
  ownerId?: string | null;
  dueDate?: string | null;
  status: ActionStatus;
  sourceType: string;
  sourceId: string;
  sourceLabel: string;
  sourceTitle: string;
  owner?: UserOption | null;
};

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PageHeaderComponent],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="'Actions'"
        [title]="'Global action tracker'"
        [description]="'Track follow-up from risks, CAPA, audits, and management review in one operational register.'"
        [breadcrumbs]="[{ label: 'Actions' }]"
      />

      <section class="page-stack">
        <div class="card list-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Register</span>
              <h3>Cross-module follow-up</h3>
              <p class="subtle">A single action view for owners, due dates, status, and source context.</p>
            </div>
          </div>

          <form class="toolbar top-space" [formGroup]="filtersForm" (ngSubmit)="reload()">
            <div class="filter-row">
              <label class="field">
                <span>Source</span>
                <select formControlName="sourceType">
                  <option value="">All sources</option>
                  <option value="risk">Risk</option>
                  <option value="capa">CAPA</option>
                  <option value="audit">Audit</option>
                  <option value="management-review">Management Review</option>
                </select>
              </label>
              <label class="field">
                <span>Status</span>
                <select formControlName="status">
                  <option value="">All statuses</option>
                  <option>OPEN</option>
                  <option>IN_PROGRESS</option>
                  <option>DONE</option>
                  <option>CANCELLED</option>
                </select>
              </label>
              <label class="field">
                <span>Owner</span>
                <select formControlName="ownerId">
                  <option value="">All owners</option>
                  <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
                </select>
              </label>
              <label class="field">
                <span>Due date</span>
                <select formControlName="dueState">
                  <option value="">All due dates</option>
                  <option value="overdue">Overdue</option>
                  <option value="upcoming">Upcoming</option>
                </select>
              </label>
            </div>

            <div class="button-row">
              <button type="submit" [disabled]="loading()">Apply filters</button>
            </div>
          </form>

          <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <div class="empty-state" *ngIf="loading()">
            <strong>Loading actions</strong>
            <span>Refreshing follow-up across the tenant.</span>
          </div>

          <div class="empty-state top-space" *ngIf="!loading() && !actions().length">
            <strong>No actions match the current filter</strong>
            <span>Create actions from CAPA, audits, management review, or risks to populate this tracker.</span>
          </div>

          <div class="data-table-wrap" *ngIf="!loading() && actions().length">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Source</th>
                  <th>Owner</th>
                  <th>Due date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let action of actions()">
                  <td>
                    <div class="table-title">
                      <strong>{{ action.title }}</strong>
                      <small>{{ action.description || 'No description' }}</small>
                    </div>
                  </td>
                  <td>
                    <div class="table-title">
                      <strong>{{ action.sourceLabel }}</strong>
                      <small>{{ action.sourceTitle }}</small>
                    </div>
                  </td>
                  <td>{{ action.owner ? action.owner.firstName + ' ' + action.owner.lastName : 'Unassigned' }}</td>
                  <td>{{ action.dueDate ? (action.dueDate | date:'yyyy-MM-dd') : 'Not set' }}</td>
                  <td>
                    <select [value]="action.status" (change)="updateStatus(action, readStatus($event))">
                      <option>OPEN</option>
                      <option>IN_PROGRESS</option>
                      <option>DONE</option>
                      <option>CANCELLED</option>
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </section>
  `
})
export class ActionsPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly users = signal<UserOption[]>([]);
  protected readonly actions = signal<ActionRecord[]>([]);
  protected readonly loading = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');

  protected readonly filtersForm = this.fb.nonNullable.group({
    sourceType: [''],
    status: [''],
    ownerId: [''],
    dueState: ['']
  });

  constructor() {
    this.api.get<UserOption[]>('users').subscribe((users) => this.users.set(users));
    this.reload();
  }

  protected reload() {
    this.loading.set(true);
    this.error.set('');
    const raw = this.filtersForm.getRawValue();
    const query = new URLSearchParams();
    if (raw.sourceType) query.set('sourceType', raw.sourceType);
    if (raw.status) query.set('status', raw.status);
    if (raw.ownerId) query.set('ownerId', raw.ownerId);
    if (raw.dueState) query.set('dueState', raw.dueState);

    this.api.get<ActionRecord[]>(`action-items${query.size ? `?${query.toString()}` : ''}`).subscribe({
      next: (actions) => {
        this.loading.set(false);
        this.actions.set(actions);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Actions could not be loaded.'));
      }
    });
  }

  protected updateStatus(action: ActionRecord, status: ActionStatus) {
    if (status === action.status) {
      return;
    }

    this.api.patch<ActionRecord>(`action-items/${action.id}`, { status }).subscribe({
      next: () => {
        this.message.set('Action status updated.');
        this.reload();
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(this.readError(error, 'Action status update failed.'));
      }
    });
  }

  protected readStatus(event: Event) {
    return (event.target as HTMLSelectElement).value as ActionStatus;
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}
