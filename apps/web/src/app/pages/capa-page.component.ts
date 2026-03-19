import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { PageHeaderComponent } from '../shared/page-header.component';
import { RecordWorkItemsComponent } from '../shared/record-work-items.component';

type PageMode = 'list' | 'create' | 'detail' | 'edit';
type CapaStatus = 'OPEN' | 'INVESTIGATING' | 'ACTION_PLANNED' | 'IN_PROGRESS' | 'VERIFIED' | 'CLOSED';

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type CapaRow = {
  id: string;
  title: string;
  source: string;
  category?: string | null;
  problemStatement: string;
  containmentAction?: string | null;
  rootCause?: string | null;
  correction?: string | null;
  correctiveAction?: string | null;
  preventiveAction?: string | null;
  verificationMethod?: string | null;
  closureSummary?: string | null;
  ownerId?: string | null;
  dueDate?: string | null;
  closedAt?: string | null;
  status: CapaStatus;
  updatedAt: string;
};

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, RecordWorkItemsComponent],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="'CAPA'"
        [title]="pageTitle()"
        [description]="pageDescription()"
        [breadcrumbs]="breadcrumbs()"
      >
        <a *ngIf="mode() === 'list'" routerLink="/capa/new" class="button-link">+ New CAPA</a>
        <a *ngIf="mode() === 'detail' && selectedCapa()" [routerLink]="['/capa', selectedCapa()?.id, 'edit']" class="button-link">Edit CAPA</a>
        <a *ngIf="mode() !== 'list'" routerLink="/capa" class="button-link secondary">Back to register</a>
      </iso-page-header>

      <section *ngIf="mode() === 'list'" class="page-stack">
        <div class="card list-card">
          <div class="section-head">
            <div>
              <h3>CAPA register</h3>
              <p class="subtle">Track nonconformities, investigation, action planning, and closure in a structured register.</p>
            </div>
          </div>

          <div class="filter-row top-space">
            <label class="field">
              <span>Search</span>
              <input [value]="search()" (input)="search.set(readInputValue($event))" placeholder="Title or source">
            </label>
            <label class="field">
              <span>Status</span>
              <select [value]="statusFilter()" (change)="statusFilter.set(readSelectValue($event))">
                <option value="">All statuses</option>
                <option>OPEN</option>
                <option>INVESTIGATING</option>
                <option>ACTION_PLANNED</option>
                <option>IN_PROGRESS</option>
                <option>VERIFIED</option>
                <option>CLOSED</option>
              </select>
            </label>
          </div>

          <div class="empty-state" *ngIf="loading()">Loading CAPAs...</div>
          <table class="data-table" *ngIf="!loading()">
            <thead>
              <tr>
                <th>Title</th>
                <th>Source</th>
                <th>Status</th>
                <th>Due date</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of filteredCapas()" [routerLink]="['/capa', item.id]">
                <td><strong>{{ item.title }}</strong></td>
                <td>{{ item.source }}</td>
                <td><span class="status-badge" [class.success]="item.status === 'CLOSED'" [class.warn]="item.status === 'IN_PROGRESS'">{{ item.status }}</span></td>
                <td>{{ item.dueDate ? (item.dueDate | date:'yyyy-MM-dd') : 'N/A' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section *ngIf="mode() === 'create' || mode() === 'edit'" class="page-columns">
        <form class="card form-card page-stack" [formGroup]="form" (ngSubmit)="save()">
          <div class="section-head">
            <div>
              <h3>{{ mode() === 'create' ? 'Raise CAPA' : 'Edit CAPA' }}</h3>
              <p class="subtle">Keep the problem statement, cause, actions, and closure inputs in clearly separated sections.</p>
            </div>
          </div>

          <p class="feedback" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <div class="form-grid-2">
            <label class="field">
              <span>Title</span>
              <input formControlName="title" placeholder="Calibration missed for production gauge">
            </label>
            <label class="field">
              <span>Source</span>
              <input formControlName="source" placeholder="Internal audit">
            </label>
          </div>

          <div class="form-grid-2">
            <label class="field">
              <span>Category</span>
              <input formControlName="category" placeholder="Process">
            </label>
            <label class="field">
              <span>Status</span>
              <select formControlName="status">
                <option>OPEN</option>
                <option>INVESTIGATING</option>
                <option>ACTION_PLANNED</option>
                <option>IN_PROGRESS</option>
                <option>VERIFIED</option>
                <option>CLOSED</option>
              </select>
            </label>
          </div>

          <label class="field">
            <span>Problem statement</span>
            <textarea rows="4" formControlName="problemStatement" placeholder="Describe the nonconformity"></textarea>
          </label>

          <div class="form-grid-2">
            <label class="field">
              <span>Containment action</span>
              <textarea rows="3" formControlName="containmentAction" placeholder="Immediate containment"></textarea>
            </label>
            <label class="field">
              <span>Root cause</span>
              <textarea rows="3" formControlName="rootCause" placeholder="Why it happened"></textarea>
            </label>
          </div>

          <div class="form-grid-2">
            <label class="field">
              <span>Correction</span>
              <textarea rows="3" formControlName="correction" placeholder="Immediate correction"></textarea>
            </label>
            <label class="field">
              <span>Corrective action</span>
              <textarea rows="3" formControlName="correctiveAction" placeholder="Action to eliminate the cause"></textarea>
            </label>
          </div>

          <div class="form-grid-2">
            <label class="field">
              <span>Preventive action</span>
              <textarea rows="3" formControlName="preventiveAction" placeholder="Action to prevent recurrence"></textarea>
            </label>
            <label class="field">
              <span>Verification method</span>
              <textarea rows="3" formControlName="verificationMethod" placeholder="How effectiveness will be checked"></textarea>
            </label>
          </div>

          <label class="field">
            <span>Closure summary</span>
            <textarea rows="3" formControlName="closureSummary" placeholder="Evidence supporting closure"></textarea>
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
              <span>Due date</span>
              <input type="date" formControlName="dueDate">
            </label>
          </div>

          <div class="button-row">
            <button type="submit" [disabled]="form.invalid || saving()">{{ saving() ? 'Saving...' : 'Save CAPA' }}</button>
            <a [routerLink]="selectedId() ? ['/capa', selectedId()] : ['/capa']" class="button-link secondary">Cancel</a>
          </div>
        </form>

        <section class="card panel-card">
          <div class="section-head">
            <div>
              <h3>Workflow guidance</h3>
              <p class="subtle">Raise the issue here, then use the record page for follow-up actions, evidence, and closure review.</p>
            </div>
          </div>
          <div class="entity-list top-space">
            <div class="entity-item">
              <strong>Raise the nonconformity</strong>
              <small>Keep the initial problem statement and source tight and factual.</small>
            </div>
            <div class="entity-item">
              <strong>Capture the root cause and actions</strong>
              <small>Separate correction, corrective action, and preventive action to avoid crowding the record.</small>
            </div>
            <div class="entity-item">
              <strong>Close from the detail page</strong>
              <small>Review due dates, closure evidence, and linked actions before moving to verified or closed.</small>
            </div>
          </div>
          <iso-record-work-items *ngIf="selectedId()" [sourceType]="'capa'" [sourceId]="selectedId()" />
        </section>
      </section>

      <section *ngIf="mode() === 'detail' && selectedCapa()" class="page-columns">
        <div class="page-stack">
          <section class="card detail-card">
            <div class="section-head">
              <div>
                <h3>{{ selectedCapa()?.title }}</h3>
                <p class="subtle">{{ selectedCapa()?.source }}{{ selectedCapa()?.category ? ' | ' + selectedCapa()?.category : '' }}</p>
              </div>
              <span class="status-badge" [class.success]="selectedCapa()?.status === 'CLOSED'" [class.warn]="selectedCapa()?.status === 'IN_PROGRESS'">{{ selectedCapa()?.status }}</span>
            </div>

            <div class="summary-strip top-space">
              <article class="summary-item">
                <span>Owner due date</span>
                <strong>{{ selectedCapa()?.dueDate ? (selectedCapa()?.dueDate | date:'yyyy-MM-dd') : 'Not set' }}</strong>
              </article>
              <article class="summary-item">
                <span>Closed at</span>
                <strong>{{ selectedCapa()?.closedAt ? (selectedCapa()?.closedAt | date:'yyyy-MM-dd HH:mm') : 'Open' }}</strong>
              </article>
              <article class="summary-item">
                <span>Last updated</span>
                <strong>{{ selectedCapa()?.updatedAt | date:'yyyy-MM-dd HH:mm' }}</strong>
              </article>
            </div>

            <dl class="key-value top-space">
              <dt>Problem statement</dt>
              <dd>{{ selectedCapa()?.problemStatement }}</dd>
              <dt>Containment</dt>
              <dd>{{ selectedCapa()?.containmentAction || 'No containment action recorded.' }}</dd>
              <dt>Root cause</dt>
              <dd>{{ selectedCapa()?.rootCause || 'No root cause recorded.' }}</dd>
              <dt>Correction</dt>
              <dd>{{ selectedCapa()?.correction || 'No correction recorded.' }}</dd>
              <dt>Corrective action</dt>
              <dd>{{ selectedCapa()?.correctiveAction || 'No corrective action recorded.' }}</dd>
              <dt>Preventive action</dt>
              <dd>{{ selectedCapa()?.preventiveAction || 'No preventive action recorded.' }}</dd>
              <dt>Verification method</dt>
              <dd>{{ selectedCapa()?.verificationMethod || 'No verification method recorded.' }}</dd>
              <dt>Closure summary</dt>
              <dd>{{ selectedCapa()?.closureSummary || 'No closure summary recorded.' }}</dd>
            </dl>
          </section>
        </div>

        <iso-record-work-items [sourceType]="'capa'" [sourceId]="selectedId()" />
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
export class CapaPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
  protected readonly capas = signal<CapaRow[]>([]);
  protected readonly selectedCapa = signal<CapaRow | null>(null);
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
    source: ['', [Validators.required, Validators.maxLength(80)]],
    category: [''],
    problemStatement: ['', [Validators.required, Validators.maxLength(2000)]],
    containmentAction: [''],
    rootCause: [''],
    correction: [''],
    correctiveAction: [''],
    preventiveAction: [''],
    verificationMethod: [''],
    closureSummary: [''],
    ownerId: [''],
    dueDate: [''],
    status: ['OPEN' as CapaStatus, Validators.required]
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
      list: 'CAPA register',
      create: 'Raise CAPA',
      detail: this.selectedCapa()?.title || 'CAPA detail',
      edit: this.selectedCapa()?.title || 'Edit CAPA'
    }[this.mode()];
  }

  protected pageDescription() {
    return {
      list: 'A cleaner CAPA register for nonconformity ownership, investigation, and closure.',
      create: 'Raise a new CAPA in a dedicated workflow instead of an overloaded split screen.',
      detail: 'Review the problem, cause, actions, and closure evidence in one clear detail page.',
      edit: 'Update CAPA content with a focused edit form.'
    }[this.mode()];
  }

  protected breadcrumbs() {
    if (this.mode() === 'list') return [{ label: 'CAPA' }];
    const base = [{ label: 'CAPA', link: '/capa' }];
    if (this.mode() === 'create') return [...base, { label: 'New CAPA' }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedCapa()?.title || 'CAPA', link: `/capa/${this.selectedId()}` }, { label: 'Edit' }];
    return [...base, { label: this.selectedCapa()?.title || 'CAPA' }];
  }

  protected filteredCapas() {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.capas().filter((item) => {
      const matchesStatus = !status || item.status === status;
      const matchesTerm =
        !term ||
        item.title.toLowerCase().includes(term) ||
        item.source.toLowerCase().includes(term);
      return matchesStatus && matchesTerm;
    });
  }

  protected readInputValue(event: Event) {
    return (event.target as HTMLInputElement).value;
  }

  protected readSelectValue(event: Event) {
    return (event.target as HTMLSelectElement).value;
  }

  protected save() {
    if (this.form.invalid) {
      this.error.set('Complete the required CAPA fields.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    const payload = this.toPayload();
    const request = this.selectedId()
      ? this.api.patch<CapaRow>(`capa/${this.selectedId()}`, payload)
      : this.api.post<CapaRow>('capa', payload);

    request.subscribe({
      next: (capa) => {
        this.saving.set(false);
        this.router.navigate(['/capa', capa.id], { state: { notice: 'CAPA saved successfully.' } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'CAPA save failed.'));
      }
    });
  }

  private handleRoute(params: ParamMap) {
    const id = params.get('id');
    this.selectedId.set(id);
    this.message.set((history.state?.notice as string) || '');
    this.error.set('');

    if (this.mode() === 'list') {
      this.selectedCapa.set(null);
      this.resetFormValues();
      this.reloadCapas();
      return;
    }

    if (this.mode() === 'create') {
      this.selectedCapa.set(null);
      this.resetFormValues();
      return;
    }

    if (id) {
      this.fetchCapa(id);
    }
  }

  private resetFormValues() {
    this.form.reset({
      title: '',
      source: '',
      category: '',
      problemStatement: '',
      containmentAction: '',
      rootCause: '',
      correction: '',
      correctiveAction: '',
      preventiveAction: '',
      verificationMethod: '',
      closureSummary: '',
      ownerId: '',
      dueDate: '',
      status: 'OPEN'
    });
  }

  private reloadCapas() {
    this.loading.set(true);
    this.api.get<CapaRow[]>('capa').subscribe({
      next: (items) => {
        this.loading.set(false);
        this.capas.set(items);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'CAPA register could not be loaded.'));
      }
    });
  }

  private fetchCapa(id: string) {
    this.loading.set(true);
    this.api.get<CapaRow>(`capa/${id}`).subscribe({
      next: (capa) => {
        this.loading.set(false);
        this.selectedCapa.set(capa);
        this.form.reset({
          title: capa.title,
          source: capa.source,
          category: capa.category ?? '',
          problemStatement: capa.problemStatement,
          containmentAction: capa.containmentAction ?? '',
          rootCause: capa.rootCause ?? '',
          correction: capa.correction ?? '',
          correctiveAction: capa.correctiveAction ?? '',
          preventiveAction: capa.preventiveAction ?? '',
          verificationMethod: capa.verificationMethod ?? '',
          closureSummary: capa.closureSummary ?? '',
          ownerId: capa.ownerId ?? '',
          dueDate: capa.dueDate?.slice(0, 10) ?? '',
          status: capa.status
        });
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'CAPA details could not be loaded.'));
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
      source: raw.source.trim(),
      category: raw.category.trim() || undefined,
      problemStatement: raw.problemStatement.trim(),
      containmentAction: raw.containmentAction.trim() || undefined,
      rootCause: raw.rootCause.trim() || undefined,
      correction: raw.correction.trim() || undefined,
      correctiveAction: raw.correctiveAction.trim() || undefined,
      preventiveAction: raw.preventiveAction.trim() || undefined,
      verificationMethod: raw.verificationMethod.trim() || undefined,
      closureSummary: raw.closureSummary.trim() || undefined,
      ownerId: raw.ownerId || undefined,
      dueDate: raw.dueDate || undefined
    };
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}
