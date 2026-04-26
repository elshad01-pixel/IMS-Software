import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
import { PageHeaderComponent } from '../shared/page-header.component';

type ImplementationChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

type ObjectivePlan = {
  focus: string;
  objective: string;
  target: string;
  owner: string;
  reviewFrequency: string;
  linkedModule: string;
};

type ImplementationConfig = {
  enabled: boolean;
  startingPoint: string;
  targetStandards: string[];
  rolloutOwner: string;
  certificationGoal: string;
  checklist: ImplementationChecklistItem[];
  objectivePlan: ObjectivePlan;
};

type PdcaCard = {
  phase: 'Plan' | 'Do' | 'Check' | 'Act';
  summary: string;
  modules: Array<{ label: string; route: string; hint: string }>;
};

type ReadinessChecklistCard = {
  label: string;
  hint: string;
  route: string;
  permission: string;
};

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent],
  template: `
      <section class="page-grid">
        <iso-page-header
        [label]="'Start Here'"
        [title]="'Implementation and readiness path'"
        [description]="'Use this page as the first stop for tenant setup: review the core readiness checklist, then use the optional implementation workspace when guided rollout is needed.'"
        [breadcrumbs]="[{ label: 'Start Here' }]"
      />

      <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">
        {{ error() || message() }}
      </p>

      <div class="empty-state" *ngIf="loading()">
        <strong>Loading implementation workspace</strong>
        <span>Bringing in tenant rollout settings and objective guidance.</span>
      </div>

      <ng-container *ngIf="!loading() && config() as current">
        <section class="card implementation-intro implementation-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Launch point</span>
              <h3>Start here</h3>
              <p class="subtle">Use this page to orient a new tenant quickly. The readiness checklist stays available for everyone with workspace access, and the implementation workspace can remain optional for mature companies.</p>
            </div>
          </div>

          <div class="summary-strip implementation-summary">
            <article class="summary-item">
              <span>Workspace</span>
              <strong>{{ current.enabled ? 'Enabled' : 'Hidden' }}</strong>
            </article>
            <article class="summary-item">
              <span>Starting point</span>
              <strong>{{ startingPointLabel(current.startingPoint) }}</strong>
            </article>
            <article class="summary-item">
              <span>Checklist progress</span>
              <strong>{{ completedChecklistCount() }}/{{ current.checklist.length }}</strong>
            </article>
            <article class="summary-item">
              <span>Objective starter</span>
              <strong>{{ objectiveReadinessLabel() }}</strong>
            </article>
          </div>
        </section>

        <section class="card page-stack implementation-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Readiness</span>
              <h3>Core setup checklist</h3>
              <p class="subtle">Walk through these essentials in order so the tenant has a clear first-use path before deeper rollout work begins.</p>
            </div>
          </div>

          <div class="readiness-grid">
            <article class="readiness-card" *ngFor="let item of readinessChecklist()">
              <div class="readiness-card__top">
                <span class="phase-pill readiness-pill">Setup</span>
                <strong>{{ item.label }}</strong>
              </div>
              <p>{{ item.hint }}</p>
              <a *ngIf="item.accessible; else lockedReadiness" class="readiness-link" [routerLink]="[item.route]" [queryParams]="{ from: 'start-here' }">Open</a>
              <ng-template #lockedReadiness>
                <span class="readiness-state">Needs access</span>
              </ng-template>
            </article>
          </div>
        </section>

        <section class="card guidance-card implementation-card">
          <strong>Recommended first-use flow</strong>
          <p>Company profile -> Users -> Processes -> Documents -> Risks -> Audits -> NCR/CAPA -> KPIs -> Management Review.</p>
        </section>

        <section class="card guidance-card implementation-card" *ngIf="!current.enabled">
          <strong>The implementation workspace is currently hidden for this tenant.</strong>
          <p>
            That is useful for companies that already have ISO implemented and only need the operational modules. This Start Here page still stays available for orientation, and you can turn the deeper rollout workspace back on later in
            <a [routerLink]="['/settings']">Settings</a>.
          </p>
        </section>

        <section class="page-stack" *ngIf="current.enabled">
          <section class="card page-stack implementation-card">
                <div class="section-head">
                  <div>
                    <span class="section-eyebrow">Profile</span>
                    <h3>Rollout profile</h3>
                    <p class="subtle">Keep the setup context short and visible so the tenant knows how this workspace is being used.</p>
                  </div>
                </div>

                <form class="page-stack" [formGroup]="profileForm" (ngSubmit)="saveProfile()" *ngIf="canWrite(); else readOnlyProfile">
                  <label class="toggle-row">
                    <input type="checkbox" formControlName="enabled">
                    <span>Enable implementation workspace</span>
                  </label>

                  <div class="form-grid-2">
                    <label class="field">
                      <span>Starting point</span>
                      <select formControlName="startingPoint">
                        <option value="NEW_IMPLEMENTATION">New implementation</option>
                        <option value="DIGITISING_EXISTING">Digitising an existing system</option>
                        <option value="MATURING_EXISTING">Maturing an already digital system</option>
                      </select>
                    </label>
                    <label class="field">
                      <span>Rollout owner</span>
                      <input formControlName="rolloutOwner" placeholder="Quality Manager">
                    </label>
                  </div>

                  <div class="form-grid-2">
                    <label class="field">
                      <span>Target standards</span>
                      <input formControlName="targetStandards" placeholder="ISO 9001, ISO 14001, ISO 45001">
                    </label>
                    <label class="field">
                      <span>Rollout goal</span>
                      <input formControlName="certificationGoal" placeholder="External certification in Q4 2026">
                    </label>
                  </div>

                  <div class="button-row">
                    <button type="submit" [disabled]="profileForm.invalid || savingSection() === 'profile'">
                      {{ savingSection() === 'profile' ? 'Saving...' : 'Save rollout profile' }}
                    </button>
                  </div>
                </form>

                <ng-template #readOnlyProfile>
                  <div class="entity-list compact-entity-list">
                    <div class="entity-item">
                      <strong>Starting point</strong>
                      <small>{{ startingPointLabel(current.startingPoint) }}</small>
                    </div>
                    <div class="entity-item">
                      <strong>Target standards</strong>
                      <small>{{ current.targetStandards.join(', ') }}</small>
                    </div>
                    <div class="entity-item">
                      <strong>Rollout owner</strong>
                      <small>{{ current.rolloutOwner || 'Not set' }}</small>
                    </div>
                    <div class="entity-item">
                      <strong>Goal</strong>
                      <small>{{ current.certificationGoal || 'Not recorded yet' }}</small>
                    </div>
                  </div>
                </ng-template>
          </section>

          <section class="card page-stack implementation-card">
                <div class="section-head">
                  <div>
                    <span class="section-eyebrow">Checklist</span>
                    <h3>Rollout checkpoints</h3>
                    <p class="subtle">High-level setup only. This should stay lighter than a project plan and simply show whether the basics are in place.</p>
                  </div>
                </div>

                <div class="checklist-grid">
                  <label class="checklist-item" *ngFor="let item of current.checklist">
                    <input type="checkbox" [checked]="item.done" [disabled]="!canWrite() || savingSection() === 'checklist'" (change)="toggleChecklist(item.id, readCheckbox($event))">
                    <span>{{ item.label }}</span>
                  </label>
                </div>
          </section>

          <section class="card page-stack implementation-card">
              <div class="section-head">
                <div>
                  <span class="section-eyebrow">Objectives</span>
                  <h3>Objective establishment starter</h3>
                  <p class="subtle">Keep one practical starter objective here, then move the live measure and readings into KPIs.</p>
                </div>
              </div>

              <form class="page-stack" [formGroup]="objectiveForm" (ngSubmit)="saveObjectivePlan()" *ngIf="canWrite(); else readOnlyObjective">
                <div class="form-grid-2">
                  <label class="field">
                    <span>Business focus</span>
                    <input formControlName="focus" placeholder="Supplier performance and traceability">
                  </label>
                  <label class="field">
                    <span>Objective owner</span>
                    <input formControlName="owner" placeholder="Operations Manager">
                  </label>
                </div>

                <label class="field">
                  <span>Objective statement</span>
                  <textarea rows="3" formControlName="objective" placeholder="Improve on-time supplier approval and reduce traceability gaps by year end."></textarea>
                </label>

                <div class="form-grid-3">
                  <label class="field">
                    <span>Target / measure</span>
                    <input formControlName="target" placeholder="95% approved supplier score by Q4">
                  </label>
                  <label class="field">
                    <span>Review frequency</span>
                    <select formControlName="reviewFrequency">
                      <option>Monthly</option>
                      <option>Quarterly</option>
                      <option>Biannual</option>
                      <option>Annual</option>
                    </select>
                  </label>
                  <label class="field">
                    <span>Linked module</span>
                    <select formControlName="linkedModule">
                      <option>KPIs</option>
                      <option>Risks</option>
                      <option>Management Review</option>
                      <option>Process Register</option>
                    </select>
                  </label>
                </div>

                <div class="button-row">
                  <button type="submit" [disabled]="objectiveForm.invalid || savingSection() === 'objective'">
                    {{ savingSection() === 'objective' ? 'Saving...' : 'Save objective starter' }}
                  </button>
                  <a [routerLink]="['/kpis']" class="button-link secondary">Open KPIs</a>
                </div>
              </form>

              <ng-template #readOnlyObjective>
                <div class="entity-list compact-entity-list">
                  <div class="entity-item">
                    <strong>Business focus</strong>
                    <small>{{ current.objectivePlan.focus || 'Not recorded yet' }}</small>
                  </div>
                  <div class="entity-item">
                    <strong>Objective</strong>
                    <small>{{ current.objectivePlan.objective || 'Not recorded yet' }}</small>
                  </div>
                  <div class="entity-item">
                    <strong>Target / measure</strong>
                    <small>{{ current.objectivePlan.target || 'Not recorded yet' }}</small>
                  </div>
                  <div class="entity-item">
                    <strong>Review cadence</strong>
                    <small>{{ current.objectivePlan.reviewFrequency }}</small>
                  </div>
                </div>
              </ng-template>
          </section>

          <section class="card page-stack implementation-card">
                <div class="section-head">
                  <div>
                    <span class="section-eyebrow">PDCA</span>
                    <h3>Recommended module sequence</h3>
                    <p class="subtle">Use PDCA as a suggested rollout order, not as another register to keep updating.</p>
                  </div>
                </div>

                <div class="pdca-grid">
                  <article class="detail-section pdca-card" *ngFor="let card of pdcaCards">
                    <div class="pdca-card__header">
                      <span class="phase-pill">{{ card.phase }}</span>
                      <h4>{{ card.summary }}</h4>
                    </div>
                    <div class="module-chip-grid top-space">
                      <a class="module-chip" *ngFor="let module of card.modules" [routerLink]="[module.route]">
                        <strong>{{ module.label }}</strong>
                        <small>{{ module.hint }}</small>
                      </a>
                    </div>
                  </article>
                </div>
          </section>
        </section>
      </ng-container>
    </section>
  `,
  styles: [`
    .implementation-card {
      padding: 1.35rem 1.45rem;
    }

    .implementation-intro,
    .implementation-summary {
      display: grid;
      gap: 1rem;
    }

    .implementation-summary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .readiness-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.9rem;
    }

    .readiness-card {
      display: grid;
      gap: 0.65rem;
      min-height: 100%;
      padding: 1rem;
      border: 1px solid rgba(46, 67, 56, 0.08);
      border-radius: 1rem;
      background: rgba(252, 253, 250, 0.86);
    }

    .readiness-card__top {
      display: grid;
      gap: 0.45rem;
    }

    .readiness-card p {
      margin: 0;
      color: var(--muted);
      line-height: 1.5;
    }

    .readiness-pill {
      min-width: 4.2rem;
    }

    .readiness-link,
    .readiness-state {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 2.5rem;
      width: fit-content;
      padding: 0.55rem 0.85rem;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 700;
      text-decoration: none;
    }

    .readiness-link {
      background: rgba(36, 79, 61, 0.1);
      color: var(--brand-strong);
    }

    .readiness-link:hover {
      background: rgba(36, 79, 61, 0.16);
    }

    .readiness-state {
      background: rgba(113, 126, 118, 0.12);
      color: var(--muted-strong);
    }

    .pdca-grid {
      display: grid;
      gap: 1rem;
    }

    .pdca-card {
      min-height: 100%;
    }

    .pdca-card__header {
      display: grid;
      gap: 0.6rem;
    }

    .pdca-card__header h4 {
      margin: 0;
      font-size: 1rem;
      line-height: 1.4;
    }

    .module-chip-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
    }

    .module-chip {
      display: grid;
      gap: 0.15rem;
      padding: 0.85rem 0.9rem;
      border: 1px solid rgba(46, 67, 56, 0.08);
      border-radius: 0.95rem;
      background: rgba(252, 253, 250, 0.82);
      color: inherit;
      text-decoration: none;
      min-width: 0;
    }

    .module-chip:hover {
      border-color: rgba(36, 79, 61, 0.18);
      background: rgba(250, 252, 247, 0.96);
    }

    .module-chip strong {
      color: var(--brand-strong);
    }

    .module-chip small {
      color: var(--muted);
      line-height: 1.35;
    }

    .summary-item strong,
    .entity-item small,
    .module-chip strong,
    .module-chip small,
    .checklist-item span {
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .phase-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 3.1rem;
      padding: 0.3rem 0.65rem;
      border-radius: 999px;
      background: rgba(36, 79, 61, 0.1);
      color: var(--brand-strong);
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-size: 0.72rem;
    }

    .checklist-grid {
      display: grid;
      gap: 0.75rem;
    }

    .checklist-item {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.8rem;
      align-items: start;
      padding: 0.95rem 1rem;
      border: 1px solid rgba(46, 67, 56, 0.1);
      border-radius: 1rem;
      background: rgba(252, 253, 250, 0.82);
    }

    .checklist-item span {
      line-height: 1.45;
    }

    .guidance-card p {
      margin: 0.45rem 0 0;
      line-height: 1.55;
    }

    @media (max-width: 1180px) {
      .readiness-grid,
      .pdca-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 900px) {
      .implementation-card {
        padding: 1.1rem;
      }

      .implementation-summary,
      .readiness-grid,
      .module-chip-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (min-width: 1180px) {
      .module-chip-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `]
})
export class ImplementationPageComponent {
  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);

  protected readonly loading = signal(true);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly savingSection = signal<'profile' | 'objective' | 'checklist' | null>(null);
  protected readonly config = signal<ImplementationConfig | null>(null);

  protected readonly profileForm = this.fb.nonNullable.group({
    enabled: [true],
    startingPoint: ['DIGITISING_EXISTING', Validators.required],
    targetStandards: ['ISO 9001, ISO 14001, ISO 45001', Validators.required],
    rolloutOwner: ['Quality Manager'],
    certificationGoal: ['']
  });

  protected readonly objectiveForm = this.fb.nonNullable.group({
    focus: [''],
    objective: [''],
    target: [''],
    owner: [''],
    reviewFrequency: ['Monthly', Validators.required],
    linkedModule: ['KPIs', Validators.required]
  });

  protected readonly completedChecklistCount = computed(() => this.config()?.checklist.filter((item) => item.done).length ?? 0);
  protected readonly readinessChecklist = computed(() =>
    this.readinessCards.map((item) => ({
      ...item,
      accessible: this.authStore.hasPermission(item.permission)
    }))
  );
  protected readonly objectiveReadinessLabel = computed(() => {
    const current = this.config()?.objectivePlan;
    if (!current) {
      return 'Not loaded';
    }

    const completed = [current.focus, current.objective, current.target, current.owner].filter((value) => value.trim()).length;
    if (completed >= 4) {
      return 'Ready to deploy';
    }
    if (completed >= 2) {
      return 'In progress';
    }
    return 'Needs setup';
  });

  protected readonly pdcaCards: PdcaCard[] = [
    {
      phase: 'Plan',
      summary: 'Define the management system direction before pushing records into daily use.',
      modules: [
        { label: 'Context', route: '/context', hint: 'Scope, issues, interested parties, and needs' },
        { label: 'Obligations', route: '/compliance-obligations', hint: 'External and compliance requirements' },
        { label: 'Risks', route: '/risks', hint: 'Risk and opportunity assessment' },
        { label: 'KPIs', route: '/kpis', hint: 'Objectives, measures, and thresholds' }
      ]
    },
    {
      phase: 'Do',
      summary: 'Deploy controls, competence, and supplier management into daily operations.',
      modules: [
        { label: 'Documents', route: '/documents', hint: 'Policies, procedures, forms, and instructions' },
        { label: 'Process Register', route: '/process-register', hint: 'Process ownership and interfaces' },
        { label: 'Training', route: '/training', hint: 'Competence and assignment follow-up' },
        { label: 'External Providers', route: '/external-providers', hint: 'Supplier and service control' }
      ]
    },
    {
      phase: 'Check',
      summary: 'Use evidence, incidents, and audits to test whether the system is performing as intended.',
      modules: [
        { label: 'Audits', route: '/audits', hint: 'Programme, execution, findings, and reports' },
        { label: 'Incidents', route: '/incidents', hint: 'Incidents, near misses, and investigation' },
        { label: 'Hazards', route: '/hazards', hint: 'OH&S hazard review' },
        { label: 'Environmental Aspects', route: '/environmental-aspects', hint: 'Aspect and impact review' }
      ]
    },
    {
      phase: 'Act',
      summary: 'Drive improvement from findings, failures, changes, and management decisions.',
      modules: [
        { label: 'NCR', route: '/ncr', hint: 'Nonconformity control and investigation' },
        { label: 'CAPA', route: '/capa', hint: 'Corrective action workflow' },
        { label: 'Actions', route: '/actions', hint: 'Cross-module follow-up tracker' },
        { label: 'Management Review', route: '/management-review', hint: 'Decisions, resources, and system effectiveness' }
      ]
    }
  ];
  private readonly readinessCards: ReadinessChecklistCard[] = [
    { label: 'Company profile', hint: 'Confirm tenant identity, numbering defaults, and system setup.', route: '/settings', permission: 'settings.read' },
    { label: 'Users and roles', hint: 'Set access, ownership, and who will operate each module.', route: '/users', permission: 'users.read' },
    { label: 'Process map', hint: 'Define the main processes and how they connect across the system.', route: '/process-register', permission: 'processes.read' },
    { label: 'Controlled documents', hint: 'Load the policies, procedures, forms, and work instructions needed for operation.', route: '/documents', permission: 'documents.read' },
    { label: 'Risks', hint: 'Capture key business, compliance, QHSE, and operational risks early.', route: '/risks', permission: 'risks.read' },
    { label: 'Audits', hint: 'Set the audit programme and prepare how effectiveness will be checked.', route: '/audits', permission: 'audits.read' },
    { label: 'NCR/CAPA/actions', hint: 'Make sure nonconformities, corrective action, and follow-up ownership are ready.', route: '/actions', permission: 'action-items.read' },
    { label: 'KPIs', hint: 'Define the measures and thresholds that show whether the system is working.', route: '/kpis', permission: 'kpis.read' },
    { label: 'Management review', hint: 'Prepare the leadership review path for decisions, resources, and improvement.', route: '/management-review', permission: 'management-review.read' }
  ];

  constructor() {
    this.reload();
  }

  protected canWrite() {
    return this.authStore.hasPermission('settings.write');
  }

  protected startingPointLabel(value: string) {
    const labels: Record<string, string> = {
      NEW_IMPLEMENTATION: 'New implementation',
      DIGITISING_EXISTING: 'Digitising an existing system',
      MATURING_EXISTING: 'Maturing an already digital system'
    };

    return labels[value] ?? value;
  }

  protected readCheckbox(event: Event) {
    return (event.target as HTMLInputElement).checked;
  }

  protected saveProfile() {
    if (!this.canWrite()) {
      this.error.set('You do not have permission to update the implementation workspace.');
      return;
    }

    this.persistImplementation('profile', {
      enabled: this.profileForm.getRawValue().enabled,
      startingPoint: this.profileForm.getRawValue().startingPoint,
      targetStandards: this.parseStandards(),
      rolloutOwner: this.profileForm.getRawValue().rolloutOwner.trim(),
      certificationGoal: this.profileForm.getRawValue().certificationGoal.trim()
    });
  }

  protected saveObjectivePlan() {
    if (!this.canWrite()) {
      this.error.set('You do not have permission to update the implementation workspace.');
      return;
    }

    this.persistImplementation('objective', {
      objectivePlan: {
        ...this.objectiveForm.getRawValue()
      }
    });
  }

  protected toggleChecklist(itemId: string, checked: boolean) {
    if (!this.canWrite()) {
      this.error.set('You do not have permission to update the rollout checklist.');
      return;
    }

    const current = this.config();
    if (!current) {
      return;
    }

    const checklist = current.checklist.map((item) => (item.id === itemId ? { ...item, done: checked } : item));
    this.persistImplementation('checklist', { checklist });
  }

  private reload() {
    this.loading.set(true);
    this.api.get<ImplementationConfig>('settings/implementation').subscribe({
      next: (config) => {
        this.loading.set(false);
        this.applyConfig(config);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Implementation workspace could not be loaded.'));
      }
    });
  }

  private persistImplementation(section: 'profile' | 'objective' | 'checklist', values: Partial<ImplementationConfig>) {
    this.savingSection.set(section);
    this.message.set('');
    this.error.set('');

    this.api.put<unknown>('settings/section/implementation', { values }).subscribe({
      next: (config) => {
        this.savingSection.set(null);
        this.message.set('Implementation workspace updated.');
        this.applyConfig((config as { implementation?: ImplementationConfig }).implementation ?? (config as ImplementationConfig));
      },
      error: (error: HttpErrorResponse) => {
        this.savingSection.set(null);
        this.error.set(this.readError(error, 'Implementation workspace could not be saved.'));
      }
    });
  }

  private applyConfig(config: ImplementationConfig) {
    this.config.set(config);
    this.profileForm.reset({
      enabled: config.enabled,
      startingPoint: config.startingPoint,
      targetStandards: config.targetStandards.join(', '),
      rolloutOwner: config.rolloutOwner,
      certificationGoal: config.certificationGoal
    });
    this.objectiveForm.reset({
      focus: config.objectivePlan.focus,
      objective: config.objectivePlan.objective,
      target: config.objectivePlan.target,
      owner: config.objectivePlan.owner,
      reviewFrequency: config.objectivePlan.reviewFrequency,
      linkedModule: config.objectivePlan.linkedModule
    });
  }

  private parseStandards() {
    return this.profileForm.getRawValue().targetStandards
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}
