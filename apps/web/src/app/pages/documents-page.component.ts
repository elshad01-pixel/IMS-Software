import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { RecordWorkItemsComponent } from '../shared/record-work-items.component';

type DocumentRow = {
  id: string;
  code: string;
  title: string;
  version: string;
  status: string;
};

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RecordWorkItemsComponent],
  template: `
    <section class="page-grid">
      <div class="card header">
        <div>
          <span class="pill">Documents</span>
          <h2>Controlled document register</h2>
          <p>Maintain approved documents, revisions, and linked follow-up evidence.</p>
        </div>
      </div>

      <div class="workspace">
        <div class="card table-card">
          <div class="toolbar">
            <strong>{{ documents().length }} documents</strong>
            <button type="button" class="ghost" (click)="resetForm()">New document</button>
          </div>

          <table>
            <thead>
              <tr><th>Code</th><th>Title</th><th>Version</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of documents()" (click)="select(item)" [class.selected]="item.id === selectedId()">
                <td>{{ item.code }}</td>
                <td>{{ item.title }}</td>
                <td>{{ item.version }}</td>
                <td>{{ item.status }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="side">
          <form class="card form-card" [formGroup]="form" (ngSubmit)="save()">
            <div class="toolbar">
              <strong>{{ selectedId() ? 'Edit document' : 'Create document' }}</strong>
              <span class="message">{{ message() }}</span>
            </div>

            <label>
              <span>Code</span>
              <input formControlName="code">
            </label>
            <label>
              <span>Title</span>
              <input formControlName="title">
            </label>
            <div class="inline">
              <label>
                <span>Version</span>
                <input formControlName="version">
              </label>
              <label>
                <span>Status</span>
                <select formControlName="status">
                  <option>Draft</option>
                  <option>Review</option>
                  <option>Approved</option>
                  <option>Obsolete</option>
                </select>
              </label>
            </div>

            <button type="submit" [disabled]="form.invalid || saving()">
              {{ saving() ? 'Saving...' : (selectedId() ? 'Update document' : 'Create document') }}
            </button>
          </form>

          <iso-record-work-items [sourceType]="'document'" [sourceId]="selectedId()" />
        </div>
      </div>
    </section>
  `,
  styles: [`
    .header,
    .table-card,
    .form-card {
      padding: 1.2rem 1.3rem;
    }

    .header h2 {
      margin: 0.8rem 0 0.3rem;
    }

    .header p,
    .message,
    label span {
      color: var(--muted);
    }

    .workspace {
      display: grid;
      grid-template-columns: 1.35fr 1fr;
      gap: 1rem;
      align-items: start;
    }

    .side {
      display: grid;
      gap: 1rem;
    }

    .toolbar {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: center;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 1rem;
    }

    th,
    td {
      padding: 0.95rem 0.4rem;
      text-align: left;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }

    tbody tr {
      cursor: pointer;
    }

    tbody tr.selected {
      background: rgba(40, 89, 67, 0.08);
    }

    form {
      display: grid;
      gap: 0.9rem;
    }

    label {
      display: grid;
      gap: 0.45rem;
    }

    .inline {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }

    input,
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

    @media (max-width: 1100px) {
      .workspace {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class DocumentsPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly documents = signal<DocumentRow[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly message = signal('');

  protected readonly form = this.fb.nonNullable.group({
    code: ['', Validators.required],
    title: ['', Validators.required],
    version: ['1.0', Validators.required],
    status: ['Draft', Validators.required]
  });

  constructor() {
    this.reload();
  }

  select(item: DocumentRow) {
    this.selectedId.set(item.id);
    this.form.setValue({
      code: item.code,
      title: item.title,
      version: item.version,
      status: item.status
    });
    this.message.set('');
  }

  resetForm() {
    this.selectedId.set(null);
    this.form.reset({
      code: '',
      title: '',
      version: '1.0',
      status: 'Draft'
    });
    this.message.set('');
  }

  save() {
    if (this.form.invalid) {
      return;
    }

    this.saving.set(true);
    const request = this.selectedId()
      ? this.api.patch(`documents/${this.selectedId()}`, this.form.getRawValue())
      : this.api.post<DocumentRow>('documents', this.form.getRawValue());

    request.subscribe({
      next: (response: unknown) => {
        this.saving.set(false);
        this.message.set(this.selectedId() ? 'Document updated.' : 'Document created.');
        this.reload(() => {
          const created = response as DocumentRow;
          if (!this.selectedId() && created?.id) {
            this.select(created);
          }
        });
      },
      error: () => {
        this.saving.set(false);
        this.message.set('Save failed.');
      }
    });
  }

  private reload(after?: () => void) {
    this.api.get<DocumentRow[]>('documents').subscribe((items) => {
      this.documents.set(items);
      if (this.selectedId()) {
        const match = items.find((item) => item.id === this.selectedId());
        if (match) {
          this.select(match);
        }
      }
      after?.();
    });
  }
}
