import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type ActionItem = {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  status: string;
  owner?: UserOption | null;
};

type ReturnNavigation = {
  route: string[];
  label: string;
};

@Component({
  selector: 'iso-record-work-items',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page-grid" *ngIf="sourceId; else emptyState">
      <div class="card panel">
        <div class="panel-head">
          <div>
            <span class="pill">{{ sectionEyebrow() }}</span>
            <h3>Actions</h3>
            <p>{{ panelDescription() }}</p>
          </div>
        </div>

        <div class="panel-state" *ngIf="actionsLoading()">Loading action items...</div>
        <div class="actions-section top-space">
          <div class="section-copy">
            <strong>{{ existingActionsTitle() }}</strong>
            <small>{{ existingActionsDescription() }}</small>
          </div>
        </div>

        <div class="empty-state top-space" *ngIf="!actionsLoading() && !actionItems().length">
          <strong>{{ emptyStateTitle() }}</strong>
          <span>{{ emptyStateDescription() }}</span>
        </div>

        <ul class="list" *ngIf="!actionsLoading() && actionItems().length">
          <li *ngFor="let item of actionItems()">
            <div class="list-copy">
              <strong>{{ item.title }}</strong>
              <p>{{ item.description || 'No description' }}</p>
              <small [class.overdue]="isOverdue(item)">
                {{ item.status }}
                {{ item.owner ? ' | ' + item.owner.firstName + ' ' + item.owner.lastName : '' }}
                {{ item.dueDate ? ' | due ' + item.dueDate.slice(0, 10) : '' }}
                {{ isOverdue(item) ? ' | overdue' : '' }}
              </small>
              <a [routerLink]="['/actions']" [queryParams]="{ focusActionId: item.id }" [state]="actionLinkState()" class="table-link action-link">Open in action tracker</a>
            </div>
            <div class="button-row compact-row">
              <button
                type="button"
                class="ghost"
                (click)="completeActionItem(item.id)"
                [disabled]="item.status === 'DONE' || actionsSaving() || !canWriteActions()"
              >
                {{ item.status === 'DONE' ? 'Done' : 'Complete' }}
              </button>
            </div>
          </li>
        </ul>

        <div class="actions-toolbar top-space">
          <button type="button" class="secondary reveal-button" [disabled]="!canWriteActions()" (click)="toggleComposer()">
            {{ composerOpen() ? 'Hide form' : addButtonLabel() }}
          </button>
        </div>

        <div class="actions-section form-section top-space" *ngIf="composerOpen() && canWriteActions()">
          <div class="section-copy">
            <strong>{{ createActionTitle() }}</strong>
            <small>{{ createActionDescription() }}</small>
          </div>

          <form [formGroup]="actionForm" (ngSubmit)="createActionItem()" class="stack">
            <label>
              <span>Title</span>
              <input formControlName="title" [placeholder]="titlePlaceholder()">
            </label>
            <label>
              <span>Description</span>
              <textarea formControlName="description" rows="3" [placeholder]="descriptionPlaceholder()"></textarea>
            </label>
            <div class="inline">
              <label>
                <span>Owner</span>
                <select formControlName="ownerId">
                  <option value="">Unassigned</option>
                  <option *ngFor="let user of users()" [value]="user.id">
                    {{ user.firstName }} {{ user.lastName }}
                  </option>
                </select>
              </label>
              <label>
                <span>Due date</span>
                <input formControlName="dueDate" type="date">
              </label>
            </div>
            <button type="submit" [disabled]="actionForm.invalid || actionsSaving() || !canWriteActions()">
              {{ actionsSaving() ? savingLabel() : submitLabel() }}
            </button>
            <p class="feedback" [class.is-empty]="!actionsError() && !actionsMessage()" [class.error]="actionsError()" [class.success]="actionsMessage() && !actionsError()">
              {{ actionsError() || actionsMessage() }}
            </p>
          </form>
        </div>
        <div class="empty-state top-space compact-write-state" *ngIf="!canWriteActions()">
          <strong>Read-only actions</strong>
          <span>You can review linked actions here, but creating or completing actions requires action write access.</span>
        </div>
      </div>
    </section>

    <ng-template #emptyState>
      <section class="card empty">
        <span class="pill">Actions</span>
        <p>Save the record first to review or assign linked actions.</p>
      </section>
    </ng-template>
  `,
  styles: [`
    .panel,
    .empty {
      padding: 1.2rem;
    }

    .panel {
      box-shadow: var(--shadow-soft);
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(246, 248, 244, 0.9));
    }

    .panel-head h3 {
      margin: 0.8rem 0 0;
    }

    .panel-head p,
    .empty p,
    label span,
    .feedback {
      color: var(--muted);
    }

    .stack {
      display: grid;
      gap: 0.7rem;
      margin-top: 0.85rem;
    }

    .inline {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.7rem;
    }

    label {
      display: grid;
      gap: 0.35rem;
    }

    input,
    textarea,
    select,
    button {
      border-radius: 14px;
      border: 1px solid var(--panel-border);
      padding: 0.8rem 0.9rem;
    }

    button {
      border: 0;
      background: var(--brand);
      color: white;
      font-weight: 700;
    }

    .ghost {
      background: rgba(40, 89, 67, 0.1);
      color: var(--brand-strong);
    }

    .list {
      list-style: none;
      padding: 0;
      margin: 1rem 0 0;
      display: grid;
      gap: 0.7rem;
    }

    .list li {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      border: 1px solid rgba(23, 50, 37, 0.08);
      border-radius: 18px;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.86);
    }

    .list p {
      margin: 0.3rem 0;
      color: var(--muted);
    }

    .list-copy {
      display: grid;
      gap: 0.15rem;
    }

    small,
    .panel-state {
      color: var(--muted);
    }

    .feedback {
      font-size: 0.92rem;
    }

    .table-link {
      color: var(--brand-strong);
      font-weight: 700;
      text-decoration: none;
    }

    .table-link:hover {
      text-decoration: underline;
    }

    .action-link {
      margin-top: 0.15rem;
      font-size: 0.92rem;
    }

    .actions-section {
      display: grid;
      gap: 0.45rem;
    }

    .section-copy {
      display: grid;
      gap: 0.18rem;
    }

    .section-copy strong {
      font-size: 0.96rem;
      color: var(--text-soft);
    }

    .section-copy small {
      color: var(--muted);
      line-height: 1.45;
    }

    .actions-toolbar {
      display: flex;
      justify-content: flex-start;
    }

    .reveal-button {
      min-height: auto;
      padding: 0.72rem 0.95rem;
    }

    .form-section {
      padding-top: 1rem;
      border-top: 1px solid rgba(23, 50, 37, 0.08);
    }

    .overdue {
      color: var(--danger);
      font-weight: 700;
    }

    @media (max-width: 700px) {
      .inline {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class RecordWorkItemsComponent implements OnChanges {
  @Input() sourceType!: string;
  @Input() sourceId: string | null = null;
  @Input() draftTitle: string | null = null;
  @Input() draftDescription: string | null = null;
  @Input() returnNavigation: ReturnNavigation | null = null;

  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);

  protected readonly users = signal<UserOption[]>([]);
  protected readonly actionItems = signal<ActionItem[]>([]);
  protected readonly actionsLoading = signal(false);
  protected readonly actionsSaving = signal(false);
  protected readonly actionsMessage = signal('');
  protected readonly actionsError = signal('');
  protected readonly composerOpen = signal(false);

  protected readonly actionForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: [''],
    ownerId: [''],
    dueDate: ['']
  });

  constructor() {
    this.api
      .get<UserOption[]>('users')
      .subscribe((users) => this.users.set(users.filter((user) => !!user.id)));
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['sourceId'] || changes['sourceType']) && this.sourceId) {
      this.composerOpen.set(false);
      this.reloadActions();
    }

    if (changes['draftTitle'] || changes['draftDescription']) {
      this.actionForm.patchValue({
        title: this.draftTitle || this.actionForm.getRawValue().title,
        description: this.draftDescription ?? this.actionForm.getRawValue().description
      }, { emitEvent: false });
    }
  }

  createActionItem() {
    if (!this.sourceId || this.actionForm.invalid || !this.canWriteActions()) {
      return;
    }

    this.actionsSaving.set(true);
    this.actionsMessage.set('');
    this.actionsError.set('');

    this.api
      .post<ActionItem>('action-items', {
        sourceType: this.sourceType,
        sourceId: this.sourceId,
        ...this.actionForm.getRawValue()
      })
      .subscribe({
        next: () => {
          this.actionsSaving.set(false);
          this.actionsMessage.set('Action item added.');
          this.actionForm.reset({ title: '', description: '', ownerId: '', dueDate: '' });
          this.composerOpen.set(false);
          this.reloadActions();
        },
        error: (error: HttpErrorResponse) => {
          this.actionsSaving.set(false);
          this.actionsError.set(this.readError(error, 'Action item save failed.'));
        }
      });
  }

  completeActionItem(id: string) {
    if (!this.canWriteActions()) {
      this.actionsError.set('You do not have permission to update actions.');
      return;
    }

    this.actionsSaving.set(true);
    this.actionsMessage.set('');
    this.actionsError.set('');

    this.api.patch(`action-items/${id}/complete`, {}).subscribe({
      next: () => {
        this.actionsSaving.set(false);
        this.actionsMessage.set('Action item completed.');
        this.reloadActions();
      },
      error: (error: HttpErrorResponse) => {
        this.actionsSaving.set(false);
        this.actionsError.set(this.readError(error, 'Action item update failed.'));
      }
    });
  }

  private reloadActions() {
    if (!this.sourceId) {
      this.actionItems.set([]);
      return;
    }

    this.actionsLoading.set(true);
    this.api
      .get<ActionItem[]>(`action-items?sourceType=${this.sourceType}&sourceId=${this.sourceId}`)
      .subscribe({
        next: (items) => {
          this.actionsLoading.set(false);
          this.actionItems.set(items);
        },
        error: (error: HttpErrorResponse) => {
          this.actionsLoading.set(false);
          this.actionsError.set(this.readError(error, 'Action items could not be loaded.'));
        }
      });
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    return (error.error?.message as string) || fallback;
  }

  protected toggleComposer() {
    if (!this.canWriteActions()) {
      return;
    }

    this.composerOpen.set(!this.composerOpen());
  }

  protected canWriteActions() {
    return this.authStore.hasPermission('action-items.write');
  }

  protected sectionEyebrow() {
    return this.sourceType === 'ncr' ? 'Resolution workflow' : 'Linked actions';
  }

  protected panelDescription() {
    return this.sourceType === 'ncr'
      ? 'Actions assigned to resolve this nonconformance'
      : 'Track linked actions, ownership, due dates, and completion status for this record.';
  }

  protected existingActionsTitle() {
    return this.sourceType === 'ncr' ? 'Assigned actions' : 'Existing actions';
  }

  protected existingActionsDescription() {
    return this.sourceType === 'ncr'
      ? 'Review the actions already linked to this nonconformance before adding new ones.'
      : 'Review the current follow-up already linked to this record.';
  }

  protected emptyStateTitle() {
    return this.sourceType === 'ncr' ? 'No corrective actions yet' : 'No action items yet';
  }

  protected emptyStateDescription() {
    return this.sourceType === 'ncr'
      ? 'Add the first corrective action when ownership and due dates are ready.'
      : 'Create ownership and due dates for the next meaningful step.';
  }

  protected createActionTitle() {
    if (this.sourceType === 'ncr') return 'Add corrective action';
    if (this.sourceType === 'risk') return 'Create action';
    return 'Add action';
  }

  protected createActionDescription() {
    if (this.sourceType === 'ncr') {
      return 'Use this only when a new action is needed to resolve the NCR.';
    }
    if (this.sourceType === 'risk') {
      return 'Create a mitigation action directly from this record when ownership and due dates are ready.';
    }
    return 'Create another linked action for this record only when additional follow-up is needed.';
  }

  protected titlePlaceholder() {
    if (this.sourceType === 'ncr') return 'Update procedure and retrain team';
    if (this.sourceType === 'risk') return 'Implement secondary supplier control';
    return 'Close evidence gap';
  }

  protected descriptionPlaceholder() {
    return this.sourceType === 'ncr' ? 'Describe the corrective step required to resolve the NCR' : 'Action details';
  }

  protected submitLabel() {
    if (this.sourceType === 'ncr') return 'Add Corrective Action';
    if (this.sourceType === 'risk') return 'Create Action';
    return 'Add Action';
  }

  protected savingLabel() {
    if (this.sourceType === 'ncr') return 'Saving corrective action...';
    if (this.sourceType === 'risk') return 'Saving action...';
    return 'Saving action...';
  }

  protected addButtonLabel() {
    if (this.sourceType === 'ncr') return 'Add Corrective Action';
    if (this.sourceType === 'risk') return 'Create Action';
    return 'Add Action';
  }

  protected actionLinkState() {
    return this.returnNavigation ? { returnNavigation: this.returnNavigation } : undefined;
  }

  protected isOverdue(item: ActionItem) {
    if (!item.dueDate || item.status === 'DONE' || item.status === 'CANCELLED') {
      return false;
    }
    return new Date(item.dueDate) < new Date();
  }
}
