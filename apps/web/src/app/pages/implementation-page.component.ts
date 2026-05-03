import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
import { I18nService } from '../core/i18n.service';
import { PackageModuleKey, TenantScope } from '../core/package-entitlements';

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

type DiagramStage = {
  phase: 'Plan' | 'Do' | 'Check' | 'Act';
  titleKey: string;
  copyKey: string;
  modules: PackageModuleKey[];
};

type ReadinessChecklistCard = {
  id: string;
  route: string;
  permission: string;
  packageModule: PackageModuleKey;
};

type ImplementationScopeProfile = {
  inputModules: PackageModuleKey[];
  outputModules: PackageModuleKey[];
  diagramStages: Array<{ phase: 'Plan' | 'Do' | 'Check' | 'Act'; modules: PackageModuleKey[] }>;
  readinessOrder: string[];
};

const CHECKLIST_LABEL_KEYS: Record<string, string> = {
  'scope-context': 'implementation.checklist.items.scopeContext',
  'policy-documents': 'implementation.checklist.items.policyDocuments',
  'objectives-kpis': 'implementation.checklist.items.objectivesKpis',
  'process-risk': 'implementation.checklist.items.processRisk',
  'operations-training': 'implementation.checklist.items.operationsTraining',
  'audit-review': 'implementation.checklist.items.auditReview'
};

const IMPLEMENTATION_SCOPE_PROFILES: Record<TenantScope, ImplementationScopeProfile> = {
  QMS: {
    inputModules: ['context', 'kpis', 'risks'],
    outputModules: ['kpis', 'audits', 'management-review'],
    diagramStages: [
      { phase: 'Plan', modules: ['context', 'kpis', 'compliance-obligations', 'risks'] },
      { phase: 'Do', modules: ['documents', 'process-register', 'training', 'change-management'] },
      { phase: 'Check', modules: ['audits', 'ncr', 'capa', 'actions'] },
      { phase: 'Act', modules: ['ncr', 'capa', 'actions', 'management-review'] }
    ],
    readinessOrder: ['companyProfile', 'usersRoles', 'processMap', 'controlledDocuments', 'risks', 'audits', 'ncrCapaActions', 'kpis', 'managementReview']
  },
  EMS: {
    inputModules: ['context', 'compliance-obligations', 'environmental-aspects'],
    outputModules: ['audits', 'kpis', 'management-review'],
    diagramStages: [
      { phase: 'Plan', modules: ['context', 'compliance-obligations', 'risks', 'environmental-aspects'] },
      { phase: 'Do', modules: ['documents', 'process-register', 'training', 'change-management'] },
      { phase: 'Check', modules: ['audits', 'incidents', 'environmental-aspects', 'external-providers'] },
      { phase: 'Act', modules: ['ncr', 'capa', 'actions', 'management-review'] }
    ],
    readinessOrder: ['companyProfile', 'usersRoles', 'processMap', 'controlledDocuments', 'obligations', 'aspects', 'incidents', 'audits', 'actions', 'managementReview']
  },
  OHSMS: {
    inputModules: ['context', 'compliance-obligations', 'hazards'],
    outputModules: ['audits', 'kpis', 'management-review'],
    diagramStages: [
      { phase: 'Plan', modules: ['context', 'compliance-obligations', 'risks', 'hazards'] },
      { phase: 'Do', modules: ['documents', 'process-register', 'training', 'change-management'] },
      { phase: 'Check', modules: ['audits', 'incidents', 'hazards', 'training'] },
      { phase: 'Act', modules: ['ncr', 'capa', 'actions', 'management-review'] }
    ],
    readinessOrder: ['companyProfile', 'usersRoles', 'processMap', 'controlledDocuments', 'obligations', 'hazards', 'incidents', 'training', 'audits', 'actions', 'managementReview']
  },
  IMS: {
    inputModules: ['context', 'compliance-obligations', 'risks'],
    outputModules: ['kpis', 'audits', 'management-review'],
    diagramStages: [
      { phase: 'Plan', modules: ['context', 'kpis', 'compliance-obligations', 'risks'] },
      { phase: 'Do', modules: ['documents', 'process-register', 'training', 'external-providers'] },
      { phase: 'Check', modules: ['audits', 'incidents', 'hazards', 'environmental-aspects'] },
      { phase: 'Act', modules: ['ncr', 'capa', 'actions', 'management-review'] }
    ],
    readinessOrder: ['companyProfile', 'usersRoles', 'processMap', 'controlledDocuments', 'risks', 'obligations', 'hazards', 'aspects', 'audits', 'ncrCapaActions', 'kpis', 'managementReview']
  },
  FSMS: {
    inputModules: ['context', 'compliance-obligations', 'external-providers'],
    outputModules: ['audits', 'kpis', 'management-review'],
    diagramStages: [
      { phase: 'Plan', modules: ['context', 'kpis', 'compliance-obligations', 'risks'] },
      { phase: 'Do', modules: ['documents', 'process-register', 'training', 'external-providers'] },
      { phase: 'Check', modules: ['audits', 'external-providers', 'actions', 'management-review'] },
      { phase: 'Act', modules: ['ncr', 'capa', 'actions', 'management-review'] }
    ],
    readinessOrder: ['companyProfile', 'usersRoles', 'processMap', 'controlledDocuments', 'training', 'providers', 'audits', 'ncrCapaActions', 'kpis', 'managementReview']
  }
};

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslatePipe],
  template: `
    <section class="page-grid">
      <header class="implementation-page-head">
        <h1>{{ 'implementation.page.label' | translate }}</h1>
        <p>{{ startHereIntro() }}</p>
      </header>

      <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">
        {{ error() || message() }}
      </p>

      <div class="empty-state" *ngIf="loading()">
        <strong>{{ 'implementation.feedback.loadingTitle' | translate }}</strong>
        <span>{{ 'implementation.feedback.loadingCopy' | translate }}</span>
      </div>

      <ng-container *ngIf="!loading() && config() as current">
        <section class="card implementation-card implementation-diagram-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">{{ 'implementation.diagram.eyebrow' | translate }}</span>
              <h3>{{ systemMapTitle() }}</h3>
              <p class="subtle">{{ systemMapCopy() }}</p>
            </div>
          </div>

          <div class="implementation-flow top-space">
            <div class="implementation-ribbon">{{ 'implementation.diagram.improvementBar' | translate }}</div>

            <aside class="implementation-side implementation-side--input">
              <h4>{{ 'implementation.diagram.inputTitle' | translate }}</h4>
              <div class="implementation-side__chips">
                <a
                  *ngFor="let module of diagramInputModules()"
                  class="pill diagram-module-chip"
                  [routerLink]="[moduleDiagramRoute(module)]"
                  [queryParams]="{ from: 'start-here' }"
                >
                  {{ moduleDiagramLabel(module) }}
                </a>
              </div>
            </aside>

            <aside class="implementation-side implementation-side--output">
              <h4>{{ 'implementation.diagram.outputTitle' | translate }}</h4>
              <div class="implementation-side__chips">
                <a
                  *ngFor="let module of diagramOutputModules()"
                  class="pill diagram-module-chip"
                  [routerLink]="[moduleDiagramRoute(module)]"
                  [queryParams]="{ from: 'start-here' }"
                >
                  {{ moduleDiagramLabel(module) }}
                </a>
              </div>
            </aside>

            <div class="implementation-oval" aria-hidden="true"></div>
            <div class="implementation-line implementation-line--mid" aria-hidden="true"></div>
            <div class="implementation-cycle implementation-cycle--act-plan" aria-hidden="true"></div>
            <div class="implementation-cycle implementation-cycle--plan-do" aria-hidden="true"></div>
            <div class="implementation-cycle implementation-cycle--do-check" aria-hidden="true"></div>
            <div class="implementation-cycle implementation-cycle--check-act" aria-hidden="true"></div>

            <div class="implementation-center">
              <span class="implementation-core__label">{{ 'implementation.diagram.coreLabel' | translate }}</span>
              <a class="implementation-core__link implementation-core__link--light" [routerLink]="['/process-register']" [queryParams]="{ from: 'start-here' }">
                {{ 'shell.nav.processRegister.label' | translate }}
              </a>
            </div>

            <article
              *ngFor="let stage of visibleDiagramStages()"
              [class]="'implementation-box implementation-box--' + stage.phase.toLowerCase()"
            >
              <div class="implementation-stage__head">
                <span class="implementation-stage__eyebrow">{{ ('implementation.pdca.phases.' + stage.phase + '.label') | translate }}</span>
                <h4>{{ stage.titleKey | translate }}</h4>
              </div>
              <div class="implementation-stage__chips">
                <a
                  *ngFor="let module of stage.modules"
                  class="pill diagram-module-chip"
                  [routerLink]="[moduleDiagramRoute(module)]"
                  [queryParams]="{ from: 'start-here' }"
                >
                  {{ moduleDiagramLabel(module) }}
                </a>
              </div>
            </article>
          </div>
        </section>

        <section class="card page-stack implementation-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">{{ 'implementation.readiness.eyebrow' | translate }}</span>
              <h3>{{ readinessTitle() }}</h3>
              <p class="subtle">{{ readinessCopy() }}</p>
            </div>
          </div>

          <div class="readiness-grid">
            <article class="readiness-card" *ngFor="let item of readinessChecklist()">
              <div class="readiness-card__top">
                <span class="phase-pill readiness-pill">{{ 'implementation.readiness.setupPill' | translate }}</span>
                <strong>{{ readinessCardLabel(item) }}</strong>
              </div>
              <p>{{ readinessCardHint(item) }}</p>
              <a *ngIf="item.accessible; else lockedReadiness" class="readiness-link" [routerLink]="[item.route]" [queryParams]="{ from: 'start-here' }">{{ 'common.open' | translate }}</a>
              <ng-template #lockedReadiness>
                <span class="readiness-state">{{ 'common.needsAccess' | translate }}</span>
              </ng-template>
            </article>
          </div>
        </section>

        <section class="card guidance-card implementation-card">
          <strong>{{ flowGuidanceTitle() }}</strong>
          <p>{{ flowGuidanceCopy() }}</p>
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

    .implementation-page-head {
      display: flex;
      align-items: center;
      min-height: 2rem;
      margin-top: 0.2rem;
    }

    .implementation-page-head h1 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 800;
      color: var(--text);
      letter-spacing: -0.01em;
    }

    .implementation-diagram-card {
      overflow: hidden;
      padding-bottom: 1.5rem;
    }

    .implementation-flow {
      position: relative;
      min-height: 50rem;
      padding: 0.9rem 0 1rem;
      isolation: isolate;
    }

    .implementation-ribbon {
      position: absolute;
      top: 0.15rem;
      left: 10%;
      right: 10%;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 2.7rem;
      padding: 0.35rem 1rem;
      border-radius: 999px;
      background: linear-gradient(180deg, rgba(189, 228, 223, 0.9), rgba(207, 236, 231, 0.96));
      border: 1px solid rgba(20, 61, 43, 0.12);
      color: #173b2f;
      font-size: 1.05rem;
      font-weight: 800;
      text-align: center;
      box-shadow: 0 14px 24px rgba(23, 44, 34, 0.08);
      z-index: 3;
    }

    .implementation-side {
      position: absolute;
      top: 4.35rem;
      bottom: 2rem;
      width: 9.6rem;
      display: grid;
      align-content: center;
      gap: 1rem;
      padding: 1.25rem 0.95rem;
      border-radius: 1.6rem;
      color: #fff;
      box-shadow: 0 22px 36px rgba(23, 44, 34, 0.12);
      z-index: 2;
    }

    .implementation-side--input {
      left: 0.75rem;
      background: linear-gradient(180deg, #214f4e, #173b3d);
    }

    .implementation-side--output {
      right: 0.75rem;
      background: linear-gradient(180deg, #f0a21e, #dc8f12);
      color: #24312c;
    }

    .implementation-side h4 {
      margin: 0;
      font-size: 0.98rem;
      line-height: 1.35;
      text-align: center;
    }

    .implementation-side__chips {
      display: grid;
      gap: 0.6rem;
      justify-items: center;
    }

    .implementation-side__chips .pill {
      justify-content: center;
      width: 100%;
      min-height: 2.05rem;
      padding: 0.34rem 0.78rem;
      text-align: center;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(244, 248, 245, 0.92));
      border-color: rgba(20, 61, 43, 0.08);
      color: #173b2f;
      font-weight: 800;
      letter-spacing: 0.03em;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.82),
        0 6px 12px rgba(23, 44, 34, 0.08);
    }

    .implementation-oval {
      position: absolute;
      inset: 3.45rem 11.7rem 0.75rem;
      border-radius: 50%;
      border: 1px solid rgba(20, 61, 43, 0.08);
      background:
        radial-gradient(circle at center, rgba(20, 61, 43, 0.045), rgba(255,255,255,0) 72%),
        linear-gradient(180deg, rgba(248, 250, 248, 0.96), rgba(241, 245, 242, 0.92));
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.7);
      z-index: 0;
    }

    .implementation-line {
      position: absolute;
      background: rgba(31, 41, 51, 0.72);
      z-index: 1;
    }

    .implementation-line::after {
      content: '';
      position: absolute;
      width: 0.82rem;
      height: 0.82rem;
      background: rgba(31, 41, 51, 0.72);
      clip-path: polygon(0 0, 100% 50%, 0 100%);
    }

    .implementation-line--top {
      top: 9.55rem;
      left: 24%;
      right: 24%;
      height: 1px;
    }

    .implementation-line--top::after {
      right: 0;
      top: 50%;
      transform: translate(50%, -50%);
    }

    .implementation-line--mid {
      top: calc(50% + 1.75rem);
      left: 10.35rem;
      right: 10.35rem;
      height: 2px;
      transform: translateY(-50%);
    }

    .implementation-line--mid::after {
      right: 0;
      top: 50%;
      transform: translate(50%, -50%);
    }

    .implementation-cycle {
      position: absolute;
      z-index: 1;
      pointer-events: none;
      color: rgba(31, 41, 51, 0.72);
      border-style: solid;
      border-width: 0;
      border-color: currentColor;
    }

    .implementation-cycle::after {
      content: '';
      position: absolute;
      width: 0.9rem;
      height: 0.9rem;
      background: currentColor;
      clip-path: polygon(0 0, 100% 50%, 0 100%);
    }

    .implementation-cycle--act-plan {
      top: calc(50% - 14.35rem);
      left: calc(50% - 18.6rem);
      width: 9.6rem;
      height: 8.1rem;
      border-top-width: 3px;
      border-left-width: 3px;
      border-top-left-radius: 1.9rem;
      color: rgba(97, 81, 162, 0.88);
    }

    .implementation-cycle--act-plan::after {
      right: 0;
      top: 0;
      transform: translate(50%, -50%);
    }

    .implementation-cycle--plan-do {
      top: calc(50% - 14.35rem);
      right: calc(50% - 18.6rem);
      width: 9.6rem;
      height: 8.1rem;
      border-top-width: 3px;
      border-right-width: 3px;
      border-top-right-radius: 1.9rem;
      color: rgba(45, 106, 79, 0.9);
    }

    .implementation-cycle--plan-do::after {
      right: 0;
      bottom: 0;
      transform: translate(50%, 50%) rotate(90deg);
    }

    .implementation-cycle--do-check {
      right: calc(50% - 18.6rem);
      bottom: calc(50% - 17.75rem);
      width: 9.6rem;
      height: 8.1rem;
      border-right-width: 3px;
      border-bottom-width: 3px;
      border-bottom-right-radius: 1.9rem;
      color: rgba(63, 109, 149, 0.88);
    }

    .implementation-cycle--do-check::after {
      left: 0;
      bottom: 0;
      transform: translate(-50%, 50%) rotate(180deg);
    }

    .implementation-cycle--check-act {
      left: calc(50% - 18.6rem);
      bottom: calc(50% - 17.75rem);
      width: 9.6rem;
      height: 8.1rem;
      border-left-width: 3px;
      border-bottom-width: 3px;
      border-bottom-left-radius: 1.9rem;
      color: rgba(161, 110, 31, 0.9);
    }

    .implementation-cycle--check-act::after {
      left: 0;
      top: 0;
      transform: translate(-50%, -50%) rotate(-90deg);
    }

    .implementation-center {
      position: absolute;
      top: calc(50% + 1.75rem);
      left: 50%;
      width: 11rem;
      min-height: 11rem;
      display: grid;
      align-content: center;
      justify-items: center;
      gap: 0.3rem;
      padding: 0.9rem;
      border-radius: 50%;
      border: 1px solid rgba(63, 109, 149, 0.18);
      background:
        radial-gradient(circle at 35% 30%, rgba(255,255,255,0.9), rgba(255,255,255,0) 34%),
        radial-gradient(circle at center, rgba(234, 241, 255, 0.96), rgba(214, 230, 249, 0.96) 72%, rgba(190, 214, 238, 0.98) 100%);
      box-shadow:
        0 20px 34px rgba(34, 62, 91, 0.16),
        inset 0 0 0 1px rgba(255,255,255,0.58);
      transform: translate(-50%, -50%);
      z-index: 3;
    }

    .implementation-center::before {
      content: '';
      position: absolute;
      inset: -0.7rem;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(173, 204, 235, 0.18), rgba(173, 204, 235, 0.06) 58%, rgba(173, 204, 235, 0) 74%);
      border: 2px solid rgba(173, 204, 235, 0.24);
      z-index: -1;
    }

    .implementation-core__label {
      color: #4b647f;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      text-align: center;
    }

    .implementation-core__link--light {
      color: #173b2f;
      font-size: 0.98rem;
      font-weight: 800;
      text-decoration: none;
      text-align: center;
      line-height: 1.15;
      transition: transform 160ms ease, opacity 160ms ease;
      transform-origin: center;
    }

    .implementation-core__link--light:hover {
      transform: scale(1.04);
      opacity: 0.9;
    }

    .implementation-box {
      position: absolute;
      width: 18.25rem;
      min-height: 8.75rem;
      display: grid;
      gap: 0.55rem;
      padding: 0.76rem 0.82rem 0.88rem;
      border-radius: 1.2rem;
      border: 1px solid var(--border-subtle);
      background: color-mix(in srgb, var(--surface-strong) 95%, white);
      box-shadow: 0 18px 32px rgba(23, 44, 34, 0.08);
      z-index: 1;
    }

    .implementation-box::before {
      content: '';
      position: absolute;
      left: 0.85rem;
      right: 0.85rem;
      top: 0;
      height: 3px;
      border-radius: 999px;
    }

    .implementation-box--plan {
      top: calc(50% - 9rem);
      left: 50%;
      transform: translate(-50%, -100%);
      background: linear-gradient(180deg, rgba(231, 243, 236, 0.98), rgba(255,255,255,0.98));
    }

    .implementation-box--plan::before {
      background: #2d6a4f;
    }

    .implementation-box--do {
      top: calc(50% + 1.75rem);
      left: calc(50% + 12.25rem);
      transform: translate(0, -50%);
      background: linear-gradient(180deg, rgba(234, 241, 255, 0.96), rgba(255,255,255,0.98));
    }

    .implementation-box--do::before {
      background: #3f6d95;
    }

    .implementation-box--check {
      top: calc(50% + 12.5rem);
      left: 50%;
      right: auto;
      transform: translate(-50%, 0);
      background: linear-gradient(180deg, rgba(247, 239, 224, 0.96), rgba(255,255,255,0.98));
    }

    .implementation-box--check::before {
      background: #a16e1f;
    }

    .implementation-box--act {
      top: calc(50% + 1.75rem);
      left: calc(50% - 12.25rem);
      bottom: auto;
      transform: translate(-100%, -50%);
      background: linear-gradient(180deg, rgba(239, 239, 254, 0.97), rgba(255,255,255,0.98));
    }

    .implementation-box--act::before {
      background: #6151a2;
    }

    .implementation-stage__head {
      display: grid;
      gap: 0.2rem;
    }

    .implementation-stage__eyebrow {
      color: var(--muted);
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }

    .implementation-box h4 {
      margin: 0;
      font-size: 0.94rem;
      color: var(--text);
    }

    .implementation-stage__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
    }

    .implementation-stage__chips .pill {
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(246, 248, 249, 0.94));
      border-color: rgba(20, 61, 43, 0.12);
      min-height: 1.95rem;
      padding: 0.34rem 0.72rem;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.9),
        0 5px 10px rgba(23, 44, 34, 0.08);
    }

    .diagram-module-chip {
      text-decoration: none;
      transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease;
      transform-origin: center;
      will-change: transform;
    }

    .diagram-module-chip:hover {
      transform: translateY(-1px) scale(1.05);
      box-shadow: 0 12px 18px rgba(23, 44, 34, 0.12);
      border-color: rgba(20, 61, 43, 0.2);
    }

    .implementation-box--plan .pill {
      background: rgba(255, 255, 255, 0.76);
      border-color: rgba(45, 106, 79, 0.18);
    }

    .implementation-box--do .pill {
      background: rgba(255, 255, 255, 0.74);
      border-color: rgba(63, 109, 149, 0.18);
    }

    .implementation-box--check .pill {
      background: rgba(255, 255, 255, 0.72);
      border-color: rgba(161, 110, 31, 0.18);
    }

    .implementation-box--act .pill {
      background: rgba(255, 255, 255, 0.72);
      border-color: rgba(97, 81, 162, 0.18);
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

    @media (max-width: 1120px) {
      .implementation-flow {
        min-height: 44rem;
      }

      .implementation-oval {
        inset-inline: 10.25rem;
      }

      .implementation-side {
        width: 8.4rem;
      }

      .implementation-box--do {
        left: calc(50% + 10rem);
      }

      .implementation-box--act {
        left: calc(50% - 10rem);
      }

      .implementation-cycle--act-plan,
      .implementation-cycle--plan-do,
      .implementation-cycle--do-check,
      .implementation-cycle--check-act {
        width: 7.1rem;
      }

      .implementation-cycle--act-plan,
      .implementation-cycle--check-act {
        left: calc(50% - 17rem);
      }

      .implementation-cycle--plan-do,
      .implementation-cycle--do-check {
        right: calc(50% - 17rem);
      }
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

      .readiness-grid,
      .module-chip-grid {
        grid-template-columns: 1fr;
      }

      .implementation-flow {
        min-height: auto;
        display: grid;
        gap: 1rem;
        padding-top: 0.25rem;
      }

      .implementation-ribbon,
      .implementation-side,
      .implementation-oval,
      .implementation-line,
      .implementation-cycle {
        display: none;
      }

      .implementation-center {
        position: relative;
        top: auto;
        left: auto;
        width: 100%;
        max-width: none;
        border-radius: 1.4rem;
        transform: none;
      }

      .implementation-box {
        position: relative;
        inset: auto;
        width: 100%;
        transform: none;
      }

      .implementation-box::before {
        left: 0.9rem;
        right: 0.9rem;
      }
    }

    @media (min-width: 1180px) {
      .module-chip-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 640px) {
      .implementation-box {
        padding-inline: 0.9rem;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .diagram-module-chip,
      .implementation-core__link {
        transition: none;
      }

      .diagram-module-chip:hover,
      .implementation-core__link:hover {
        transform: none;
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

  protected readonly completedChecklistCount = computed(() => this.config()?.checklist.filter((item) => item.done).length ?? 0);
  protected readonly scope = computed(() => this.authStore.scope());
  protected readonly scopeProfile = computed(() => IMPLEMENTATION_SCOPE_PROFILES[this.scope()]);
  protected readonly readinessChecklist = computed(() =>
    this.scopeProfile().readinessOrder
      .map((id) => this.readinessCards.find((item) => item.id === id))
      .filter((item): item is ReadinessChecklistCard => !!item)
      .map((item) => ({
        ...item,
        accessible: this.authStore.hasPermission(item.permission) && this.authStore.hasModule(item.packageModule)
      }))
      .filter((item) => this.authStore.hasModule(item.packageModule))
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
  protected readonly diagramInputModules = computed(() =>
    this.scopeProfile().inputModules.filter((module) => this.authStore.hasModule(module))
  );
  protected readonly diagramOutputModules = computed(() =>
    this.scopeProfile().outputModules.filter((module) => this.authStore.hasModule(module))
  );
  protected readonly diagramStages: DiagramStage[] = [
    {
      phase: 'Plan',
      titleKey: 'implementation.diagram.stages.plan.title',
      copyKey: 'implementation.diagram.stages.plan.copy',
      modules: ['context', 'kpis', 'compliance-obligations', 'risks']
    },
    {
      phase: 'Do',
      titleKey: 'implementation.diagram.stages.do.title',
      copyKey: 'implementation.diagram.stages.do.copy',
      modules: ['documents', 'training', 'external-providers']
    },
    {
      phase: 'Check',
      titleKey: 'implementation.diagram.stages.check.title',
      copyKey: 'implementation.diagram.stages.check.copy',
      modules: ['audits', 'incidents', 'hazards', 'environmental-aspects']
    },
    {
      phase: 'Act',
      titleKey: 'implementation.diagram.stages.act.title',
      copyKey: 'implementation.diagram.stages.act.copy',
      modules: ['ncr', 'capa', 'actions', 'management-review']
    }
  ];
  protected readonly visibleDiagramStages = computed(() =>
    this.diagramStages
      .map((stage) => ({
        ...stage,
        modules:
          this.scopeProfile().diagramStages.find((scopeStage) => scopeStage.phase === stage.phase)?.modules.filter((module) =>
            this.authStore.hasModule(module)
          ) ?? []
      }))
      .filter((stage) => stage.modules.length > 0)
  );

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
    { id: 'companyProfile', route: '/settings', permission: 'settings.read', packageModule: 'settings' },
    { id: 'usersRoles', route: '/users', permission: 'users.read', packageModule: 'users' },
    { id: 'processMap', route: '/process-register', permission: 'processes.read', packageModule: 'process-register' },
    { id: 'controlledDocuments', route: '/documents', permission: 'documents.read', packageModule: 'documents' },
    { id: 'risks', route: '/risks', permission: 'risks.read', packageModule: 'risks' },
    { id: 'audits', route: '/audits', permission: 'audits.read', packageModule: 'audits' },
    { id: 'ncrCapaActions', route: '/actions', permission: 'action-items.read', packageModule: 'actions' },
    { id: 'kpis', route: '/kpis', permission: 'kpis.read', packageModule: 'kpis' },
    { id: 'managementReview', route: '/management-review', permission: 'management-review.read', packageModule: 'management-review' },
    { id: 'obligations', route: '/compliance-obligations', permission: 'obligations.read', packageModule: 'compliance-obligations' },
    { id: 'aspects', route: '/environmental-aspects', permission: 'aspects.read', packageModule: 'environmental-aspects' },
    { id: 'incidents', route: '/incidents', permission: 'incidents.read', packageModule: 'incidents' },
    { id: 'hazards', route: '/hazards', permission: 'hazards.read', packageModule: 'hazards' },
    { id: 'training', route: '/training', permission: 'training.read', packageModule: 'training' },
    { id: 'providers', route: '/external-providers', permission: 'providers.read', packageModule: 'external-providers' },
    { id: 'actions', route: '/actions', permission: 'action-items.read', packageModule: 'actions' }
  ];

  constructor() {
    this.reload();
  }

  protected canWrite() {
    return this.authStore.hasPermission('settings.write');
  }

  protected startHereIntro() {
    return this.scopeVariant({
      QMS: {
        en: 'Use Start Here to orient the quality workspace, confirm the core setup path, and move quickly into process, audit, and improvement work.',
        az: 'Start Here səhifəsindən keyfiyyət iş məkanını yönləndirmək, əsas quruluş yolunu təsdiqləmək və proses, audit, təkmilləşdirmə işlərinə sürətlə keçmək üçün istifadə edin.',
        ru: 'Используйте Start Here, чтобы сориентироваться в рабочем пространстве качества, подтвердить базовый путь настройки и быстро перейти к процессам, аудитам и улучшениям.'
      },
      EMS: {
        en: 'Use Start Here to orient the environmental workspace, confirm the core setup path, and move quickly into obligations, aspects, and assurance work.',
        az: 'Start Here səhifəsindən ekoloji iş məkanını yönləndirmək, əsas quruluş yolunu təsdiqləmək və öhdəliklər, aspektlər, təminat işlərinə sürətlə keçmək üçün istifadə edin.',
        ru: 'Используйте Start Here, чтобы сориентироваться в экологическом рабочем пространстве, подтвердить базовый путь настройки и быстро перейти к обязательствам, аспектам и проверкам.'
      },
      OHSMS: {
        en: 'Use Start Here to orient the OH&S workspace, confirm the core setup path, and move quickly into hazards, incidents, competence, and assurance work.',
        az: 'Start Here səhifəsindən əməyin mühafizəsi iş məkanını yönləndirmək, əsas quruluş yolunu təsdiqləmək və təhlükələr, hadisələr, səriştə, təminat işlərinə sürətlə keçmək üçün istifadə edin.',
        ru: 'Используйте Start Here, чтобы сориентироваться в рабочем пространстве ОТиЗ, подтвердить базовый путь настройки и быстро перейти к опасностям, инцидентам, компетентности и проверкам.'
      },
      IMS: {
        en: 'Use Start Here to orient the integrated workspace, confirm the core setup path, and move quickly into planning, operations, assurance, and review.',
        az: 'Start Here səhifəsindən inteqrə olunmuş iş məkanını yönləndirmək, əsas quruluş yolunu təsdiqləmək və planlaşdırma, əməliyyat, təminat və baxışa sürətlə keçmək üçün istifadə edin.',
        ru: 'Используйте Start Here, чтобы сориентироваться в интегрированном рабочем пространстве, подтвердить базовый путь настройки и быстро перейти к планированию, операциям, проверкам и анализу.'
      },
      FSMS: {
        en: 'Use Start Here to orient the food safety workspace, confirm the core setup path, and move quickly into provider, training, assurance, and review work.',
        az: 'Start Here səhifəsindən qida təhlükəsizliyi iş məkanını yönləndirmək, əsas quruluş yolunu təsdiqləmək və təminatçı, təlim, təminat, baxış işlərinə sürətlə keçmək üçün istifadə edin.',
        ru: 'Используйте Start Here, чтобы сориентироваться в рабочем пространстве пищевой безопасности, подтвердить базовый путь настройки и быстро перейти к поставщикам, обучению, проверкам и анализу.'
      }
    });
  }

  protected systemMapTitle() {
    return this.scopeVariant({
      QMS: { en: 'How quality modules interact', az: 'Keyfiyyət modulları necə qarşılıqlı işləyir', ru: 'Как взаимодействуют модули качества' },
      EMS: { en: 'How environmental modules interact', az: 'Ekoloji modullar necə qarşılıqlı işləyir', ru: 'Как взаимодействуют экологические модули' },
      OHSMS: { en: 'How OH&S modules interact', az: 'Əməyin mühafizəsi modulları necə qarşılıqlı işləyir', ru: 'Как взаимодействуют модули ОТиЗ' },
      IMS: { en: this.i18n.t('implementation.diagram.title'), az: this.i18n.t('implementation.diagram.title'), ru: this.i18n.t('implementation.diagram.title') },
      FSMS: { en: 'How food safety modules interact', az: 'Qida təhlükəsizliyi modulları necə qarşılıqlı işləyir', ru: 'Как взаимодействуют модули пищевой безопасности' }
    });
  }

  protected systemMapCopy() {
    return this.scopeVariant({
      QMS: {
        en: 'Use this map as the quickest orientation view for quality planning, control, assurance, and improvement.',
        az: 'Bu xəritədən keyfiyyət planlaşdırması, nəzarəti, təminatı və təkmilləşdirilməsi üçün ən sürətli istiqamətləndirmə görünüşü kimi istifadə edin.',
        ru: 'Используйте эту схему как самый быстрый обзор для планирования, контроля, обеспечения и улучшения качества.'
      },
      EMS: {
        en: 'Use this map as the quickest orientation view for environmental planning, control, assurance, and improvement.',
        az: 'Bu xəritədən ekoloji planlaşdırma, nəzarət, təminat və təkmilləşdirmə üçün ən sürətli istiqamətləndirmə görünüşü kimi istifadə edin.',
        ru: 'Используйте эту схему как самый быстрый обзор для экологического планирования, контроля, обеспечения и улучшения.'
      },
      OHSMS: {
        en: 'Use this map as the quickest orientation view for OH&S planning, control, assurance, and improvement.',
        az: 'Bu xəritədən əməyin mühafizəsi planlaşdırması, nəzarəti, təminatı və təkmilləşdirilməsi üçün ən sürətli istiqamətləndirmə görünüşü kimi istifadə edin.',
        ru: 'Используйте эту схему как самый быстрый обзор для планирования, контроля, обеспечения и улучшения ОТиЗ.'
      },
      IMS: {
        en: this.i18n.t('implementation.diagram.copy'),
        az: this.i18n.t('implementation.diagram.copy'),
        ru: this.i18n.t('implementation.diagram.copy')
      },
      FSMS: {
        en: 'Use this map as the quickest orientation view for food safety planning, control, assurance, and improvement.',
        az: 'Bu xəritədən qida təhlükəsizliyi planlaşdırması, nəzarəti, təminatı və təkmilləşdirilməsi üçün ən sürətli istiqamətləndirmə görünüşü kimi istifadə edin.',
        ru: 'Используйте эту схему как самый быстрый обзор для планирования, контроля, обеспечения и улучшения пищевой безопасности.'
      }
    });
  }

  protected readinessTitle() {
    return this.scopeVariant({
      QMS: { en: 'Quality readiness path', az: 'Keyfiyyət hazırlıq yolu', ru: 'Путь готовности по качеству' },
      EMS: { en: 'Environmental readiness path', az: 'Ekoloji hazırlıq yolu', ru: 'Путь экологической готовности' },
      OHSMS: { en: 'OH&S readiness path', az: 'Əməyin mühafizəsi hazırlıq yolu', ru: 'Путь готовности по ОТиЗ' },
      IMS: { en: this.i18n.t('implementation.readiness.title'), az: this.i18n.t('implementation.readiness.title'), ru: this.i18n.t('implementation.readiness.title') },
      FSMS: { en: 'Food safety readiness path', az: 'Qida təhlükəsizliyi hazırlıq yolu', ru: 'Путь готовности по пищевой безопасности' }
    });
  }

  protected readinessCopy() {
    return this.scopeVariant({
      QMS: {
        en: 'Use these launch points to confirm the quality system is ready to run with clear ownership and evidence.',
        az: 'Keyfiyyət sisteminin aydın cavabdehlik və sübutlarla işləməyə hazır olduğunu təsdiqləmək üçün bu başlanğıc nöqtələrindən istifadə edin.',
        ru: 'Используйте эти стартовые точки, чтобы подтвердить готовность системы качества к работе с ясной ответственностью и доказательствами.'
      },
      EMS: {
        en: 'Use these launch points to confirm the environmental system is ready to run with clear ownership and evidence.',
        az: 'Ekoloji sistemin aydın cavabdehlik və sübutlarla işləməyə hazır olduğunu təsdiqləmək üçün bu başlanğıc nöqtələrindən istifadə edin.',
        ru: 'Используйте эти стартовые точки, чтобы подтвердить готовность экологической системы к работе с ясной ответственностью и доказательствами.'
      },
      OHSMS: {
        en: 'Use these launch points to confirm the OH&S system is ready to run with clear ownership and evidence.',
        az: 'Əməyin mühafizəsi sisteminin aydın cavabdehlik və sübutlarla işləməyə hazır olduğunu təsdiqləmək üçün bu başlanğıc nöqtələrindən istifadə edin.',
        ru: 'Используйте эти стартовые точки, чтобы подтвердить готовность системы ОТиЗ к работе с ясной ответственностью и доказательствами.'
      },
      IMS: {
        en: this.i18n.t('implementation.readiness.copy'),
        az: this.i18n.t('implementation.readiness.copy'),
        ru: this.i18n.t('implementation.readiness.copy')
      },
      FSMS: {
        en: 'Use these launch points to confirm the food safety system is ready to run with clear ownership and evidence.',
        az: 'Qida təhlükəsizliyi sisteminin aydın cavabdehlik və sübutlarla işləməyə hazır olduğunu təsdiqləmək üçün bu başlanğıc nöqtələrindən istifadə edin.',
        ru: 'Используйте эти стартовые точки, чтобы подтвердить готовность системы пищевой безопасности к работе с ясной ответственностью и доказательствами.'
      }
    });
  }

  protected flowGuidanceTitle() {
    return this.scopeVariant({
      QMS: { en: 'Quality flow', az: 'Keyfiyyət axını', ru: 'Поток качества' },
      EMS: { en: 'Environmental flow', az: 'Ekoloji axın', ru: 'Экологический поток' },
      OHSMS: { en: 'OH&S flow', az: 'Əməyin mühafizəsi axını', ru: 'Поток ОТиЗ' },
      IMS: { en: this.i18n.t('implementation.guidance.flowTitle'), az: this.i18n.t('implementation.guidance.flowTitle'), ru: this.i18n.t('implementation.guidance.flowTitle') },
      FSMS: { en: 'Food safety flow', az: 'Qida təhlükəsizliyi axını', ru: 'Поток пищевой безопасности' }
    });
  }

  protected flowGuidanceCopy() {
    return this.scopeVariant({
      QMS: {
        en: 'Start with process structure, controlled documents, risks, and audit follow-up so the quality system becomes usable quickly.',
        az: 'Keyfiyyət sisteminin sürətlə işlək olması üçün proses quruluşu, idarə olunan sənədlər, risklər və audit izləməsi ilə başlayın.',
        ru: 'Начните со структуры процессов, управляемых документов, рисков и последующих действий по аудитам, чтобы система качества быстро стала рабочей.'
      },
      EMS: {
        en: 'Start with obligations, aspects, operational controls, and audit follow-up so the environmental system becomes usable quickly.',
        az: 'Ekoloji sistemin sürətlə işlək olması üçün öhdəliklər, aspektlər, əməliyyat nəzarətləri və audit izləməsi ilə başlayın.',
        ru: 'Начните с обязательств, аспектов, операционных мер контроля и последующих действий по аудитам, чтобы экологическая система быстро стала рабочей.'
      },
      OHSMS: {
        en: 'Start with hazards, incidents, competence, and audit follow-up so the OH&S system becomes usable quickly.',
        az: 'Əməyin mühafizəsi sisteminin sürətlə işlək olması üçün təhlükələr, hadisələr, səriştə və audit izləməsi ilə başlayın.',
        ru: 'Начните с опасностей, инцидентов, компетентности и последующих действий по аудитам, чтобы система ОТиЗ быстро стала рабочей.'
      },
      IMS: {
        en: this.i18n.t('implementation.guidance.flowCopy'),
        az: this.i18n.t('implementation.guidance.flowCopy'),
        ru: this.i18n.t('implementation.guidance.flowCopy')
      },
      FSMS: {
        en: 'Start with providers, training, obligations, and assurance so the food safety system becomes usable quickly.',
        az: 'Qida təhlükəsizliyi sisteminin sürətlə işlək olması üçün təminatçılar, təlim, öhdəliklər və təminat ilə başlayın.',
        ru: 'Начните с поставщиков, обучения, обязательств и проверок, чтобы система пищевой безопасности быстро стала рабочей.'
      }
    });
  }

  protected moduleDiagramLabel(module: PackageModuleKey) {
    const mapping: Record<PackageModuleKey, string> = {
      dashboard: 'shell.nav.dashboard.label',
      implementation: 'shell.nav.startHere.label',
      settings: 'shell.nav.settings.label',
      users: 'shell.nav.users.label',
      'activity-log': 'shell.nav.activityLog.label',
      audits: 'shell.nav.audits.label',
      ncr: 'shell.nav.ncr.label',
      capa: 'shell.nav.capa.label',
      actions: 'shell.nav.actions.label',
      documents: 'shell.nav.documents.label',
      risks: 'shell.nav.risks.label',
      context: 'shell.nav.context.label',
      'process-register': 'shell.nav.processRegister.label',
      training: 'shell.nav.training.label',
      'compliance-obligations': 'shell.nav.complianceObligations.label',
      kpis: 'shell.nav.kpis.label',
      'management-review': 'shell.nav.managementReview.label',
      reports: 'shell.nav.reports.label',
      incidents: 'shell.nav.incidents.label',
      'environmental-aspects': 'shell.nav.environmentalAspects.label',
      hazards: 'shell.nav.hazards.label',
      'external-providers': 'shell.nav.externalProviders.label',
      'change-management': 'shell.nav.changeManagement.label'
    };
    return this.i18n.t(mapping[module]);
  }

  protected moduleDiagramRoute(module: PackageModuleKey) {
    const routes: Record<PackageModuleKey, string> = {
      dashboard: '/dashboard',
      implementation: '/start-here',
      settings: '/settings',
      users: '/users',
      'activity-log': '/activity-log',
      audits: '/audits',
      ncr: '/ncr',
      capa: '/capa',
      actions: '/actions',
      documents: '/documents',
      risks: '/risks',
      context: '/context',
      'process-register': '/process-register',
      training: '/training',
      'compliance-obligations': '/compliance-obligations',
      kpis: '/kpis',
      'management-review': '/management-review',
      reports: '/reports',
      incidents: '/incidents',
      'environmental-aspects': '/environmental-aspects',
      hazards: '/hazards',
      'external-providers': '/external-providers',
      'change-management': '/change-management'
    };
    return routes[module];
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

  protected readinessCardLabel(item: ReadinessChecklistCard) {
    this.i18n.language();
    const existingLabels: Partial<Record<ReadinessChecklistCard['id'], string>> = {
      companyProfile: this.i18n.t('implementation.readiness.items.companyProfile.label'),
      usersRoles: this.i18n.t('implementation.readiness.items.usersRoles.label'),
      processMap: this.i18n.t('implementation.readiness.items.processMap.label'),
      controlledDocuments: this.i18n.t('implementation.readiness.items.controlledDocuments.label'),
      risks: this.i18n.t('implementation.readiness.items.risks.label'),
      audits: this.i18n.t('implementation.readiness.items.audits.label'),
      ncrCapaActions: this.i18n.t('implementation.readiness.items.ncrCapaActions.label'),
      kpis: this.i18n.t('implementation.readiness.items.kpis.label'),
      managementReview: this.i18n.t('implementation.readiness.items.managementReview.label')
    };

    if (existingLabels[item.id]) {
      return existingLabels[item.id]!;
    }

    return {
      obligations: this.scopeText({
        en: 'Compliance obligations',
        az: 'Uyğunluq öhdəlikləri',
        ru: 'Обязательства по соблюдению требований'
      }),
      aspects: this.scopeText({
        en: 'Environmental aspects',
        az: 'Ekoloji aspektlər',
        ru: 'Экологические аспекты'
      }),
      incidents: this.scopeText({
        en: 'Incidents',
        az: 'İnsidentlər',
        ru: 'Инциденты'
      }),
      hazards: this.scopeText({
        en: 'Hazards',
        az: 'Təhlükələr',
        ru: 'Опасности'
      }),
      training: this.scopeText({
        en: 'Training',
        az: 'Təlim',
        ru: 'Обучение'
      }),
      providers: this.scopeText({
        en: 'External providers',
        az: 'Xarici təchizatçılar',
        ru: 'Внешние поставщики'
      }),
      actions: this.scopeText({
        en: 'Actions',
        az: 'Tapşırıqlar',
        ru: 'Действия'
      })
    }[item.id];
  }

  protected readinessCardHint(item: ReadinessChecklistCard) {
    this.i18n.language();
    const existingHints: Partial<Record<ReadinessChecklistCard['id'], string>> = {
      companyProfile: this.i18n.t('implementation.readiness.items.companyProfile.hint'),
      usersRoles: this.i18n.t('implementation.readiness.items.usersRoles.hint'),
      processMap: this.i18n.t('implementation.readiness.items.processMap.hint'),
      controlledDocuments: this.i18n.t('implementation.readiness.items.controlledDocuments.hint'),
      risks: this.i18n.t('implementation.readiness.items.risks.hint'),
      audits: this.i18n.t('implementation.readiness.items.audits.hint'),
      ncrCapaActions: this.i18n.t('implementation.readiness.items.ncrCapaActions.hint'),
      kpis: this.i18n.t('implementation.readiness.items.kpis.hint'),
      managementReview: this.i18n.t('implementation.readiness.items.managementReview.hint')
    };

    if (existingHints[item.id]) {
      return existingHints[item.id]!;
    }

    return {
      obligations: this.scopeText({
        en: 'Track legal, regulatory, and external requirements that shape this scope.',
        az: 'Bu scope-u formalaşdıran hüquqi, normativ və xarici tələbləri izləyin.',
        ru: 'Отслеживайте правовые, нормативные и внешние требования для этого scope.'
      }),
      aspects: this.scopeText({
        en: 'Record significant environmental aspects, lifecycle view, and required controls.',
        az: 'Əhəmiyyətli ekoloji aspektləri, həyat dövrü baxışını və tələb olunan nəzarətləri qeyd edin.',
        ru: 'Фиксируйте значимые экологические аспекты, взгляд по жизненному циклу и требуемые меры контроля.'
      }),
      incidents: this.scopeText({
        en: 'Capture events, investigations, and resulting follow-up that feeds assurance and review.',
        az: 'Hadisələri, araşdırmaları və təminatla rəhbərlik baxışına ötürülən izləmə tədbirlərini qeyd edin.',
        ru: 'Фиксируйте события, расследования и последующие действия для проверок и анализа руководством.'
      }),
      hazards: this.scopeText({
        en: 'Maintain the hazard register, harm view, and control needs for OH&S operations.',
        az: 'Əməyin mühafizəsi əməliyyatları üçün təhlükə reyestrini, zərər baxışını və nəzarət ehtiyaclarını saxlayın.',
        ru: 'Ведите реестр опасностей, оценку вреда и потребности в мерах контроля для OHS.'
      }),
      training: this.scopeText({
        en: 'Assign competence and awareness activities that support safe and consistent operation.',
        az: 'Təhlükəsiz və ardıcıl fəaliyyət üçün səriştə və maarifləndirmə tədbirlərini təyin edin.',
        ru: 'Назначайте обучение и мероприятия по осведомлённости для безопасной и стабильной работы.'
      }),
      providers: this.scopeText({
        en: 'Review external providers, supplier assurance, and outsourced process support.',
        az: 'Xarici təchizatçıları, təchizatçı təminatını və autsors proses dəstəyini nəzərdən keçirin.',
        ru: 'Проверяйте внешних поставщиков, поставочное обеспечение и поддержку аутсорсинговых процессов.'
      }),
      actions: this.scopeText({
        en: 'Track follow-up owners, due dates, and overdue work across the selected scope.',
        az: 'Seçilmiş scope üzrə cavabdehləri, son tarixləri və gecikmiş işləri izləyin.',
        ru: 'Отслеживайте владельцев, сроки и просроченные действия в рамках выбранного scope.'
      })
    }[item.id];
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

  private scopeText(copy: { en: string; az: string; ru: string }) {
    const language = this.i18n.language();
    if (language === 'az') {
      return copy.az;
    }
    if (language === 'ru') {
      return copy.ru;
    }
    return copy.en;
  }

  private scopeVariant(content: Record<TenantScope, { en: string; az: string; ru: string }>) {
    const scope = this.authStore.scope();
    const language = this.i18n.language();
    return content[scope][language];
  }
}
