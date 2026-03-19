import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { PageHeaderComponent } from '../shared/page-header.component';

type PageMode = 'list' | 'create' | 'detail' | 'edit';
type KpiDirection = 'AT_LEAST' | 'AT_MOST';

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type SettingsConfig = {
  kpi: {
    greenThreshold: number;
    warningThreshold: number;
    breachThreshold: number;
  };
};

type KpiReading = {
  id: string;
  value: number;
  readingDate: string;
  notes?: string | null;
};

type KpiRecord = {
  id: string;
  name: string;
  description?: string | null;
  ownerId?: string | null;
  target: number;
  warningThreshold?: number | null;
  actual: number;
  unit: string;
  periodLabel: string;
  direction: KpiDirection;
  status: 'ON_TARGET' | 'WATCH' | 'BREACH';
  trend: number;
  readings: KpiReading[];
};

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="'KPIs'"
        [title]="pageTitle()"
        [description]="pageDescription()"
        [breadcrumbs]="breadcrumbs()"
      >
        <a *ngIf="mode() === 'list'" routerLink="/kpis/new" class="button-link">+ New KPI</a>
        <a *ngIf="mode() === 'detail' && selectedKpi()" [routerLink]="['/kpis', selectedKpi()?.id, 'edit']" class="button-link">Edit KPI</a>
        <a *ngIf="mode() !== 'list'" routerLink="/kpis" class="button-link secondary">Back to KPIs</a>
      </iso-page-header>

      <section *ngIf="mode() === 'list'" class="page-stack">
        <div class="card list-card">
          <div class="section-head">
            <div>
              <h3>KPI register</h3>
              <p class="subtle">Track current performance, targets, thresholds, and watch or breach states in one calm list.</p>
            </div>
          </div>

          <div class="empty-state" *ngIf="loading()">Loading KPIs...</div>
          <table class="data-table" *ngIf="!loading()">
            <thead>
              <tr>
                <th>Name</th>
                <th>Current</th>
                <th>Target</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of kpis()" [routerLink]="['/kpis', item.id]">
                <td><strong>{{ item.name }}</strong></td>
                <td>{{ item.actual }} {{ item.unit }}</td>
                <td>{{ item.target }} {{ item.unit }}</td>
                <td><span class="status-badge" [class.warn]="item.status === 'WATCH'" [class.danger]="item.status === 'BREACH'" [class.success]="item.status === 'ON_TARGET'">{{ item.status }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section *ngIf="mode() === 'create' || mode() === 'edit'" class="page-columns">
        <form class="card form-card page-stack" [formGroup]="kpiForm" (ngSubmit)="saveKpi()">
          <div class="section-head">
            <div>
              <h3>{{ mode() === 'create' ? 'Create KPI' : 'Edit KPI' }}</h3>
              <p class="subtle">Define target logic cleanly here. Readings and trend history stay on the KPI detail page.</p>
            </div>
          </div>

          <p class="feedback" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <label class="field"><span>Name</span><input formControlName="name" placeholder="Supplier OTIF"></label>
          <label class="field"><span>Description</span><textarea rows="3" formControlName="description" placeholder="On-time in-full supplier delivery rate"></textarea></label>
          <div class="form-grid-2">
            <label class="field">
              <span>Owner</span>
              <select formControlName="ownerId">
                <option value="">Unassigned</option>
                <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
              </select>
            </label>
            <label class="field">
              <span>Direction</span>
              <select formControlName="direction">
                <option>AT_LEAST</option>
                <option>AT_MOST</option>
              </select>
            </label>
          </div>
          <div class="form-grid-3">
            <label class="field"><span>Target</span><input type="number" step="0.01" formControlName="target"></label>
            <label class="field"><span>Warning threshold</span><input type="number" step="0.01" formControlName="warningThreshold"></label>
            <label class="field"><span>Unit</span><input formControlName="unit" placeholder="%"></label>
          </div>
          <label class="field"><span>Period label</span><input formControlName="periodLabel" placeholder="Monthly"></label>

          <div class="button-row">
            <button type="submit" [disabled]="kpiForm.invalid || saving()">{{ saving() ? 'Saving...' : 'Save KPI' }}</button>
            <a [routerLink]="selectedId() ? ['/kpis', selectedId()] : ['/kpis']" class="button-link secondary">Cancel</a>
          </div>
        </form>

        <section class="card panel-card">
          <div class="section-head">
            <div>
              <h3>Definition guidance</h3>
              <p class="subtle">Targets and thresholds stay readable here; trend history belongs on the KPI record.</p>
            </div>
          </div>
          <div class="entity-list top-space">
            <div class="entity-item">
              <strong>Define the KPI</strong>
              <small>Set the direction, target, threshold, unit, and period clearly.</small>
            </div>
            <div class="entity-item">
              <strong>Add readings later</strong>
              <small>Use the detail page for current value updates and trend history.</small>
            </div>
          </div>
        </section>
      </section>

      <section *ngIf="mode() === 'detail' && selectedKpi()" class="page-columns">
        <div class="page-stack">
          <section class="card detail-card">
            <div class="section-head">
              <div>
                <h3>{{ selectedKpi()?.name }}</h3>
                <p class="subtle">{{ selectedKpi()?.periodLabel }} KPI</p>
              </div>
              <span class="status-badge" [class.warn]="selectedKpi()?.status === 'WATCH'" [class.danger]="selectedKpi()?.status === 'BREACH'" [class.success]="selectedKpi()?.status === 'ON_TARGET'">{{ selectedKpi()?.status }}</span>
            </div>

            <div class="summary-strip top-space">
              <article class="summary-item">
                <span>Current</span>
                <strong>{{ selectedKpi()?.actual }} {{ selectedKpi()?.unit }}</strong>
              </article>
              <article class="summary-item">
                <span>Target</span>
                <strong>{{ selectedKpi()?.target }} {{ selectedKpi()?.unit }}</strong>
              </article>
              <article class="summary-item">
                <span>Trend</span>
                <strong>{{ selectedKpi()?.trend }}</strong>
              </article>
            </div>

            <dl class="key-value top-space">
              <dt>Description</dt>
              <dd>{{ selectedKpi()?.description || 'No description provided.' }}</dd>
              <dt>Warning threshold</dt>
              <dd>{{ selectedKpi()?.warningThreshold ?? 'Not set' }}</dd>
              <dt>Direction</dt>
              <dd>{{ selectedKpi()?.direction }}</dd>
            </dl>
          </section>

          <section class="card panel-card">
            <div class="section-head">
              <div>
                <h3>Readings</h3>
                <p class="subtle">Add current readings and keep recent history visible below.</p>
              </div>
            </div>

            <form [formGroup]="readingForm" class="page-stack top-space" (ngSubmit)="addReading()">
              <div class="form-grid-2">
                <label class="field"><span>Value</span><input type="number" step="0.01" formControlName="value"></label>
                <label class="field"><span>Reading date</span><input type="date" formControlName="readingDate"></label>
              </div>
              <label class="field"><span>Notes</span><textarea rows="3" formControlName="notes" placeholder="Reading notes"></textarea></label>
              <button type="submit" [disabled]="readingForm.invalid || saving()">Add reading</button>
            </form>

            <div class="entity-list top-space">
              <article class="entity-item" *ngFor="let reading of selectedKpi()?.readings || []">
                <strong>{{ reading.value }} {{ selectedKpi()?.unit }}</strong>
                <small>{{ reading.readingDate | date:'yyyy-MM-dd' }} | {{ reading.notes || 'No notes' }}</small>
              </article>
            </div>
          </section>
        </div>
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
export class KpisPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
  protected readonly kpis = signal<KpiRecord[]>([]);
  protected readonly users = signal<UserOption[]>([]);
  protected readonly settings = signal<SettingsConfig | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selectedKpi = signal<KpiRecord | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal((history.state?.notice as string) || '');
  protected readonly error = signal('');

  protected readonly kpiForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    description: [''],
    ownerId: [''],
    target: [0, Validators.required],
    warningThreshold: [0],
    unit: ['', [Validators.required, Validators.maxLength(20)]],
    periodLabel: ['', [Validators.required, Validators.maxLength(60)]],
    direction: ['AT_LEAST' as KpiDirection, Validators.required]
  });

  protected readonly readingForm = this.fb.nonNullable.group({
    value: [0, Validators.required],
    readingDate: ['', Validators.required],
    notes: ['']
  });

  constructor() {
    this.loadUsers();
    this.loadSettings();
    this.route.data.subscribe((data) => {
      this.mode.set((data['mode'] as PageMode) || 'list');
      this.handleRoute(this.route.snapshot.paramMap);
    });
    this.route.paramMap.subscribe((params) => this.handleRoute(params));
  }

  protected pageTitle() {
    return {
      list: 'KPI register',
      create: 'Create KPI',
      detail: this.selectedKpi()?.name || 'KPI detail',
      edit: this.selectedKpi()?.name || 'Edit KPI'
    }[this.mode()];
  }

  protected pageDescription() {
    return {
      list: 'A focused list of KPI definitions and current status against target.',
      create: 'Define a KPI in its own page without mixing reading history into the same screen.',
      detail: 'Review current status, thresholds, and reading history in one clean KPI record.',
      edit: 'Adjust the KPI definition in a dedicated editing workflow.'
    }[this.mode()];
  }

  protected breadcrumbs() {
    if (this.mode() === 'list') return [{ label: 'KPIs' }];
    const base = [{ label: 'KPIs', link: '/kpis' }];
    if (this.mode() === 'create') return [...base, { label: 'New KPI' }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedKpi()?.name || 'KPI', link: `/kpis/${this.selectedId()}` }, { label: 'Edit' }];
    return [...base, { label: this.selectedKpi()?.name || 'KPI' }];
  }

  protected saveKpi() {
    if (this.kpiForm.invalid) {
      this.error.set('Complete the required KPI fields.');
      return;
    }

    this.saving.set(true);
    this.message.set('');
    this.error.set('');
    const raw = this.kpiForm.getRawValue();
    const payload = {
      ...raw,
      name: raw.name.trim(),
      description: raw.description.trim() || undefined,
      ownerId: raw.ownerId || undefined,
      warningThreshold: raw.warningThreshold || undefined,
      unit: raw.unit.trim(),
      periodLabel: raw.periodLabel.trim()
    };

    const request = this.selectedId()
      ? this.api.patch<KpiRecord>(`kpis/${this.selectedId()}`, payload)
      : this.api.post<KpiRecord>('kpis', payload);

    request.subscribe({
      next: (kpi) => {
        this.saving.set(false);
        this.router.navigate(['/kpis', kpi.id], { state: { notice: 'KPI saved successfully.' } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'KPI save failed.'));
      }
    });
  }

  protected addReading() {
    if (!this.selectedId() || this.readingForm.invalid) {
      return;
    }

    this.saving.set(true);
    const raw = this.readingForm.getRawValue();
    this.api.post(`kpis/${this.selectedId()}/readings`, {
      ...raw,
      notes: raw.notes.trim() || undefined
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('KPI reading added.');
        this.readingForm.reset({ value: 0, readingDate: '', notes: '' });
        this.fetchKpi(this.selectedId() as string);
        this.reload();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'KPI reading save failed.'));
      }
    });
  }

  private handleRoute(params: ParamMap) {
    const id = params.get('id');
    this.selectedId.set(id);
    this.message.set((history.state?.notice as string) || '');
    this.error.set('');

    if (this.mode() === 'list') {
      this.selectedKpi.set(null);
      this.resetForms();
      this.reload();
      return;
    }

    if (this.mode() === 'create') {
      this.selectedKpi.set(null);
      this.resetForms();
      return;
    }

    if (id) {
      this.fetchKpi(id);
    }
  }

  private resetForms() {
    this.kpiForm.reset({
      name: '',
      description: '',
      ownerId: '',
      target: this.defaultTarget(),
      warningThreshold: this.defaultWarningThreshold(),
      unit: '',
      periodLabel: '',
      direction: 'AT_LEAST'
    });
    this.readingForm.reset({ value: 0, readingDate: '', notes: '' });
  }

  private fetchKpi(id: string) {
    this.loading.set(true);
    this.api.get<KpiRecord>(`kpis/${id}`).subscribe({
      next: (kpi) => {
        this.loading.set(false);
        this.selectedKpi.set(kpi);
        this.kpiForm.reset({
          name: kpi.name,
          description: kpi.description ?? '',
          ownerId: kpi.ownerId ?? '',
          target: kpi.target,
          warningThreshold: kpi.warningThreshold ?? 0,
          unit: kpi.unit,
          periodLabel: kpi.periodLabel,
          direction: kpi.direction
        });
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'KPI details could not be loaded.'));
      }
    });
  }

  private reload() {
    this.loading.set(true);
    this.api.get<KpiRecord[]>('kpis').subscribe({
      next: (items) => {
        this.loading.set(false);
        this.kpis.set(items);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'KPIs could not be loaded.'));
      }
    });
  }

  private loadUsers() {
    this.api.get<UserOption[]>('users').subscribe((users) => this.users.set(users));
  }

  private loadSettings() {
    this.api.get<SettingsConfig>('settings/config').subscribe({
      next: (settings) => {
        this.settings.set(settings);
        if (this.mode() === 'create') {
          this.kpiForm.patchValue({
            target: this.defaultTarget(),
            warningThreshold: this.defaultWarningThreshold()
          }, { emitEvent: false });
        }
      }
    });
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }

  protected defaultTarget() {
    return this.settings()?.kpi.greenThreshold ?? 100;
  }

  protected defaultWarningThreshold() {
    return this.settings()?.kpi.warningThreshold ?? 90;
  }
}
