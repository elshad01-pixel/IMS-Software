import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
import { IconActionButtonComponent } from '../shared/icon-action-button.component';
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

type ReturnNavigation = {
  route: string[];
  label: string;
};

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PageHeaderComponent, RouterLink, IconActionButtonComponent],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="'Actions'"
        [title]="'Global action tracker'"
        [description]="'Track follow-up from risks, incidents, hazards, environmental aspects, obligations, CAPA, change management, provider reviews, audits, and management review in one operational register.'"
        [breadcrumbs]="[{ label: 'Actions' }]"
      >
        <a *ngIf="returnNavigation()" [routerLink]="returnNavigation()!.route" class="button-link secondary">Back to {{ returnNavigation()!.label }}</a>
      </iso-page-header>

      <section class="page-stack">
        <section class="card detail-card" *ngIf="focusedAction() as focused">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Focused action</span>
              <h3>{{ focused.title }}</h3>
              <p class="subtle">Review this linked action directly, then continue in the full tracker if needed.</p>
            </div>
            <div class="button-row">
              <a *ngIf="returnNavigation()" [routerLink]="returnNavigation()!.route" class="button-link secondary">Back to {{ returnNavigation()!.label }}</a>
              <button type="button" class="secondary" (click)="clearFocusedAction()">Back to all actions</button>
            </div>
          </div>

          <div class="summary-strip top-space">
            <article class="summary-item">
              <span>Status</span>
              <strong>{{ focused.status }}</strong>
            </article>
            <article class="summary-item">
              <span>Owner</span>
              <strong>{{ focused.owner ? focused.owner.firstName + ' ' + focused.owner.lastName : 'Unassigned' }}</strong>
            </article>
            <article class="summary-item">
              <span>Due date</span>
              <strong>{{ focused.dueDate ? (focused.dueDate | date:'yyyy-MM-dd') : 'Not set' }}</strong>
            </article>
          </div>

          <div class="section-grid-2 top-space">
            <section class="detail-section">
              <h4>Description</h4>
              <p>{{ focused.description || 'No description provided.' }}</p>
            </section>
            <section class="detail-section">
              <h4>Source</h4>
              <p>{{ focused.sourceLabel }} | {{ focused.sourceTitle }}</p>
              <div class="button-row top-space" *ngIf="sourceRoute(focused) as route">
                <a [routerLink]="route" class="button-link secondary">Open source record</a>
              </div>
            </section>
          </div>

          <div class="detail-section top-space">
            <h4>Update status</h4>
            <div class="button-row top-space">
              <select [value]="focused.status" [disabled]="!canWriteActions()" (change)="updateStatus(focused, readStatus($event))">
                <option>OPEN</option>
                <option>IN_PROGRESS</option>
                <option>DONE</option>
                <option>CANCELLED</option>
              </select>
            </div>
          </div>
        </section>

        <div class="card list-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Register</span>
              <h3>Cross-module follow-up</h3>
              <p class="subtle">A single action view for owners, due dates, status, and source context.</p>
            </div>
          </div>

          <section class="summary-strip top-space">
            <article class="summary-item">
              <span>Open</span>
              <strong>{{ countByStatus('OPEN') }}</strong>
            </article>
            <article class="summary-item">
              <span>In progress</span>
              <strong>{{ countByStatus('IN_PROGRESS') }}</strong>
            </article>
            <article class="summary-item">
              <span>Overdue</span>
              <strong>{{ overdueCount() }}</strong>
            </article>
            <article class="summary-item">
              <span>Done</span>
              <strong>{{ countByStatus('DONE') }}</strong>
            </article>
          </section>

          <section class="guidance-card top-space">
            <strong>{{ followUpHeadline() }}</strong>
            <p>{{ followUpNarrative() }}</p>
          </section>

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
                  <option value="incident">Incident / Near miss</option>
                  <option value="hazard">Hazard</option>
                  <option value="aspect">Environmental aspect</option>
                  <option value="obligation">Compliance obligation</option>
                  <option value="provider">External provider</option>
                  <option value="change-management">Change management</option>
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
                  <th *ngIf="canDeleteActions()">Admin</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let action of actions()" [class.focused-row]="focusedActionId() === action.id">
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
                      <small *ngIf="sourceRoute(action) as route">
                        <a [routerLink]="route" class="table-link">Open source record</a>
                      </small>
                    </div>
                  </td>
                  <td>{{ action.owner ? action.owner.firstName + ' ' + action.owner.lastName : 'Unassigned' }}</td>
                  <td>{{ action.dueDate ? (action.dueDate | date:'yyyy-MM-dd') : 'Not set' }}</td>
                  <td>
                    <select [value]="action.status" [disabled]="!canWriteActions()" (change)="updateStatus(action, readStatus($event))">
                      <option>OPEN</option>
                      <option>IN_PROGRESS</option>
                      <option>DONE</option>
                      <option>CANCELLED</option>
                    </select>
                  </td>
                  <td *ngIf="canDeleteActions()">
                    <iso-icon-action-button
                      [icon]="'delete'"
                      [label]="'Delete action'"
                      [variant]="'danger'"
                      [disabled]="action.status === 'DONE'"
                      (pressed)="deleteAction(action)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </section>
  `,
  styles: [`
    .guidance-card {
      padding: 1rem 1.1rem;
      border: 1px solid rgba(46, 67, 56, 0.1);
      border-radius: 1rem;
      background: rgba(252, 253, 250, 0.82);
    }

    .guidance-card strong,
    .guidance-card p {
      display: block;
    }

    .guidance-card p {
      margin-top: 0.4rem;
      color: var(--muted);
      line-height: 1.45;
    }

    .table-link {
      color: var(--brand-strong);
      font-weight: 700;
      text-decoration: none;
    }

    .table-link:hover {
      text-decoration: underline;
    }

    .focused-row {
      outline: 2px solid rgba(36, 79, 61, 0.22);
      outline-offset: -2px;
      background: rgba(36, 79, 61, 0.05);
    }

    .top-space {
      margin-top: 1rem;
    }
  `]
})
export class ActionsPageComponent {
  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly users = signal<UserOption[]>([]);
  protected readonly actions = signal<ActionRecord[]>([]);
  protected readonly loading = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly focusedActionId = signal<string | null>(null);
  protected readonly focusedAction = computed(() => this.actions().find((action) => action.id === this.focusedActionId()) ?? null);
  protected readonly returnNavigation = signal<ReturnNavigation | null>(null);
  protected readonly sourceTypeLabels = computed(() => ({
    risk: 'Risk',
    capa: 'CAPA',
    audit: 'Audit',
    'management-review': 'Management Review',
    ncr: 'NCR',
    incident: 'Incident',
    hazard: 'Hazard',
    aspect: 'Environmental Aspect',
    obligation: 'Compliance Obligation',
    provider: 'External Provider',
    'change-management': 'Change Management',
    document: 'Document',
    context: 'Context issue'
  }));

  protected readonly filtersForm = this.fb.nonNullable.group({
    sourceType: [''],
    status: [''],
    ownerId: [''],
    dueState: ['']
  });

  constructor() {
    this.api.get<UserOption[]>('users').subscribe((users) => this.users.set(users));
    this.route.queryParamMap.subscribe((params) => {
      this.focusedActionId.set(params.get('focusActionId'));
      this.returnNavigation.set((history.state?.returnNavigation as ReturnNavigation | undefined) ?? null);
    });
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
    if (!this.canWriteActions()) {
      this.error.set('You do not have permission to update actions.');
      return;
    }

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

  protected countByStatus(status: ActionStatus) {
    return this.actions().filter((action) => action.status === status).length;
  }

  protected overdueCount() {
    return this.actions().filter((action) => this.isOverdueRecord(action)).length;
  }

  protected followUpHeadline() {
    if (this.overdueCount() > 0) {
      return 'Some follow-up is overdue';
    }
    if (this.countByStatus('OPEN') > 0 || this.countByStatus('IN_PROGRESS') > 0) {
      return 'Follow-up is active across the system';
    }
    return 'Follow-up is currently under control';
  }

  protected followUpNarrative() {
    if (this.overdueCount() > 0) {
      return 'Use the overdue actions as the first management attention point. They represent follow-up that has already missed the committed due date.';
    }
    if (this.countByStatus('OPEN') > 0 || this.countByStatus('IN_PROGRESS') > 0) {
      return 'Open and in-progress actions are visible here across risks, incidents, hazards, environmental aspects, obligations, provider reviews, change management, audits, CAPA, and management review so ownership stays clear.';
    }
    return 'Current action records are either complete or not yet requiring additional intervention.';
  }

  protected canDeleteActions() {
    return this.authStore.hasPermission('admin.delete');
  }

  protected canWriteActions() {
    return this.authStore.hasPermission('action-items.write');
  }

  protected deleteAction(action: ActionRecord) {
    if (!this.canDeleteActions() || action.status === 'DONE') {
      return;
    }

    if (!window.confirm(`Delete action "${action.title}"? Completed actions are protected.`)) {
      return;
    }

    this.api.delete(`action-items/${action.id}`).subscribe({
      next: () => {
        this.message.set('Action deleted.');
        this.reload();
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(this.readError(error, 'Action deletion failed.'));
      }
    });
  }

  protected readStatus(event: Event) {
    return (event.target as HTMLSelectElement).value as ActionStatus;
  }

  protected sourceRoute(action: ActionRecord) {
    switch (action.sourceType) {
      case 'risk':
        return ['/risks', action.sourceId];
      case 'capa':
        return ['/capa', action.sourceId];
      case 'audit':
        return ['/audits', action.sourceId];
      case 'management-review':
        return ['/management-review', action.sourceId];
      case 'ncr':
        return ['/ncr', action.sourceId];
      case 'incident':
        return ['/incidents', action.sourceId];
      case 'hazard':
        return ['/hazards', action.sourceId];
      case 'aspect':
        return ['/environmental-aspects', action.sourceId];
      case 'obligation':
        return ['/compliance-obligations', action.sourceId];
      case 'provider':
        return ['/external-providers', action.sourceId];
      case 'change-management':
        return ['/change-management', action.sourceId];
      case 'document':
        return ['/documents', action.sourceId];
      default:
        return null;
    }
  }

  protected clearFocusedAction() {
    void this.router.navigate(['/actions']);
  }

  private isOverdueRecord(action: ActionRecord) {
    if (!action.dueDate || action.status === 'DONE' || action.status === 'CANCELLED') {
      return false;
    }
    return new Date(action.dueDate) < new Date();
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}
