import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
import { ContentLibraryResponse } from '../core/content-library.models';
import { ContentLibraryService } from '../core/content-library.service';
import { ContextApiService } from '../core/context-api.service';
import { I18nService } from '../core/i18n.service';
import { TenantScope } from '../core/package-entitlements';
import { AttachmentPanelComponent } from '../shared/attachment-panel.component';
import { PageHeaderComponent } from '../shared/page-header.component';
import { RecordWorkItemsComponent } from '../shared/record-work-items.component';

type PageMode = 'list' | 'create' | 'detail' | 'edit';
type RiskStatus = 'OPEN' | 'IN_TREATMENT' | 'MITIGATED' | 'ACCEPTED' | 'CLOSED';
type RiskAssessmentType = 'RISK' | 'OPPORTUNITY';
type RiskLifecycleStatus = 'DRAFT' | 'ASSESSED' | 'MITIGATION_PLANNED' | 'MONITORING' | 'CLOSED';
type RiskSortOption = 'attention' | 'score' | 'targetDate' | 'updated';

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
  assessmentType?: RiskAssessmentType;
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

type RiskContextPrefill = {
  issueId: string;
  issueType: 'INTERNAL' | 'EXTERNAL';
  issueTitle: string;
  issueDescription?: string | null;
  impactOnBusiness?: string | null;
  category?: string | null;
  processNames?: string[];
};

type SourceContextNavigation = {
  route: string[];
  label: string;
};

@Component({
  selector: 'iso-risks-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, RecordWorkItemsComponent, AttachmentPanelComponent, TranslatePipe],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="pageLabel()"
        [title]="pageTitle()"
        [description]="pageDescription()"
        [breadcrumbs]="breadcrumbs()"
      >
        <a *ngIf="showStartHereBackLink()" [routerLink]="['/implementation']" class="button-link secondary">{{ 'risks.actions.backToStartHere' | translate }}</a>
        <a *ngIf="mode() === 'list' && canWrite()" routerLink="/risks/new" class="button-link">+ {{ 'risks.actions.new' | translate }}</a>
        <a *ngIf="mode() === 'detail' && selectedRisk() && canWrite()" [routerLink]="['/risks', selectedRisk()?.id, 'edit']" [state]="routeStateWithSource()" class="button-link">{{ t('risks.actions.edit', { entity: assessmentEntityLabel(selectedRisk()?.assessmentType || 'RISK').toLowerCase() }) }}</a>
        <button *ngIf="mode() === 'detail' && canDeleteRisk()" type="button" class="button-link danger" (click)="deleteRisk()">{{ t('risks.actions.delete', { entity: assessmentEntityLabel(selectedRisk()?.assessmentType || 'RISK').toLowerCase() }) }}</button>
        <a *ngIf="sourceContextNavigation()" [routerLink]="sourceContextNavigation()!.route" class="button-link tertiary">{{ t('risks.actions.backToSource', { label: sourceContextNavigation()!.label }) }}</a>
        <a *ngIf="mode() !== 'list'" routerLink="/risks" class="button-link secondary">{{ 'risks.actions.backToRegister' | translate }}</a>
      </iso-page-header>

      <section *ngIf="mode() === 'list'" class="page-stack">
        <div class="card list-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">{{ 'risks.list.eyebrow' | translate }}</span>
              <h3>{{ listTitle() }}</h3>
              <p class="subtle">{{ listCopy() }}</p>
            </div>
          </div>

          <div class="toolbar top-space">
            <div class="toolbar-meta">
              <div>
                <p class="toolbar-title">{{ filtersTitle() }}</p>
                <p class="toolbar-copy">{{ filtersCopy() }}</p>
              </div>
              <div class="toolbar-stats">
                <article class="toolbar-stat">
                  <span>{{ 'risks.list.stats.total' | translate }}</span>
                  <strong>{{ risks().length }}</strong>
                </article>
                <article class="toolbar-stat">
                  <span>{{ 'risks.list.stats.mitigationPlanned' | translate }}</span>
                  <strong>{{ countByLifecycle('MITIGATION_PLANNED') }}</strong>
                </article>
                <article class="toolbar-stat">
                  <span>{{ 'risks.list.stats.highPriority' | translate }}</span>
                  <strong>{{ highRiskCount() }}</strong>
                </article>
              </div>
            </div>

            <div class="filter-row standard-filter-grid">
              <label class="field compact-field search-field">
                <span>{{ 'risks.list.searchLabel' | translate }}</span>
                <input [value]="search()" (input)="search.set(readInputValue($event))" [placeholder]="t('risks.list.searchPlaceholder')">
              </label>
              <label class="field compact-field">
                <span>{{ 'risks.list.typeLabel' | translate }}</span>
                <select [value]="assessmentTypeFilter()" (change)="setAssessmentTypeFilter(readSelectValue($event))">
                  <option value="">{{ 'risks.list.allRecords' | translate }}</option>
                  <option value="RISK">{{ 'risks.entity.riskPlural' | translate }}</option>
                  <option value="OPPORTUNITY">{{ 'risks.entity.opportunityPlural' | translate }}</option>
                </select>
              </label>
              <label class="field compact-field">
                <span>{{ 'risks.list.statusLabel' | translate }}</span>
                <select [value]="statusFilter()" (change)="setStatusFilter(readSelectValue($event))">
                  <option value="">{{ 'risks.list.allStatuses' | translate }}</option>
                  <option value="DRAFT">{{ 'risks.lifecycle.draft' | translate }}</option>
                  <option value="ASSESSED">{{ 'risks.lifecycle.assessed' | translate }}</option>
                  <option value="MITIGATION_PLANNED">{{ 'risks.lifecycle.mitigation_planned' | translate }}</option>
                  <option value="MONITORING">{{ 'risks.lifecycle.monitoring' | translate }}</option>
                  <option value="CLOSED">{{ 'risks.lifecycle.closed' | translate }}</option>
                </select>
              </label>
              <label class="field compact-field">
                <span>{{ 'risks.list.sortLabel' | translate }}</span>
                <select [value]="sortBy()" (change)="setSortBy(readSelectValue($event))">
                  <option value="attention">{{ 'risks.list.sort.attention' | translate }}</option>
                  <option value="score">{{ 'risks.list.sort.score' | translate }}</option>
                  <option value="targetDate">{{ 'risks.list.sort.targetDate' | translate }}</option>
                  <option value="updated">{{ 'risks.list.sort.updated' | translate }}</option>
                </select>
              </label>
            </div>
          </div>

          <div class="empty-state" *ngIf="loading()">
            <strong>{{ 'risks.list.loadingTitle' | translate }}</strong>
            <span>{{ 'risks.list.loadingCopy' | translate }}</span>
          </div>

          <div class="empty-state top-space" *ngIf="!loading() && !filteredRisks().length">
            <strong>{{ 'risks.list.emptyTitle' | translate }}</strong>
            <span>{{ 'risks.list.emptyCopy' | translate }}</span>
          </div>

          <div class="data-table-wrap" *ngIf="!loading() && filteredRisks().length">
            <table class="data-table">
              <thead>
                <tr>
                  <th>{{ 'risks.list.table.record' | translate }}</th>
                  <th>{{ 'risks.list.table.type' | translate }}</th>
                  <th>{{ 'risks.list.table.assessment' | translate }}</th>
                  <th>{{ 'risks.list.table.status' | translate }}</th>
                  <th>{{ 'risks.list.table.attention' | translate }}</th>
                  <th>{{ 'risks.list.table.target' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of filteredRisks()" [routerLink]="['/risks', item.id]">
                  <td>
                    <div class="table-title">
                      <strong>{{ item.title }}</strong>
                      <small>{{ item.category || t('risks.list.generalCategory') }}</small>
                    </div>
                  </td>
                  <td><span class="status-badge" [ngClass]="item.assessmentType === 'OPPORTUNITY' ? 'success' : 'attention'">{{ item.assessmentType === 'OPPORTUNITY' ? t('risks.entity.opportunity') : t('risks.entity.risk') }}</span></td>
                  <td>
                    <div class="table-title">
                      <strong>{{ assessmentSummary(item) }}</strong>
                      <small>{{ scoreBreakdown(item) }}</small>
                      <small class="level-caption" [ngClass]="levelBadgeClass(item.score, item.assessmentType || 'RISK')">{{ riskLevelLabel(item.score, item.assessmentType || 'RISK') }}</small>
                      <small class="attention-copy" *ngIf="attentionSummary(item) as attention">{{ attention }}</small>
                    </div>
                  </td>
                  <td><span class="status-badge" [ngClass]="statusClass(item.status)">{{ lifecycleStatusLabel(item.status) }}</span></td>
                  <td><span class="status-badge" [ngClass]="attentionClass(item)">{{ attentionLabel(item) }}</span></td>
                  <td>{{ item.targetDate ? (item.targetDate | date:'yyyy-MM-dd') : t('common.na') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section *ngIf="mode() === 'create' || mode() === 'edit'" class="page-stack">
        <form class="card form-card page-stack" [formGroup]="form" (ngSubmit)="save()">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">{{ 'risks.form.eyebrow' | translate }}</span>
              <h3>{{ mode() === 'create' ? t('risks.form.createTitle', { entity: assessmentEntityLabel(form.getRawValue().assessmentType).toLowerCase() }) : t('risks.form.editTitle', { entity: assessmentEntityLabel(form.getRawValue().assessmentType).toLowerCase() }) }}</h3>
              <p class="subtle">{{ assessmentIntroCopy(form.getRawValue().assessmentType) }}</p>
            </div>
          </div>

          <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <section class="feedback next-steps-banner success" *ngIf="mode() === 'create' && sourceContextNavigation() && sourceContextSummary() as contextSummary">
            <strong>{{ 'risks.form.fromContextTitle' | translate }}</strong>
            <span>{{ contextSummary }}</span>
            <div class="button-row top-space">
              <a [routerLink]="sourceContextNavigation()!.route" class="button-link secondary">{{ 'risks.form.reviewSourceIssue' | translate }}</a>
            </div>
          </section>

          <section class="feedback next-steps-banner success" *ngIf="mode() === 'edit' && sourceContextNavigation() && sourceContextSummary() as contextSummary">
            <strong>{{ 'risks.form.stillLinkedTitle' | translate }}</strong>
            <span>{{ contextSummary }}</span>
            <div class="button-row top-space">
              <a [routerLink]="sourceContextNavigation()!.route" class="button-link secondary">{{ 'risks.form.reviewSourceIssue' | translate }}</a>
            </div>
          </section>

          <section class="detail-section">
            <h4>1. {{ t('risks.form.contextTitle', { entity: assessmentEntityLabel(form.getRawValue().assessmentType) }) }}</h4>
            <div class="segmented-control top-space" role="group" aria-label="Risk assessment type">
              <button type="button" [class.active]="form.getRawValue().assessmentType === 'RISK'" (click)="setAssessmentType('RISK')">{{ 'risks.entity.risk' | translate }}</button>
              <button type="button" [class.active]="form.getRawValue().assessmentType === 'OPPORTUNITY'" (click)="setAssessmentType('OPPORTUNITY')">{{ 'risks.entity.opportunity' | translate }}</button>
            </div>
            <div class="form-grid-2 top-space">
              <label class="field">
                <span>{{ 'risks.form.title' | translate }}</span>
                <input formControlName="title" [placeholder]="t('risks.form.titlePlaceholder')">
              </label>
              <label class="field">
                <span>{{ 'risks.form.starterCategory' | translate }}</span>
                <select [value]="selectedCategoryOption()" (change)="onCategoryOptionChange(readSelectValue($event))">
                  <option value="">{{ 'risks.form.chooseCategory' | translate }}</option>
                  <option *ngFor="let category of activeCategories()" [value]="category">{{ category }}</option>
                  <option value="__custom__">{{ 'risks.form.customCategory' | translate }}</option>
                </select>
                <small class="field-hint">{{ t('risks.form.starterCategoryHint', { entity: assessmentEntityLabel(form.getRawValue().assessmentType).toLowerCase() }) }}</small>
              </label>
            </div>
            <label class="field top-space" *ngIf="customCategoryMode()">
              <span>{{ 'risks.form.customCategory' | translate }}</span>
              <input formControlName="category" [placeholder]="t('risks.form.customCategoryPlaceholder')">
            </label>

            <label class="field top-space">
              <span>{{ 'risks.form.description' | translate }}</span>
              <textarea rows="4" formControlName="description" [placeholder]="t('risks.form.descriptionPlaceholder')"></textarea>
            </label>

            <div class="form-grid-2 top-space">
              <label class="field">
                <span>{{ 'risks.form.issueContext' | translate }}</span>
                <select formControlName="issueContextType">
                  <option value="">{{ 'risks.form.notLinked' | translate }}</option>
                  <option value="INTERNAL">{{ 'risks.form.internalIssue' | translate }}</option>
                  <option value="EXTERNAL">{{ 'risks.form.externalIssue' | translate }}</option>
                </select>
              </label>
              <label class="field">
                <span>{{ 'risks.form.issueReference' | translate }}</span>
                <input formControlName="issueContext" [placeholder]="t('risks.form.issueReferencePlaceholder')">
              </label>
            </div>
          </section>

          <section class="detail-section">
            <h4>2. {{ initialAssessmentHeading(form.getRawValue().assessmentType) }}</h4>
            <div class="form-grid-3 top-space">
              <label class="field">
                <span>{{ likelihoodLabel(form.getRawValue().assessmentType) }}</span>
                <input type="number" min="1" [attr.max]="likelihoodScaleMax()" formControlName="likelihood">
                <small class="field-hint">{{ likelihoodHint(form.getRawValue().assessmentType) }}</small>
              </label>
              <label class="field">
                <span>{{ impactLabel(form.getRawValue().assessmentType) }}</span>
                <input type="number" min="1" [attr.max]="severityScaleMax()" formControlName="severity">
                <small class="field-hint">{{ impactHint(form.getRawValue().assessmentType) }}</small>
              </label>
            </div>

            <div class="summary-strip top-space">
              <article class="summary-item">
                <span>{{ initialScoreLabel(form.getRawValue().assessmentType) }}</span>
                <strong>{{ currentScore() }}</strong>
              </article>
              <article class="summary-item">
                <span>{{ matrixRatingLabel(form.getRawValue().assessmentType) }}</span>
                <strong class="level-indicator" [ngClass]="levelBadgeClass(currentScore(), form.getRawValue().assessmentType)">{{ riskLevelLabel(currentScore(), form.getRawValue().assessmentType) }}</strong>
              </article>
            </div>

            <div class="detail-section top-space" *ngIf="sourceContextSummary() as sourceContext">
              <h4>Linked context</h4>
              <p>{{ sourceContext }}</p>
            </div>
            <div class="detail-section top-space" *ngIf="currentProcessContext() as processContext">
              <h4>Process</h4>
              <p>{{ processContext }}</p>
            </div>
          </section>

          <section class="detail-section">
            <h4>3. {{ treatmentHeading(form.getRawValue().assessmentType) }}</h4>
            <label class="field top-space">
              <span>{{ existingControlsLabel(form.getRawValue().assessmentType) }}</span>
              <textarea rows="3" formControlName="existingControls" [placeholder]="existingControlsPlaceholder(form.getRawValue().assessmentType)"></textarea>
            </label>

            <label class="field top-space">
              <span>{{ plannedActionsLabel(form.getRawValue().assessmentType) }}</span>
              <textarea rows="3" formControlName="plannedMitigationActions" [placeholder]="plannedActionsPlaceholder(form.getRawValue().assessmentType)"></textarea>
            </label>

            <div class="form-grid-2 top-space">
              <label class="field">
                <span>{{ 'risks.form.owner' | translate }}</span>
                <select formControlName="ownerId">
                  <option value="">{{ 'risks.form.unassigned' | translate }}</option>
                  <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
                </select>
              </label>
              <label class="field">
                <span>{{ 'risks.form.dueDate' | translate }}</span>
                <input type="date" formControlName="targetDate">
              </label>
            </div>

            <label class="field top-space">
              <span>{{ 'risks.list.statusLabel' | translate }}</span>
              <select [value]="lifecycleStatus()" (change)="setLifecycleStatus(readSelectValue($event))">
                <option value="DRAFT">{{ 'risks.lifecycle.draft' | translate }}</option>
                <option value="ASSESSED">{{ 'risks.lifecycle.assessed' | translate }}</option>
                <option value="MITIGATION_PLANNED">{{ 'risks.lifecycle.mitigation_planned' | translate }}</option>
                <option value="MONITORING">{{ 'risks.lifecycle.monitoring' | translate }}</option>
                <option value="CLOSED">{{ 'risks.lifecycle.closed' | translate }}</option>
              </select>
            </label>

            <section class="compliance-note top-space">
              <strong>{{ riskResponseHeading(form.getRawValue().assessmentType, lifecycleStatus()) }}</strong>
              <span>{{ riskResponseGuidance(form.getRawValue().assessmentType, lifecycleStatus()) }}</span>
            </section>
          </section>

          <section class="detail-section">
            <h4>4. {{ residualAssessmentHeading(form.getRawValue().assessmentType) }}</h4>
            <div class="form-grid-3 top-space">
              <label class="field">
                <span>{{ t('risks.form.residualLabel', { label: likelihoodLabel(form.getRawValue().assessmentType).toLowerCase() }) }}</span>
                <input type="number" min="1" [attr.max]="likelihoodScaleMax()" formControlName="residualLikelihood">
                <small class="field-hint">{{ likelihoodHint(form.getRawValue().assessmentType) }}</small>
              </label>
              <label class="field">
                <span>{{ t('risks.form.residualLabel', { label: impactLabel(form.getRawValue().assessmentType).toLowerCase() }) }}</span>
                <input type="number" min="1" [attr.max]="severityScaleMax()" formControlName="residualImpact">
                <small class="field-hint">{{ impactHint(form.getRawValue().assessmentType) }}</small>
              </label>
            </div>

            <div class="summary-strip top-space">
              <article class="summary-item">
                <span>{{ residualScoreLabel(form.getRawValue().assessmentType) }}</span>
                <strong>{{ currentResidualScore() ?? t('risks.levels.notAssessed') }}</strong>
              </article>
              <article class="summary-item">
                <span>{{ residualRatingLabel(form.getRawValue().assessmentType) }}</span>
                <strong class="level-indicator" [ngClass]="levelBadgeClass(currentResidualScore(), form.getRawValue().assessmentType)">{{ riskLevelLabel(currentResidualScore(), form.getRawValue().assessmentType) }}</strong>
              </article>
            </div>
          </section>

          <div class="button-row">
            <button type="submit" [disabled]="form.invalid || saving() || !canWrite()">{{ saving() ? t('risks.form.saving') : t('risks.form.save', { entity: assessmentEntityLabel(form.getRawValue().assessmentType).toLowerCase() }) }}</button>
            <a [routerLink]="cancelRoute()" [state]="cancelState()" class="button-link secondary">{{ 'common.cancel' | translate }}</a>
          </div>
        </form>

        <iso-attachment-panel *ngIf="selectedId()" [sourceType]="'risk'" [sourceId]="selectedId()" />
      </section>

      <section *ngIf="mode() === 'detail' && selectedRisk()" class="page-columns">
        <div class="page-stack">
          <section class="card detail-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">{{ 'risks.detail.eyebrow' | translate }}</span>
                <h3>{{ selectedRisk()?.title }}</h3>
                <p class="subtle">{{ assessmentEntityLabel(selectedRisk()?.assessmentType || 'RISK') }} | {{ selectedRisk()?.category || t('risks.list.generalCategory') }}</p>
              </div>
              <span class="status-badge" [ngClass]="statusClass(selectedRisk()?.status || 'OPEN')">{{ lifecycleStatusLabel(selectedRisk()?.status || 'OPEN') }}</span>
            </div>

            <section class="feedback next-steps-banner success" *ngIf="message() && !error()">
              <strong>{{ message() }}</strong>
              <span>{{ nextStepsCopy(selectedRisk()?.assessmentType || 'RISK') }}</span>
              <div class="button-row top-space">
                <button type="button" (click)="scrollToActions()">{{ selectedRisk()?.assessmentType === 'OPPORTUNITY' ? t('risks.detail.createAction') : t('risks.detail.createMitigationAction') }}</button>
                <button type="button" class="secondary" (click)="scrollToEvidence()">{{ 'risks.detail.reviewEvidence' | translate }}</button>
                <a *ngIf="sourceContextNavigation()" [routerLink]="sourceContextNavigation()!.route" class="button-link secondary">{{ 'risks.form.reviewSourceIssue' | translate }}</a>
                <a routerLink="/risks" class="button-link tertiary">{{ 'risks.detail.reviewRisks' | translate }}</a>
              </div>
            </section>

            <div class="summary-strip top-space">
              <article class="summary-item">
                <span>{{ 'risks.detail.responsePosition' | translate }}</span>
                <strong>{{ riskResponseShortLabel(selectedRisk()?.assessmentType || 'RISK', selectedRisk()?.status || 'OPEN') }}</strong>
              </article>
              <article class="summary-item">
                <span>{{ likelihoodLabel(selectedRisk()?.assessmentType || 'RISK') }}</span>
                <strong>{{ selectedRisk()?.likelihood }}</strong>
              </article>
              <article class="summary-item">
                <span>{{ impactLabel(selectedRisk()?.assessmentType || 'RISK') }}</span>
                <strong>{{ selectedRisk()?.severity }}</strong>
              </article>
              <article class="summary-item">
                <span>{{ initialScoreLabel(selectedRisk()?.assessmentType || 'RISK') }}</span>
                <strong>{{ selectedRisk()?.score }}</strong>
              </article>
              <article class="summary-item">
                <span>{{ matrixRatingLabel(selectedRisk()?.assessmentType || 'RISK') }}</span>
                <strong class="level-indicator" [ngClass]="levelBadgeClass(selectedRisk()?.score ?? null, selectedRisk()?.assessmentType || 'RISK')">{{ riskLevelLabel(selectedRisk()?.score ?? null, selectedRisk()?.assessmentType || 'RISK') }}</strong>
              </article>
            </div>

            <section class="content-guidance top-space">
              <div class="section-head compact-head">
                <div>
                  <h4>{{ 'risks.detail.managementAttention' | translate }}</h4>
                  <p class="subtle">{{ attentionHeadline(selectedRisk()) }}</p>
                </div>
              </div>
              <p class="top-space">{{ attentionNarrative(selectedRisk()) }}</p>
            </section>

            <div class="section-grid-2 top-space">
              <section class="detail-section">
                <h4>{{ 'risks.form.description' | translate }}</h4>
                <p>{{ selectedRisk()?.description || t('risks.detail.noDescription') }}</p>
              </section>
              <section class="detail-section">
                <h4>{{ 'risks.form.issueContext' | translate }}</h4>
                <p>{{ selectedRisk()?.issueContextType ? (selectedRisk()?.issueContextType + ' | ') : '' }}{{ selectedRisk()?.issueContext || t('risks.detail.noIssueContext') }}</p>
              </section>
            </div>

            <section class="detail-section top-space" *ngIf="linkedProcessSummary(selectedRisk()) as processSummary">
              <h4>{{ 'risks.detail.processContext' | translate }}</h4>
              <p>{{ processSummary }}</p>
            </section>

            <section class="detail-section top-space">
              <h4>3. {{ treatmentHeading(selectedRisk()?.assessmentType || 'RISK') }}</h4>
              <div class="section-grid-2 top-space">
                <section class="detail-section">
                  <h4>{{ existingControlsLabel(selectedRisk()?.assessmentType || 'RISK') }}</h4>
                  <p>{{ selectedRisk()?.existingControls || selectedRisk()?.treatmentSummary || t('risks.detail.noExistingControls') }}</p>
                </section>
                <section class="detail-section">
                  <h4>{{ plannedActionsLabel(selectedRisk()?.assessmentType || 'RISK') }}</h4>
                  <p>{{ selectedRisk()?.plannedMitigationActions || selectedRisk()?.treatmentPlan || t('risks.detail.noPlannedActions') }}</p>
                </section>
              </div>

              <div id="risk-actions-section" class="detail-section top-space">
                <div class="section-head compact-head">
                  <div>
                    <span class="section-eyebrow">{{ 'risks.detail.linkedActionsEyebrow' | translate }}</span>
                    <h4>{{ 'risks.detail.createAction' | translate }}</h4>
                    <p class="subtle">{{ linkedActionCopy(selectedRisk()?.assessmentType || 'RISK') }}</p>
                  </div>
                </div>
                <iso-record-work-items [sourceType]="'risk'" [sourceId]="selectedId()" [returnNavigation]="sourceContextNavigation()" />
              </div>
            </section>

            <section class="detail-section top-space">
              <h4>4. {{ residualAssessmentHeading(selectedRisk()?.assessmentType || 'RISK') }}</h4>
              <div class="summary-strip top-space" *ngIf="selectedRisk()?.residualLikelihood && selectedRisk()?.residualImpact; else residualEmpty">
                <article class="summary-item">
                  <span>{{ t('risks.form.residualLabel', { label: likelihoodLabel(selectedRisk()?.assessmentType || 'RISK').toLowerCase() }) }}</span>
                  <strong>{{ selectedRisk()?.residualLikelihood }}</strong>
                </article>
                <article class="summary-item">
                  <span>{{ t('risks.form.residualLabel', { label: impactLabel(selectedRisk()?.assessmentType || 'RISK').toLowerCase() }) }}</span>
                  <strong>{{ selectedRisk()?.residualImpact }}</strong>
                </article>
                <article class="summary-item">
                  <span>{{ residualScoreLabel(selectedRisk()?.assessmentType || 'RISK') }}</span>
                  <strong>{{ selectedRisk()?.residualScore }}</strong>
                </article>
                <article class="summary-item">
                  <span>{{ residualRatingLabel(selectedRisk()?.assessmentType || 'RISK') }}</span>
                  <strong class="level-indicator" [ngClass]="levelBadgeClass(selectedRisk()?.residualScore ?? null, selectedRisk()?.assessmentType || 'RISK')">{{ riskLevelLabel(selectedRisk()?.residualScore ?? null, selectedRisk()?.assessmentType || 'RISK') }}</strong>
                </article>
              </div>
              <section class="compliance-note top-space" *ngIf="residualMovementSummary(selectedRisk()) as residualMovement">
                <strong>{{ residualMovement.heading }}</strong>
                <span>{{ residualMovement.copy }}</span>
              </section>
              <ng-template #residualEmpty>
                <p>{{ residualEmptyCopy(selectedRisk()?.assessmentType || 'RISK') }}</p>
              </ng-template>
            </section>

            <section class="feedback next-steps-banner warning top-space" *ngIf="followUpSummary(selectedRisk()) as followUp">
              <strong>{{ followUp.heading }}</strong>
              <span>{{ followUp.copy }}</span>
            </section>

            <dl class="key-value top-space">
              <dt>{{ 'risks.form.dueDate' | translate }}</dt>
              <dd>{{ selectedRisk()?.targetDate ? (selectedRisk()?.targetDate | date:'yyyy-MM-dd') : t('common.notSet') }}</dd>
              <dt>{{ 'documents.detail.lastUpdated' | translate }}</dt>
              <dd>{{ selectedRisk()?.updatedAt | date:'yyyy-MM-dd HH:mm' }}</dd>
            </dl>
          </section>

        </div>

        <div class="page-stack">
          <section class="card panel-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">{{ 'risks.detail.evidenceEyebrow' | translate }}</span>
                <h3>{{ 'risks.detail.evidenceTitle' | translate }}</h3>
                <p class="subtle">{{ 'risks.detail.evidenceCopy' | translate }}</p>
              </div>
            </div>
            <dl class="key-value top-space">
              <dt>{{ 'risks.detail.sourceIssue' | translate }}</dt>
              <dd>
                <ng-container *ngIf="sourceContextNavigation(); else noRiskSource">
                  <a [routerLink]="sourceContextNavigation()!.route" class="table-link">{{ t('risks.detail.openSource', { label: sourceContextNavigation()!.label }) }}</a>
                </ng-container>
                <ng-template #noRiskSource>{{ selectedRisk()?.issueContext || t('risks.detail.noSourceIssue') }}</ng-template>
              </dd>
              <dt>{{ 'risks.detail.processContext' | translate }}</dt>
              <dd>{{ currentProcessContext() || t('risks.detail.noProcessLinked') }}</dd>
              <dt>{{ 'risks.detail.linkedActionsLabel' | translate }}</dt>
              <dd>{{ linkedActionSummary(selectedRisk()?.assessmentType || 'RISK') }}</dd>
            </dl>
            <div class="button-row top-space">
              <a *ngIf="sourceContextNavigation()" [routerLink]="sourceContextNavigation()!.route" class="button-link secondary">{{ 'risks.detail.openSourceIssue' | translate }}</a>
              <button type="button" class="secondary" (click)="scrollToActions()">{{ 'risks.detail.reviewLinkedActions' | translate }}</button>
              <button type="button" class="tertiary" (click)="scrollToEvidence()">{{ 'risks.detail.reviewEvidence' | translate }}</button>
            </div>
          </section>

          <div id="risk-evidence-section">
            <iso-attachment-panel [sourceType]="'risk'" [sourceId]="selectedId()" />
          </div>
        </div>
      </section>
    </section>
  `,
  styles: [`
    .top-space {
      margin-top: 1rem;
    }

    .segmented-control {
      display: inline-flex;
      gap: 0.4rem;
      padding: 0.35rem;
      border: 1px solid var(--border-subtle);
      border-radius: 999px;
      background: color-mix(in srgb, var(--surface-strong) 88%, white);
    }

    .segmented-control button {
      border: 0;
      background: transparent;
      color: var(--text-soft);
      border-radius: 999px;
      padding: 0.55rem 0.95rem;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }

    .segmented-control button.active {
      background: rgba(36, 79, 61, 0.12);
      color: var(--brand-strong);
      box-shadow: var(--shadow-soft);
    }

    .tone-low {
      color: #2f6b45;
    }

    .tone-positive {
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

    .level-indicator {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 7.5rem;
      padding: 0.45rem 0.8rem;
      border-radius: 999px;
      font-weight: 800;
      border: 1px solid transparent;
    }

    .level-low {
      color: #2f6b45;
      background: rgba(47, 107, 69, 0.12);
      border-color: rgba(47, 107, 69, 0.18);
    }

    .level-caption {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      margin-top: 0.2rem;
      padding: 0.22rem 0.55rem;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 700;
      border: 1px solid transparent;
    }

    .level-medium {
      color: #8a6322;
      background: rgba(138, 99, 34, 0.12);
      border-color: rgba(138, 99, 34, 0.18);
    }

    .level-high {
      color: #b0493a;
      background: rgba(176, 73, 58, 0.12);
      border-color: rgba(176, 73, 58, 0.18);
    }

    .level-positive {
      color: #2f6b45;
      background: rgba(47, 107, 69, 0.12);
      border-color: rgba(47, 107, 69, 0.18);
    }

    .field-hint {
      color: var(--muted);
      font-size: 0.86rem;
      line-height: 1.4;
    }

    .next-steps-banner {
      display: grid;
      gap: 0.35rem;
      margin-top: 1rem;
      padding: 1rem 1.1rem;
      border-radius: 1rem;
      border: 1px solid rgba(47, 107, 69, 0.16);
      background: rgba(47, 107, 69, 0.08);
    }

    .next-steps-banner.warning,
    .compliance-note {
      display: grid;
      gap: 0.35rem;
      padding: 1rem 1.1rem;
      border-radius: 1rem;
      border: 1px solid rgba(138, 99, 34, 0.16);
      background: rgba(138, 99, 34, 0.08);
    }

    tr[routerLink] {
      cursor: pointer;
    }
    .chip-row { display: flex; flex-wrap: wrap; gap: 0.6rem; }
    .chip-button {
      border: 1px solid var(--border-subtle);
      background: color-mix(in srgb, var(--surface-strong) 88%, white);
      border-radius: 999px;
      padding: 0.5rem 0.9rem;
      color: var(--text-strong);
      cursor: pointer;
      font: inherit;
    }
    .content-guidance {
      border: 1px solid var(--border-subtle);
      border-radius: 1rem;
      padding: 1rem;
      background: color-mix(in srgb, var(--surface-strong) 92%, white);
    }
    .compact-head { align-items: center; }
    .guidance-group strong { display: block; color: var(--text-strong); }
    .attention-copy {
      color: var(--brand-strong);
      font-weight: 700;
    }
  `]
})
export class RisksPageComponent implements OnInit, OnChanges {
  @Input() forcedMode: PageMode | null = null;

  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly contentLibrary = inject(ContentLibraryService);
  private readonly contextApi = inject(ContextApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  protected readonly mode = signal<PageMode>('list');
  protected readonly risks = signal<RiskRow[]>([]);
  protected readonly selectedRisk = signal<RiskRow | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly users = signal<UserOption[]>([]);
  protected readonly settings = signal<SettingsConfig | null>(null);
  protected readonly library = signal<ContentLibraryResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal((history.state?.notice as string) || '');
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly statusFilter = signal<RiskLifecycleStatus | ''>('');

  protected showStartHereBackLink() {
    return this.route.snapshot.queryParamMap.get('from') === 'start-here';
  }
  protected readonly assessmentTypeFilter = signal<RiskAssessmentType | ''>('');
  protected readonly sortBy = signal<RiskSortOption>('attention');
  protected readonly customCategoryMode = signal(false);
  protected readonly sourceContextPrefill = signal<RiskContextPrefill | null>(null);
  protected readonly sourceContextNavigation = signal<SourceContextNavigation | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    assessmentType: ['RISK' as RiskAssessmentType, Validators.required],
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
    status: ['ACCEPTED' as RiskStatus, Validators.required]
  });

  ngOnInit() {
    this.loadUsers();
    this.loadSettings();
    this.loadContentLibrary();
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
    const label = this.pageLabel();
    return {
      list: label,
      create: this.t('risks.page.titles.create'),
      detail: this.selectedRisk()?.title || this.t('risks.page.titles.detail'),
      edit: this.selectedRisk()?.title || this.t('risks.page.titles.edit')
    }[this.mode()];
  }

  protected pageLabel() {
    return this.scopeVariant({
      QMS: { en: 'Quality risks & opportunities', az: 'Keyfiyyət riskləri və imkanları', ru: 'Риски и возможности качества' },
      EMS: { en: 'Environmental risks & opportunities', az: 'Ekoloji risklər və imkanlar', ru: 'Экологические риски и возможности' },
      OHSMS: { en: 'OH&S risks & opportunities', az: 'Əməyin mühafizəsi riskləri və imkanları', ru: 'Риски и возможности по ОТиЗ' },
      IMS: { en: this.t('risks.page.label'), az: this.t('risks.page.label'), ru: this.t('risks.page.label') },
      FSMS: { en: 'Food safety risks & opportunities', az: 'Qida təhlükəsizliyi riskləri və imkanları', ru: 'Риски и возможности пищевой безопасности' }
    });
  }

  protected pageDescription() {
    if (this.mode() === 'list') {
      return this.scopeVariant({
        QMS: {
          en: 'Assess quality risks and opportunities, track treatment, and keep ownership visible.',
          az: 'Keyfiyyət risk və imkanlarını qiymətləndirin, tədbirləri izləyin və cavabdehliyi görünən saxlayın.',
          ru: 'Оценивайте риски и возможности качества, отслеживайте меры и сохраняйте видимость ответственности.'
        },
        EMS: {
          en: 'Assess environmental risks and opportunities, track treatment, and keep ownership visible.',
          az: 'Ekoloji risk və imkanları qiymətləndirin, tədbirləri izləyin və cavabdehliyi görünən saxlayın.',
          ru: 'Оценивайте экологические риски и возможности, отслеживайте меры и сохраняйте видимость ответственности.'
        },
        OHSMS: {
          en: 'Assess OH&S risks and opportunities, track treatment, and keep ownership visible.',
          az: 'Əməyin mühafizəsi risk və imkanlarını qiymətləndirin, tədbirləri izləyin və cavabdehliyi görünən saxlayın.',
          ru: 'Оценивайте риски и возможности по ОТиЗ, отслеживайте меры и сохраняйте видимость ответственности.'
        },
        IMS: {
          en: this.t('risks.page.descriptions.list'),
          az: this.t('risks.page.descriptions.list'),
          ru: this.t('risks.page.descriptions.list')
        },
        FSMS: {
          en: 'Assess food safety risks and opportunities, track treatment, and keep ownership visible.',
          az: 'Qida təhlükəsizliyi risk və imkanlarını qiymətləndirin, tədbirləri izləyin və cavabdehliyi görünən saxlayın.',
          ru: 'Оценивайте риски и возможности пищевой безопасности, отслеживайте меры и сохраняйте видимость ответственности.'
        }
      });
    }

    if (this.mode() === 'create') {
      return this.t('risks.page.descriptions.create');
    }
    if (this.mode() === 'detail') {
      return this.t('risks.page.descriptions.detail');
    }
    return this.t('risks.page.descriptions.edit');
  }

  protected breadcrumbs() {
    const label = this.pageLabel();
    if (this.mode() === 'list') {
      return [{ label }];
    }
    const base = [{ label, link: '/risks' }];
    if (this.mode() === 'create') return [...base, { label: this.t('risks.page.breadcrumbs.new') }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedRisk()?.title || this.t('risks.page.breadcrumbs.record'), link: `/risks/${this.selectedId()}` }, { label: this.t('risks.page.breadcrumbs.edit') }];
    return [...base, { label: this.selectedRisk()?.title || this.t('risks.page.breadcrumbs.record') }];
  }

  protected listTitle() {
    return this.scopeVariant({
      QMS: { en: 'Quality risk register', az: 'Keyfiyyət risk reyestri', ru: 'Реестр рисков качества' },
      EMS: { en: 'Environmental risk register', az: 'Ekoloji risk reyestri', ru: 'Реестр экологических рисков' },
      OHSMS: { en: 'OH&S risk register', az: 'Əməyin mühafizəsi risk reyestri', ru: 'Реестр рисков ОТиЗ' },
      IMS: { en: this.t('risks.list.title'), az: this.t('risks.list.title'), ru: this.t('risks.list.title') },
      FSMS: { en: 'Food safety risk register', az: 'Qida təhlükəsizliyi risk reyestri', ru: 'Реестр рисков пищевой безопасности' }
    });
  }

  protected listCopy() {
    return this.scopeVariant({
      QMS: {
        en: 'Use one register for quality risks, opportunities, treatment, and follow-up.',
        az: 'Keyfiyyət riskləri, imkanları, tədbirləri və sonrakı izləməni bir reyestrdə idarə edin.',
        ru: 'Ведите риски качества, возможности, меры и последующие действия в одном реестре.'
      },
      EMS: {
        en: 'Use one register for environmental risks, opportunities, treatment, and follow-up.',
        az: 'Ekoloji riskləri, imkanları, tədbirləri və sonrakı izləməni bir reyestrdə idarə edin.',
        ru: 'Ведите экологические риски, возможности, меры и последующие действия в одном реестре.'
      },
      OHSMS: {
        en: 'Use one register for OH&S risks, opportunities, treatment, and follow-up.',
        az: 'Əməyin mühafizəsi risklərini, imkanlarını, tədbirləri və sonrakı izləməni bir reyestrdə idarə edin.',
        ru: 'Ведите риски и возможности по ОТиЗ, меры и последующие действия в одном реестре.'
      },
      IMS: {
        en: this.t('risks.list.copy'),
        az: this.t('risks.list.copy'),
        ru: this.t('risks.list.copy')
      },
      FSMS: {
        en: 'Use one register for food safety risks, opportunities, treatment, and follow-up.',
        az: 'Qida təhlükəsizliyi risklərini, imkanlarını, tədbirləri və sonrakı izləməni bir reyestrdə idarə edin.',
        ru: 'Ведите риски и возможности пищевой безопасности, меры и последующие действия в одном реестре.'
      }
    });
  }

  protected filtersTitle() {
    return this.scopeVariant({
      QMS: { en: 'Quality risk filters', az: 'Keyfiyyət risk filtrləri', ru: 'Фильтры рисков качества' },
      EMS: { en: 'Environmental risk filters', az: 'Ekoloji risk filtrləri', ru: 'Фильтры экологических рисков' },
      OHSMS: { en: 'OH&S risk filters', az: 'Əməyin mühafizəsi risk filtrləri', ru: 'Фильтры рисков ОТиЗ' },
      IMS: { en: this.t('risks.list.filtersTitle'), az: this.t('risks.list.filtersTitle'), ru: this.t('risks.list.filtersTitle') },
      FSMS: { en: 'Food safety risk filters', az: 'Qida təhlükəsizliyi risk filtrləri', ru: 'Фильтры рисков пищевой безопасности' }
    });
  }

  protected filtersCopy() {
    return this.scopeVariant({
      QMS: {
        en: 'Focus the register on the quality records that need review first.',
        az: 'Əvvəl baxış tələb edən keyfiyyət qeydlərinə reyestri fokuslayın.',
        ru: 'Сфокусируйте реестр на записях качества, которые требуют первоочередного анализа.'
      },
      EMS: {
        en: 'Focus the register on the environmental records that need review first.',
        az: 'Əvvəl baxış tələb edən ekoloji qeydlərə reyestri fokuslayın.',
        ru: 'Сфокусируйте реестр на экологических записях, которые требуют первоочередного анализа.'
      },
      OHSMS: {
        en: 'Focus the register on the OH&S records that need review first.',
        az: 'Əvvəl baxış tələb edən əməyin mühafizəsi qeydlərinə reyestri fokuslayın.',
        ru: 'Сфокусируйте реестр на записях ОТиЗ, которые требуют первоочередного анализа.'
      },
      IMS: {
        en: this.t('risks.list.filtersCopy'),
        az: this.t('risks.list.filtersCopy'),
        ru: this.t('risks.list.filtersCopy')
      },
      FSMS: {
        en: 'Focus the register on the food safety records that need review first.',
        az: 'Əvvəl baxış tələb edən qida təhlükəsizliyi qeydlərinə reyestri fokuslayın.',
        ru: 'Сфокусируйте реестр на записях пищевой безопасности, которые требуют первоочередного анализа.'
      }
    });
  }

  protected filteredRisks() {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.risks().filter((item) => {
      const matchesStatus = !status || this.toLifecycleStatus(item.status) === status;
      const matchesType = !this.assessmentTypeFilter() || (item.assessmentType || 'RISK') === this.assessmentTypeFilter();
      const matchesTerm =
        !term ||
        item.title.toLowerCase().includes(term) ||
        (item.category || '').toLowerCase().includes(term);
      return matchesStatus && matchesType && matchesTerm;
    }).sort((left, right) => this.compareRisks(left, right));
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

  protected countByLifecycle(status: RiskLifecycleStatus) {
    return this.risks().filter((item) => this.toLifecycleStatus(item.status) === status).length;
  }

  protected highRiskCount() {
    return this.risks().filter((item) => item.score >= 15).length;
  }

  protected attentionCount() {
    return this.risks().filter((item) => this.riskAttentionReasons(item).length > 0).length;
  }

  protected assessmentEntityLabel(type: RiskAssessmentType) {
    this.i18n.language();
    return type === 'OPPORTUNITY' ? this.t('risks.entity.opportunity') : this.t('risks.entity.risk');
  }

  protected assessmentSummary(item: RiskRow) {
    const entity = item.assessmentType === 'OPPORTUNITY' ? 'Potential' : 'Initial';
    const residual = item.residualScore ? ` -> ${item.assessmentType === 'OPPORTUNITY' ? 'Residual potential' : 'Residual'} ${item.residualScore}` : '';
    return `${entity} ${item.score}${residual}`;
  }

  protected lifecycleStatus() {
    return this.toLifecycleStatus(this.form.getRawValue().status);
  }

  protected lifecycleStatusLabel(status: RiskStatus) {
    this.i18n.language();
    const lifecycle = this.toLifecycleStatus(status).toLowerCase();
    return this.t(`risks.lifecycle.${lifecycle}`);
  }

  protected setLifecycleStatus(value: string) {
    this.form.patchValue({ status: this.fromLifecycleStatus(value as RiskLifecycleStatus) });
  }

  protected scoreBreakdown(item: RiskRow) {
    return item.assessmentType === 'OPPORTUNITY'
      ? `L${item.likelihood} x B${item.severity}`
      : `L${item.likelihood} x I${item.severity}`;
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

  protected riskLevelLabel(score: number | null, type: RiskAssessmentType = 'RISK') {
    this.i18n.language();
    if (!score) {
      return this.t('risks.levels.notAssessed');
    }

    if (score <= 5) {
      return type === 'OPPORTUNITY' ? this.t('risks.levels.lowPotential') : this.t('risks.levels.low');
    }
    if (score <= 14) {
      return type === 'OPPORTUNITY' ? this.t('risks.levels.mediumPotential') : this.t('risks.levels.medium');
    }
    return type === 'OPPORTUNITY' ? this.t('risks.levels.highPotential') : this.t('risks.levels.high');
  }

  protected scoreToneClass(score: number | null, type: RiskAssessmentType = 'RISK') {
    const level = this.riskLevelLabel(score, type);
    if (type === 'OPPORTUNITY') {
      if (level === 'High potential') {
        return 'tone-positive';
      }
      if (level === 'Medium potential') {
        return 'tone-medium';
      }
      return 'tone-neutral';
    }

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

  protected levelBadgeClass(score: number | null, type: RiskAssessmentType = 'RISK') {
    const level = this.riskLevelLabel(score, type);
    if (type === 'OPPORTUNITY') {
      if (level === 'High potential') return 'level-positive';
      if (level === 'Medium potential') return 'level-medium';
      return 'level-low';
    }

    if (level === 'Low') return 'level-low';
    if (level === 'Medium') return 'level-medium';
    if (level === 'High') return 'level-high';
    return 'level-low';
  }

  protected readInputValue(event: Event) {
    return (event.target as HTMLInputElement).value;
  }

  protected readSelectValue(event: Event) {
    return (event.target as HTMLSelectElement).value;
  }
  protected riskCategories() {
    return this.library()?.risks.riskCategories ?? [];
  }
  protected opportunityCategories() {
    return this.library()?.risks.opportunityCategories ?? [];
  }
  protected activeCategories() {
    return this.form.getRawValue().assessmentType === 'OPPORTUNITY' ? this.opportunityCategories() : this.riskCategories();
  }
  protected selectedCategoryOption() {
    const category = this.form.getRawValue().category.trim();
    if (!category) {
      return '';
    }
    return this.activeCategories().includes(category) ? category : '__custom__';
  }
  protected applyRiskCategory(category: string) {
    this.customCategoryMode.set(false);
    this.form.patchValue({ category });
  }
  protected setAssessmentType(type: RiskAssessmentType) {
    this.form.patchValue({ assessmentType: type });
    const currentCategory = this.form.getRawValue().category.trim();
    if (!currentCategory) {
      this.customCategoryMode.set(false);
      return;
    }

    const supportedInNewType =
      (type === 'OPPORTUNITY' ? this.opportunityCategories() : this.riskCategories()).includes(currentCategory);
    this.customCategoryMode.set(!supportedInNewType);
  }
  protected onCategoryOptionChange(category: string) {
    if (category === '__custom__') {
      this.customCategoryMode.set(true);
      if (this.activeCategories().includes(this.form.getRawValue().category.trim())) {
        this.form.patchValue({ category: '' });
      }
      return;
    }

    this.customCategoryMode.set(false);
    this.form.patchValue({ category });
  }
  protected setAssessmentTypeFilter(value: string) {
    this.assessmentTypeFilter.set((value as RiskAssessmentType | '') || '');
  }
  protected setStatusFilter(value: string) {
    this.statusFilter.set((value as RiskLifecycleStatus | '') || '');
  }
  protected setSortBy(value: string) {
    this.sortBy.set((value as RiskSortOption) || 'attention');
  }
  protected assessmentIntroCopy(type: RiskAssessmentType) {
    this.i18n.language();
    return type === 'OPPORTUNITY'
      ? this.t('risks.assessment.intro.opportunity')
      : this.t('risks.assessment.intro.risk');
  }
  protected initialAssessmentHeading(type: RiskAssessmentType) {
    this.i18n.language();
    return type === 'OPPORTUNITY' ? this.t('risks.assessment.initialHeading.opportunity') : this.t('risks.assessment.initialHeading.risk');
  }
  protected likelihoodLabel(type: RiskAssessmentType) {
    this.i18n.language();
    return type === 'OPPORTUNITY' ? this.t('risks.assessment.likelihood.opportunity') : this.t('risks.assessment.likelihood.risk');
  }
  protected impactLabel(type: RiskAssessmentType) {
    this.i18n.language();
    return type === 'OPPORTUNITY' ? this.t('risks.assessment.impact.opportunity') : this.t('risks.assessment.impact.risk');
  }
  protected likelihoodHint(type: RiskAssessmentType) {
    this.i18n.language();
    return type === 'OPPORTUNITY' ? this.t('risks.assessment.likelihoodHint.opportunity') : this.t('risks.assessment.likelihoodHint.risk');
  }
  protected impactHint(type: RiskAssessmentType) {
    this.i18n.language();
    return type === 'OPPORTUNITY' ? this.t('risks.assessment.impactHint.opportunity') : this.t('risks.assessment.impactHint.risk');
  }
  protected initialScoreLabel(type: RiskAssessmentType) {
    this.i18n.language();
    return type === 'OPPORTUNITY' ? this.t('risks.assessment.initialScore.opportunity') : this.t('risks.assessment.initialScore.risk');
  }
  protected matrixRatingLabel(type: RiskAssessmentType) {
    this.i18n.language();
    return type === 'OPPORTUNITY' ? this.t('risks.assessment.matrixRating.opportunity') : this.t('risks.assessment.matrixRating.risk');
  }
  protected treatmentHeading(type: RiskAssessmentType) {
    return type === 'OPPORTUNITY' ? 'Realization planning' : 'Mitigation';
  }
  protected existingControlsLabel(type: RiskAssessmentType) {
    return type === 'OPPORTUNITY' ? 'Current enablers' : 'Existing controls';
  }
  protected existingControlsPlaceholder(type: RiskAssessmentType) {
    return type === 'OPPORTUNITY'
      ? 'Current conditions already supporting this opportunity'
      : 'Current controls already reducing the risk';
  }
  protected plannedActionsLabel(type: RiskAssessmentType) {
    return type === 'OPPORTUNITY' ? 'Planned realization actions' : 'Planned mitigation actions';
  }
  protected plannedActionsPlaceholder(type: RiskAssessmentType) {
    return type === 'OPPORTUNITY'
      ? 'Actions planned to realize the opportunity'
      : 'Additional mitigation actions to reduce the risk';
  }
  protected residualAssessmentHeading(type: RiskAssessmentType) {
    this.i18n.language();
    return type === 'OPPORTUNITY' ? this.t('risks.assessment.residualHeading.opportunity') : this.t('risks.assessment.residualHeading.risk');
  }
  protected residualScoreLabel(type: RiskAssessmentType) {
    this.i18n.language();
    return type === 'OPPORTUNITY' ? this.t('risks.assessment.residualScore.opportunity') : this.t('risks.assessment.residualScore.risk');
  }
  protected residualRatingLabel(type: RiskAssessmentType) {
    this.i18n.language();
    return type === 'OPPORTUNITY' ? this.t('risks.assessment.residualRating.opportunity') : this.t('risks.assessment.residualRating.risk');
  }
  protected residualEmptyCopy(type: RiskAssessmentType) {
    return type === 'OPPORTUNITY' ? 'No residual opportunity assessment recorded yet.' : 'No residual risk assessment recorded yet.';
  }
  protected nextStepsCopy(type: RiskAssessmentType) {
    return type === 'OPPORTUNITY'
      ? 'Next: confirm the realization plan, create an action if ownership is needed, and then review the residual opportunity.'
      : 'Next: confirm the mitigation plan, create an action for ownership and due date, and then review the residual risk.';
  }
  protected riskResponseHeading(type: RiskAssessmentType, lifecycle: RiskLifecycleStatus) {
    const entity = type === 'OPPORTUNITY' ? 'Opportunity' : 'Risk';
    if (lifecycle === 'DRAFT') return `${entity} is being identified`;
    if (lifecycle === 'ASSESSED') return `${entity} has been assessed`;
    if (lifecycle === 'MITIGATION_PLANNED') return type === 'OPPORTUNITY' ? 'Realization actions are planned' : 'Mitigation actions are planned';
    if (lifecycle === 'MONITORING') return type === 'OPPORTUNITY' ? 'Realization is being monitored' : 'Residual performance is being monitored';
    return `${entity} record is closed`;
  }
  protected riskResponseGuidance(type: RiskAssessmentType, lifecycle: RiskLifecycleStatus) {
    if (lifecycle === 'DRAFT') {
      return type === 'OPPORTUNITY'
        ? 'Use draft while the opportunity is still being defined. Move it to assessed once the initial potential is clear.'
        : 'Use draft while the risk is still being described. Move it to assessed once the initial score is agreed.';
    }
    if (lifecycle === 'ASSESSED') {
      return type === 'OPPORTUNITY'
        ? 'Use assessed once the initial opportunity is understood and no assigned realization work is needed yet.'
        : 'Use assessed once the initial risk is understood and no assigned mitigation work is needed yet.';
    }
    if (lifecycle === 'MITIGATION_PLANNED') {
      return type === 'OPPORTUNITY'
        ? 'Use mitigation planned when realization actions, ownership, or due dates are active and still being driven.'
        : 'Use mitigation planned when treatment actions, ownership, or due dates are active and still being driven.';
    }
    if (lifecycle === 'MONITORING') {
      return type === 'OPPORTUNITY'
        ? 'Use monitoring after actions are in place and you are checking whether the expected benefit is being realized.'
        : 'Use monitoring after controls are in place and you are checking whether the residual risk stays acceptable.';
    }
    return 'Use closed when the record no longer needs active follow-up and the evidence trail is complete.';
  }
  protected riskResponseShortLabel(type: RiskAssessmentType, status: RiskStatus) {
    const lifecycle = this.toLifecycleStatus(status);
    if (lifecycle === 'DRAFT') return 'Identifying';
    if (lifecycle === 'ASSESSED') return 'Assessed';
    if (lifecycle === 'MITIGATION_PLANNED') return type === 'OPPORTUNITY' ? 'Realizing' : 'Treating';
    if (lifecycle === 'MONITORING') return 'Monitoring';
    return 'Closed';
  }
  protected sourceContextSummary() {
    const prefill = this.sourceContextPrefill();
    if (!prefill) {
      return null;
    }
    const impact = prefill.impactOnBusiness?.trim();
    return `Created from ${prefill.issueType.toLowerCase()} issue "${prefill.issueTitle}"${impact ? ` | Business impact: ${impact}` : ''}.`;
  }
  protected currentProcessContext() {
    const prefill = this.sourceContextPrefill();
    if (prefill?.processNames?.length) {
      return prefill.processNames.join(', ');
    }
    return this.linkedProcessSummary(this.selectedRisk());
  }
  protected linkedProcessSummary(item: RiskRow | null) {
    if (!item?.issueContext) {
      return null;
    }
    const marker = 'Processes:';
    const index = item.issueContext.indexOf(marker);
    if (index === -1) {
      return null;
    }
    return item.issueContext.slice(index + marker.length).trim() || null;
  }
  protected linkedActionCopy(type: RiskAssessmentType) {
    return type === 'OPPORTUNITY'
      ? 'Actions raised from this opportunity stay linked here so realization work is easy to review without leaving the record.'
      : 'Actions raised from this record stay linked here so treatment work is easy to review without leaving the risk flow.';
  }
  protected linkedActionSummary(type: RiskAssessmentType) {
    return type === 'OPPORTUNITY'
      ? 'Use linked actions to assign realization work, ownership, and due dates.'
      : 'Use linked actions to assign mitigation work, ownership, and due dates.';
  }
  protected residualMovementSummary(item: RiskRow | null) {
    if (!item?.residualScore) {
      return null;
    }

    const delta = item.score - item.residualScore;
    if (delta > 0) {
      return {
        heading: item.assessmentType === 'OPPORTUNITY' ? 'Residual potential is lower than the initial opportunity' : 'Residual risk is lower than the initial assessment',
        copy: item.assessmentType === 'OPPORTUNITY'
          ? `The score moved from ${item.score} to ${item.residualScore}. Confirm the reduced potential is acceptable or add further realization actions.`
          : `The score moved from ${item.score} to ${item.residualScore}. This shows the planned controls are reducing exposure and can move into monitored follow-up.`
      };
    }

    if (delta < 0) {
      return {
        heading: item.assessmentType === 'OPPORTUNITY' ? 'Residual potential increased' : 'Residual risk increased',
        copy: item.assessmentType === 'OPPORTUNITY'
          ? `The score moved from ${item.score} to ${item.residualScore}. Confirm the higher potential is supported by realistic actions and ownership.`
          : `The score moved from ${item.score} to ${item.residualScore}. Review treatment effectiveness because the residual position is now worse than the initial assessment.`
      };
    }

    return {
      heading: item.assessmentType === 'OPPORTUNITY' ? 'Residual potential is unchanged' : 'Residual risk is unchanged',
      copy: item.assessmentType === 'OPPORTUNITY'
        ? `The residual score remains ${item.residualScore}. Confirm whether additional realization actions are needed to improve the expected benefit.`
        : `The residual score remains ${item.residualScore}. Confirm whether additional treatment is needed before moving the record into monitoring.`
    };
  }
  protected followUpSummary(item: RiskRow | null) {
    if (!item || !item.targetDate || item.status === 'CLOSED') {
      return null;
    }

    const dueDate = new Date(item.targetDate);
    const today = new Date();
    const diffDays = Math.floor((dueDate.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);

    if (diffDays < 0) {
      return {
        heading: 'Follow-up date is overdue',
        copy: `The planned follow-up date passed on ${item.targetDate.slice(0, 10)}. Review the actions, confirm residual assessment, and either move the record forward or reset the follow-up date.`
      };
    }

    if (diffDays <= 14) {
      return {
        heading: 'Follow-up date is approaching',
        copy: `The next follow-up is due on ${item.targetDate.slice(0, 10)}. Confirm owner accountability, treatment evidence, and the residual position before the due date arrives.`
      };
    }

    if (!item.ownerId && item.status === 'IN_TREATMENT') {
      return {
        heading: 'Treatment is active without an owner',
        copy: 'This record is in treatment but no owner is assigned yet. Add an owner or raise a linked action so accountability is visible.'
      };
    }

    return null;
  }

  protected attentionHeadline(item: RiskRow | null) {
    return item && this.riskAttentionReasons(item).length
      ? 'This record currently needs management attention.'
      : 'This record is currently under control.';
  }

  protected attentionNarrative(item: RiskRow | null) {
    if (!item) {
      return 'Attention guidance appears after the record is saved.';
    }
    const reasons = this.riskAttentionReasons(item);
    if (!reasons.length) {
      return 'Ownership, follow-up timing, and current risk position are controlled enough for routine monitoring.';
    }
    return `Attention is needed because ${reasons.map((reason) => reason.toLowerCase()).join(', ')}.`;
  }

  protected attentionSummary(item: RiskRow) {
    const reasons = this.riskAttentionReasons(item);
    return reasons.length ? reasons.join(' | ') : '';
  }

  protected attentionLabel(item: RiskRow) {
    const reasons = this.riskAttentionReasons(item);
    if (!reasons.length) {
      return 'Under control';
    }
    return reasons.length > 1 ? `${reasons[0]} +${reasons.length - 1}` : reasons[0];
  }

  protected attentionClass(item: RiskRow) {
    const reasons = this.riskAttentionReasons(item);
    if (!reasons.length) {
      return 'success';
    }
    if (reasons.includes('Follow-up overdue') || reasons.includes('High priority')) {
      return 'danger';
    }
    return 'warn';
  }
  protected scrollToActions() {
    const section = document.getElementById('risk-actions-section');
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  protected scrollToEvidence() {
    const section = document.getElementById('risk-evidence-section');
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  protected cancelRoute() {
    if (!this.selectedId() && this.sourceContextNavigation()) {
      return this.sourceContextNavigation()!.route;
    }
    return this.selectedId() ? ['/risks', this.selectedId()] : ['/risks'];
  }
  protected cancelState() {
    if (this.selectedId() && this.sourceContextNavigation()) {
      return { sourceContextNavigation: this.sourceContextNavigation() };
    }
    return undefined;
  }

  private riskAttentionReasons(item: RiskRow) {
    if (item.status === 'CLOSED') {
      return [];
    }
    const reasons: string[] = [];
    if (this.isRiskOverdue(item)) {
      reasons.push('Follow-up overdue');
    } else if (this.isRiskDueSoon(item, 14)) {
      reasons.push('Follow-up due soon');
    }
    if (!item.ownerId && item.status === 'IN_TREATMENT') {
      reasons.push('Owner needed');
    }
    if (item.score >= 15) {
      reasons.push('High priority');
    }
    if (this.isRiskStale(item, 45)) {
      reasons.push('Stale');
    }
    return reasons;
  }

  private isRiskOverdue(item: RiskRow) {
    return !!item.targetDate && new Date(item.targetDate) < new Date();
  }

  private isRiskDueSoon(item: RiskRow, days: number) {
    if (!item.targetDate || this.isRiskOverdue(item)) {
      return false;
    }
    const due = new Date(item.targetDate);
    const today = new Date();
    const delta = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return delta >= 0 && delta <= days;
  }

  private isRiskStale(item: RiskRow, days: number) {
    const updated = new Date(item.updatedAt);
    const today = new Date();
    const delta = (today.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);
    return delta > days;
  }

  private compareRisks(left: RiskRow, right: RiskRow) {
    switch (this.sortBy()) {
      case 'score':
        return right.score - left.score || this.compareDateDesc(left.updatedAt, right.updatedAt);
      case 'targetDate':
        return this.compareOptionalDateAsc(left.targetDate, right.targetDate) || this.compareDateDesc(left.updatedAt, right.updatedAt);
      case 'updated':
        return this.compareDateDesc(left.updatedAt, right.updatedAt) || right.score - left.score;
      case 'attention':
      default:
        return (
          this.riskAttentionRank(left) - this.riskAttentionRank(right) ||
          right.score - left.score ||
          this.compareOptionalDateAsc(left.targetDate, right.targetDate) ||
          this.compareDateDesc(left.updatedAt, right.updatedAt)
        );
    }
  }

  private riskAttentionRank(item: RiskRow) {
    const reasons = this.riskAttentionReasons(item);
    if (reasons.includes('Follow-up overdue')) return 0;
    if (reasons.includes('High priority')) return 1;
    if (reasons.includes('Owner needed')) return 2;
    if (reasons.includes('Follow-up due soon')) return 3;
    if (reasons.includes('Stale')) return 4;
    if (item.status !== 'CLOSED') return 5;
    return 6;
  }

  private compareOptionalDateAsc(left?: string | null, right?: string | null) {
    const leftTime = left ? new Date(left).getTime() : Number.POSITIVE_INFINITY;
    const rightTime = right ? new Date(right).getTime() : Number.POSITIVE_INFINITY;
    return leftTime - rightTime;
  }

  private compareDateDesc(left?: string | null, right?: string | null) {
    const leftTime = left ? new Date(left).getTime() : 0;
    const rightTime = right ? new Date(right).getTime() : 0;
    return rightTime - leftTime;
  }
  protected routeStateWithSource() {
    return this.sourceContextNavigation() ? { sourceContextNavigation: this.sourceContextNavigation() } : undefined;
  }

  private toLifecycleStatus(status: RiskStatus): RiskLifecycleStatus {
    if (status === 'OPEN') return 'DRAFT';
    if (status === 'ACCEPTED') return 'ASSESSED';
    if (status === 'IN_TREATMENT') return 'MITIGATION_PLANNED';
    if (status === 'MITIGATED') return 'MONITORING';
    return 'CLOSED';
  }

  private fromLifecycleStatus(status: RiskLifecycleStatus): RiskStatus {
    if (status === 'DRAFT') return 'OPEN';
    if (status === 'ASSESSED') return 'ACCEPTED';
    if (status === 'MITIGATION_PLANNED') return 'IN_TREATMENT';
    if (status === 'MONITORING') return 'MITIGATED';
    return 'CLOSED';
  }

  protected save() {
    if (!this.canWrite()) {
      this.error.set('You do not have permission to update risks.');
      return;
    }

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
        const sourceContext = this.sourceContextPrefill();
        const sourceNavigation = this.sourceContextNavigation();
        if (sourceContext && !this.selectedId()) {
          this.contextApi.addIssueRiskLink(sourceContext.issueId, risk.id).subscribe({
            next: () => {
              this.saving.set(false);
              this.sourceContextPrefill.set(null);
              this.router.navigate(['/risks', risk.id], { state: { notice: 'Risk saved and linked to the source context issue.', sourceContextNavigation: sourceNavigation } });
            },
            error: () => {
              this.saving.set(false);
              this.sourceContextPrefill.set(null);
              this.router.navigate(['/risks', risk.id], { state: { notice: 'Risk saved successfully.', sourceContextNavigation: sourceNavigation } });
            }
          });
          return;
        }

        this.saving.set(false);
        this.router.navigate(['/risks', risk.id], {
          state: {
            notice: 'Risk saved successfully.',
            sourceContextNavigation: sourceNavigation
          }
        });
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

  protected canWrite() {
    return this.authStore.hasPermission('risks.write');
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
    this.sourceContextNavigation.set((history.state?.sourceContextNavigation as SourceContextNavigation | undefined) ?? null);

    if (this.mode() === 'list') {
      this.selectedRisk.set(null);
      this.sourceContextPrefill.set(null);
      this.sourceContextNavigation.set(null);
      this.customCategoryMode.set(false);
      this.form.reset({
        assessmentType: 'RISK',
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
        status: 'ACCEPTED'
      });
      this.reloadRisks();
      return;
    }

    if (this.mode() === 'create') {
      const prefill = history.state?.riskPrefill as RiskContextPrefill | undefined;
      this.selectedRisk.set(null);
      this.sourceContextPrefill.set(prefill ?? null);
      this.sourceContextNavigation.set((history.state?.sourceContextNavigation as SourceContextNavigation | undefined) ?? null);
      this.customCategoryMode.set(false);
      const processNames = prefill?.processNames?.filter(Boolean) ?? [];
      const issueContext = prefill
        ? `${prefill.issueTitle}${processNames.length ? ` | Processes: ${processNames.join(', ')}` : ''}`
        : '';
      this.form.reset({
        assessmentType: 'RISK',
        title: prefill?.issueTitle ?? '',
        description: prefill?.issueDescription ?? '',
        category: prefill?.category ?? '',
        likelihood: 3,
        severity: 3,
        existingControls: '',
        plannedMitigationActions: '',
        residualLikelihood: null,
        residualImpact: null,
        issueContextType: prefill?.issueType ?? '',
        issueContext,
        treatmentPlan: '',
        treatmentSummary: '',
        ownerId: '',
        targetDate: '',
        status: 'ACCEPTED'
      });
      this.customCategoryMode.set(!!prefill?.category && !this.activeCategories().includes(prefill.category));
      return;
    }

    if (id) {
      this.sourceContextPrefill.set(null);
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
        this.customCategoryMode.set(!!risk.category && !((risk.assessmentType || 'RISK') === 'OPPORTUNITY' ? this.opportunityCategories() : this.riskCategories()).includes(risk.category));
        this.form.reset({
          assessmentType: risk.assessmentType || 'RISK',
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

  private loadContentLibrary() {
    this.contentLibrary.getLibrary().subscribe({
      next: (library) => this.library.set(library),
      error: () => this.library.set(null)
    });
  }

  private toPayload() {
    const raw = this.form.getRawValue();
    return {
      ...raw,
      assessmentType: raw.assessmentType,
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

  protected t(key: string, params?: Record<string, unknown>) {
    return this.i18n.t(key, params);
  }

  private scopeVariant(content: Record<TenantScope, { en: string; az: string; ru: string }>) {
    const scope = this.authStore.scope();
    const language = this.i18n.language();
    return content[scope][language];
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
