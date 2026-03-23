import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
import { AttachmentPanelComponent } from '../shared/attachment-panel.component';
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

type SettingsConfig = {
  risk: {
    likelihoodScale: number;
    severityScale: number;
  };
};

type RiskRow = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  likelihood: number;
  severity: number;
  score: number;
  existingControls?: string | null;
  plannedMitigationActions?: string | null;
  residualLikelihood?: number | null;
  residualImpact?: number | null;
  residualScore?: number | null;
  issueContextType?: 'INTERNAL' | 'EXTERNAL' | null;
  issueContext?: string | null;
  treatmentPlan?: string | null;
  treatmentSummary?: string | null;
  ownerId?: string | null;
  targetDate?: string | null;
  status: RiskStatus;
  updatedAt: string;
};

@Component({
  selector: 'iso-risks-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, RecordWorkItemsComponent, AttachmentPanelComponent],
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
        <button *ngIf="mode() === 'detail' && canDeleteRisk()" type="button" class="button-link danger" (click)="deleteRisk()">Delete risk</button>
        <a *ngIf="mode() !== 'list'" routerLink="/risks" class="button-link secondary">Back to register</a>
      </iso-page-header>

      <section *ngIf="mode() === 'list'" class="page-stack">
        <div class="card list-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Register</span>
              <h3>Risk register</h3>
              <p class="subtle">A clear enterprise register for risk exposure, treatment ownership, target dates, and live scoring.</p>
            </div>
          </div>

          <div class="toolbar top-space">
            <div class="toolbar-meta">
              <div>
                <p class="toolbar-title">Risk filters</p>
                <p class="toolbar-copy">Search by risk title or category, then open the record for assessment, treatment, and evidence.</p>
              </div>
              <div class="toolbar-stats">
                <article class="toolbar-stat">
                  <span>Total</span>
                  <strong>{{ risks().length }}</strong>
                </article>
                <article class="toolbar-stat">
                  <span>In treatment</span>
                  <strong>{{ countByStatus('IN_TREATMENT') }}</strong>
                </article>
                <article class="toolbar-stat">
                  <span>High score</span>
                  <strong>{{ highRiskCount() }}</strong>
                </article>
              </div>
            </div>

            <div class="filter-row">
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
          </div>

          <div class="empty-state" *ngIf="loading()">
            <strong>Loading risks</strong>
            <span>Refreshing current assessment and treatment data.</span>
          </div>

          <div class="empty-state top-space" *ngIf="!loading() && !filteredRisks().length">
            <strong>No risks match the current filter</strong>
            <span>Adjust the search or create the first risk entry for this tenant.</span>
          </div>

          <div class="data-table-wrap" *ngIf="!loading() && filteredRisks().length">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Risk</th>
                  <th>Assessment</th>
                  <th>Status</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of filteredRisks()" [routerLink]="['/risks', item.id]">
                  <td>
                    <div class="table-title">
                      <strong>{{ item.title }}</strong>
                      <small>{{ item.category || 'General' }}</small>
                    </div>
                  </td>
                  <td>
                    <div class="table-title">
                      <strong>Initial {{ item.score }}{{ item.residualScore ? ' -> Residual ' + item.residualScore : '' }}</strong>
                      <small>L{{ item.likelihood }} x I{{ item.severity }}</small>
                    </div>
                  </td>
                  <td><span class="status-badge" [ngClass]="statusClass(item.status)">{{ item.status }}</span></td>
                  <td>{{ item.targetDate ? (item.targetDate | date:'yyyy-MM-dd') : 'N/A' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section *ngIf="mode() === 'create' || mode() === 'edit'" class="page-columns">
        <form class="card form-card page-stack" [formGroup]="form" (ngSubmit)="save()">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Risk assessment</span>
              <h3>{{ mode() === 'create' ? 'New risk' : 'Edit risk' }}</h3>
              <p class="subtle">Separate the initial risk, mitigation planning, and residual risk review so the assessment reads like a real IMS risk register.</p>
            </div>
          </div>

          <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <section class="detail-section">
            <h4>Risk context</h4>
            <div class="form-grid-2 top-space">
              <label class="field">
                <span>Title</span>
                <input formControlName="title" placeholder="Supplier delivery interruption">
              </label>
              <label class="field">
                <span>Category</span>
                <input formControlName="category" placeholder="Operational">
              </label>
            </div>

            <label class="field top-space">
              <span>Description</span>
              <textarea rows="4" formControlName="description" placeholder="What could happen and why"></textarea>
            </label>

            <div class="form-grid-2 top-space">
              <label class="field">
                <span>Issue context</span>
                <select formControlName="issueContextType">
                  <option value="">Not linked</option>
                  <option value="INTERNAL">Internal issue</option>
                  <option value="EXTERNAL">External issue</option>
                </select>
              </label>
              <label class="field">
                <span>Issue reference</span>
                <input formControlName="issueContext" placeholder="Strategic supplier dependency">
              </label>
            </div>
          </section>

          <section class="detail-section">
            <h4>Initial risk</h4>
            <div class="form-grid-3 top-space">
              <label class="field">
                <span>Likelihood</span>
                <input type="number" min="1" [attr.max]="likelihoodScaleMax()" formControlName="likelihood">
              </label>
              <label class="field">
                <span>Impact</span>
                <input type="number" min="1" [attr.max]="severityScaleMax()" formControlName="severity">
              </label>
            </div>

            <div class="summary-strip top-space">
              <article class="summary-item">
                <span>Initial score</span>
                <strong>{{ currentScore() }}</strong>
              </article>
              <article class="summary-item">
                <span>Risk level</span>
                <strong [class]="scoreToneClass(currentScore())">{{ riskLevelLabel(currentScore()) }}</strong>
              </article>
            </div>
          </section>

          <section class="detail-section">
            <h4>Mitigation</h4>
            <label class="field top-space">
              <span>Existing controls</span>
              <textarea rows="3" formControlName="existingControls" placeholder="Current controls already reducing the risk"></textarea>
            </label>

            <label class="field top-space">
              <span>Planned mitigation actions</span>
              <textarea rows="3" formControlName="plannedMitigationActions" placeholder="Additional mitigation actions to reduce the risk"></textarea>
            </label>

            <div class="form-grid-2 top-space">
              <label class="field">
                <span>Owner</span>
                <select formControlName="ownerId">
                  <option value="">Unassigned</option>
                  <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
                </select>
              </label>
              <label class="field">
                <span>Due date</span>
                <input type="date" formControlName="targetDate">
              </label>
            </div>

            <label class="field top-space">
              <span>Status</span>
              <select formControlName="status">
                <option>OPEN</option>
                <option>IN_TREATMENT</option>
                <option>MITIGATED</option>
                <option>ACCEPTED</option>
                <option>CLOSED</option>
              </select>
            </label>
          </section>

          <section class="detail-section">
            <h4>Residual risk</h4>
            <div class="form-grid-3 top-space">
              <label class="field">
                <span>Residual likelihood</span>
                <input type="number" min="1" [attr.max]="likelihoodScaleMax()" formControlName="residualLikelihood">
              </label>
              <label class="field">
                <span>Residual impact</span>
                <input type="number" min="1" [attr.max]="severityScaleMax()" formControlName="residualImpact">
              </label>
            </div>

            <div class="summary-strip top-space">
              <article class="summary-item">
                <span>Residual score</span>
                <strong>{{ currentResidualScore() ?? 'Not assessed' }}</strong>
              </article>
              <article class="summary-item">
                <span>Residual level</span>
                <strong [class]="scoreToneClass(currentResidualScore())">{{ riskLevelLabel(currentResidualScore()) }}</strong>
              </article>
            </div>
          </section>

          <div class="button-row">
            <button type="submit" [disabled]="form.invalid || saving()">{{ saving() ? 'Saving...' : 'Save risk' }}</button>
            <a [routerLink]="selectedId() ? ['/risks', selectedId()] : ['/risks']" class="button-link secondary">Cancel</a>
          </div>
        </form>

        <section class="card panel-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Control pattern</span>
              <h3>Workflow guidance</h3>
              <p class="subtle">Capture the initial risk, define mitigation, then assess the residual position once controls are planned.</p>
            </div>
          </div>
          <div class="entity-list top-space">
            <div class="entity-item">
              <strong>Assess the initial risk</strong>
              <small>Use likelihood and impact to score the risk before any new mitigation is introduced.</small>
            </div>
            <div class="entity-item">
              <strong>Plan the mitigation</strong>
              <small>Record existing controls, planned mitigation actions, ownership, and due date in one place.</small>
            </div>
            <div class="entity-item">
              <strong>Review the residual risk</strong>
              <small>Re-score the risk after mitigation and track execution with linked mitigation actions.</small>
            </div>
          </div>
          <iso-attachment-panel *ngIf="selectedId()" [sourceType]="'risk'" [sourceId]="selectedId()" />
        </section>
      </section>

      <section *ngIf="mode() === 'detail' && selectedRisk()" class="page-columns">
        <div class="page-stack">
          <section class="card detail-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Risk detail</span>
                <h3>{{ selectedRisk()?.title }}</h3>
                <p class="subtle">{{ selectedRisk()?.category || 'General' }}</p>
              </div>
              <span class="status-badge" [ngClass]="statusClass(selectedRisk()?.status || 'OPEN')">{{ selectedRisk()?.status }}</span>
            </div>

            <div class="summary-strip top-space">
              <article class="summary-item">
                <span>Likelihood</span>
                <strong>{{ selectedRisk()?.likelihood }}</strong>
              </article>
              <article class="summary-item">
                <span>Impact</span>
                <strong>{{ selectedRisk()?.severity }}</strong>
              </article>
              <article class="summary-item">
                <span>Initial score</span>
                <strong>{{ selectedRisk()?.score }}</strong>
              </article>
              <article class="summary-item">
                <span>Level</span>
                <strong [class]="scoreToneClass(selectedRisk()?.score ?? null)">{{ riskLevelLabel(selectedRisk()?.score ?? null) }}</strong>
              </article>
            </div>

            <div class="section-grid-2 top-space">
              <section class="detail-section">
                <h4>Description</h4>
                <p>{{ selectedRisk()?.description || 'No description provided.' }}</p>
              </section>
              <section class="detail-section">
                <h4>Issue context</h4>
                <p>{{ selectedRisk()?.issueContextType ? (selectedRisk()?.issueContextType + ' | ') : '' }}{{ selectedRisk()?.issueContext || 'No issue context linked.' }}</p>
              </section>
            </div>

            <section class="detail-section top-space">
              <h4>Mitigation</h4>
              <div class="section-grid-2 top-space">
                <section class="detail-section">
                  <h4>Existing controls</h4>
                  <p>{{ selectedRisk()?.existingControls || selectedRisk()?.treatmentSummary || 'No existing controls recorded.' }}</p>
                </section>
                <section class="detail-section">
                  <h4>Planned mitigation actions</h4>
                  <p>{{ selectedRisk()?.plannedMitigationActions || selectedRisk()?.treatmentPlan || 'No planned mitigation actions recorded.' }}</p>
                </section>
              </div>
            </section>

            <section class="detail-section top-space">
              <h4>Residual risk</h4>
              <div class="summary-strip top-space" *ngIf="selectedRisk()?.residualLikelihood && selectedRisk()?.residualImpact; else residualEmpty">
                <article class="summary-item">
                  <span>Residual likelihood</span>
                  <strong>{{ selectedRisk()?.residualLikelihood }}</strong>
                </article>
                <article class="summary-item">
                  <span>Residual impact</span>
                  <strong>{{ selectedRisk()?.residualImpact }}</strong>
                </article>
                <article class="summary-item">
                  <span>Residual score</span>
                  <strong>{{ selectedRisk()?.residualScore }}</strong>
                </article>
                <article class="summary-item">
                  <span>Residual level</span>
                  <strong [class]="scoreToneClass(selectedRisk()?.residualScore ?? null)">{{ riskLevelLabel(selectedRisk()?.residualScore ?? null) }}</strong>
                </article>
              </div>
              <ng-template #residualEmpty>
                <p>No residual risk assessment recorded yet.</p>
              </ng-template>
            </section>

            <dl class="key-value top-space">
              <dt>Due date</dt>
              <dd>{{ selectedRisk()?.targetDate ? (selectedRisk()?.targetDate | date:'yyyy-MM-dd') : 'Not set' }}</dd>
              <dt>Last updated</dt>
              <dd>{{ selectedRisk()?.updatedAt | date:'yyyy-MM-dd HH:mm' }}</dd>
            </dl>
          </section>

          <iso-record-work-items [sourceType]="'risk'" [sourceId]="selectedId()" />
        </div>

        <div class="page-stack">
          <iso-attachment-panel [sourceType]="'risk'" [sourceId]="selectedId()" />
        </div>
      </section>
    </section>
  `,
  styles: [`
    .top-space {
      margin-top: 1rem;
    }

    .tone-low {
      color: #2f6b45;
    }

    .tone-medium {
      color: #8a6322;
    }

    .tone-high {
      color: #b0493a;
    }

    .tone-neutral {
      color: var(--muted);
    }

    tr[routerLink] {
      cursor: pointer;
    }
  `]
})
export class RisksPageComponent implements OnInit, OnChanges {
  @Input() forcedMode: PageMode | null = null;

  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
  protected readonly risks = signal<RiskRow[]>([]);
  protected readonly selectedRisk = signal<RiskRow | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly users = signal<UserOption[]>([]);
  protected readonly settings = signal<SettingsConfig | null>(null);
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
    likelihood: [3, [Validators.required, Validators.min(1)]],
    severity: [3, [Validators.required, Validators.min(1)]],
    existingControls: [''],
    plannedMitigationActions: [''],
    residualLikelihood: [null as number | null],
    residualImpact: [null as number | null],
    issueContextType: [''],
    issueContext: [''],
    treatmentPlan: [''],
    treatmentSummary: [''],
    ownerId: [''],
    targetDate: [''],
    status: ['OPEN' as RiskStatus, Validators.required]
  });

  ngOnInit() {
    this.loadUsers();
    this.loadSettings();
    if (this.forcedMode) {
      this.mode.set(this.forcedMode);
      this.handleRoute(this.route.snapshot.paramMap);
    } else {
      this.route.data.subscribe((data) => {
        this.mode.set((data['mode'] as PageMode) || 'list');
        this.handleRoute(this.route.snapshot.paramMap);
      });
    }
    this.route.paramMap.subscribe((params) => this.handleRoute(params));
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['forcedMode'] && this.forcedMode) {
      this.mode.set(this.forcedMode);
      this.handleRoute(this.route.snapshot.paramMap);
    }
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

  protected currentResidualScore() {
    const raw = this.form.getRawValue();
    if (!raw.residualLikelihood || !raw.residualImpact) {
      return null;
    }

    return Number(raw.residualLikelihood) * Number(raw.residualImpact);
  }

  protected countByStatus(status: RiskStatus) {
    return this.risks().filter((item) => item.status === status).length;
  }

  protected highRiskCount() {
    return this.risks().filter((item) => item.score >= 15).length;
  }

  protected statusClass(status: RiskStatus) {
    if (status === 'IN_TREATMENT') {
      return 'warn';
    }

    if (status === 'CLOSED') {
      return 'neutral';
    }

    if (status === 'MITIGATED' || status === 'ACCEPTED') {
      return 'success';
    }

    return 'danger';
  }

  protected riskLevelLabel(score: number | null) {
    if (!score) {
      return 'Not assessed';
    }

    const maxScore = this.likelihoodScaleMax() * this.severityScaleMax();
    const ratio = score / maxScore;
    if (ratio <= 0.24) {
      return 'Low';
    }
    if (ratio <= 0.6) {
      return 'Medium';
    }
    return 'High';
  }

  protected scoreToneClass(score: number | null) {
    const level = this.riskLevelLabel(score);
    if (level === 'Low') {
      return 'tone-low';
    }
    if (level === 'Medium') {
      return 'tone-medium';
    }
    if (level === 'High') {
      return 'tone-high';
    }
    return 'tone-neutral';
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

  protected canDeleteRisk() {
    return this.authStore.hasPermission('admin.delete') && !!this.selectedId();
  }

  protected deleteRisk() {
    if (!this.selectedId() || !this.canDeleteRisk()) {
      return;
    }

    if (!window.confirm('Delete this risk from the active register? The action will be audit logged.')) {
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.api.delete(`risks/${this.selectedId()}`).subscribe({
      next: () => {
        this.saving.set(false);
        void this.router.navigate(['/risks'], { state: { notice: 'Risk deleted.' } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Risk deletion failed.'));
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
        existingControls: '',
        plannedMitigationActions: '',
        residualLikelihood: null,
        residualImpact: null,
        issueContextType: '',
        issueContext: '',
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
        existingControls: '',
        plannedMitigationActions: '',
        residualLikelihood: null,
        residualImpact: null,
        issueContextType: '',
        issueContext: '',
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
          existingControls: risk.existingControls ?? risk.treatmentSummary ?? '',
          plannedMitigationActions: risk.plannedMitigationActions ?? risk.treatmentPlan ?? '',
          residualLikelihood: risk.residualLikelihood ?? null,
          residualImpact: risk.residualImpact ?? null,
          issueContextType: risk.issueContextType ?? '',
          issueContext: risk.issueContext ?? '',
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

  private loadSettings() {
    this.api.get<SettingsConfig>('settings/config').subscribe({
      next: (settings) => {
        this.settings.set(settings);
        const raw = this.form.getRawValue();
        this.form.patchValue({
          likelihood: Math.min(Number(raw.likelihood), this.likelihoodScaleMax()),
          severity: Math.min(Number(raw.severity), this.severityScaleMax())
        }, { emitEvent: false });
      }
    });
  }

  private toPayload() {
    const raw = this.form.getRawValue();
    return {
      ...raw,
      title: raw.title.trim(),
      description: raw.description.trim() || undefined,
      category: raw.category.trim() || undefined,
      existingControls: raw.existingControls.trim() || undefined,
      plannedMitigationActions: raw.plannedMitigationActions.trim() || undefined,
      residualLikelihood: raw.residualLikelihood || undefined,
      residualImpact: raw.residualImpact || undefined,
      issueContextType: raw.issueContextType || undefined,
      issueContext: raw.issueContext.trim() || undefined,
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

  protected likelihoodScaleMax() {
    return this.settings()?.risk.likelihoodScale ?? 5;
  }

  protected severityScaleMax() {
    return this.settings()?.risk.severityScale ?? 5;
  }
}

@Component({
  standalone: true,
  imports: [RisksPageComponent],
  template: `<iso-risks-page [forcedMode]="'list'" />`
})
export class RisksRegisterPageComponent {}

@Component({
  standalone: true,
  imports: [RisksPageComponent],
  template: `<iso-risks-page [forcedMode]="'create'" />`
})
export class RiskCreatePageComponent {}

@Component({
  standalone: true,
  imports: [RisksPageComponent],
  template: `<iso-risks-page [forcedMode]="'detail'" />`
})
export class RiskDetailPageComponent {}

@Component({
  standalone: true,
  imports: [RisksPageComponent],
  template: `<iso-risks-page [forcedMode]="'edit'" />`
})
export class RiskEditPageComponent {}
