import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';

type ActionItem = {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  status: string;
};

type Attachment = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
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
          </div>
        </div>

        <form [formGroup]="actionForm" (ngSubmit)="createActionItem()" class="stack">
          <input formControlName="title" placeholder="Close evidence gap">
          <textarea formControlName="description" rows="3" placeholder="Action details"></textarea>
          <input formControlName="dueDate" type="date">
          <button type="submit" [disabled]="actionForm.invalid">Add action item</button>
        </form>

        <ul class="list">
          <li *ngFor="let item of actionItems()">
            <div>
              <strong>{{ item.title }}</strong>
              <p>{{ item.description || 'No description' }}</p>
              <small>{{ item.status }}{{ item.dueDate ? ' • ' + item.dueDate.slice(0, 10) : '' }}</small>
            </div>
            <button type="button" class="ghost" (click)="completeActionItem(item.id)" [disabled]="item.status === 'DONE'">
              {{ item.status === 'DONE' ? 'Done' : 'Complete' }}
            </button>
          </li>
        </ul>
      </div>

      <div class="card panel">
        <div class="panel-head">
          <div>
            <span class="pill">Attachments</span>
            <h3>Evidence</h3>
          </div>
        </div>

        <form class="stack" (ngSubmit)="uploadAttachment()">
          <input type="file" (change)="onFileSelected($event)">
          <button type="submit" [disabled]="!selectedFile()">Upload</button>
        </form>

        <ul class="list">
          <li *ngFor="let item of attachments()">
            <div>
              <strong>{{ item.fileName }}</strong>
              <p>{{ item.mimeType }}</p>
              <small>{{ item.createdAt | date:'medium' }}</small>
            </div>
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

    .stack {
      display: grid;
      gap: 0.7rem;
      margin-top: 1rem;
    }

    input,
    textarea,
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

    .list p,
    .empty p {
      margin: 0.3rem 0;
      color: var(--muted);
    }

    small {
      color: var(--muted);
    }
  `]
})
export class RecordWorkItemsComponent implements OnChanges {
  @Input() sourceType!: string;
  @Input() sourceId: string | null = null;

  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly actionItems = signal<ActionItem[]>([]);
  protected readonly attachments = signal<Attachment[]>([]);
  protected readonly selectedFile = signal<File | null>(null);

  protected readonly actionForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: [''],
    dueDate: ['']
  });

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['sourceId'] || changes['sourceType']) && this.sourceId) {
      this.reload();
    }
  }

  createActionItem() {
    if (!this.sourceId || this.actionForm.invalid) {
      return;
    }

    this.api.post<ActionItem>('action-items', {
      sourceType: this.sourceType,
      sourceId: this.sourceId,
      ...this.actionForm.getRawValue()
    }).subscribe(() => {
      this.actionForm.reset({ title: '', description: '', dueDate: '' });
      this.reload();
    });
  }

  completeActionItem(id: string) {
    this.api.patch(`action-items/${id}/complete`, {}).subscribe(() => this.reload());
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] ?? null);
  }

  uploadAttachment() {
    if (!this.sourceId || !this.selectedFile()) {
      return;
    }

    const formData = new FormData();
    formData.append('file', this.selectedFile() as File);

    this.api.postFormData(`attachments/${this.sourceType}/${this.sourceId}`, formData).subscribe(() => {
      this.selectedFile.set(null);
      this.reload();
    });
  }

  private reload() {
    if (!this.sourceId) {
      this.actionItems.set([]);
      this.attachments.set([]);
      return;
    }

    this.api.get<ActionItem[]>(`action-items?sourceType=${this.sourceType}&sourceId=${this.sourceId}`)
      .subscribe((items) => this.actionItems.set(items));
    this.api.get<Attachment[]>(`attachments/${this.sourceType}/${this.sourceId}`)
      .subscribe((items) => this.attachments.set(items));
  }
}
