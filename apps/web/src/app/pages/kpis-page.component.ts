import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { I18nService } from '../core/i18n.service';
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
        [label]="t('kpis.page.label')"
        [title]="pageTitle()"
        [description]="pageDescription()"
        [breadcrumbs]="breadcrumbs()"
      >
        <a *ngIf="showStartHereBackLink()" [routerLink]="['/implementation']" class="button-link secondary">{{ t('kpis.actions.backToStartHere') }}</a>
        <a *ngIf="mode() === 'list'" routerLink="/kpis/new" class="button-link">+ {{ t('kpis.actions.new') }}</a>
        <a *ngIf="mode() === 'detail' && selectedKpi()" [routerLink]="['/kpis', selectedKpi()?.id, 'edit']" class="button-link">{{ t('kpis.actions.edit') }}</a>
        <a *ngIf="mode() !== 'list'" routerLink="/kpis" class="button-link secondary">{{ t('kpis.actions.backToList') }}</a>
      </iso-page-header>

      <section *ngIf="mode() === 'list'" class="page-stack">
        <div class="card list-card">
          <div class="section-head">
            <div>
              <h3>{{ t('kpis.list.title') }}</h3>
              <p *ngIf="t('kpis.list.copy') as listCopy" class="subtle">{{ listCopy }}</p>
            </div>
          </div>

          <div class="empty-state" *ngIf="loading()">{{ t('kpis.list.loading') }}</div>
          <table class="data-table" *ngIf="!loading()">
            <thead>
              <tr>
                <th>{{ t('kpis.list.table.name') }}</th>
                <th>{{ t('kpis.list.table.current') }}</th>
                <th>{{ t('kpis.list.table.target') }}</th>
                <th>{{ t('kpis.list.table.status') }}</th>
                <th>{{ t('kpis.list.table.managementView') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of kpis()" [routerLink]="['/kpis', item.id]">
                <td><strong>{{ item.name }}</strong></td>
                <td>{{ item.actual }} {{ item.unit }}</td>
                <td>{{ item.target }} {{ item.unit }}</td>
                <td><span class="status-badge" [class.warn]="item.status === 'WATCH'" [class.danger]="item.status === 'BREACH'" [class.success]="item.status === 'ON_TARGET'">{{ statusLabel(item.status) }}</span></td>
                <td>{{ managementView(item) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section *ngIf="mode() === 'create' || mode() === 'edit'" class="page-stack">
        <form class="card form-card page-stack" [formGroup]="kpiForm" (ngSubmit)="saveKpi()">
          <div class="section-head">
            <div>
              <h3>{{ mode() === 'create' ? t('kpis.form.createTitle') : t('kpis.form.editTitle') }}</h3>
              <p class="subtle">{{ t('kpis.form.copy') }}</p>
            </div>
          </div>

          <p class="feedback" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <section class="guidance-card">
            <strong>{{ directionLabel(kpiForm.getRawValue().direction) }}</strong>
            <p>{{ directionGuidance(kpiForm.getRawValue().direction) }}</p>
            <small>{{ t('kpis.form.guidance') }}</small>
          </section>

          <label class="field"><span>{{ t('kpis.form.fields.name') }}</span><input formControlName="name" [placeholder]="t('kpis.form.placeholders.name')"></label>
          <label class="field"><span>{{ t('kpis.form.fields.description') }}</span><textarea rows="3" formControlName="description" [placeholder]="t('kpis.form.placeholders.description')"></textarea></label>
          <div class="form-grid-2">
            <label class="field">
              <span>{{ t('kpis.form.fields.owner') }}</span>
              <select formControlName="ownerId">
                <option value="">{{ t('kpis.common.unassigned') }}</option>
                <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
              </select>
            </label>
            <label class="field">
              <span>{{ t('kpis.form.fields.direction') }}</span>
              <select formControlName="direction">
                <option>AT_LEAST</option>
                <option>AT_MOST</option>
              </select>
            </label>
          </div>
          <div class="form-grid-3">
            <label class="field"><span>{{ t('kpis.form.fields.target') }}</span><input type="number" step="0.01" formControlName="target"></label>
            <label class="field"><span>{{ t('kpis.form.fields.warningThreshold') }}</span><input type="number" step="0.01" formControlName="warningThreshold"></label>
            <label class="field"><span>{{ t('kpis.form.fields.unit') }}</span><input formControlName="unit" [placeholder]="t('kpis.form.placeholders.unit')"></label>
          </div>
          <label class="field"><span>{{ t('kpis.form.fields.periodLabel') }}</span><input formControlName="periodLabel" [placeholder]="t('kpis.form.placeholders.periodLabel')"></label>

          <div class="button-row">
            <button type="submit" [disabled]="kpiForm.invalid || saving()">{{ saving() ? t('kpis.actions.saving') : t('kpis.actions.save') }}</button>
            <a [routerLink]="selectedId() ? ['/kpis', selectedId()] : ['/kpis']" class="button-link secondary">{{ t('common.cancel') }}</a>
          </div>
        </form>

      </section>

      <section *ngIf="mode() === 'detail' && selectedKpi()" class="page-columns">
        <div class="page-stack">
          <section class="card detail-card">
            <div class="section-head">
              <div>
                <h3>{{ selectedKpi()?.name }}</h3>
                <p class="subtle">{{ selectedKpi()?.periodLabel }} {{ t('kpis.detail.periodSuffix') }}</p>
              </div>
              <span class="status-badge" [class.warn]="selectedKpi()?.status === 'WATCH'" [class.danger]="selectedKpi()?.status === 'BREACH'" [class.success]="selectedKpi()?.status === 'ON_TARGET'">{{ statusLabel(selectedKpi()?.status) }}</span>
            </div>

            <div class="summary-strip top-space">
              <article class="summary-item">
                <span>{{ t('kpis.detail.summary.current') }}</span>
                <strong>{{ selectedKpi()?.actual }} {{ selectedKpi()?.unit }}</strong>
              </article>
              <article class="summary-item">
                <span>{{ t('kpis.detail.summary.target') }}</span>
                <strong>{{ selectedKpi()?.target }} {{ selectedKpi()?.unit }}</strong>
              </article>
              <article class="summary-item">
                <span>{{ t('kpis.detail.summary.trend') }}</span>
                <strong>{{ selectedKpi()?.trend }}</strong>
              </article>
            </div>

            <section class="guidance-card top-space">
              <strong>{{ performanceHeadline() }}</strong>
              <p>{{ performanceNarrative() }}</p>
              <small>{{ performanceActionHint() }}</small>
            </section>

            <dl class="key-value top-space">
              <dt>{{ t('kpis.detail.fields.description') }}</dt>
              <dd>{{ selectedKpi()?.description || t('kpis.detail.noDescription') }}</dd>
              <dt>{{ t('kpis.detail.fields.warningThreshold') }}</dt>
              <dd>{{ selectedKpi()?.warningThreshold ?? t('kpis.common.notSet') }}</dd>
              <dt>{{ t('kpis.detail.fields.direction') }}</dt>
              <dd>{{ directionLabel(selectedKpi()?.direction || 'AT_LEAST') }}</dd>
              <dt>{{ t('kpis.detail.fields.distanceToTarget') }}</dt>
              <dd>{{ distanceToTarget() }}</dd>
            </dl>
          </section>

          <section class="card panel-card">
            <div class="section-head">
              <div>
                <h3>{{ t('kpis.readings.title') }}</h3>
                <p class="subtle">{{ t('kpis.readings.copy') }}</p>
              </div>
            </div>

            <form [formGroup]="readingForm" class="page-stack top-space" (ngSubmit)="addReading()">
              <div class="form-grid-2">
                <label class="field"><span>{{ t('kpis.readings.fields.value') }}</span><input type="number" step="0.01" formControlName="value"></label>
                <label class="field"><span>{{ t('kpis.readings.fields.readingDate') }}</span><input type="date" formControlName="readingDate"></label>
              </div>
              <label class="field"><span>{{ t('kpis.readings.fields.notes') }}</span><textarea rows="3" formControlName="notes" [placeholder]="t('kpis.readings.placeholders.notes')"></textarea></label>
              <button type="submit" [disabled]="readingForm.invalid || saving()">{{ t('kpis.readings.actions.add') }}</button>
            </form>

            <div class="entity-list top-space">
              <article class="entity-item" *ngFor="let reading of selectedKpi()?.readings || []">
                <strong>{{ reading.value }} {{ selectedKpi()?.unit }}</strong>
                <small>{{ reading.readingDate | date:'yyyy-MM-dd' }} | {{ reading.notes || readingInterpretation(reading.value) }}</small>
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

    .guidance-card {
      padding: 1rem 1.1rem;
      border: 1px solid rgba(46, 67, 56, 0.1);
      border-radius: 1rem;
      background: rgba(252, 253, 250, 0.82);
    }

    .guidance-card strong,
    .guidance-card p,
    .guidance-card small {
      display: block;
    }

    .guidance-card strong {
      color: #203427;
      font-size: 1rem;
    }

    .guidance-card p,
    .guidance-card small {
      margin-top: 0.4rem;
      color: #617165;
      line-height: 1.45;
    }
  `]
})
export class KpisPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(I18nService);
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

  protected t(key: string, params?: Record<string, unknown>) {
    return this.i18n.t(key, params);
  }

  protected showStartHereBackLink() {
    return this.route.snapshot.queryParamMap.get('from') === 'start-here';
  }

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
      list: this.t('kpis.page.titles.list'),
      create: this.t('kpis.page.titles.create'),
      detail: this.selectedKpi()?.name || this.t('kpis.page.titles.detail'),
      edit: this.selectedKpi()?.name || this.t('kpis.page.titles.edit')
    }[this.mode()];
  }

  protected pageDescription() {
    return {
      list: this.t('kpis.page.descriptions.list'),
      create: this.t('kpis.page.descriptions.create'),
      detail: this.t('kpis.page.descriptions.detail'),
      edit: this.t('kpis.page.descriptions.edit')
    }[this.mode()];
  }

  protected breadcrumbs() {
    if (this.mode() === 'list') return [{ label: this.t('kpis.page.label') }];
    const base = [{ label: this.t('kpis.page.label'), link: '/kpis' }];
    if (this.mode() === 'create') return [...base, { label: this.t('kpis.breadcrumbs.new') }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedKpi()?.name || this.t('kpis.breadcrumbs.record'), link: `/kpis/${this.selectedId()}` }, { label: this.t('kpis.breadcrumbs.edit') }];
    return [...base, { label: this.selectedKpi()?.name || this.t('kpis.breadcrumbs.record') }];
  }

  protected saveKpi() {
    if (this.kpiForm.invalid) {
      this.error.set(this.t('kpis.messages.completeRequired'));
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
        this.router.navigate(['/kpis', kpi.id], { state: { notice: this.t('kpis.messages.saved') } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, this.t('kpis.messages.saveFailed')));
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
        this.message.set(this.t('kpis.messages.readingAdded'));
        this.readingForm.reset({ value: 0, readingDate: '', notes: '' });
        this.fetchKpi(this.selectedId() as string);
        this.reload();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, this.t('kpis.messages.readingSaveFailed')));
      }
    });
  }

  protected directionLabel(direction: KpiDirection) {
    return direction === 'AT_MOST' ? this.t('kpis.direction.atMost') : this.t('kpis.direction.atLeast');
  }

  protected directionGuidance(direction: KpiDirection) {
    return direction === 'AT_MOST'
      ? this.t('kpis.directionGuidance.atMost')
      : this.t('kpis.directionGuidance.atLeast');
  }

  protected managementView(item: KpiRecord) {
    if (item.status === 'BREACH') {
      return this.t('kpis.managementView.breach');
    }
    if (item.status === 'WATCH') {
      return this.t('kpis.managementView.watch');
    }
    return this.t('kpis.managementView.onTarget');
  }

  protected statusLabel(status?: KpiRecord['status'] | null) {
    if (!status) {
      return this.t('kpis.common.notSet');
    }
    return this.t(`kpis.status.${status}`);
  }

  protected performanceHeadline() {
    const kpi = this.selectedKpi();
    if (!kpi) {
      return this.t('kpis.performance.defaultHeadline');
    }
    if (kpi.status === 'BREACH') {
      return this.t('kpis.performance.headlineBreach');
    }
    if (kpi.status === 'WATCH') {
      return this.t('kpis.performance.headlineWatch');
    }
    return this.t('kpis.performance.headlineOnTarget');
  }

  protected performanceNarrative() {
    const kpi = this.selectedKpi();
    if (!kpi) {
      return this.t('kpis.performance.defaultNarrative');
    }
    if (kpi.status === 'BREACH') {
      return this.t('kpis.performance.narrativeBreach', { period: kpi.periodLabel.toLowerCase() });
    }
    if (kpi.status === 'WATCH') {
      return this.t('kpis.performance.narrativeWatch');
    }
    return this.t('kpis.performance.narrativeOnTarget');
  }

  protected performanceActionHint() {
    const kpi = this.selectedKpi();
    if (!kpi) {
      return this.t('kpis.performance.defaultHint');
    }
    if (kpi.status === 'BREACH') {
      return this.t('kpis.performance.hintBreach');
    }
    if (kpi.status === 'WATCH') {
      return this.t('kpis.performance.hintWatch');
    }
    return this.t('kpis.performance.hintOnTarget');
  }

  protected distanceToTarget() {
    const kpi = this.selectedKpi();
    if (!kpi) {
      return this.t('kpis.common.notAvailable');
    }
    const difference = Number((kpi.actual - kpi.target).toFixed(2));
    if (difference === 0) {
      return this.t('kpis.distance.atTarget', { target: kpi.target, unit: kpi.unit });
    }
    if (kpi.direction === 'AT_LEAST') {
      return difference > 0
        ? this.t('kpis.distance.aboveTarget', { difference, unit: kpi.unit })
        : this.t('kpis.distance.belowTarget', { difference: Math.abs(difference), unit: kpi.unit });
    }
    return difference < 0
      ? this.t('kpis.distance.betterThanLimit', { difference: Math.abs(difference), unit: kpi.unit })
      : this.t('kpis.distance.aboveLimit', { difference, unit: kpi.unit });
  }

  protected readingInterpretation(value: number) {
    const kpi = this.selectedKpi();
    if (!kpi) {
      return this.t('kpis.readings.interpretation.logged');
    }
    if (kpi.direction === 'AT_LEAST') {
      if (value >= kpi.target) {
        return this.t('kpis.readings.interpretation.metTarget');
      }
      if (kpi.warningThreshold != null && value >= kpi.warningThreshold) {
        return this.t('kpis.readings.interpretation.watchRange');
      }
      return this.t('kpis.readings.interpretation.breachRange');
    }

    if (value <= kpi.target) {
      return this.t('kpis.readings.interpretation.withinLimit');
    }
    if (kpi.warningThreshold != null && value <= kpi.warningThreshold) {
      return this.t('kpis.readings.interpretation.watchRange');
    }
    return this.t('kpis.readings.interpretation.exceededLimit');
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
        this.error.set(this.readError(error, this.t('kpis.messages.detailLoadFailed')));
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
        this.error.set(this.readError(error, this.t('kpis.messages.listLoadFailed')));
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
