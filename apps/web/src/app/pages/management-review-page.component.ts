import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { RecordWorkItemsComponent } from '../shared/record-work-items.component';

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type ReviewStatus = 'PLANNED' | 'HELD' | 'CLOSED';

type ReviewInput = {
  id: string;
  sourceType: string;
  sourceId: string;
  title: string;
  summary?: string | null;
};

type ReviewRecord = {
  id: string;
  title: string;
  reviewDate?: string | null;
  chairpersonId?: string | null;
  agenda?: string | null;
  minutes?: string | null;
  decisions?: string | null;
  summary?: string | null;
  status: ReviewStatus;
  inputs?: ReviewInput[];
  inputCount?: number;
};

type SourceOption = {
  id: string;
  label: string;
  summary: string;
  sourceType: 'risk' | 'capa' | 'audit' | 'kpi';
};

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RecordWorkItemsComponent],
  template: `
    <section class="page-grid">
      <div class="card header">
        <div>
          <span class="pill">Management Review</span>
          <h2>Review meetings, inputs, decisions, and actions</h2>
          <p>Capture formal review meetings with evidence from risks, CAPAs, audits, and KPIs, then assign follow-up.</p>
        </div>
      </div>

      <div class="workspace">
        <div class="card table-card">
          <div class="toolbar">
            <div>
              <strong>{{ reviews().length }} review meetings</strong>
              <p class="subtle">Each review stores linked inputs, minutes, and decisions.</p>
            </div>
            <button type="button" class="ghost" (click)="resetForm()">New review</button>
          </div>

          <div class="table-state" *ngIf="loading()">Loading management reviews...</div>
          <table *ngIf="!loading()">
            <thead>
              <tr>
                <th>Title</th>
                <th>Date</th>
                <th>Status</th>
                <th>Inputs</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of reviews()" (click)="select(item)" [class.selected]="item.id === selectedId()">
                <td>{{ item.title }}</td>
                <td>{{ item.reviewDate ? (item.reviewDate | date:'yyyy-MM-dd') : 'TBD' }}</td>
                <td>{{ item.status }}</td>
                <td>{{ item.inputCount || item.inputs?.length || 0 }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="side">
          <form class="card form-card" [formGroup]="reviewForm" (ngSubmit)="saveReview()">
            <div class="toolbar">
              <div>
                <strong>{{ selectedId() ? 'Edit review meeting' : 'Create review meeting' }}</strong>
                <p class="subtle" *ngIf="selectedReview()">Status: {{ selectedReview()?.status }}</p>
              </div>
              <span class="message" [class.error]="!!error()">{{ error() || message() }}</span>
            </div>

            <label><span>Title</span><input formControlName="title" placeholder="Q1 2026 management review"></label>
            <div class="inline">
              <label><span>Meeting date</span><input type="date" formControlName="reviewDate"></label>
              <label>
                <span>Chairperson</span>
                <select formControlName="chairpersonId">
                  <option value="">Unassigned</option>
                  <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
                </select>
              </label>
            </div>
            <div class="inline">
              <label>
                <span>Status</span>
                <select formControlName="status">
                  <option>PLANNED</option>
                  <option>HELD</option>
                  <option>CLOSED</option>
                </select>
              </label>
              <label><span>Summary</span><input formControlName="summary" placeholder="Quarterly review of IMS performance"></label>
            </div>
            <label><span>Agenda</span><textarea rows="2" formControlName="agenda" placeholder="KPIs, audit outcomes, CAPA status, risks"></textarea></label>
            <label><span>Minutes</span><textarea rows="4" formControlName="minutes" placeholder="Formal meeting minutes"></textarea></label>
            <label><span>Decisions</span><textarea rows="3" formControlName="decisions" placeholder="Decisions and strategic outputs"></textarea></label>
            <button type="submit" [disabled]="reviewForm.invalid || saving()">
              {{ saving() ? 'Saving...' : (selectedId() ? 'Save changes' : 'Create review') }}
            </button>
          </form>

          <section class="card nested-card">
            <div class="panel-title">Inputs</div>
            <div class="input-groups">
              <div *ngFor="let group of sourceGroups()">
                <div class="group-title">{{ group.label }}</div>
                <label class="selector" *ngFor="let item of group.items">
                  <input
                    type="checkbox"
                    [checked]="selectedInputIds().has(group.type + ':' + item.id)"
                    (change)="toggleInput(group.type, item.id, $event)"
                  >
                  <span>{{ item.label }}</span>
                  <small>{{ item.summary }}</small>
                </label>
              </div>
            </div>

            <ul class="list" *ngIf="selectedReview()?.inputs?.length">
              <li *ngFor="let input of selectedReview()?.inputs || []">
                <strong>{{ input.title }}</strong>
                <small>{{ input.sourceType }} | {{ input.summary || 'No summary' }}</small>
              </li>
            </ul>
          </section>

          <iso-record-work-items [sourceType]="'management-review'" [sourceId]="selectedId()" />
        </div>
      </div>
    </section>
  `,
  styles: [`
    .header, .table-card, .form-card, .nested-card { padding: 1.2rem 1.3rem; }
    .header h2 { margin: 0.8rem 0 0.3rem; }
    .header p, .subtle, .message, .table-state, small { color: var(--muted); }
    .workspace { display: grid; grid-template-columns: 1.15fr 1fr; gap: 1rem; align-items: start; }
    .side { display: grid; gap: 1rem; }
    .toolbar { display: flex; justify-content: space-between; gap: 1rem; align-items: start; }
    .subtle, .message { margin: 0.25rem 0 0; font-size: 0.92rem; }
    .message { min-height: 1.1rem; text-align: right; }
    .message.error { color: #a03535; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { padding: 0.95rem 0.4rem; text-align: left; border-bottom: 1px solid rgba(0,0,0,0.08); }
    tbody tr { cursor: pointer; }
    tbody tr.selected { background: rgba(40,89,67,0.08); }
    form { display: grid; gap: 0.9rem; }
    .inline { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    label { display: grid; gap: 0.45rem; }
    input, select, textarea, button { border-radius: 14px; border: 1px solid var(--panel-border); padding: 0.8rem 0.9rem; }
    button { border: 0; background: var(--brand); color: white; font-weight: 700; }
    .ghost { background: rgba(40,89,67,0.1); color: var(--brand-strong); }
    .panel-title, .group-title { font-weight: 700; }
    .input-groups { display: grid; gap: 1rem; margin-top: 1rem; }
    .selector { display: grid; gap: 0.15rem; border: 1px solid rgba(0,0,0,0.08); border-radius: 14px; padding: 0.85rem; margin-top: 0.45rem; }
    .selector input { width: 18px; height: 18px; margin: 0 0 0.35rem; }
    .list { list-style: none; padding: 0; margin: 1rem 0 0; display: grid; gap: 0.75rem; }
    .list li { border: 1px solid rgba(0,0,0,0.08); border-radius: 16px; padding: 0.85rem; display: grid; gap: 0.25rem; }
    @media (max-width: 1100px) { .workspace { grid-template-columns: 1fr; } }
    @media (max-width: 700px) { .inline { grid-template-columns: 1fr; } }
  `]
})
export class ManagementReviewPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly reviews = signal<ReviewRecord[]>([]);
  protected readonly users = signal<UserOption[]>([]);
  protected readonly risks = signal<SourceOption[]>([]);
  protected readonly capas = signal<SourceOption[]>([]);
  protected readonly audits = signal<SourceOption[]>([]);
  protected readonly kpis = signal<SourceOption[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selectedReview = signal<ReviewRecord | null>(null);
  protected readonly selectedInputIds = signal<Set<string>>(new Set());
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');

  protected readonly reviewForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    reviewDate: [''],
    chairpersonId: [''],
    agenda: [''],
    minutes: [''],
    decisions: [''],
    summary: [''],
    status: ['PLANNED' as ReviewStatus, Validators.required]
  });

  constructor() {
    this.loadLookups();
    this.reload();
  }

  select(item: ReviewRecord) {
    this.selectedId.set(item.id);
    this.fetchReview(item.id);
  }

  resetForm() {
    this.selectedId.set(null);
    this.selectedReview.set(null);
    this.selectedInputIds.set(new Set());
    this.reviewForm.reset({
      title: '',
      reviewDate: '',
      chairpersonId: '',
      agenda: '',
      minutes: '',
      decisions: '',
      summary: '',
      status: 'PLANNED'
    });
    this.message.set('');
    this.error.set('');
  }

  saveReview() {
    if (this.reviewForm.invalid) {
      this.error.set('Complete the required management review fields.');
      return;
    }

    this.saving.set(true);
    this.message.set('');
    this.error.set('');

    const payload = {
      ...this.reviewForm.getRawValue(),
      title: this.reviewForm.getRawValue().title.trim(),
      reviewDate: this.reviewForm.getRawValue().reviewDate || undefined,
      chairpersonId: this.reviewForm.getRawValue().chairpersonId || undefined,
      agenda: this.reviewForm.getRawValue().agenda.trim() || undefined,
      minutes: this.reviewForm.getRawValue().minutes.trim() || undefined,
      decisions: this.reviewForm.getRawValue().decisions.trim() || undefined,
      summary: this.reviewForm.getRawValue().summary.trim() || undefined,
      inputs: Array.from(this.selectedInputIds()).map((key) => {
        const [sourceType, sourceId] = key.split(':');
        return { sourceType, sourceId };
      })
    };

    const request = this.selectedId()
      ? this.api.patch<ReviewRecord>(`management-review/${this.selectedId()}`, payload)
      : this.api.post<ReviewRecord>('management-review', payload);

    request.subscribe({
      next: (review) => {
        this.saving.set(false);
        this.message.set(this.selectedId() ? 'Management review updated.' : 'Management review created.');
        this.reload(() => this.select(review));
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Management review save failed.'));
      }
    });
  }

  toggleInput(sourceType: string, sourceId: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const next = new Set(this.selectedInputIds());
    const key = `${sourceType}:${sourceId}`;
    if (checked) {
      next.add(key);
    } else {
      next.delete(key);
    }
    this.selectedInputIds.set(next);
  }

  protected sourceGroups() {
    return [
      { label: 'Risks', type: 'risk', items: this.risks() },
      { label: 'CAPAs', type: 'capa', items: this.capas() },
      { label: 'Audits', type: 'audit', items: this.audits() },
      { label: 'KPIs', type: 'kpi', items: this.kpis() }
    ];
  }

  private fetchReview(id: string) {
    this.loading.set(true);
    this.api.get<ReviewRecord>(`management-review/${id}`).subscribe({
      next: (review) => {
        this.loading.set(false);
        this.selectedReview.set(review);
        this.reviewForm.reset({
          title: review.title,
          reviewDate: review.reviewDate?.slice(0, 10) ?? '',
          chairpersonId: review.chairpersonId ?? '',
          agenda: review.agenda ?? '',
          minutes: review.minutes ?? '',
          decisions: review.decisions ?? '',
          summary: review.summary ?? '',
          status: review.status
        });
        this.selectedInputIds.set(new Set((review.inputs || []).map((input) => `${input.sourceType}:${input.sourceId}`)));
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Management review details could not be loaded.'));
      }
    });
  }

  private reload(after?: () => void) {
    this.loading.set(true);
    this.api.get<ReviewRecord[]>('management-review').subscribe({
      next: (items) => {
        this.loading.set(false);
        this.reviews.set(items);
        after?.();
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Management reviews could not be loaded.'));
      }
    });
  }

  private loadLookups() {
    this.api.get<UserOption[]>('users').subscribe((users) => this.users.set(users));
    this.api.get<Array<{ id: string; title: string; score: number; status: string }>>('risks').subscribe((items) => {
      this.risks.set(items.map((item) => ({ id: item.id, label: item.title, summary: `Score ${item.score} | ${item.status}`, sourceType: 'risk' })));
    });
    this.api.get<Array<{ id: string; title: string; status: string }>>('capa').subscribe((items) => {
      this.capas.set(items.map((item) => ({ id: item.id, label: item.title, summary: item.status, sourceType: 'capa' })));
    });
    this.api.get<Array<{ id: string; title: string; status: string }>>('audits').subscribe((items) => {
      this.audits.set(items.map((item) => ({ id: item.id, label: item.title, summary: item.status, sourceType: 'audit' })));
    });
    this.api.get<Array<{ id: string; name: string; status: string }>>('kpis').subscribe((items) => {
      this.kpis.set(items.map((item) => ({ id: item.id, label: item.name, summary: item.status, sourceType: 'kpi' })));
    });
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}
