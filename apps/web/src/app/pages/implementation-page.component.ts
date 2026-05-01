import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
import { I18nService } from '../core/i18n.service';
import { PackageModuleKey } from '../core/package-entitlements';
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
  summaryKey: string;
  modules: Array<{ label: string; route: string; hintKey: string; packageModule: PackageModuleKey }>;
};

type ReadinessChecklistCard = {
  id: string;
  labelKey: string;
  hintKey: string;
  route: string;
  permission: string;
  packageModule: PackageModuleKey;
};

const CHECKLIST_LABEL_KEYS: Record<string, string> = {
  'scope-context': 'implementation.checklist.items.scopeContext',
  'policy-documents': 'implementation.checklist.items.policyDocuments',
  'objectives-kpis': 'implementation.checklist.items.objectivesKpis',
  'process-risk': 'implementation.checklist.items.processRisk',
  'operations-training': 'implementation.checklist.items.operationsTraining',
  'audit-review': 'implementation.checklist.items.auditReview'
};

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, TranslatePipe],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="pageHeader().label"
        [title]="pageHeader().title"
        [description]="pageHeader().description"
        [breadcrumbs]="[{ label: pageHeader().breadcrumb }]"
      />

      <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">
        {{ error() || message() }}
      </p>

      <div class="empty-state" *ngIf="loading()">
        <strong>{{ 'implementation.feedback.loadingTitle' | translate }}</strong>
        <span>{{ 'implementation.feedback.loadingCopy' | translate }}</span>
      </div>

      <ng-container *ngIf="!loading() && config() as current">
        <section class="card implementation-intro implementation-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">{{ 'implementation.intro.eyebrow' | translate }}</span>
              <h3>{{ 'implementation.intro.title' | translate }}</h3>
              <p class="subtle">{{ 'implementation.intro.copy' | translate }}</p>
            </div>
          </div>

          <div class="summary-strip implementation-summary">
            <article class="summary-item">
              <span>{{ 'implementation.summary.workspace' | translate }}</span>
              <strong>{{ current.enabled ? ('common.enabled' | translate) : ('common.hidden' | translate) }}</strong>
            </article>
            <article class="summary-item">
              <span>{{ 'implementation.summary.startingPoint' | translate }}</span>
              <strong>{{ startingPointLabel(current.startingPoint) }}</strong>
            </article>
            <article class="summary-item">
              <span>{{ 'implementation.summary.checklistProgress' | translate }}</span>
              <strong>{{ completedChecklistCount() }}/{{ current.checklist.length }}</strong>
            </article>
            <article class="summary-item">
              <span>{{ 'implementation.summary.objectiveStarter' | translate }}</span>
              <strong>{{ objectiveReadinessLabel() }}</strong>
            </article>
          </div>
        </section>

        <section class="card page-stack implementation-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">{{ 'implementation.readiness.eyebrow' | translate }}</span>
              <h3>{{ 'implementation.readiness.title' | translate }}</h3>
              <p class="subtle">{{ 'implementation.readiness.copy' | translate }}</p>
            </div>
          </div>

          <div class="readiness-grid">
            <article class="readiness-card" *ngFor="let item of readinessChecklist()">
              <div class="readiness-card__top">
                <span class="phase-pill readiness-pill">{{ 'implementation.readiness.setupPill' | translate }}</span>
                <strong>{{ item.labelKey | translate }}</strong>
              </div>
              <p>{{ item.hintKey | translate }}</p>
              <a *ngIf="item.accessible; else lockedReadiness" class="readiness-link" [routerLink]="[item.route]" [queryParams]="{ from: 'start-here' }">{{ 'common.open' | translate }}</a>
              <ng-template #lockedReadiness>
                <span class="readiness-state">{{ 'common.needsAccess' | translate }}</span>
              </ng-template>
            </article>
          </div>
        </section>

        <section class="card guidance-card implementation-card">
          <strong>{{ 'implementation.guidance.flowTitle' | translate }}</strong>
          <p>{{ 'implementation.guidance.flowCopy' | translate }}</p>
        </section>

        <section class="card guidance-card implementation-card" *ngIf="!current.enabled">
          <strong>{{ 'implementation.guidance.hiddenTitle' | translate }}</strong>
          <p>
            {{ 'implementation.guidance.hiddenCopy' | translate }}
            <a [routerLink]="['/settings']">{{ 'implementation.guidance.settingsLink' | translate }}</a>.
          </p>
        </section>

        <section class="page-stack" *ngIf="current.enabled">
          <section class="card page-stack implementation-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">{{ 'implementation.profile.eyebrow' | translate }}</span>
                <h3>{{ 'implementation.profile.title' | translate }}</h3>
                <p class="subtle">{{ 'implementation.profile.copy' | translate }}</p>
              </div>
            </div>

            <form class="page-stack" [formGroup]="profileForm" (ngSubmit)="saveProfile()" *ngIf="canWrite(); else readOnlyProfile">
              <label class="toggle-row">
                <input type="checkbox" formControlName="enabled">
                <span>{{ 'implementation.profile.enable' | translate }}</span>
              </label>

              <div class="form-grid-2">
                <label class="field">
                  <span>{{ 'implementation.profile.startingPoint' | translate }}</span>
                  <select formControlName="startingPoint">
                    <option value="NEW_IMPLEMENTATION">{{ 'implementation.profile.startingPoints.NEW_IMPLEMENTATION' | translate }}</option>
                    <option value="DIGITISING_EXISTING">{{ 'implementation.profile.startingPoints.DIGITISING_EXISTING' | translate }}</option>
                    <option value="MATURING_EXISTING">{{ 'implementation.profile.startingPoints.MATURING_EXISTING' | translate }}</option>
                  </select>
                </label>
                <label class="field">
                  <span>{{ 'implementation.profile.rolloutOwner' | translate }}</span>
                  <input formControlName="rolloutOwner" [placeholder]="'implementation.profile.placeholders.rolloutOwner' | translate">
                </label>
              </div>

              <div class="form-grid-2">
                <label class="field">
                  <span>{{ 'implementation.profile.targetStandards' | translate }}</span>
                  <input formControlName="targetStandards" [placeholder]="'implementation.profile.placeholders.targetStandards' | translate">
                </label>
                <label class="field">
                  <span>{{ 'implementation.profile.rolloutGoal' | translate }}</span>
                  <input formControlName="certificationGoal" [placeholder]="'implementation.profile.placeholders.rolloutGoal' | translate">
                </label>
              </div>

              <div class="button-row">
                <button type="submit" [disabled]="profileForm.invalid || savingSection() === 'profile'">
                  {{ savingSection() === 'profile' ? ('implementation.profile.saving' | translate) : ('implementation.profile.save' | translate) }}
                </button>
              </div>
            </form>

            <ng-template #readOnlyProfile>
              <div class="entity-list compact-entity-list">
                <div class="entity-item">
                  <strong>{{ 'implementation.profile.startingPoint' | translate }}</strong>
                  <small>{{ startingPointLabel(current.startingPoint) }}</small>
                </div>
                <div class="entity-item">
                  <strong>{{ 'implementation.profile.targetStandards' | translate }}</strong>
                  <small>{{ current.targetStandards.join(', ') }}</small>
                </div>
                <div class="entity-item">
                  <strong>{{ 'implementation.profile.rolloutOwner' | translate }}</strong>
                  <small>{{ current.rolloutOwner || ('common.notSet' | translate) }}</small>
                </div>
                <div class="entity-item">
                  <strong>{{ 'implementation.profile.goalLabel' | translate }}</strong>
                  <small>{{ current.certificationGoal || ('common.notRecordedYet' | translate) }}</small>
                </div>
              </div>
            </ng-template>
          </section>

          <section class="card page-stack implementation-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">{{ 'implementation.checklist.eyebrow' | translate }}</span>
                <h3>{{ 'implementation.checklist.title' | translate }}</h3>
                <p class="subtle">{{ 'implementation.checklist.copy' | translate }}</p>
              </div>
            </div>

            <div class="checklist-grid">
              <label class="checklist-item" *ngFor="let item of current.checklist">
                <input type="checkbox" [checked]="item.done" [disabled]="!canWrite() || savingSection() === 'checklist'" (change)="toggleChecklist(item.id, readCheckbox($event))">
                <span>{{ checklistLabel(item) }}</span>
              </label>
            </div>
          </section>

          <section class="card page-stack implementation-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">{{ 'implementation.objective.eyebrow' | translate }}</span>
                <h3>{{ 'implementation.objective.title' | translate }}</h3>
                <p class="subtle">{{ 'implementation.objective.copy' | translate }}</p>
              </div>
            </div>

            <form class="page-stack" [formGroup]="objectiveForm" (ngSubmit)="saveObjectivePlan()" *ngIf="canWrite(); else readOnlyObjective">
              <div class="form-grid-2">
                <label class="field">
                  <span>{{ 'implementation.objective.focus' | translate }}</span>
                  <input formControlName="focus" [placeholder]="'implementation.objective.placeholders.focus' | translate">
                </label>
                <label class="field">
                  <span>{{ 'implementation.objective.owner' | translate }}</span>
                  <input formControlName="owner" [placeholder]="'implementation.objective.placeholders.owner' | translate">
                </label>
              </div>

              <label class="field">
                <span>{{ 'implementation.objective.statement' | translate }}</span>
                <textarea rows="3" formControlName="objective" [placeholder]="'implementation.objective.placeholders.statement' | translate"></textarea>
              </label>

              <div class="form-grid-3">
                <label class="field">
                  <span>{{ 'implementation.objective.target' | translate }}</span>
                  <input formControlName="target" [placeholder]="'implementation.objective.placeholders.target' | translate">
                </label>
                <label class="field">
                  <span>{{ 'implementation.objective.reviewFrequency' | translate }}</span>
                  <select formControlName="reviewFrequency">
                    <option value="Monthly">{{ 'implementation.objective.frequencies.Monthly' | translate }}</option>
                    <option value="Quarterly">{{ 'implementation.objective.frequencies.Quarterly' | translate }}</option>
                    <option value="Biannual">{{ 'implementation.objective.frequencies.Biannual' | translate }}</option>
                    <option value="Annual">{{ 'implementation.objective.frequencies.Annual' | translate }}</option>
                  </select>
                </label>
                <label class="field">
                  <span>{{ 'implementation.objective.linkedModule' | translate }}</span>
                  <select formControlName="linkedModule">
                    <option value="KPIs">{{ 'implementation.objective.modules.KPIs' | translate }}</option>
                    <option value="Risks">{{ 'implementation.objective.modules.Risks' | translate }}</option>
                    <option value="Management Review">{{ 'implementation.objective.modules.Management Review' | translate }}</option>
                    <option value="Process Register">{{ 'implementation.objective.modules.Process Register' | translate }}</option>
                  </select>
                </label>
              </div>

              <div class="button-row">
                <button type="submit" [disabled]="objectiveForm.invalid || savingSection() === 'objective'">
                  {{ savingSection() === 'objective' ? ('implementation.objective.saving' | translate) : ('implementation.objective.save' | translate) }}
                </button>
                <a [routerLink]="['/kpis']" class="button-link secondary">{{ 'implementation.objective.openKpis' | translate }}</a>
              </div>
            </form>

            <ng-template #readOnlyObjective>
              <div class="entity-list compact-entity-list">
                <div class="entity-item">
                  <strong>{{ 'implementation.objective.focus' | translate }}</strong>
                  <small>{{ current.objectivePlan.focus || ('common.notRecordedYet' | translate) }}</small>
                </div>
                <div class="entity-item">
                  <strong>{{ 'implementation.objective.statement' | translate }}</strong>
                  <small>{{ current.objectivePlan.objective || ('common.notRecordedYet' | translate) }}</small>
                </div>
                <div class="entity-item">
                  <strong>{{ 'implementation.objective.target' | translate }}</strong>
                  <small>{{ current.objectivePlan.target || ('common.notRecordedYet' | translate) }}</small>
                </div>
                <div class="entity-item">
                  <strong>{{ 'implementation.objective.reviewCadence' | translate }}</strong>
                  <small>{{ objectiveFrequencyLabel(current.objectivePlan.reviewFrequency) }}</small>
                </div>
              </div>
            </ng-template>
          </section>

          <section class="card page-stack implementation-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">{{ 'implementation.pdca.eyebrow' | translate }}</span>
                <h3>{{ 'implementation.pdca.title' | translate }}</h3>
                <p class="subtle">{{ 'implementation.pdca.copy' | translate }}</p>
              </div>
            </div>

            <div class="pdca-grid">
              <article class="detail-section pdca-card" *ngFor="let card of visiblePdcaCards()">
                <div class="pdca-card__header">
                  <span class="phase-pill">{{ ('implementation.pdca.phases.' + card.phase + '.label') | translate }}</span>
                  <h4>{{ card.summaryKey | translate }}</h4>
                </div>
                <div class="module-chip-grid top-space">
                  <a class="module-chip" *ngFor="let module of card.modules" [routerLink]="[module.route]">
                    <strong>{{ ('implementation.objective.modules.' + module.label) | translate }}</strong>
                    <small>{{ module.hintKey | translate }}</small>
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
  private readonly i18n = inject(I18nService);

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

  protected readonly pageHeader = computed(() => {
    this.i18n.language();
    return {
      label: this.i18n.t('implementation.page.label'),
      title: this.i18n.t('implementation.page.title'),
      description: this.i18n.t('implementation.page.description'),
      breadcrumb: this.i18n.t('implementation.page.breadcrumb')
    };
  });
  protected readonly completedChecklistCount = computed(() => this.config()?.checklist.filter((item) => item.done).length ?? 0);
  protected readonly readinessChecklist = computed(() =>
    this.readinessCards.map((item) => ({
      ...item,
      accessible: this.authStore.hasPermission(item.permission) && this.authStore.hasModule(item.packageModule)
    })).filter((item) => this.authStore.hasModule(item.packageModule))
  );
  protected readonly visiblePdcaCards = computed(() =>
    this.pdcaCards
      .map((card) => ({
        ...card,
        modules: card.modules.filter((module) => this.authStore.hasModule(module.packageModule))
      }))
      .filter((card) => card.modules.length > 0)
  );
  protected readonly objectiveReadinessLabel = computed(() => {
    this.i18n.language();
    const current = this.config()?.objectivePlan;
    if (!current) {
      return this.i18n.t('common.notLoaded');
    }

    const completed = [current.focus, current.objective, current.target, current.owner].filter((value) => value.trim()).length;
    if (completed >= 4) {
      return this.i18n.t('implementation.summary.readyToDeploy');
    }
    if (completed >= 2) {
      return this.i18n.t('common.inProgress');
    }
    return this.i18n.t('implementation.summary.needsSetup');
  });

  protected readonly pdcaCards: PdcaCard[] = [
    {
      phase: 'Plan',
      summaryKey: 'implementation.pdca.phases.Plan.summary',
      modules: [
        { label: 'Context', route: '/context', hintKey: 'implementation.pdca.modules.Context', packageModule: 'context' },
        { label: 'Obligations', route: '/compliance-obligations', hintKey: 'implementation.pdca.modules.Obligations', packageModule: 'compliance-obligations' },
        { label: 'Risks', route: '/risks', hintKey: 'implementation.pdca.modules.Risks', packageModule: 'risks' },
        { label: 'KPIs', route: '/kpis', hintKey: 'implementation.pdca.modules.KPIs', packageModule: 'kpis' }
      ]
    },
    {
      phase: 'Do',
      summaryKey: 'implementation.pdca.phases.Do.summary',
      modules: [
        { label: 'Documents', route: '/documents', hintKey: 'implementation.pdca.modules.Documents', packageModule: 'documents' },
        { label: 'Process Register', route: '/process-register', hintKey: 'implementation.pdca.modules.Process Register', packageModule: 'process-register' },
        { label: 'Training', route: '/training', hintKey: 'implementation.pdca.modules.Training', packageModule: 'training' },
        { label: 'External Providers', route: '/external-providers', hintKey: 'implementation.pdca.modules.External Providers', packageModule: 'external-providers' }
      ]
    },
    {
      phase: 'Check',
      summaryKey: 'implementation.pdca.phases.Check.summary',
      modules: [
        { label: 'Audits', route: '/audits', hintKey: 'implementation.pdca.modules.Audits', packageModule: 'audits' },
        { label: 'Incidents', route: '/incidents', hintKey: 'implementation.pdca.modules.Incidents', packageModule: 'incidents' },
        { label: 'Hazards', route: '/hazards', hintKey: 'implementation.pdca.modules.Hazards', packageModule: 'hazards' },
        { label: 'Environmental Aspects', route: '/environmental-aspects', hintKey: 'implementation.pdca.modules.Environmental Aspects', packageModule: 'environmental-aspects' }
      ]
    },
    {
      phase: 'Act',
      summaryKey: 'implementation.pdca.phases.Act.summary',
      modules: [
        { label: 'NCR', route: '/ncr', hintKey: 'implementation.pdca.modules.NCR', packageModule: 'ncr' },
        { label: 'CAPA', route: '/capa', hintKey: 'implementation.pdca.modules.CAPA', packageModule: 'capa' },
        { label: 'Actions', route: '/actions', hintKey: 'implementation.pdca.modules.Actions', packageModule: 'actions' },
        { label: 'Management Review', route: '/management-review', hintKey: 'implementation.pdca.modules.Management Review', packageModule: 'management-review' }
      ]
    }
  ];
  private readonly readinessCards: ReadinessChecklistCard[] = [
    { id: 'companyProfile', labelKey: 'implementation.readiness.items.companyProfile.label', hintKey: 'implementation.readiness.items.companyProfile.hint', route: '/settings', permission: 'settings.read', packageModule: 'settings' },
    { id: 'usersRoles', labelKey: 'implementation.readiness.items.usersRoles.label', hintKey: 'implementation.readiness.items.usersRoles.hint', route: '/users', permission: 'users.read', packageModule: 'users' },
    { id: 'processMap', labelKey: 'implementation.readiness.items.processMap.label', hintKey: 'implementation.readiness.items.processMap.hint', route: '/process-register', permission: 'processes.read', packageModule: 'process-register' },
    { id: 'controlledDocuments', labelKey: 'implementation.readiness.items.controlledDocuments.label', hintKey: 'implementation.readiness.items.controlledDocuments.hint', route: '/documents', permission: 'documents.read', packageModule: 'documents' },
    { id: 'risks', labelKey: 'implementation.readiness.items.risks.label', hintKey: 'implementation.readiness.items.risks.hint', route: '/risks', permission: 'risks.read', packageModule: 'risks' },
    { id: 'audits', labelKey: 'implementation.readiness.items.audits.label', hintKey: 'implementation.readiness.items.audits.hint', route: '/audits', permission: 'audits.read', packageModule: 'audits' },
    { id: 'ncrCapaActions', labelKey: 'implementation.readiness.items.ncrCapaActions.label', hintKey: 'implementation.readiness.items.ncrCapaActions.hint', route: '/actions', permission: 'action-items.read', packageModule: 'actions' },
    { id: 'kpis', labelKey: 'implementation.readiness.items.kpis.label', hintKey: 'implementation.readiness.items.kpis.hint', route: '/kpis', permission: 'kpis.read', packageModule: 'kpis' },
    { id: 'managementReview', labelKey: 'implementation.readiness.items.managementReview.label', hintKey: 'implementation.readiness.items.managementReview.hint', route: '/management-review', permission: 'management-review.read', packageModule: 'management-review' }
  ];

  constructor() {
    this.reload();
  }

  protected canWrite() {
    return this.authStore.hasPermission('settings.write');
  }

  protected startingPointLabel(value: string) {
    this.i18n.language();
    return this.i18n.t(`implementation.profile.startingPoints.${value}`);
  }

  protected objectiveFrequencyLabel(value: string) {
    this.i18n.language();
    return this.i18n.t(`implementation.objective.frequencies.${value}`);
  }

  protected checklistLabel(item: ImplementationChecklistItem) {
    this.i18n.language();
    const key = CHECKLIST_LABEL_KEYS[item.id];
    return key ? this.i18n.t(key) : item.label;
  }

  protected readCheckbox(event: Event) {
    return (event.target as HTMLInputElement).checked;
  }

  protected saveProfile() {
    if (!this.canWrite()) {
      this.error.set(this.i18n.t('implementation.feedback.noWriteWorkspace'));
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
      this.error.set(this.i18n.t('implementation.feedback.noWriteWorkspace'));
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
      this.error.set(this.i18n.t('implementation.feedback.noWriteChecklist'));
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
        this.error.set(this.readError(error, this.i18n.t('implementation.feedback.loadError')));
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
        this.message.set(this.i18n.t('implementation.feedback.updated'));
        this.applyConfig((config as { implementation?: ImplementationConfig }).implementation ?? (config as ImplementationConfig));
      },
      error: (error: HttpErrorResponse) => {
        this.savingSection.set(null);
        this.error.set(this.readError(error, this.i18n.t('implementation.feedback.saveError')));
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
