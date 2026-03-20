import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { ApiService } from '../core/api.service';

type Attachment = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

@Component({
  selector: 'iso-attachment-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="card panel" *ngIf="sourceId; else emptyState">
      <div class="panel-head">
        <div>
          <span class="pill">Attachments</span>
          <h3>Evidence</h3>
          <p>Upload and download controlled evidence for this record without leaving the workflow.</p>
        </div>
      </div>

      <div class="stack">
        <label class="dropzone">
          <span>Select file</span>
          <input #fileInput type="file" (change)="onFileSelected($event)">
          <small>{{ selectedFile()?.name || lastUploadedFileName() || 'Choose a file to attach' }}</small>
        </label>
        <div class="button-row">
          <button type="button" [disabled]="!selectedFile() || saving()" (click)="uploadAttachment()">
            {{ saving() ? 'Uploading...' : 'Upload file' }}
          </button>
        </div>
        <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="error()" [class.success]="message() && !error()">
          {{ error() || message() }}
        </p>
      </div>

      <div class="panel-state" *ngIf="loading()">Loading attachments...</div>
      <div class="empty-state top-space" *ngIf="!loading() && !attachments().length">
        <strong>No attachments yet</strong>
        <span>Upload the first supporting file to start the evidence trail.</span>
      </div>
      <ul class="list" *ngIf="!loading() && attachments().length">
        <li *ngFor="let item of attachments()">
          <div class="list-copy">
            <strong>{{ item.fileName }}</strong>
            <p>{{ item.mimeType }} | {{ formatFileSize(item.size) }}</p>
            <small>{{ item.createdAt | date:'medium' }}</small>
          </div>
          <button type="button" class="secondary" [disabled]="downloadingId() === item.id" (click)="downloadAttachment(item)">
            {{ downloadingId() === item.id ? 'Downloading...' : 'Download' }}
          </button>
        </li>
      </ul>
    </section>

    <ng-template #emptyState>
      <section class="card panel">
        <span class="pill">Attachments</span>
        <p class="empty-state">Save the record first to upload supporting files.</p>
      </section>
    </ng-template>
  `,
  styles: [`
    .panel {
      padding: 1.2rem;
    }

    .panel-head h3 {
      margin: 0.8rem 0 0.2rem;
    }

    .panel-head p,
    .dropzone span,
    .dropzone small,
    .feedback,
    .list p,
    .panel-state,
    .empty-state,
    small {
      color: var(--muted);
    }

    .stack {
      display: grid;
      gap: 0.75rem;
      margin-top: 1rem;
    }

    .dropzone {
      display: grid;
      gap: 0.4rem;
      border: 1px dashed rgba(36, 79, 61, 0.28);
      border-radius: 18px;
      padding: 1.05rem;
      background: linear-gradient(180deg, rgba(232, 240, 234, 0.9), rgba(244, 247, 242, 0.82));
    }

    .dropzone input {
      border: 0;
      padding: 0;
      background: transparent;
    }

    .top-space {
      margin-top: 1rem;
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
      align-items: start;
      background: rgba(255, 255, 255, 0.82);
    }

    .list p {
      margin: 0.3rem 0;
    }

    .list-copy {
      display: grid;
      gap: 0.15rem;
    }

    .feedback {
      font-size: 0.92rem;
    }

    @media (max-width: 700px) {
      .list li {
        display: grid;
      }
    }
  `]
})
export class AttachmentPanelComponent implements OnChanges {
  @Input() sourceType!: string;
  @Input() sourceId: string | null = null;

  private readonly api = inject(ApiService);

  protected readonly attachments = signal<Attachment[]>([]);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly lastUploadedFileName = signal('');
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly downloadingId = signal<string | null>(null);
  protected readonly message = signal('');
  protected readonly error = signal('');

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['sourceType'] || changes['sourceId']) && this.sourceId) {
      this.reload();
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile.set(file);
    this.message.set('');
    this.error.set('');
    if (file) {
      this.uploadAttachment(input);
    }
  }

  uploadAttachment(input?: HTMLInputElement) {
    if (!this.sourceId || !this.selectedFile()) {
      return;
    }

    const formData = new FormData();
    formData.append('file', this.selectedFile() as File);

    this.saving.set(true);
    this.message.set('');
    this.error.set('');

    this.api.postFormData(`attachments/${this.sourceType}/${this.sourceId}`, formData).subscribe({
      next: () => {
        this.saving.set(false);
        this.lastUploadedFileName.set((this.selectedFile() as File).name);
        this.selectedFile.set(null);
        if (input) {
          input.value = '';
        }
        this.message.set(`Attachment uploaded successfully: ${this.lastUploadedFileName()}.`);
        this.reload();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Attachment upload failed.'));
      }
    });
  }

  downloadAttachment(attachment: Attachment) {
    this.downloadingId.set(attachment.id);
    this.message.set('');
    this.error.set('');

    this.api.getBlob(`attachments/${attachment.id}/download`).subscribe({
      next: (blob) => {
        this.downloadingId.set(null);
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = attachment.fileName;
        anchor.click();
        URL.revokeObjectURL(objectUrl);
        this.message.set('Attachment download started.');
      },
      error: (error: HttpErrorResponse) => {
        this.downloadingId.set(null);
        this.error.set(this.readError(error, 'Attachment download failed.'));
      }
    });
  }

  protected formatFileSize(size: number) {
    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  private reload() {
    if (!this.sourceId) {
      this.attachments.set([]);
      return;
    }

    this.loading.set(true);
    this.api.get<Attachment[]>(`attachments/${this.sourceType}/${this.sourceId}`).subscribe({
      next: (items) => {
        this.loading.set(false);
        this.attachments.set(items);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Attachments could not be loaded.'));
      }
    });
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}
