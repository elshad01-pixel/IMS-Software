import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { PageHeaderComponent } from '../shared/page-header.component';
import { RecordWorkItemsComponent } from '../shared/record-work-items.component';

type PageMode = 'list' | 'create' | 'detail' | 'edit';
type ReviewStatus = 'PLANNED' | 'HELD' | 'CLOSED';

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

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
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, RecordWorkItemsComponent],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="'Management Review'"
        [title]="pageTitle()"
        [description]="pageDescription()"
        [breadcrumbs]="breadcrumbs()"
      >
        <a *ngIf="mode() === 'list'" routerLink="/management-review/new" class="button-link">+ New review meeting</a>
        <a *ngIf="mode() === 'detail' && selectedReview()" [routerLink]="['/management-review', selectedReview()?.id, 'edit']" class="button-link">Edit meeting</a>
        <a *ngIf="mode() !== 'list'" routerLink="/management-review" class="button-link secondary">Back to meetings</a>
      </iso-page-header>

      <section *ngIf="mode() === 'list'" class="page-stack">
        <div class="card list-card">
          <div class="section-head">
            <div>
              <h3>Review meetings</h3>
              <p class="subtle">A clean list of management review meetings with meeting date, status, and linked input count.</p>
            </div>
          </div>

          <div class="empty-state" *ngIf="loading()">Loading management reviews...</div>
          <table class="data-table" *ngIf="!loading()">
            <thead>
              <tr>
                <th>Title</th>
                <th>Date</th>
                <th>Status</th>
                <th>Inputs</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of reviews()" [routerLink]="['/management-review', item.id]">
                <td><strong>{{ item.title }}</strong></td>
                <td>{{ item.reviewDate ? (item.reviewDate | date:'yyyy-MM-dd') : 'TBD' }}</td>
                <td><span class="status-badge" [class.success]="item.status === 'CLOSED'" [class.warn]="item.status === 'HELD'">{{ item.status }}</span></td>
                <td>{{ item.inputCount || item.inputs?.length || 0 }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section *ngIf="mode() === 'create' || mode() === 'edit'" class="page-columns">
        <form class="card form-card page-stack" [formGroup]="reviewForm" (ngSubmit)="saveReview()">
          <div class="section-head">
            <div>
              <h3>{{ mode() === 'create' ? 'Create review meeting' : 'Edit review meeting' }}</h3>
              <p class="subtle">The meeting record stays clean here. Linked inputs and actions remain clearly separated.</p>
            </div>
          </div>

          <p class="feedback" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <label class="field"><span>Title</span><input formControlName="title" placeholder="Q1 2026 management review"></label>
          <div class="form-grid-2">
            <label class="field"><span>Meeting date</span><input type="date" formControlName="reviewDate"></label>
            <label class="field">
              <span>Chairperson</span>
              <select formControlName="chairpersonId">
                <option value="">Unassigned</option>
                <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
              </select>
            </label>
          </div>
          <div class="form-grid-2">
            <label class="field">
              <span>Status</span>
              <select formControlName="status">
                <option>PLANNED</option>
                <option>HELD</option>
                <option>CLOSED</option>
              </select>
            </label>
            <label class="field"><span>Summary</span><input formControlName="summary" placeholder="Quarterly review of IMS performance"></label>
          </div>
          <label class="field"><span>Agenda</span><textarea rows="3" formControlName="agenda" placeholder="KPIs, audits, CAPA, risks"></textarea></label>
          <label class="field"><span>Minutes</span><textarea rows="4" formControlName="minutes" placeholder="Formal meeting minutes"></textarea></label>
          <label class="field"><span>Decisions</span><textarea rows="4" formControlName="decisions" placeholder="Decisions and outputs"></textarea></label>

          <div class="button-row">
            <button type="submit" [disabled]="reviewForm.invalid || saving()">{{ saving() ? 'Saving...' : 'Save meeting' }}</button>
            <a [routerLink]="selectedId() ? ['/management-review', selectedId()] : ['/management-review']" class="button-link secondary">Cancel</a>
          </div>
        </form>

        <section class="card panel-card">
          <div class="section-head">
            <div>
              <h3>Input selection</h3>
              <p class="subtle">Select risks, CAPAs, audits, and KPIs that should be referenced in the meeting.</p>
            </div>
          </div>

          <div class="page-stack top-space">
            <section *ngFor="let group of sourceGroups()">
              <h4>{{ group.label }}</h4>
              <div class="entity-list top-space">
                <label class="entity-item" *ngFor="let item of group.items">
                  <strong>{{ item.label }}</strong>
                  <small>{{ item.summary }}</small>
                  <input type="checkbox" [checked]="selectedInputIds().has(group.type + ':' + item.id)" (change)="toggleInput(group.type, item.id, $event)">
                </label>
              </div>
            </section>
          </div>
        </section>
      </section>

      <section *ngIf="mode() === 'detail' && selectedReview()" class="page-columns">
        <div class="page-stack">
          <section class="card detail-card">
            <div class="section-head">
              <div>
                <h3>{{ selectedReview()?.title }}</h3>
                <p class="subtle">{{ selectedReview()?.reviewDate ? (selectedReview()?.reviewDate | date:'yyyy-MM-dd') : 'Date not set' }}</p>
              </div>
              <span class="status-badge" [class.success]="selectedReview()?.status === 'CLOSED'" [class.warn]="selectedReview()?.status === 'HELD'">{{ selectedReview()?.status }}</span>
            </div>

            <dl class="key-value top-space">
              <dt>Summary</dt>
              <dd>{{ selectedReview()?.summary || 'No summary recorded.' }}</dd>
              <dt>Agenda</dt>
              <dd>{{ selectedReview()?.agenda || 'No agenda recorded.' }}</dd>
              <dt>Minutes</dt>
              <dd>{{ selectedReview()?.minutes || 'No minutes recorded.' }}</dd>
              <dt>Decisions</dt>
              <dd>{{ selectedReview()?.decisions || 'No decisions recorded.' }}</dd>
            </dl>
          </section>

          <section class="card panel-card">
            <div class="section-head">
              <div>
                <h3>Linked inputs</h3>
                <p class="subtle">Keep the meeting inputs visible without mixing them into the minutes content.</p>
              </div>
            </div>
            <div class="entity-list top-space">
              <article class="entity-item" *ngFor="let input of selectedReview()?.inputs || []">
                <strong>{{ input.title }}</strong>
                <small>{{ input.sourceType }} | {{ input.summary || 'No summary' }}</small>
              </article>
            </div>
          </section>
        </div>

        <iso-record-work-items [sourceType]="'management-review'" [sourceId]="selectedId()" />
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

    label.entity-item input {
      width: auto;
      margin-top: 0.3rem;
    }
  `]
})
export class ManagementReviewPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
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
  protected readonly message = signal((history.state?.notice as string) || '');
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
    this.route.data.subscribe((data) => {
      this.mode.set((data['mode'] as PageMode) || 'list');
      this.handleRoute(this.route.snapshot.paramMap);
    });
    this.route.paramMap.subscribe((params) => this.handleRoute(params));
  }

  protected pageTitle() {
    return {
      list: 'Management review meetings',
      create: 'Create management review',
      detail: this.selectedReview()?.title || 'Management review detail',
      edit: this.selectedReview()?.title || 'Edit management review'
    }[this.mode()];
  }

  protected pageDescription() {
    return {
      list: 'A focused list of management review meetings and their linked operational inputs.',
      create: 'Create the meeting record in a dedicated page, then manage inputs and actions cleanly.',
      detail: 'Review meeting context, minutes, decisions, and linked inputs in one calm detail page.',
      edit: 'Update the meeting record without mixing it with the list view.'
    }[this.mode()];
  }

  protected breadcrumbs() {
    if (this.mode() === 'list') return [{ label: 'Management Review' }];
    const base = [{ label: 'Management Review', link: '/management-review' }];
    if (this.mode() === 'create') return [...base, { label: 'New review' }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedReview()?.title || 'Review', link: `/management-review/${this.selectedId()}` }, { label: 'Edit' }];
    return [...base, { label: this.selectedReview()?.title || 'Review' }];
  }

  protected sourceGroups() {
    return [
      { label: 'Risks', type: 'risk', items: this.risks() },
      { label: 'CAPAs', type: 'capa', items: this.capas() },
      { label: 'Audits', type: 'audit', items: this.audits() },
      { label: 'KPIs', type: 'kpi', items: this.kpis() }
    ];
  }

  protected saveReview() {
    if (this.reviewForm.invalid) {
      this.error.set('Complete the required management review fields.');
      return;
    }

    this.saving.set(true);
    this.message.set('');
    this.error.set('');
    const raw = this.reviewForm.getRawValue();
    const payload = {
      ...raw,
      title: raw.title.trim(),
      reviewDate: raw.reviewDate || undefined,
      chairpersonId: raw.chairpersonId || undefined,
      agenda: raw.agenda.trim() || undefined,
      minutes: raw.minutes.trim() || undefined,
      decisions: raw.decisions.trim() || undefined,
      summary: raw.summary.trim() || undefined,
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
        this.router.navigate(['/management-review', review.id], { state: { notice: 'Management review saved successfully.' } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Management review save failed.'));
      }
    });
  }

  protected toggleInput(sourceType: string, sourceId: string, event: Event) {
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

  private handleRoute(params: ParamMap) {
    const id = params.get('id');
    this.selectedId.set(id);
    this.message.set((history.state?.notice as string) || '');
    this.error.set('');

    if (this.mode() === 'list') {
      this.selectedReview.set(null);
      this.resetFormValues();
      this.reload();
      return;
    }

    if (this.mode() === 'create') {
      this.selectedReview.set(null);
      this.resetFormValues();
      return;
    }

    if (id) {
      this.fetchReview(id);
    }
  }

  private resetFormValues() {
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

  private reload() {
    this.loading.set(true);
    this.api.get<ReviewRecord[]>('management-review').subscribe({
      next: (items) => {
        this.loading.set(false);
        this.reviews.set(items);
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
