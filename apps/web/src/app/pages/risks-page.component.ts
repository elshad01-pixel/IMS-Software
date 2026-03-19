import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { PageHeaderComponent } from '../shared/page-header.component';
import { RecordWorkItemsComponent } from '../shared/record-work-items.component';

type PageMode = 'list' | 'create' | 'detail' | 'edit';
type RiskStatus = 'OPEN' | 'IN_TREATMENT' | 'MITIGATED' | 'ACCEPTED' | 'CLOSED';

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type RiskRow = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  likelihood: number;
  severity: number;
  score: number;
  treatmentPlan?: string | null;
  treatmentSummary?: string | null;
  ownerId?: string | null;
  targetDate?: string | null;
  status: RiskStatus;
  updatedAt: string;
};

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, RecordWorkItemsComponent],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="'Risks'"
        [title]="pageTitle()"
        [description]="pageDescription()"
        [breadcrumbs]="breadcrumbs()"
      >
        <a *ngIf="mode() === 'list'" routerLink="/risks/new" class="button-link">+ New risk</a>
        <a *ngIf="mode() === 'detail' && selectedRisk()" [routerLink]="['/risks', selectedRisk()?.id, 'edit']" class="button-link">Edit risk</a>
        <a *ngIf="mode() !== 'list'" routerLink="/risks" class="button-link secondary">Back to register</a>
      </iso-page-header>

      <section *ngIf="mode() === 'list'" class="page-stack">
        <div class="card list-card">
          <div class="section-head">
            <div>
              <h3>Risk register</h3>
              <p class="subtle">Track assessment, treatment, status, and due dates in a clean register view.</p>
            </div>
          </div>

          <div class="filter-row top-space">
            <label class="field">
              <span>Search</span>
              <input [value]="search()" (input)="search.set(readInputValue($event))" placeholder="Title or category">
            </label>
            <label class="field">
              <span>Status</span>
              <select [value]="statusFilter()" (change)="statusFilter.set(readSelectValue($event))">
                <option value="">All statuses</option>
                <option>OPEN</option>
                <option>IN_TREATMENT</option>
                <option>MITIGATED</option>
                <option>ACCEPTED</option>
                <option>CLOSED</option>
              </select>
            </label>
          </div>

          <div class="empty-state" *ngIf="loading()">Loading risks...</div>
          <table class="data-table" *ngIf="!loading()">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Score</th>
                <th>Status</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of filteredRisks()" [routerLink]="['/risks', item.id]">
                <td><strong>{{ item.title }}</strong></td>
                <td>{{ item.category || 'General' }}</td>
                <td>{{ item.score }}</td>
                <td><span class="status-badge" [class.warn]="item.status === 'IN_TREATMENT'">{{ item.status }}</span></td>
                <td>{{ item.targetDate ? (item.targetDate | date:'yyyy-MM-dd') : 'N/A' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section *ngIf="mode() === 'create' || mode() === 'edit'" class="page-columns">
        <form class="card form-card page-stack" [formGroup]="form" (ngSubmit)="save()">
          <div class="section-head">
            <div>
              <h3>{{ mode() === 'create' ? 'New risk' : 'Edit risk' }}</h3>
              <p class="subtle">Keep risk definition, assessment, and treatment separated into clear form groups.</p>
            </div>
          </div>

          <p class="feedback" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <div class="form-grid-2">
            <label class="field">
              <span>Title</span>
              <input formControlName="title" placeholder="Supplier delivery interruption">
            </label>
            <label class="field">
              <span>Category</span>
              <input formControlName="category" placeholder="Operational">
            </label>
          </div>

          <label class="field">
            <span>Description</span>
            <textarea rows="4" formControlName="description" placeholder="What could happen and why"></textarea>
          </label>

          <div class="form-grid-3">
            <label class="field">
              <span>Likelihood</span>
              <input type="number" min="1" max="5" formControlName="likelihood">
            </label>
            <label class="field">
              <span>Severity</span>
              <input type="number" min="1" max="5" formControlName="severity">
            </label>
            <article class="summary-item">
              <span>Calculated score</span>
              <strong>{{ currentScore() }}</strong>
            </article>
          </div>

          <label class="field">
            <span>Treatment plan</span>
            <textarea rows="3" formControlName="treatmentPlan" placeholder="Controls and planned mitigation"></textarea>
          </label>

          <label class="field">
            <span>Treatment summary</span>
            <textarea rows="3" formControlName="treatmentSummary" placeholder="Current treatment status"></textarea>
          </label>

          <div class="form-grid-2">
            <label class="field">
              <span>Owner</span>
              <select formControlName="ownerId">
                <option value="">Unassigned</option>
                <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
              </select>
            </label>
            <label class="field">
              <span>Target date</span>
              <input type="date" formControlName="targetDate">
            </label>
          </div>

          <label class="field">
            <span>Status</span>
            <select formControlName="status">
              <option>OPEN</option>
              <option>IN_TREATMENT</option>
              <option>MITIGATED</option>
              <option>ACCEPTED</option>
              <option>CLOSED</option>
            </select>
          </label>

          <div class="button-row">
            <button type="submit" [disabled]="form.invalid || saving()">{{ saving() ? 'Saving...' : 'Save risk' }}</button>
            <a [routerLink]="selectedId() ? ['/risks', selectedId()] : ['/risks']" class="button-link secondary">Cancel</a>
          </div>
        </form>

        <section class="card panel-card">
          <div class="section-head">
            <div>
              <h3>Workflow guidance</h3>
              <p class="subtle">Assessment and treatment stay readable here; actions and evidence continue on the risk record.</p>
            </div>
          </div>
          <div class="entity-list top-space">
            <div class="entity-item">
              <strong>Assess the inherent risk</strong>
              <small>Use likelihood and severity to generate the register score automatically.</small>
            </div>
            <div class="entity-item">
              <strong>Plan the treatment</strong>
              <small>Keep the treatment plan concise, then track execution with linked action items.</small>
            </div>
            <div class="entity-item">
              <strong>Review from the detail page</strong>
              <small>Use the detail page for current status, dashboard context, and follow-up activity.</small>
            </div>
          </div>
          <iso-record-work-items *ngIf="selectedId()" [sourceType]="'risk'" [sourceId]="selectedId()" />
        </section>
      </section>

      <section *ngIf="mode() === 'detail' && selectedRisk()" class="page-columns">
        <div class="page-stack">
          <section class="card detail-card">
            <div class="section-head">
              <div>
                <h3>{{ selectedRisk()?.title }}</h3>
                <p class="subtle">{{ selectedRisk()?.category || 'General' }}</p>
              </div>
              <span class="status-badge" [class.warn]="selectedRisk()?.status === 'IN_TREATMENT'">{{ selectedRisk()?.status }}</span>
            </div>

            <div class="summary-strip top-space">
              <article class="summary-item">
                <span>Likelihood</span>
                <strong>{{ selectedRisk()?.likelihood }}</strong>
              </article>
              <article class="summary-item">
                <span>Severity</span>
                <strong>{{ selectedRisk()?.severity }}</strong>
              </article>
              <article class="summary-item">
                <span>Score</span>
                <strong>{{ selectedRisk()?.score }}</strong>
              </article>
            </div>

            <dl class="key-value top-space">
              <dt>Description</dt>
              <dd>{{ selectedRisk()?.description || 'No description provided.' }}</dd>
              <dt>Treatment plan</dt>
              <dd>{{ selectedRisk()?.treatmentPlan || 'No treatment plan yet.' }}</dd>
              <dt>Treatment summary</dt>
              <dd>{{ selectedRisk()?.treatmentSummary || 'No treatment summary yet.' }}</dd>
              <dt>Target date</dt>
              <dd>{{ selectedRisk()?.targetDate ? (selectedRisk()?.targetDate | date:'yyyy-MM-dd') : 'Not set' }}</dd>
              <dt>Last updated</dt>
              <dd>{{ selectedRisk()?.updatedAt | date:'yyyy-MM-dd HH:mm' }}</dd>
            </dl>
          </section>
        </div>

        <iso-record-work-items [sourceType]="'risk'" [sourceId]="selectedId()" />
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
  `]
})
export class RisksPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
  protected readonly risks = signal<RiskRow[]>([]);
  protected readonly selectedRisk = signal<RiskRow | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly users = signal<UserOption[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal((history.state?.notice as string) || '');
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly statusFilter = signal('');

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    description: [''],
    category: [''],
    likelihood: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
    severity: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
    treatmentPlan: [''],
    treatmentSummary: [''],
    ownerId: [''],
    targetDate: [''],
    status: ['OPEN' as RiskStatus, Validators.required]
  });

  constructor() {
    this.loadUsers();
    this.route.data.subscribe((data) => {
      this.mode.set((data['mode'] as PageMode) || 'list');
      this.handleRoute(this.route.snapshot.paramMap);
    });
    this.route.paramMap.subscribe((params) => this.handleRoute(params));
  }

  protected pageTitle() {
    return {
      list: 'Risk register',
      create: 'Create risk',
      detail: this.selectedRisk()?.title || 'Risk detail',
      edit: this.selectedRisk()?.title || 'Edit risk'
    }[this.mode()];
  }

  protected pageDescription() {
    return {
      list: 'A calmer register for assessed risks, treatment ownership, and target follow-up.',
      create: 'Capture a new risk in a dedicated page without mixing the register and editor.',
      detail: 'Review risk assessment, treatment context, and action follow-up in one focused detail view.',
      edit: 'Update assessment and treatment in a dedicated edit workflow.'
    }[this.mode()];
  }

  protected breadcrumbs() {
    if (this.mode() === 'list') {
      return [{ label: 'Risks' }];
    }
    const base = [{ label: 'Risks', link: '/risks' }];
    if (this.mode() === 'create') return [...base, { label: 'New risk' }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedRisk()?.title || 'Risk', link: `/risks/${this.selectedId()}` }, { label: 'Edit' }];
    return [...base, { label: this.selectedRisk()?.title || 'Risk' }];
  }

  protected filteredRisks() {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.risks().filter((item) => {
      const matchesStatus = !status || item.status === status;
      const matchesTerm =
        !term ||
        item.title.toLowerCase().includes(term) ||
        (item.category || '').toLowerCase().includes(term);
      return matchesStatus && matchesTerm;
    });
  }

  protected currentScore() {
    const raw = this.form.getRawValue();
    return Number(raw.likelihood) * Number(raw.severity);
  }

  protected readInputValue(event: Event) {
    return (event.target as HTMLInputElement).value;
  }

  protected readSelectValue(event: Event) {
    return (event.target as HTMLSelectElement).value;
  }

  protected save() {
    if (this.form.invalid) {
      this.error.set('Complete the required risk fields.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    const payload = this.toPayload();
    const request = this.selectedId()
      ? this.api.patch<RiskRow>(`risks/${this.selectedId()}`, payload)
      : this.api.post<RiskRow>('risks', payload);

    request.subscribe({
      next: (risk) => {
        this.saving.set(false);
        this.router.navigate(['/risks', risk.id], { state: { notice: 'Risk saved successfully.' } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Risk save failed.'));
      }
    });
  }

  private handleRoute(params: ParamMap) {
    const id = params.get('id');
    this.selectedId.set(id);
    this.message.set((history.state?.notice as string) || '');
    this.error.set('');

    if (this.mode() === 'list') {
      this.selectedRisk.set(null);
      this.form.reset({
        title: '',
        description: '',
        category: '',
        likelihood: 3,
        severity: 3,
        treatmentPlan: '',
        treatmentSummary: '',
        ownerId: '',
        targetDate: '',
        status: 'OPEN'
      });
      this.reloadRisks();
      return;
    }

    if (this.mode() === 'create') {
      this.selectedRisk.set(null);
      this.form.reset({
        title: '',
        description: '',
        category: '',
        likelihood: 3,
        severity: 3,
        treatmentPlan: '',
        treatmentSummary: '',
        ownerId: '',
        targetDate: '',
        status: 'OPEN'
      });
      return;
    }

    if (id) {
      this.fetchRisk(id);
    }
  }

  private reloadRisks() {
    this.loading.set(true);
    this.api.get<RiskRow[]>('risks').subscribe({
      next: (items) => {
        this.loading.set(false);
        this.risks.set(items);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Risk register could not be loaded.'));
      }
    });
  }

  private fetchRisk(id: string) {
    this.loading.set(true);
    this.api.get<RiskRow>(`risks/${id}`).subscribe({
      next: (risk) => {
        this.loading.set(false);
        this.selectedRisk.set(risk);
        this.form.reset({
          title: risk.title,
          description: risk.description ?? '',
          category: risk.category ?? '',
          likelihood: risk.likelihood,
          severity: risk.severity,
          treatmentPlan: risk.treatmentPlan ?? '',
          treatmentSummary: risk.treatmentSummary ?? '',
          ownerId: risk.ownerId ?? '',
          targetDate: risk.targetDate?.slice(0, 10) ?? '',
          status: risk.status
        });
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Risk details could not be loaded.'));
      }
    });
  }

  private loadUsers() {
    this.api.get<UserOption[]>('users').subscribe((users) => this.users.set(users));
  }

  private toPayload() {
    const raw = this.form.getRawValue();
    return {
      ...raw,
      title: raw.title.trim(),
      description: raw.description.trim() || undefined,
      category: raw.category.trim() || undefined,
      treatmentPlan: raw.treatmentPlan.trim() || undefined,
      treatmentSummary: raw.treatmentSummary.trim() || undefined,
      ownerId: raw.ownerId || undefined,
      targetDate: raw.targetDate || undefined
    };
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}
