import { CommonModule } from '@angular/common';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
import { I18nService } from '../core/i18n.service';
import { TenantScope } from '../core/package-entitlements';
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

type IncidentSummaryRow = { id: string; status: string; severity: string };
type ProviderSummaryRow = {
  id: string;
  status: string;
  criticality: string;
  evaluationOutcome?: string | null;
  supplierAuditRequired?: boolean;
  supplierAuditLinked?: boolean;
};
type ObligationSummaryRow = { id: string; status: string; nextReviewDate?: string | null };
type HazardSummaryRow = { id: string; status: string; severity: string };
type AspectSummaryRow = { id: string; status: string; significance: string };
type ChangeSummaryRow = { id: string; status: string; reviewDate?: string | null; targetImplementationDate?: string | null };
type ContextFeedbackSummary = {
  summary: {
    customerSurveyResponses: number;
    customerSurveyAverage?: number | null;
    customerFeedbackAttention: number;
  };
};
type ManagementReviewAiSections = {
  auditResults: string;
  capaStatus: string;
  kpiPerformance: string;
  customerInterestedPartiesFeedback: string;
  providerPerformance: string;
  complianceObligations: string;
  incidentEmergencyPerformance: string;
  consultationCommunication: string;
  risksOpportunities: string;
  changesAffectingSystem: string;
  previousActions: string;
};
type ManagementReviewAiDraft = {
  provider: string;
  model: string;
  mode: 'provider' | 'template';
  sections: ManagementReviewAiSections;
  warning?: string;
};

type ReviewRecord = {
  id: string;
  title: string;
  reviewDate?: string | null;
  chairpersonId?: string | null;
  agenda?: string | null;
  auditResults?: string | null;
  capaStatus?: string | null;
  kpiPerformance?: string | null;
  customerInterestedPartiesFeedback?: string | null;
  providerPerformance?: string | null;
  complianceObligations?: string | null;
  incidentEmergencyPerformance?: string | null;
  consultationCommunication?: string | null;
  risksOpportunities?: string | null;
  changesAffectingSystem?: string | null;
  previousActions?: string | null;
  minutes?: string | null;
  decisions?: string | null;
  improvementActions?: string | null;
  systemChangesNeeded?: string | null;
  objectiveTargetChanges?: string | null;
  resourceNeeds?: string | null;
  effectivenessConclusion?: string | null;
  summary?: string | null;
  status: ReviewStatus;
};

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, RecordWorkItemsComponent],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="pageLabel()"
        [title]="pageTitle()"
        [description]="pageDescription()"
        [breadcrumbs]="breadcrumbs()"
      >
        <a *ngIf="showStartHereBackLink()" [routerLink]="['/implementation']" class="button-link secondary">{{ t('managementReview.actions.backToStartHere') }}</a>
        <a *ngIf="mode() === 'list' && canWrite()" routerLink="/management-review/new" class="button-link">+ {{ t('managementReview.actions.new') }}</a>
        <button *ngIf="mode() === 'detail' && selectedReview()" type="button" class="button-link secondary" [disabled]="generatingReport()" (click)="generateReport()">
          {{ generatingReport() ? t('managementReview.actions.preparingPdf') : t('managementReview.actions.downloadPdf') }}
        </button>
        <button *ngIf="mode() === 'detail' && selectedReview()" type="button" class="button-link secondary" [disabled]="generatingPresentation()" (click)="generatePresentation()">
          {{ generatingPresentation() ? t('managementReview.actions.preparingPpt') : t('managementReview.actions.downloadPpt') }}
        </button>
        <a *ngIf="mode() === 'detail' && selectedReview() && canWrite()" [routerLink]="['/management-review', selectedReview()?.id, 'edit']" class="button-link">{{ t('managementReview.actions.edit') }}</a>
        <button *ngIf="mode() === 'detail' && canArchiveReview()" type="button" class="button-link secondary" (click)="archiveReview()">{{ t('managementReview.actions.archive') }}</button>
        <a *ngIf="mode() !== 'list'" routerLink="/management-review" class="button-link secondary">{{ t('managementReview.actions.backToList') }}</a>
      </iso-page-header>

      <section *ngIf="mode() === 'list'" class="page-stack">
        <div class="card list-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Meetings</span>
              <h3>{{ listTitle() }}</h3>
              <p class="subtle">{{ listCopy() }}</p>
            </div>
          </div>

          <div class="empty-state" *ngIf="loading()">
            <strong>{{ t('managementReview.list.loadingTitle') }}</strong>
            <span>{{ t('managementReview.list.loadingCopy') }}</span>
          </div>

          <div class="data-table-wrap" *ngIf="!loading() && reviews().length">
            <table class="data-table">
              <thead>
                <tr>
                  <th>{{ t('managementReview.list.table.meeting') }}</th>
                  <th>{{ t('managementReview.list.table.date') }}</th>
                  <th>{{ t('managementReview.list.table.status') }}</th>
                  <th>{{ t('managementReview.list.table.inputCoverage') }}</th>
                  <th>{{ t('managementReview.list.table.outputsReadiness') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of reviews()" [routerLink]="['/management-review', item.id]">
                  <td>
                    <div class="table-title">
                      <strong>{{ item.title }}</strong>
                      <small>{{ item.summary || t('managementReview.list.noSummary') }}</small>
                    </div>
                  </td>
                  <td>{{ item.reviewDate ? (item.reviewDate | date:'yyyy-MM-dd') : t('managementReview.list.tbd') }}</td>
                  <td><span class="status-badge" [class.success]="item.status === 'CLOSED'" [class.warn]="item.status === 'HELD'">{{ statusLabel(item.status) }}</span></td>
                  <td>{{ reviewInputCoverage(item) }}/{{ inputSectionCount() }}</td>
                  <td>
                    <span class="status-badge" [class.success]="reviewOutputsReady(item)" [class.warn]="item.status !== 'PLANNED' && !reviewOutputsReady(item)">
                      {{ reviewOutputsReady(item) ? t('managementReview.list.recorded') : t('managementReview.list.pending') }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section *ngIf="mode() === 'create' || mode() === 'edit'" class="page-columns">
        <form class="card form-card page-stack" [formGroup]="reviewForm" (ngSubmit)="saveReview()">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Meeting record</span>
              <h3>{{ mode() === 'create' ? t('managementReview.form.createTitle') : t('managementReview.form.editTitle') }}</h3>
              <p class="subtle">{{ t('managementReview.form.copy') }}</p>
            </div>
          </div>

          <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <section class="readiness-strip">
            <article class="readiness-card">
              <span>{{ t('managementReview.form.readiness.inputsCaptured') }}</span>
              <strong>{{ completedInputCount() }}/{{ inputSectionCount() }}</strong>
              <small>{{ completedInputCount() >= plannedInputTarget() ? t('managementReview.form.readiness.inputsReady') : t('managementReview.form.readiness.inputsThin') }}</small>
            </article>
            <article class="readiness-card">
              <span>{{ t('managementReview.form.readiness.outputsCaptured') }}</span>
              <strong>{{ completedOutputCount() }}/{{ outputSectionCount() }}</strong>
              <small>{{ completedOutputCount() >= heldOutputTarget() ? t('managementReview.form.readiness.outputsReady') : t('managementReview.form.readiness.outputsThin') }}</small>
            </article>
            <article class="readiness-card">
              <span>{{ t('managementReview.form.readiness.meetingReadiness') }}</span>
              <strong>{{ reviewReadinessLabel() }}</strong>
              <small>{{ reviewReadinessHint() }}</small>
            </article>
          </section>

          <section class="guidance-card">
            <strong>{{ t('managementReview.form.liveInputs.title') }}</strong>
            <p>
              {{ t('managementReview.form.liveInputs.copy') }}
              <ng-container *ngIf="hasAiAddOn()"> {{ t('managementReview.form.liveInputs.aiCopy') }}</ng-container>
            </p>
            <div class="touchpoint-grid top-space">
              <a class="touchpoint-card" *ngFor="let item of managementSignals()" [routerLink]="item.link">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
                <small>{{ item.copy }}</small>
              </a>
            </div>
            <div class="button-row top-space" *ngIf="hasAiAddOn()">
              <button type="button" class="secondary" [disabled]="generatingAiInputs() || saving() || !canWrite()" (click)="draftInputsWithAi()">
                {{ generatingAiInputs() ? t('managementReview.form.liveInputs.aiBusy') : t('managementReview.form.liveInputs.aiAction') }}
              </button>
            </div>
            <small class="top-space" *ngIf="hasAiAddOn()">{{ t('managementReview.form.liveInputs.aiNote') }}</small>
          </section>

          <label class="field"><span>{{ t('managementReview.form.fields.title') }}</span><input formControlName="title" [placeholder]="t('managementReview.form.placeholders.title')"></label>
          <div class="form-grid-3">
            <label class="field"><span>{{ t('managementReview.form.fields.reviewDate') }}</span><input type="date" formControlName="reviewDate"></label>
            <label class="field">
              <span>{{ t('managementReview.form.fields.chairperson') }}</span>
              <select formControlName="chairpersonId">
                <option value="">{{ t('managementReview.common.unassigned') }}</option>
                <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
              </select>
            </label>
            <label class="field">
              <span>{{ t('managementReview.form.fields.status') }}</span>
              <select formControlName="status">
                <option value="PLANNED">{{ statusLabel('PLANNED') }}</option>
                <option value="HELD">{{ statusLabel('HELD') }}</option>
                <option value="CLOSED">{{ statusLabel('CLOSED') }}</option>
              </select>
            </label>
          </div>

          <section class="detail-section">
            <h4>{{ t('managementReview.inputs.title') }}</h4>
            <div class="page-stack top-space">
              <p class="section-note">{{ t('managementReview.inputs.copy') }}</p>
              <label class="field"><span>{{ t('managementReview.sections.auditResults') }}</span><textarea rows="3" formControlName="auditResults" [placeholder]="t('managementReview.inputs.placeholders.auditResults')"></textarea></label>
              <label class="field"><span>{{ t('managementReview.sections.capaStatus') }}</span><textarea rows="3" formControlName="capaStatus" [placeholder]="t('managementReview.inputs.placeholders.capaStatus')"></textarea></label>
              <label class="field"><span>{{ t('managementReview.sections.kpiPerformance') }}</span><textarea rows="3" formControlName="kpiPerformance" [placeholder]="t('managementReview.inputs.placeholders.kpiPerformance')"></textarea></label>
              <label class="field"><span>{{ t('managementReview.sections.customerInterestedPartiesFeedback') }}</span><textarea rows="3" formControlName="customerInterestedPartiesFeedback" [placeholder]="t('managementReview.inputs.placeholders.customerInterestedPartiesFeedback')"></textarea></label>
              <label class="field"><span>{{ t('managementReview.sections.providerPerformance') }}</span><textarea rows="3" formControlName="providerPerformance" [placeholder]="t('managementReview.inputs.placeholders.providerPerformance')"></textarea></label>
              <label class="field"><span>{{ t('managementReview.sections.complianceObligations') }}</span><textarea rows="3" formControlName="complianceObligations" [placeholder]="t('managementReview.inputs.placeholders.complianceObligations')"></textarea></label>
              <label class="field"><span>{{ t('managementReview.sections.incidentEmergencyPerformance') }}</span><textarea rows="3" formControlName="incidentEmergencyPerformance" [placeholder]="t('managementReview.inputs.placeholders.incidentEmergencyPerformance')"></textarea></label>
              <label class="field"><span>{{ t('managementReview.sections.consultationCommunication') }}</span><textarea rows="3" formControlName="consultationCommunication" [placeholder]="t('managementReview.inputs.placeholders.consultationCommunication')"></textarea></label>
              <label class="field"><span>{{ t('managementReview.sections.risksOpportunities') }}</span><textarea rows="3" formControlName="risksOpportunities" [placeholder]="t('managementReview.inputs.placeholders.risksOpportunities')"></textarea></label>
              <label class="field"><span>{{ t('managementReview.sections.changesAffectingSystem') }}</span><textarea rows="3" formControlName="changesAffectingSystem" [placeholder]="t('managementReview.inputs.placeholders.changesAffectingSystem')"></textarea></label>
              <label class="field"><span>{{ t('managementReview.sections.previousActions') }}</span><textarea rows="3" formControlName="previousActions" [placeholder]="t('managementReview.inputs.placeholders.previousActions')"></textarea></label>
            </div>
          </section>

          <section class="detail-section">
            <h4>{{ t('managementReview.outputs.title') }}</h4>
            <div class="page-stack top-space">
              <p class="section-note">{{ t('managementReview.outputs.copy') }}</p>
              <label class="field"><span>{{ t('managementReview.sections.minutes') }}</span><textarea rows="4" formControlName="minutes" [placeholder]="t('managementReview.outputs.placeholders.minutes')"></textarea></label>
              <label class="field"><span>{{ t('managementReview.sections.decisions') }}</span><textarea rows="3" formControlName="decisions" [placeholder]="t('managementReview.outputs.placeholders.decisions')"></textarea></label>
              <label class="field"><span>{{ t('managementReview.sections.improvementActions') }}</span><textarea rows="3" formControlName="improvementActions" [placeholder]="t('managementReview.outputs.placeholders.improvementActions')"></textarea></label>
              <label class="field"><span>{{ t('managementReview.sections.systemChangesNeeded') }}</span><textarea rows="3" formControlName="systemChangesNeeded" [placeholder]="t('managementReview.outputs.placeholders.systemChangesNeeded')"></textarea></label>
              <label class="field"><span>{{ t('managementReview.sections.objectiveTargetChanges') }}</span><textarea rows="3" formControlName="objectiveTargetChanges" [placeholder]="t('managementReview.outputs.placeholders.objectiveTargetChanges')"></textarea></label>
              <label class="field"><span>{{ t('managementReview.sections.resourceNeeds') }}</span><textarea rows="3" formControlName="resourceNeeds" [placeholder]="t('managementReview.outputs.placeholders.resourceNeeds')"></textarea></label>
              <label class="field"><span>{{ t('managementReview.sections.effectivenessConclusion') }}</span><textarea rows="3" formControlName="effectivenessConclusion" [placeholder]="t('managementReview.outputs.placeholders.effectivenessConclusion')"></textarea></label>
              <label class="field"><span>{{ t('managementReview.form.fields.summary') }}</span><textarea rows="2" formControlName="summary" [placeholder]="t('managementReview.outputs.placeholders.summary')"></textarea></label>
            </div>
          </section>

          <div class="button-row">
            <button type="submit" [disabled]="reviewForm.invalid || saving() || !canWrite()">{{ saving() ? t('managementReview.actions.saving') : t('managementReview.actions.save') }}</button>
            <a [routerLink]="selectedId() ? ['/management-review', selectedId()] : ['/management-review']" class="button-link secondary">{{ t('common.cancel') }}</a>
          </div>
        </form>
      </section>

          <section *ngIf="mode() === 'detail' && selectedReview()" class="page-columns">
        <div class="page-stack">
          <section class="card detail-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">{{ t('managementReview.page.label') }}</span>
                <h3>{{ selectedReview()?.title }}</h3>
                <p class="subtle">{{ selectedReview()?.reviewDate ? (selectedReview()?.reviewDate | date:'yyyy-MM-dd') : t('managementReview.detail.dateNotSet') }}</p>
              </div>
              <span class="status-badge" [class.success]="selectedReview()?.status === 'CLOSED'" [class.warn]="selectedReview()?.status === 'HELD'">{{ statusLabel(selectedReview()?.status || null) }}</span>
            </div>

            <section class="readiness-strip top-space">
              <article class="readiness-card">
                <span>{{ t('managementReview.detail.summary.inputsRecorded') }}</span>
                <strong>{{ detailInputCount() }}/{{ inputSectionCount() }}</strong>
                <small>{{ t('managementReview.detail.summary.inputsCopy') }}</small>
              </article>
              <article class="readiness-card">
                <span>{{ t('managementReview.detail.summary.outputsRecorded') }}</span>
                <strong>{{ detailOutputCount() }}/{{ outputSectionCount() }}</strong>
                <small>{{ detailOutputCount() >= heldOutputTarget() ? t('managementReview.detail.summary.outputsReady') : t('managementReview.detail.summary.outputsThin') }}</small>
              </article>
              <article class="readiness-card">
                <span>{{ t('managementReview.detail.summary.managementPosition') }}</span>
                <strong>{{ managementPositionLabel() }}</strong>
                <small>{{ managementPositionHint() }}</small>
              </article>
            </section>

            <section class="guidance-card top-space" *ngIf="needsMeetingContentAttention()">
              <strong>{{ t('managementReview.detail.attention.title') }}</strong>
              <p>{{ t('managementReview.detail.attention.copy') }}</p>
              <small>{{ t('managementReview.detail.attention.note') }}</small>
            </section>

            <section class="guidance-card top-space">
              <strong>{{ t('managementReview.detail.liveSignals.title') }}</strong>
              <p>{{ t('managementReview.detail.liveSignals.copy') }}</p>
              <div class="touchpoint-grid top-space">
                <a class="touchpoint-card" *ngFor="let item of managementSignals()" [routerLink]="item.link">
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                  <small>{{ item.reviewCopy || item.copy }}</small>
                </a>
              </div>
            </section>

            <div class="page-stack top-space">
              <section class="detail-section" *ngFor="let section of reviewSections()">
                <div class="section-head">
                  <div>
                    <h4>{{ section.label }}</h4>
                    <p class="subtle">{{ section.value || t('managementReview.detail.noContent') }}</p>
                  </div>
                  <button type="button" class="secondary" [disabled]="!canCreateActionFromSection(section.value)" [title]="createActionTooltip(section.value)" (click)="prepareAction(section.label, section.value)">{{ t('managementReview.detail.prepareAction') }}</button>
                </div>
              </section>
            </div>
          </section>

          <iso-record-work-items
            [sourceType]="'management-review'"
            [sourceId]="selectedId()"
            [draftTitle]="draftActionTitle()"
            [draftDescription]="draftActionDescription()"
          />
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

    .readiness-strip {
      display: grid;
      gap: 0.9rem;
      grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    }

    .readiness-card {
      display: grid;
      gap: 0.45rem;
      align-content: start;
      padding: 1rem 1rem 0.95rem;
      border: 1px solid rgba(31, 41, 51, 0.08);
      border-radius: 1rem;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(251, 252, 250, 0.94)),
        color-mix(in srgb, var(--surface-strong) 94%, white);
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.85);
      position: relative;
      overflow: hidden;
    }

    .readiness-card::before {
      content: '';
      position: absolute;
      inset: 0 auto auto 0;
      width: 100%;
      height: 4px;
      background: var(--mr-card-accent, rgba(23, 59, 47, 0.4));
    }

    .readiness-card:nth-child(1) { --mr-card-accent: #173B2F; }
    .readiness-card:nth-child(2) { --mr-card-accent: #1E467F; }
    .readiness-card:nth-child(3) { --mr-card-accent: #9A6B1F; }

    .readiness-card strong,
    .readiness-card small {
      min-width: 0;
    }

    .readiness-card span,
    .readiness-card small {
      display: block;
    }

    .readiness-card span {
      color: var(--muted-strong);
      font-size: 0.74rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .readiness-card strong {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      min-height: 2.35rem;
      padding: 0 0.8rem;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--mr-card-accent) 18%, white);
      background: color-mix(in srgb, var(--mr-card-accent) 10%, white);
      font-size: 1.28rem;
      color: var(--text-soft);
      line-height: 1;
      letter-spacing: -0.03em;
    }

    .readiness-card small {
      color: var(--muted);
      line-height: 1.45;
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

    .guidance-card p,
    .guidance-card small {
      margin-top: 0.4rem;
      color: #617165;
      line-height: 1.45;
    }

    .section-note {
      margin: 0;
      color: #617165;
      line-height: 1.5;
    }

    .touchpoint-grid {
      display: grid;
      gap: 0.8rem;
      grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    }

    .touchpoint-card {
      display: grid;
      gap: 0.42rem;
      align-content: start;
      padding: 1rem 1rem 0.95rem;
      border-radius: 1rem;
      border: 1px solid rgba(31, 41, 51, 0.08);
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(251, 252, 250, 0.94)),
        color-mix(in srgb, var(--surface-strong) 94%, white);
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.85);
      text-decoration: none;
      color: inherit;
      position: relative;
      overflow: hidden;
      transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
    }

    .touchpoint-card::before {
      content: '';
      position: absolute;
      inset: 0 auto auto 0;
      width: 100%;
      height: 4px;
      background: var(--mr-signal-accent, rgba(23, 59, 47, 0.4));
    }

    .touchpoint-card:nth-child(1) { --mr-signal-accent: #6A4C93; }
    .touchpoint-card:nth-child(2) { --mr-signal-accent: #173B2F; }
    .touchpoint-card:nth-child(3) { --mr-signal-accent: #9A6B1F; }
    .touchpoint-card:nth-child(4) { --mr-signal-accent: #1E467F; }

    .touchpoint-card:hover {
      transform: translateY(-1px);
      border-color: rgba(31, 41, 51, 0.12);
      box-shadow: 0 12px 24px rgba(15, 23, 42, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.88);
    }

    .touchpoint-card span,
    .touchpoint-card small {
      display: block;
    }

    .touchpoint-card span {
      color: var(--muted-strong);
      font-size: 0.74rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .touchpoint-card strong {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: fit-content;
      min-width: 2.6rem;
      min-height: 2.35rem;
      padding: 0 0.7rem;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--mr-signal-accent) 18%, white);
      background: color-mix(in srgb, var(--mr-signal-accent) 10%, white);
      font-size: 1.35rem;
      color: var(--text-soft);
      line-height: 1;
      letter-spacing: -0.03em;
    }

    .touchpoint-card small {
      color: var(--muted);
      line-height: 1.45;
    }
  `]
})
export class ManagementReviewPageComponent {
  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
  protected readonly reviews = signal<ReviewRecord[]>([]);
  protected readonly users = signal<UserOption[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selectedReview = signal<ReviewRecord | null>(null);
  protected readonly incidents = signal<IncidentSummaryRow[]>([]);
  protected readonly providers = signal<ProviderSummaryRow[]>([]);
  protected readonly obligations = signal<ObligationSummaryRow[]>([]);
  protected readonly hazards = signal<HazardSummaryRow[]>([]);
  protected readonly aspects = signal<AspectSummaryRow[]>([]);
  protected readonly changes = signal<ChangeSummaryRow[]>([]);
  protected readonly customerFeedback = signal<ContextFeedbackSummary | null>(null);
  protected readonly draftActionTitle = signal<string | null>(null);

  protected showStartHereBackLink() {
    return this.route.snapshot.queryParamMap.get('from') === 'start-here';
  }
  protected t(key: string, params?: Record<string, unknown>) {
    return this.i18n.t(key, params);
  }
  protected readonly draftActionDescription = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly generatingAiInputs = signal(false);
  protected readonly generatingReport = signal(false);
  protected readonly generatingPresentation = signal(false);
  protected readonly message = signal((history.state?.notice as string) || '');
  protected readonly error = signal('');

  protected readonly reviewForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    reviewDate: [''],
    chairpersonId: [''],
    agenda: [''],
    auditResults: [''],
    capaStatus: [''],
    kpiPerformance: [''],
    customerInterestedPartiesFeedback: [''],
    providerPerformance: [''],
    complianceObligations: [''],
    incidentEmergencyPerformance: [''],
    consultationCommunication: [''],
    risksOpportunities: [''],
    changesAffectingSystem: [''],
    previousActions: [''],
    minutes: [''],
    decisions: [''],
    improvementActions: [''],
    systemChangesNeeded: [''],
    objectiveTargetChanges: [''],
    resourceNeeds: [''],
    effectivenessConclusion: [''],
    summary: [''],
    status: ['PLANNED' as ReviewStatus, Validators.required]
  });

  constructor() {
    this.loadUsers();
    this.loadSystemSignals();
    this.route.data.subscribe((data) => {
      this.mode.set((data['mode'] as PageMode) || 'list');
      this.handleRoute(this.route.snapshot.paramMap);
    });
    this.route.paramMap.subscribe((params) => this.handleRoute(params));
  }

  private loadSystemSignals() {
    this.api.get<IncidentSummaryRow[]>('incidents').subscribe({
      next: (items) => this.incidents.set(items),
      error: () => this.incidents.set([])
    });
    this.api.get<ProviderSummaryRow[]>('external-providers').subscribe({
      next: (items) => this.providers.set(items),
      error: () => this.providers.set([])
    });
    this.api.get<ObligationSummaryRow[]>('compliance-obligations').subscribe({
      next: (items) => this.obligations.set(items),
      error: () => this.obligations.set([])
    });
    this.api.get<HazardSummaryRow[]>('hazards').subscribe({
      next: (items) => this.hazards.set(items),
      error: () => this.hazards.set([])
    });
    this.api.get<AspectSummaryRow[]>('environmental-aspects').subscribe({
      next: (items) => this.aspects.set(items),
      error: () => this.aspects.set([])
    });
    this.api.get<ChangeSummaryRow[]>('change-management').subscribe({
      next: (items) => this.changes.set(items),
      error: () => this.changes.set([])
    });
    this.api.get<ContextFeedbackSummary>('context/dashboard').subscribe({
      next: (summary) => this.customerFeedback.set(summary),
      error: () => this.customerFeedback.set(null)
    });
  }

  protected pageTitle() {
    const label = this.pageLabel();
    return {
      list: label,
      create: this.t('managementReview.page.titles.create'),
      detail: this.selectedReview()?.title || this.t('managementReview.page.titles.detail'),
      edit: this.selectedReview()?.title || this.t('managementReview.page.titles.edit')
    }[this.mode()];
  }

  protected pageLabel() {
    return this.scopeText({
      QMS: { en: 'Quality management review', az: 'Keyfiyyət üzrə rəhbərlik baxışı', ru: 'Анализ со стороны руководства по качеству' },
      EMS: { en: 'Environmental management review', az: 'Ekoloji rəhbərlik baxışı', ru: 'Анализ со стороны руководства по экологии' },
      OHSMS: { en: 'OH&S management review', az: 'Əməyin mühafizəsi üzrə rəhbərlik baxışı', ru: 'Анализ со стороны руководства по ОТиЗ' },
      IMS: { en: this.t('managementReview.page.label'), az: this.t('managementReview.page.label'), ru: this.t('managementReview.page.label') },
      FSMS: { en: 'Food safety management review', az: 'Qida təhlükəsizliyi üzrə rəhbərlik baxışı', ru: 'Анализ со стороны руководства по пищевой безопасности' }
    });
  }

  protected pageDescription() {
    if (this.mode() === 'list') {
      return this.scopeText({
        QMS: {
          en: 'Review quality performance, actions, and system direction in one leadership record.',
          az: 'Keyfiyyət nəticələrini, tədbirləri və sistem istiqamətini bir rəhbərlik qeydində nəzərdən keçirin.',
          ru: 'Рассматривайте результаты качества, действия и направление системы в одной записи руководства.'
        },
        EMS: {
          en: 'Review environmental performance, actions, and system direction in one leadership record.',
          az: 'Ekoloji nəticələri, tədbirləri və sistem istiqamətini bir rəhbərlik qeydində nəzərdən keçirin.',
          ru: 'Рассматривайте экологические результаты, действия и направление системы в одной записи руководства.'
        },
        OHSMS: {
          en: 'Review OH&S performance, actions, and system direction in one leadership record.',
          az: 'Əməyin mühafizəsi nəticələrini, tədbirləri və sistem istiqamətini bir rəhbərlik qeydində nəzərdən keçirin.',
          ru: 'Рассматривайте результаты по ОТиЗ, действия и направление системы в одной записи руководства.'
        },
        IMS: {
          en: this.t('managementReview.page.descriptions.list'),
          az: this.t('managementReview.page.descriptions.list'),
          ru: this.t('managementReview.page.descriptions.list')
        },
        FSMS: {
          en: 'Review food safety performance, actions, and system direction in one leadership record.',
          az: 'Qida təhlükəsizliyi nəticələrini, tədbirləri və sistem istiqamətini bir rəhbərlik qeydində nəzərdən keçirin.',
          ru: 'Рассматривайте результаты пищевой безопасности, действия и направление системы в одной записи руководства.'
        }
      });
    }

    if (this.mode() === 'create') {
      return this.t('managementReview.page.descriptions.create');
    }
    if (this.mode() === 'detail') {
      return this.t('managementReview.page.descriptions.detail');
    }
    return this.t('managementReview.page.descriptions.edit');
  }

  protected breadcrumbs() {
    const label = this.pageLabel();
    if (this.mode() === 'list') return [{ label }];
    const base = [{ label, link: '/management-review' }];
    if (this.mode() === 'create') return [...base, { label: this.t('managementReview.breadcrumbs.new') }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedReview()?.title || this.t('managementReview.breadcrumbs.record'), link: `/management-review/${this.selectedId()}` }, { label: this.t('managementReview.breadcrumbs.edit') }];
    return [...base, { label: this.selectedReview()?.title || this.t('managementReview.breadcrumbs.record') }];
  }

  protected listTitle() {
    return this.scopeText({
      QMS: { en: 'Quality review meetings', az: 'Keyfiyyət baxış iclasları', ru: 'Совещания по анализу качества' },
      EMS: { en: 'Environmental review meetings', az: 'Ekoloji baxış iclasları', ru: 'Совещания по экологическому анализу' },
      OHSMS: { en: 'OH&S review meetings', az: 'Əməyin mühafizəsi baxış iclasları', ru: 'Совещания по анализу ОТиЗ' },
      IMS: { en: this.t('managementReview.list.title'), az: this.t('managementReview.list.title'), ru: this.t('managementReview.list.title') },
      FSMS: { en: 'Food safety review meetings', az: 'Qida təhlükəsizliyi baxış iclasları', ru: 'Совещания по анализу пищевой безопасности' }
    });
  }

  protected listCopy() {
    return this.scopeText({
      QMS: {
        en: 'Track leadership reviews of quality performance, actions, and system direction.',
        az: 'Keyfiyyət nəticələri, tədbirlər və sistem istiqaməti üzrə rəhbərlik baxışlarını izləyin.',
        ru: 'Отслеживайте анализ со стороны руководства по результатам качества, действиям и направлению системы.'
      },
      EMS: {
        en: 'Track leadership reviews of environmental performance, actions, and system direction.',
        az: 'Ekoloji nəticələr, tədbirlər və sistem istiqaməti üzrə rəhbərlik baxışlarını izləyin.',
        ru: 'Отслеживайте анализ со стороны руководства по экологическим результатам, действиям и направлению системы.'
      },
      OHSMS: {
        en: 'Track leadership reviews of OH&S performance, actions, and system direction.',
        az: 'Əməyin mühafizəsi nəticələri, tədbirlər və sistem istiqaməti üzrə rəhbərlik baxışlarını izləyin.',
        ru: 'Отслеживайте анализ со стороны руководства по результатам ОТиЗ, действиям и направлению системы.'
      },
      IMS: {
        en: this.t('managementReview.list.copy'),
        az: this.t('managementReview.list.copy'),
        ru: this.t('managementReview.list.copy')
      },
      FSMS: {
        en: 'Track leadership reviews of food safety performance, actions, and system direction.',
        az: 'Qida təhlükəsizliyi nəticələri, tədbirlər və sistem istiqaməti üzrə rəhbərlik baxışlarını izləyin.',
        ru: 'Отслеживайте анализ со стороны руководства по результатам пищевой безопасности, действиям и направлению системы.'
      }
    });
  }

  protected reviewSections() {
    const review = this.selectedReview();
    if (!review) return [];
    return [
      { label: this.t('managementReview.sections.auditResults'), value: review.auditResults },
      { label: this.t('managementReview.sections.capaStatus'), value: review.capaStatus },
      { label: this.t('managementReview.sections.kpiPerformance'), value: review.kpiPerformance },
      { label: this.t('managementReview.sections.customerInterestedPartiesFeedback'), value: review.customerInterestedPartiesFeedback },
      { label: this.t('managementReview.sections.providerPerformance'), value: review.providerPerformance },
      { label: this.t('managementReview.sections.complianceObligations'), value: review.complianceObligations },
      { label: this.t('managementReview.sections.incidentEmergencyPerformance'), value: review.incidentEmergencyPerformance },
      { label: this.t('managementReview.sections.consultationCommunication'), value: review.consultationCommunication },
      { label: this.t('managementReview.sections.risksOpportunities'), value: review.risksOpportunities },
      { label: this.t('managementReview.sections.changesAffectingSystem'), value: review.changesAffectingSystem },
      { label: this.t('managementReview.sections.previousActions'), value: review.previousActions },
      { label: this.t('managementReview.sections.minutes'), value: review.minutes },
      { label: this.t('managementReview.sections.decisions'), value: review.decisions },
      { label: this.t('managementReview.sections.improvementActions'), value: review.improvementActions },
      { label: this.t('managementReview.sections.systemChangesNeeded'), value: review.systemChangesNeeded },
      { label: this.t('managementReview.sections.objectiveTargetChanges'), value: review.objectiveTargetChanges },
      { label: this.t('managementReview.sections.resourceNeeds'), value: review.resourceNeeds },
      { label: this.t('managementReview.sections.effectivenessConclusion'), value: review.effectivenessConclusion }
    ];
  }

  protected managementSignals() {
    const openIncidents = this.incidents().filter((item) => item.status !== 'CLOSED' && item.status !== 'ARCHIVED').length;
    const providerReviews = this.providers().filter((item) =>
      item.status === 'UNDER_REVIEW' ||
      item.evaluationOutcome === 'ESCALATED' ||
      item.evaluationOutcome === 'DISQUALIFIED' ||
      (!!item.supplierAuditRequired && !item.supplierAuditLinked)
    ).length;
    const overdueObligations = this.obligations().filter((item) =>
      item.status === 'UNDER_REVIEW' || this.isDatePast(item.nextReviewDate)
    ).length;
    const highHazards = this.hazards().filter((item) => item.status !== 'OBSOLETE' && item.severity === 'HIGH').length;
    const highAspects = this.aspects().filter((item) => item.status !== 'OBSOLETE' && item.significance === 'HIGH').length;
    const activeChanges = this.changes().filter((item) => !['CLOSED', 'REJECTED'].includes(item.status)).length;
    const feedbackResponses = this.customerFeedback()?.summary.customerSurveyResponses ?? 0;
    const feedbackAverage = this.customerFeedback()?.summary.customerSurveyAverage;
    const feedbackAttention = this.customerFeedback()?.summary.customerFeedbackAttention ?? 0;

    return [
      {
        label: this.t('managementReview.signals.customerFeedback.label'),
        value: feedbackResponses,
        copy: feedbackResponses
          ? this.t('managementReview.signals.customerFeedback.copyWithResponses', { count: feedbackResponses, average: feedbackAverage ?? 0, attention: feedbackAttention })
          : this.t('managementReview.signals.customerFeedback.copyEmpty'),
        reviewCopy: this.t('managementReview.signals.customerFeedback.reviewCopy'),
        link: '/context/interested-parties'
      },
      {
        label: this.t('managementReview.signals.auditSupplier.label'),
        value: openIncidents + providerReviews,
        copy: this.t('managementReview.signals.auditSupplier.copy', { incidents: openIncidents, providers: providerReviews }),
        reviewCopy: this.t('managementReview.signals.auditSupplier.reviewCopy'),
        link: '/external-providers'
      },
      {
        label: this.t('managementReview.signals.riskCompliance.label'),
        value: overdueObligations + highHazards + highAspects,
        copy: this.t('managementReview.signals.riskCompliance.copy', { obligations: overdueObligations, hazards: highHazards, aspects: highAspects }),
        reviewCopy: this.t('managementReview.signals.riskCompliance.reviewCopy'),
        link: '/compliance-obligations'
      },
      {
        label: this.t('managementReview.signals.changes.label'),
        value: activeChanges,
        copy: this.t('managementReview.signals.changes.copy', { count: activeChanges }),
        reviewCopy: this.t('managementReview.signals.changes.reviewCopy'),
        link: '/change-management'
      }
    ].filter((item) => this.hasCustomerFeedbackAddOn() || item.label !== this.t('managementReview.signals.customerFeedback.label'));
  }

  protected completedInputCount() {
    return this.countFilledValues(this.inputValues(this.reviewForm.getRawValue()));
  }

  protected completedOutputCount() {
    return this.countFilledValues(this.outputValues(this.reviewForm.getRawValue()));
  }

  protected inputSectionCount() {
    return this.inputValues(this.reviewForm.getRawValue()).length;
  }

  protected outputSectionCount() {
    return this.outputValues(this.reviewForm.getRawValue()).length;
  }

  protected plannedInputTarget() {
    return 7;
  }

  protected heldOutputTarget() {
    return 4;
  }

  protected reviewReadinessLabel() {
    const status = this.reviewForm.getRawValue().status;
    if (status === 'CLOSED') {
      return this.completedOutputCount() >= 6 ? this.t('managementReview.readinessLabels.readyToClose') : this.t('managementReview.readinessLabels.closureGaps');
    }
    if (status === 'HELD') {
      return this.completedOutputCount() >= this.heldOutputTarget() ? this.t('managementReview.readinessLabels.followUpForming') : this.t('managementReview.readinessLabels.outputsStillThin');
    }
    return this.completedInputCount() >= this.plannedInputTarget() ? this.t('managementReview.readinessLabels.agendaReady') : this.t('managementReview.readinessLabels.buildInputs');
  }

  protected reviewReadinessHint() {
    const status = this.reviewForm.getRawValue().status;
    if (status === 'CLOSED') {
      return this.t('managementReview.readinessHints.closed');
    }
    if (status === 'HELD') {
      return this.t('managementReview.readinessHints.held');
    }
    return this.t('managementReview.readinessHints.planned');
  }

  protected reviewOutputsReady(review: ReviewRecord) {
    return this.countFilledValues(this.outputValues(review)) >= this.heldOutputTarget();
  }

  protected reviewInputCoverage(review: ReviewRecord) {
    return this.countFilledValues(this.inputValues(review));
  }

  protected detailOutputCount() {
    const review = this.selectedReview();
    if (!review) {
      return 0;
    }
    return this.countFilledValues(this.outputValues(review));
  }

  protected detailInputCount() {
    const review = this.selectedReview();
    if (!review) {
      return 0;
    }
    return this.reviewInputCoverage(review);
  }

  protected managementPositionLabel() {
    const review = this.selectedReview();
    if (!review) {
      return this.t('managementReview.managementPosition.pending');
    }
    if (review.status === 'CLOSED') {
      return this.detailOutputCount() >= 6 ? this.t('managementReview.managementPosition.decisionRecorded') : this.t('managementReview.managementPosition.closureIncomplete');
    }
    if (review.status === 'HELD') {
      return this.detailOutputCount() >= this.heldOutputTarget() ? this.t('managementReview.managementPosition.followUpDefined') : this.t('managementReview.managementPosition.awaitingFollowUp');
    }
    return this.t('managementReview.managementPosition.plannedDiscussion');
  }

  protected managementPositionHint() {
    const review = this.selectedReview();
    if (!review) {
      return this.t('managementReview.managementPositionHints.pending');
    }
    if (review.status === 'CLOSED') {
      return this.t('managementReview.managementPositionHints.closed');
    }
    if (review.status === 'HELD') {
      return this.t('managementReview.managementPositionHints.held');
    }
    return this.t('managementReview.managementPositionHints.planned');
  }

  protected needsMeetingContentAttention() {
    const review = this.selectedReview();
    if (!review || review.status === 'CLOSED') {
      return false;
    }
    return this.countFilledValues(this.inputValues(review)) < this.plannedInputTarget()
      || this.countFilledValues(this.outputValues(review)) < this.heldOutputTarget();
  }

  protected saveReview() {
    if (!this.canWrite()) {
      this.error.set(this.t('managementReview.messages.noPermissionWrite'));
      return;
    }

    if (this.reviewForm.invalid) {
      this.error.set(this.t('managementReview.messages.completeRequired'));
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
      auditResults: raw.auditResults.trim() || undefined,
      capaStatus: raw.capaStatus.trim() || undefined,
      kpiPerformance: raw.kpiPerformance.trim() || undefined,
      customerInterestedPartiesFeedback: raw.customerInterestedPartiesFeedback.trim() || undefined,
      providerPerformance: raw.providerPerformance.trim() || undefined,
      complianceObligations: raw.complianceObligations.trim() || undefined,
      incidentEmergencyPerformance: raw.incidentEmergencyPerformance.trim() || undefined,
      consultationCommunication: raw.consultationCommunication.trim() || undefined,
      risksOpportunities: raw.risksOpportunities.trim() || undefined,
      changesAffectingSystem: raw.changesAffectingSystem.trim() || undefined,
      previousActions: raw.previousActions.trim() || undefined,
      minutes: raw.minutes.trim() || undefined,
      decisions: raw.decisions.trim() || undefined,
      improvementActions: raw.improvementActions.trim() || undefined,
      systemChangesNeeded: raw.systemChangesNeeded.trim() || undefined,
      objectiveTargetChanges: raw.objectiveTargetChanges.trim() || undefined,
      resourceNeeds: raw.resourceNeeds.trim() || undefined,
      effectivenessConclusion: raw.effectivenessConclusion.trim() || undefined,
      summary: raw.summary.trim() || undefined,
      inputs: []
    };

    const request = this.selectedId()
      ? this.api.patch<ReviewRecord>(`management-review/${this.selectedId()}`, payload)
      : this.api.post<ReviewRecord>('management-review', payload);

    request.subscribe({
      next: (review) => {
        this.saving.set(false);
        this.router.navigate(['/management-review', review.id], { state: { notice: this.t('managementReview.messages.saved') } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, this.t('managementReview.messages.saveFailed')));
      }
    });
  }

  protected draftInputsWithAi() {
    if (!this.hasAiAddOn()) {
      this.error.set(this.t('managementReview.messages.aiAddonOff'));
      return;
    }

    if (!this.canWrite()) {
      this.error.set(this.t('managementReview.messages.noPermissionWrite'));
      return;
    }

    if (this.hasExistingInputContent() && !window.confirm(this.t('managementReview.messages.aiReplaceConfirm'))) {
      return;
    }

    this.generatingAiInputs.set(true);
    this.message.set('');
    this.error.set('');

    this.api.post<ManagementReviewAiDraft>('ai/management-review-input-draft', {}).subscribe({
      next: (draft) => {
        this.generatingAiInputs.set(false);
        this.reviewForm.patchValue({
          auditResults: draft.sections.auditResults,
          capaStatus: draft.sections.capaStatus,
          kpiPerformance: draft.sections.kpiPerformance,
          customerInterestedPartiesFeedback: draft.sections.customerInterestedPartiesFeedback,
          providerPerformance: draft.sections.providerPerformance,
          complianceObligations: draft.sections.complianceObligations,
          incidentEmergencyPerformance: draft.sections.incidentEmergencyPerformance,
          consultationCommunication: draft.sections.consultationCommunication,
          risksOpportunities: draft.sections.risksOpportunities,
          changesAffectingSystem: draft.sections.changesAffectingSystem,
          previousActions: draft.sections.previousActions
        });
        this.message.set(
          draft.warning
            ? draft.warning
            : this.t('managementReview.messages.aiDrafted', { provider: draft.provider, model: draft.model })
        );
      },
      error: (error: HttpErrorResponse) => {
        this.generatingAiInputs.set(false);
        this.error.set(this.readError(error, this.t('managementReview.messages.aiDraftFailed')));
      }
    });
  }

  protected prepareAction(sectionLabel: string, content?: string | null) {
    if (!this.canCreateActions()) {
      this.error.set(this.t('managementReview.messages.noPermissionActions'));
      return;
    }

    this.draftActionTitle.set(this.t('managementReview.messages.actionDraftTitle', { section: sectionLabel }));
    this.draftActionDescription.set(content || '');
    this.message.set(this.t('managementReview.messages.followUpOpened', { section: sectionLabel.toLowerCase() }));
  }

  protected canWrite() {
    return this.authStore.hasPermission('management-review.write');
  }

  protected hasAiAddOn() {
    return this.authStore.hasAddOn('aiAssistant');
  }

  protected hasCustomerFeedbackAddOn() {
    return this.authStore.hasAddOn('customerFeedback');
  }

  protected canCreateActions() {
    return this.authStore.hasPermission('action-items.write');
  }

  protected canCreateActionFromSection(value?: string | null) {
    return this.canCreateActions() && !!(value || '').trim();
  }

  protected createActionTooltip(value?: string | null) {
    if (!this.canCreateActions()) {
      return this.t('managementReview.messages.noPermissionActions');
    }
    if (!(value || '').trim()) {
      return this.t('managementReview.messages.addContentTooltip');
    }
    return this.t('managementReview.messages.prepareActionTooltip');
  }

  protected canArchiveReview() {
    return this.authStore.hasPermission('admin.delete') && !!this.selectedId();
  }

  private isDatePast(value?: string | null) {
    if (!value) {
      return false;
    }
    return new Date(value).getTime() < Date.now();
  }

  protected archiveReview() {
    if (!this.selectedId() || !this.canArchiveReview()) {
      return;
    }

    if (!window.confirm(this.t('managementReview.messages.archiveConfirm'))) {
      return;
    }

    this.saving.set(true);
    this.message.set('');
    this.error.set('');
    this.api.patch(`management-review/${this.selectedId()}/archive`, {}).subscribe({
      next: () => {
        this.saving.set(false);
        void this.router.navigate(['/management-review'], { state: { notice: this.t('managementReview.messages.archived') } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, this.t('managementReview.messages.archiveFailed')));
      }
    });
  }

  protected generateReport() {
    if (!this.selectedId()) {
      return;
    }

    this.generatingReport.set(true);
    this.message.set('');
    this.error.set('');

    this.api.getBlobResponse(`management-review/${this.selectedId()}/report`).subscribe({
      next: (response) => {
        this.generatingReport.set(false);
        this.downloadResponse(response, 'management-review-protocol.pdf');
        this.message.set(this.t('managementReview.messages.pdfStarted'));
      },
      error: (error: HttpErrorResponse) => {
        this.generatingReport.set(false);
        this.error.set(this.readError(error, this.t('managementReview.messages.pdfFailed')));
      }
    });
  }

  protected generatePresentation() {
    if (!this.selectedId()) {
      return;
    }

    this.generatingPresentation.set(true);
    this.message.set('');
    this.error.set('');

    this.api.getBlobResponse(`management-review/${this.selectedId()}/presentation`).subscribe({
      next: (response) => {
        this.generatingPresentation.set(false);
        this.downloadResponse(response, 'management-review-dashboard.pptx');
        this.message.set(this.t('managementReview.messages.pptStarted'));
      },
      error: (error: HttpErrorResponse) => {
        this.generatingPresentation.set(false);
        this.error.set(this.readError(error, this.t('managementReview.messages.pptFailed')));
      }
    });
  }

  private handleRoute(params: ParamMap) {
    const id = params.get('id');
    this.selectedId.set(id);
    this.message.set((history.state?.notice as string) || '');
    this.error.set('');
    this.draftActionTitle.set(null);
    this.draftActionDescription.set(null);

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
    this.reviewForm.reset({
      title: '',
      reviewDate: '',
      chairpersonId: '',
      agenda: this.t('managementReview.messages.defaultAgenda'),
      auditResults: '',
      capaStatus: '',
      kpiPerformance: '',
      customerInterestedPartiesFeedback: '',
      providerPerformance: '',
      complianceObligations: '',
      incidentEmergencyPerformance: '',
      consultationCommunication: '',
      risksOpportunities: '',
      changesAffectingSystem: '',
      previousActions: '',
      minutes: '',
      decisions: '',
      improvementActions: '',
      systemChangesNeeded: '',
      objectiveTargetChanges: '',
      resourceNeeds: '',
      effectivenessConclusion: '',
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
          auditResults: review.auditResults ?? '',
          capaStatus: review.capaStatus ?? '',
          kpiPerformance: review.kpiPerformance ?? '',
          customerInterestedPartiesFeedback: review.customerInterestedPartiesFeedback ?? '',
          providerPerformance: review.providerPerformance ?? '',
          complianceObligations: review.complianceObligations ?? '',
          incidentEmergencyPerformance: review.incidentEmergencyPerformance ?? '',
          consultationCommunication: review.consultationCommunication ?? '',
          risksOpportunities: review.risksOpportunities ?? '',
          changesAffectingSystem: review.changesAffectingSystem ?? '',
          previousActions: review.previousActions ?? '',
          minutes: review.minutes ?? '',
          decisions: review.decisions ?? '',
          improvementActions: review.improvementActions ?? '',
          systemChangesNeeded: review.systemChangesNeeded ?? '',
          objectiveTargetChanges: review.objectiveTargetChanges ?? '',
          resourceNeeds: review.resourceNeeds ?? '',
          effectivenessConclusion: review.effectivenessConclusion ?? '',
          summary: review.summary ?? '',
          status: review.status
        });
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, this.t('managementReview.messages.loadDetailsFailed')));
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
        this.error.set(this.readError(error, this.t('managementReview.messages.loadListFailed')));
      }
    });
  }

  protected statusLabel(status: ReviewStatus | null) {
    if (!status) {
      return this.t('common.notSet');
    }
    return this.t(`managementReview.status.${status}`);
  }

  private loadUsers() {
    this.api.get<UserOption[]>('users').subscribe((users) => this.users.set(users));
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }

  private downloadResponse(response: HttpResponse<Blob>, fallbackName: string) {
    const blob = response.body;
    if (!blob) {
      return;
    }

    const disposition = response.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="(.+?)"/i);
    const fileName = match?.[1] || fallbackName;
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }

  private inputValues(review: Partial<ReviewRecord>) {
    return [
      review.auditResults,
      review.capaStatus,
      review.kpiPerformance,
      review.customerInterestedPartiesFeedback,
      review.providerPerformance,
      review.complianceObligations,
      review.incidentEmergencyPerformance,
      review.consultationCommunication,
      review.risksOpportunities,
      review.changesAffectingSystem,
      review.previousActions
    ];
  }

  private outputValues(review: Partial<ReviewRecord>) {
    return [
      review.minutes,
      review.decisions,
      review.improvementActions,
      review.systemChangesNeeded,
      review.objectiveTargetChanges,
      review.resourceNeeds,
      review.effectivenessConclusion,
      review.summary
    ];
  }

  private countFilledValues(values: Array<string | null | undefined>) {
    return values.filter((value) => !!String(value ?? '').trim()).length;
  }

  private hasExistingInputContent() {
    return this.countFilledValues(this.inputValues(this.reviewForm.getRawValue())) > 0;
  }

  private scopeText(content: Record<TenantScope, { en: string; az: string; ru: string }>) {
    const scope = this.authStore.scope();
    const language = this.i18n.language();
    return content[scope][language];
  }

}
