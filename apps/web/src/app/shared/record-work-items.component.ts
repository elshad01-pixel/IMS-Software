import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';

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

@Component({
  selector: 'iso-record-work-items',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="page-grid" *ngIf="sourceId; else emptyState">
      <div class="card panel">
        <div class="panel-head">
          <div>
            <span class="pill">Action Items</span>
            <h3>Follow-up</h3>
            <p>Assign real treatment and closure work with ownership and due dates.</p>
          </div>
        </div>

        <form [formGroup]="actionForm" (ngSubmit)="createActionItem()" class="stack">
          <label>
            <span>Title</span>
            <input formControlName="title" placeholder="Close evidence gap">
          </label>
          <label>
            <span>Description</span>
            <textarea formControlName="description" rows="3" placeholder="Action details"></textarea>
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
          <button type="submit" [disabled]="actionForm.invalid || actionsSaving()">
            {{ actionsSaving() ? 'Saving action...' : 'Add action item' }}
          </button>
          <p class="feedback" [class.error]="actionsError()">{{ actionsError() || actionsMessage() }}</p>
        </form>

        <div class="panel-state" *ngIf="actionsLoading()">Loading action items...</div>
        <ul class="list" *ngIf="!actionsLoading()">
          <li *ngFor="let item of actionItems()">
            <div>
              <strong>{{ item.title }}</strong>
              <p>{{ item.description || 'No description' }}</p>
              <small>
                {{ item.status }}
                {{ item.owner ? ' | ' + item.owner.firstName + ' ' + item.owner.lastName : '' }}
                {{ item.dueDate ? ' | due ' + item.dueDate.slice(0, 10) : '' }}
              </small>
            </div>
            <button
              type="button"
              class="ghost"
              (click)="completeActionItem(item.id)"
              [disabled]="item.status === 'DONE' || actionsSaving()"
            >
              {{ item.status === 'DONE' ? 'Done' : 'Complete' }}
            </button>
          </li>
        </ul>
      </div>
    </section>

    <ng-template #emptyState>
      <section class="card empty">
        <span class="pill">Work Items</span>
        <p>Select a record to manage follow-up actions and attachments.</p>
      </section>
    </ng-template>
  `,
  styles: [`
    .panel,
    .empty {
      padding: 1.1rem 1.2rem;
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
      margin-top: 1rem;
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
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 16px;
      padding: 0.9rem;
    }

    .list p {
      margin: 0.3rem 0;
      color: var(--muted);
    }

    small,
    .panel-state {
      color: var(--muted);
    }

    .feedback {
      min-height: 1.15rem;
      margin: 0;
      font-size: 0.92rem;
    }

    .feedback.error {
      color: #a03535;
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

  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly users = signal<UserOption[]>([]);
  protected readonly actionItems = signal<ActionItem[]>([]);
  protected readonly actionsLoading = signal(false);
  protected readonly actionsSaving = signal(false);
  protected readonly actionsMessage = signal('');
  protected readonly actionsError = signal('');

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
      this.reloadActions();
    }
  }

  createActionItem() {
    if (!this.sourceId || this.actionForm.invalid) {
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
          this.reloadActions();
        },
        error: (error: HttpErrorResponse) => {
          this.actionsSaving.set(false);
          this.actionsError.set(this.readError(error, 'Action item save failed.'));
        }
      });
  }

  completeActionItem(id: string) {
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
}
