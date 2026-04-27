import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnInit, SimpleChanges, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
import { I18nService } from '../core/i18n.service';
import { NcrApiService } from '../core/ncr-api.service';
import {
  NcrActivityItem,
  NcrCategory,
  NcrComment,
  NcrPriority,
  NcrRcaMethod,
  NcrRecord,
  NcrSeverity,
  NcrSource,
  NcrStatus,
  NcrUpsertPayload,
  NcrUserSummary,
  NcrVerificationStatus
} from '../core/ncr.models';
import { AttachmentPanelComponent } from '../shared/attachment-panel.component';
import { IconActionButtonComponent } from '../shared/icon-action-button.component';
import { PageHeaderComponent } from '../shared/page-header.component';
import { RecordWorkItemsComponent } from '../shared/record-work-items.component';

type PageMode = 'list' | 'create' | 'detail' | 'edit';
type UserOption = NcrUserSummary;
type ProcessOption = {
  id: string;
  name: string;
  referenceNo?: string | null;
  department?: string | null;
  status?: string;
  ownerUserId?: string | null;
  owner?: NcrUserSummary | null;
};

const NEXT_STATUS_OPTIONS: Record<NcrStatus, NcrStatus[]> = {
  OPEN: ['UNDER_REVIEW', 'INVESTIGATION', 'ARCHIVED'],
  UNDER_REVIEW: ['INVESTIGATION', 'ACTION_IN_PROGRESS', 'ARCHIVED'],
  INVESTIGATION: ['ACTION_IN_PROGRESS', 'PENDING_VERIFICATION', 'ARCHIVED'],
  ACTION_IN_PROGRESS: ['PENDING_VERIFICATION', 'ARCHIVED'],
  PENDING_VERIFICATION: ['ACTION_IN_PROGRESS', 'CLOSED', 'ARCHIVED'],
  CLOSED: ['ARCHIVED'],
  ARCHIVED: []
};

@Component({
  selector: 'iso-ncr-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, AttachmentPanelComponent, RecordWorkItemsComponent, IconActionButtonComponent],
  template: `
    <section class="page-grid">
      <iso-page-header [label]="t('ncr.common.label')" [title]="pageTitle()" [description]="pageDescription()" [breadcrumbs]="breadcrumbs()">
        <a *ngIf="mode() === 'list' && canWrite()" routerLink="/ncr/new" class="button-link">{{ t('ncr.actions.new') }}</a>
        <a *ngIf="mode() === 'detail' && selectedNcr() && canWrite()" [routerLink]="['/ncr', selectedNcr()?.id, 'edit']" class="button-link">{{ t('ncr.actions.edit') }}</a>
        <button *ngIf="mode() === 'detail' && canArchiveNcr()" type="button" class="button-link secondary" (click)="archiveCurrent()">{{ t('ncr.actions.archive') }}</button>
        <button *ngIf="mode() === 'detail' && canDeleteNcr()" type="button" class="button-link danger" (click)="deleteCurrent()">{{ t('ncr.actions.delete') }}</button>
        <a *ngIf="mode() !== 'list'" routerLink="/ncr" class="button-link secondary">{{ t('ncr.actions.backToList') }}</a>
      </iso-page-header>

      <section *ngIf="!canRead()" class="card list-card">
        <div class="empty-state">
          <strong>{{ t('ncr.empty.noAccessTitle') }}</strong>
          <span>{{ t('ncr.empty.noAccessCopy') }}</span>
        </div>
      </section>

      <section *ngIf="canRead() && mode() === 'list'" class="page-stack">
        <div class="card list-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">{{ t('ncr.list.eyebrow') }}</span>
              <h3>{{ t('ncr.list.title') }}</h3>
              <p class="subtle">{{ t('ncr.list.copy') }}</p>
            </div>
          </div>

          <div class="toolbar top-space">
            <div class="toolbar-meta">
              <div>
                <p class="toolbar-title">{{ t('ncr.list.filtersTitle') }}</p>
                <p class="toolbar-copy">{{ t('ncr.list.filtersCopy') }}</p>
              </div>
              <div class="toolbar-stats">
                <article class="toolbar-stat"><span>{{ t('ncr.list.stats.total') }}</span><strong>{{ ncrs().length }}</strong></article>
                <article class="toolbar-stat"><span>{{ t('ncr.list.stats.open') }}</span><strong>{{ countByStatus('OPEN') }}</strong></article>
                <article class="toolbar-stat"><span>{{ t('ncr.list.stats.overdue') }}</span><strong>{{ overdueCount() }}</strong></article>
              </div>
            </div>

            <div class="filter-grid ncr-filter-grid">
              <label class="field compact-field search-field">
                <span>{{ t('ncr.list.filters.search') }}</span>
                <input [value]="search()" (input)="search.set(readInput($event))" [placeholder]="t('ncr.list.placeholders.search')">
              </label>
              <label class="field compact-field">
                <span>{{ t('ncr.common.status') }}</span>
                <select [value]="statusFilter()" (change)="statusFilter.set(readSelect($event))">
                  <option value="">{{ t('ncr.list.filters.allStatuses') }}</option>
                  <option value="OVERDUE">{{ t('ncr.list.stats.overdue') }}</option>
                  <option *ngFor="let item of statusOptions" [value]="item">{{ labelize(item) }}</option>
                </select>
              </label>
              <label class="field compact-field">
                <span>{{ t('ncr.list.filters.category') }}</span>
                <select [value]="categoryFilter()" (change)="categoryFilter.set(readSelect($event))">
                  <option value="">{{ t('ncr.list.filters.allCategories') }}</option>
                  <option *ngFor="let item of categoryOptions" [value]="item">{{ labelize(item) }}</option>
                </select>
              </label>
              <label class="field compact-field">
                <span>{{ t('ncr.list.filters.source') }}</span>
                <select [value]="sourceFilter()" (change)="sourceFilter.set(readSelect($event))">
                  <option value="">{{ t('ncr.list.filters.allSources') }}</option>
                  <option *ngFor="let item of sourceOptions" [value]="item">{{ labelize(item) }}</option>
                </select>
              </label>
              <label class="field compact-field">
                <span>{{ t('ncr.list.filters.severity') }}</span>
                <select [value]="severityFilter()" (change)="severityFilter.set(readSelect($event))">
                  <option value="">{{ t('ncr.list.filters.allSeverities') }}</option>
                  <option *ngFor="let item of severityOptions" [value]="item">{{ labelize(item) }}</option>
                </select>
              </label>
              <label class="field compact-field">
                <span>{{ t('ncr.common.owner') }}</span>
                <select [value]="ownerFilter()" (change)="ownerFilter.set(readSelect($event))">
                  <option value="">{{ t('ncr.list.filters.allOwners') }}</option>
                  <option *ngFor="let item of users()" [value]="item.id">{{ fullName(item) }}</option>
                </select>
              </label>
            </div>
          </div>

          <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <div class="empty-state" *ngIf="loading()">
            <strong>{{ t('ncr.empty.loadingTitle') }}</strong>
            <span>{{ t('ncr.empty.loadingCopy') }}</span>
          </div>

          <div class="empty-state top-space" *ngIf="!loading() && !filteredNcrs().length">
            <strong>{{ t('ncr.empty.noneTitle') }}</strong>
            <span>{{ t('ncr.empty.noneCopy') }}</span>
          </div>

          <div class="data-table-wrap" *ngIf="!loading() && filteredNcrs().length">
            <table class="data-table">
              <thead>
                <tr>
                  <th>{{ t('ncr.table.reference') }}</th>
                  <th>{{ t('ncr.table.category') }}</th>
                  <th>{{ t('ncr.table.source') }}</th>
                  <th>{{ t('ncr.table.severity') }}</th>
                  <th>{{ t('ncr.common.status') }}</th>
                  <th>{{ t('ncr.common.owner') }}</th>
                  <th>{{ t('ncr.common.dueDate') }}</th>
                  <th>{{ t('ncr.table.updated') }}</th>
                  <th>{{ t('ncr.table.attention') }}</th>
                  <th>{{ t('ncr.table.actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of filteredNcrs()" [routerLink]="['/ncr', item.id]">
                  <td><div class="table-title"><strong>{{ item.referenceNo }}</strong><small>{{ item.title }}</small></div></td>
                  <td>{{ labelize(item.category) }}</td>
                  <td>{{ labelize(item.source) }}</td>
                  <td><span class="status-badge" [ngClass]="severityClass(item.severity)">{{ labelize(item.severity) }}</span></td>
                  <td><span class="status-badge" [ngClass]="statusClass(item.status)">{{ labelize(item.status) }}</span></td>
                  <td>{{ item.owner ? fullName(item.owner) : t('ncr.common.unassigned') }}</td>
                  <td>{{ item.dueDate ? (item.dueDate | date:'yyyy-MM-dd') : t('ncr.common.notSet') }}</td>
                  <td>{{ item.updatedAt | date:'yyyy-MM-dd' }}</td>
                  <td><span class="status-badge" [ngClass]="attentionClass(item)">{{ attentionLabel(item) }}</span></td>
                  <td>
                    <div class="inline-actions" (click)="$event.stopPropagation()">
                      <iso-icon-action-button [icon]="'view'" [label]="t('ncr.actions.view')" [routerLink]="['/ncr', item.id]" />
                      <iso-icon-action-button *ngIf="canWrite()" [icon]="'edit'" [label]="t('ncr.actions.edit')" [routerLink]="['/ncr', item.id, 'edit']" />
                      <iso-icon-action-button
                        *ngIf="showAdminRowActions()"
                        [icon]="'archive'"
                        [label]="canArchiveRow(item) ? t('ncr.actions.archive') : t('ncr.actions.archiveUnavailable')"
                        [disabled]="!canArchiveRow(item)"
                        (pressed)="archiveRow(item)"
                      />
                      <iso-icon-action-button
                        *ngIf="showAdminRowActions()"
                        [icon]="'delete'"
                        [label]="canDeleteRow(item) ? t('ncr.actions.delete') : t('ncr.actions.deleteUnavailable')"
                        [variant]="'danger'"
                        [disabled]="!canDeleteRow(item)"
                        (pressed)="deleteRow(item)"
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section *ngIf="canRead() && (mode() === 'create' || mode() === 'edit')" class="page-columns detail-layout">
        <form class="card form-card page-stack" [formGroup]="form" (ngSubmit)="save()">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">NCR form</span>
              <h3>{{ mode() === 'create' ? 'Raise NCR' : 'Edit NCR' }}</h3>
              <p class="subtle">Keep the initial entry simple, then build investigation and verification details as the NCR progresses.</p>
            </div>
          </div>

          <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>
          <section class="feedback next-steps-banner success" *ngIf="mode() === 'edit' && message() && !error()">
            <strong>{{ message() }}</strong>
            <span>{{ ncrNextStepsCopy() }}</span>
            <div class="button-row top-space">
              <a *ngIf="selectedId()" [routerLink]="['/ncr', selectedId()]" class="button-link secondary">{{ t('ncr.actions.reviewCurrent') }}</a>
              <a routerLink="/ncr" class="button-link tertiary">{{ t('ncr.actions.reviewList') }}</a>
            </div>
          </section>

          <section class="detail-section">
            <h4>{{ t('ncr.detail.overview') }}</h4>
            <div class="form-grid-2 top-space">
              <label class="field"><span>{{ t('ncr.form.fields.referenceNo') }}</span><input formControlName="referenceNo" [placeholder]="t('ncr.form.placeholders.referenceNo')"></label>
              <label class="field"><span>{{ t('ncr.form.fields.title') }}</span><input formControlName="title" [placeholder]="t('ncr.form.placeholders.title')"></label>
            </div>
            <div class="form-grid-3 top-space">
              <label class="field"><span>{{ t('ncr.list.filters.category') }}</span><select formControlName="category"><option *ngFor="let item of categoryOptions" [value]="item">{{ labelize(item) }}</option></select></label>
              <label class="field"><span>{{ t('ncr.list.filters.source') }}</span><select formControlName="source"><option *ngFor="let item of sourceOptions" [value]="item">{{ labelize(item) }}</option></select></label>
              <label class="field"><span>{{ t('ncr.common.status') }}</span><select formControlName="status"><option *ngFor="let item of editableStatusOptions()" [value]="item">{{ labelize(item) }}</option></select></label>
            </div>
            <label class="field top-space"><span>{{ t('ncr.form.fields.description') }}</span><textarea rows="4" formControlName="description" [placeholder]="t('ncr.form.placeholders.description')"></textarea></label>
            <div class="form-grid-3 top-space">
              <label class="field"><span>{{ t('ncr.list.filters.severity') }}</span><select formControlName="severity"><option *ngFor="let item of severityOptions" [value]="item">{{ labelize(item) }}</option></select></label>
              <label class="field"><span>{{ t('ncr.form.fields.priority') }}</span><select formControlName="priority"><option *ngFor="let item of priorityOptions" [value]="item">{{ labelize(item) }}</option></select></label>
              <label class="field"><span>{{ t('ncr.form.fields.dateReported') }}</span><input type="date" formControlName="dateReported"></label>
            </div>
          </section>

          <section class="detail-section">
            <h4>Ownership</h4>
            <div class="form-grid-2 top-space">
              <label class="field">
                <span>Process filter</span>
                <select [value]="ownerProcessFilterId()" (change)="setOwnerProcessFilter(readSelect($event))">
                  <option value="">All processes</option>
                  <option *ngFor="let process of processOptions()" [value]="process.id">{{ processLabel(process) }}</option>
                </select>
              </label>
              <div class="detail-section compact-note">
                <h4>Owner guidance</h4>
                <p>{{ ownerFilterCopy() }}</p>
              </div>
            </div>
            <div class="form-grid-2 top-space">
              <label class="field"><span>Reported by</span><select formControlName="reportedByUserId"><option value="">Unassigned</option><option *ngFor="let item of users()" [value]="item.id">{{ fullName(item) }}</option></select></label>
              <label class="field"><span>Owner</span><select formControlName="ownerUserId"><option value="">Unassigned</option><option *ngFor="let item of ownerOptions()" [value]="item.id">{{ fullName(item) }}</option></select></label>
            </div>
            <div class="form-grid-3 top-space">
              <label class="field"><span>Department</span><input formControlName="department" placeholder="Quality"></label>
              <label class="field"><span>Location</span><input formControlName="location" placeholder="Line 2"></label>
              <label class="field"><span>Due date</span><input type="date" formControlName="dueDate"></label>
            </div>
          </section>

          <section class="detail-section">
            <h4>Investigation</h4>
            <section class="compliance-note top-space">
              <strong>{{ ncrWorkflowHeading(form.getRawValue().status) }}</strong>
              <span>{{ ncrWorkflowGuidance(form.getRawValue().status) }}</span>
            </section>
            <label class="field top-space"><span>Containment action</span><textarea rows="3" formControlName="containmentAction"></textarea></label>
            <label class="field top-space"><span>Investigation summary</span><textarea rows="3" formControlName="investigationSummary"></textarea></label>
            <div class="form-grid-2 top-space">
              <label class="field"><span>Root cause</span><textarea rows="3" formControlName="rootCause"></textarea></label>
              <label class="field"><span>RCA method</span><select formControlName="rcaMethod"><option value="">Not set</option><option *ngFor="let item of rcaMethodOptions" [value]="item">{{ labelize(item) }}</option></select></label>
            </div>
            <div class="detail-section top-space structured-rca" *ngIf="selectedRcaMethod() === 'FIVE_WHY'">
              <div class="section-head compact-head">
                <div>
                  <h4>5 Why prompt</h4>
                  <p class="subtle">Work step by step through the causal chain. If the root cause summary is left blank, these answers will be combined into it on save.</p>
                </div>
              </div>
              <div class="page-stack top-space">
                <label class="field" *ngFor="let why of fiveWhySteps; let index = index">
                  <span>{{ why }}</span>
                  <textarea rows="2" [value]="fiveWhyAnswers()[index]" (input)="updateFiveWhy(index, $event)"></textarea>
                </label>
              </div>
            </div>
            <div class="detail-section top-space structured-rca" *ngIf="selectedRcaMethod() === 'FISHBONE'">
              <div class="section-head compact-head">
                <div>
                  <h4>Fishbone prompt</h4>
                  <p class="subtle">Capture likely causes by category. If the root cause summary is left blank, these notes will be combined into it on save.</p>
                </div>
              </div>
              <div class="form-grid-2 top-space">
                <label class="field" *ngFor="let group of fishboneCategories">
                  <span>{{ group.label }}</span>
                  <textarea rows="2" [value]="fishboneAnswers()[group.key]" (input)="updateFishbone(group.key, $event)"></textarea>
                </label>
              </div>
            </div>
            <label class="field top-space"><span>Corrective action summary</span><textarea rows="3" formControlName="correctiveActionSummary"></textarea></label>
          </section>

          <section class="detail-section">
            <h4>Verification</h4>
            <section class="compliance-note top-space">
              <strong>{{ verificationHeading(form.getRawValue().verificationStatus) }}</strong>
              <span>{{ verificationGuidance(form.getRawValue().verificationStatus) }}</span>
            </section>
            <div class="form-grid-3 top-space">
              <label class="field"><span>Verification status</span><select formControlName="verificationStatus"><option *ngFor="let item of verificationOptions" [value]="item">{{ labelize(item) }}</option></select></label>
              <label class="field"><span>Verified by</span><select formControlName="verifiedByUserId"><option value="">Unassigned</option><option *ngFor="let item of users()" [value]="item.id">{{ fullName(item) }}</option></select></label>
              <label class="field"><span>Verification date</span><input type="date" formControlName="verificationDate"></label>
            </div>
          </section>

            <div class="button-row">
            <button type="submit" [disabled]="form.invalid || saving() || !canWrite()">{{ saving() ? t('ncr.actions.saving') : t('ncr.actions.save') }}</button>
            <a [routerLink]="selectedId() ? ['/ncr', selectedId()] : ['/ncr']" class="button-link secondary">{{ t('common.cancel') }}</a>
          </div>
        </form>

      </section>

      <section *ngIf="canRead() && mode() === 'detail' && selectedNcr()" class="page-stack detail-layout">
        <div class="page-stack">
    <section class="card detail-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Nonconformance</span>
                <h3>{{ selectedNcr()?.title }}</h3>
                <p class="subtle">{{ selectedNcr()?.referenceNo }} | {{ labelize(selectedNcr()?.category || '') }} | {{ labelize(selectedNcr()?.source || '') }}</p>
              </div>
              <span class="status-badge" [ngClass]="statusClass(selectedNcr()?.status || 'OPEN')">{{ labelize(selectedNcr()?.status || '') }}</span>
            </div>
            <div class="summary-strip top-space">
              <article class="summary-item"><span>Workflow stage</span><strong>{{ ncrStageLabel(selectedNcr()?.status || 'OPEN') }}</strong></article>
              <article class="summary-item"><span>Severity</span><strong>{{ labelize(selectedNcr()?.severity || '') }}</strong></article>
              <article class="summary-item"><span>Priority</span><strong>{{ labelize(selectedNcr()?.priority || '') }}</strong></article>
              <article class="summary-item"><span>Due date</span><strong>{{ selectedNcr()?.dueDate ? (selectedNcr()?.dueDate | date:'yyyy-MM-dd') : 'Not set' }}</strong></article>
              <article class="summary-item"><span>Comments</span><strong>{{ comments().length }}</strong></article>
            </div>
            <section class="compliance-note top-space">
              <strong>{{ ncrWorkflowHeading(selectedNcr()?.status || 'OPEN') }}</strong>
              <span>{{ ncrWorkflowGuidance(selectedNcr()?.status || 'OPEN') }}</span>
            </section>
            <section class="compliance-note top-space">
              <strong>{{ attentionHeadline(selectedNcr()) }}</strong>
              <span>{{ attentionNarrative(selectedNcr()) }}</span>
            </section>
            <section class="compliance-note top-space" *ngIf="ncrFollowUpSummary(selectedNcr()) as followUp">
              <strong>{{ followUp.heading }}</strong>
              <span>{{ followUp.copy }}</span>
            </section>
            <section class="feedback next-steps-banner success top-space" *ngIf="message() && !error()">
              <strong>{{ message() }}</strong>
              <span>{{ ncrNextStepsCopy() }}</span>
              <div class="button-row top-space">
                <button type="button" (click)="setDetailTab(primaryWorkflowTab())">
                  {{ primaryWorkflowButtonLabel() }}
                </button>
                <button type="button" class="secondary" (click)="setDetailTab('comments')">Open comments</button>
                <button type="button" class="secondary" (click)="setDetailTab('activity')">Review evidence</button>
              </div>
            </section>
          </section>

          <section class="card panel-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">{{ t('ncr.detail.workflowEyebrow') }}</span>
                <h3>{{ t('ncr.detail.workflowTitle') }}</h3>
                <p class="subtle">{{ t('ncr.detail.workflowCopy') }}</p>
              </div>
            </div>

            <nav class="detail-tabs top-space" [attr.aria-label]="t('ncr.detail.tabsAriaLabel')">
              <button type="button" class="detail-tab" [class.active]="activeDetailTab() === 'overview'" (click)="setDetailTab('overview')">{{ t('ncr.detail.overview') }}</button>
              <button type="button" class="detail-tab" [class.active]="activeDetailTab() === 'investigation'" (click)="setDetailTab('investigation')">{{ t('ncr.detail.investigation') }}</button>
              <button type="button" class="detail-tab" [class.active]="activeDetailTab() === 'actions'" (click)="setDetailTab('actions')">{{ t('ncr.detail.followUpActions') }}</button>
              <button type="button" class="detail-tab" [class.active]="activeDetailTab() === 'verification'" (click)="setDetailTab('verification')">{{ t('ncr.detail.verification') }}</button>
              <button type="button" class="detail-tab" [class.active]="activeDetailTab() === 'comments'" (click)="setDetailTab('comments')">{{ t('ncr.detail.comments') }}</button>
              <button type="button" class="detail-tab" [class.active]="activeDetailTab() === 'activity'" (click)="setDetailTab('activity')">{{ t('ncr.detail.activityEvidence') }}</button>
            </nav>
          </section>

          <section *ngIf="activeDetailTab() === 'overview'" class="card detail-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Overview</span>
                <h3>Overview</h3>
                <p class="subtle">Issue summary, ownership, reporting, and verification context.</p>
              </div>
            </div>
            <section class="detail-section top-space">
              <h4>Description</h4>
              <p>{{ selectedNcr()?.description }}</p>
            </section>
            <dl class="key-value top-space">
              <dt>Date reported</dt><dd>{{ selectedNcr()?.dateReported | date:'yyyy-MM-dd' }}</dd>
              <dt>Reported by</dt><dd>{{ selectedNcr()?.reportedBy ? fullName(selectedNcr()?.reportedBy!) : 'Unassigned' }}</dd>
              <dt>Owner</dt><dd>{{ selectedNcr()?.owner ? fullName(selectedNcr()?.owner!) : 'Unassigned' }}</dd>
              <dt>Department</dt><dd>{{ selectedNcr()?.department || 'Not set' }}</dd>
              <dt>Location</dt><dd>{{ selectedNcr()?.location || 'Not set' }}</dd>
              <dt>Verification</dt><dd>{{ labelize(selectedNcr()?.verificationStatus || '') }}</dd>
            </dl>
          </section>

          <section *ngIf="activeDetailTab() === 'investigation'" class="card detail-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Investigation</span>
                <h3>Investigation</h3>
                <p class="subtle">Containment, summary, root cause, and corrective response planning.</p>
              </div>
            </div>
            <div class="section-grid-2 top-space">
              <section class="detail-section"><h4>Containment action</h4><p>{{ selectedNcr()?.containmentAction || 'No containment action recorded.' }}</p></section>
              <section class="detail-section"><h4>Investigation summary</h4><p>{{ selectedNcr()?.investigationSummary || 'No investigation summary recorded.' }}</p></section>
              <section class="detail-section"><h4>Root cause</h4><p>{{ selectedNcr()?.rootCause || 'No root cause recorded.' }}</p></section>
              <section class="detail-section"><h4>RCA method</h4><p>{{ selectedNcr()?.rcaMethod ? labelize(selectedNcr()?.rcaMethod || '') : 'Not set' }}</p></section>
              <section class="detail-section"><h4>Corrective action summary</h4><p>{{ selectedNcr()?.correctiveActionSummary || 'No corrective action summary recorded.' }}</p></section>
            </div>
            <div class="button-row top-space" *ngIf="availableTransitions().length && canWrite()">
              <button *ngFor="let item of availableTransitions()" type="button" class="secondary" [disabled]="saving()" (click)="changeStatus(item)">Move to {{ labelize(item) }}</button>
            </div>
          </section>

          <section *ngIf="activeDetailTab() === 'actions'" class="page-stack">
            <section class="card panel-card">
              <div class="section-head">
                <div>
                  <span class="section-eyebrow">Follow-up actions</span>
                  <h3>Task-level corrective follow-up</h3>
                  <p class="subtle">Use linked actions for owned tasks that support the NCR. Keep the corrective action summary in the investigation record, and use the action tracker for who-does-what follow-up.</p>
                </div>
              </div>
              <section class="compliance-note top-space">
                <strong>How to use linked actions</strong>
                <span>Create actions here when the NCR needs specific owners, due dates, or multiple follow-up tasks. Do not repeat the whole NCR narrative in each action.</span>
              </section>
            </section>
            <iso-record-work-items [sourceType]="'ncr'" [sourceId]="selectedId()" />
          </section>

          <section *ngIf="activeDetailTab() === 'verification'" class="card detail-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Verification</span>
                <h3>Verification</h3>
                <p class="subtle">Confirm whether the corrective action was effective, not only completed.</p>
              </div>
            </div>
            <section class="compliance-note top-space">
              <strong>{{ verificationHeading(selectedNcr()?.verificationStatus || 'PENDING') }}</strong>
              <span>{{ verificationGuidance(selectedNcr()?.verificationStatus || 'PENDING') }}</span>
            </section>
            <div class="section-grid-2 top-space">
              <section class="detail-section"><h4>Verification status</h4><p>{{ labelize(selectedNcr()?.verificationStatus || '') }}</p></section>
              <section class="detail-section"><h4>Verified by</h4><p>{{ selectedNcr()?.verifiedBy ? fullName(selectedNcr()?.verifiedBy!) : 'Not assigned' }}</p></section>
              <section class="detail-section"><h4>Verification date</h4><p>{{ selectedNcr()?.verificationDate ? (selectedNcr()?.verificationDate | date:'yyyy-MM-dd') : 'Not recorded' }}</p></section>
              <section class="detail-section"><h4>Current NCR status</h4><p>{{ labelize(selectedNcr()?.status || '') }}</p></section>
            </div>
            <div class="button-row top-space" *ngIf="availableTransitions().length && canWrite()">
              <button *ngFor="let item of availableTransitions()" type="button" class="secondary" [disabled]="saving()" (click)="changeStatus(item)">Move to {{ labelize(item) }}</button>
            </div>
          </section>

          <section *ngIf="activeDetailTab() === 'comments'" class="card panel-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Comments</span>
                <h3>Comments</h3>
                <p class="subtle">Capture context and discussion directly on the NCR.</p>
              </div>
            </div>
            <form class="page-stack top-space" [formGroup]="commentForm" (ngSubmit)="addComment()">
              <label class="field"><span>Add comment</span><textarea rows="3" formControlName="message" placeholder="Add a contextual note"></textarea></label>
              <div class="button-row"><button type="submit" [disabled]="commentForm.invalid || commentSaving() || !canWrite()">{{ commentSaving() ? 'Posting...' : 'Post comment' }}</button></div>
            </form>
            <div class="entity-list top-space" *ngIf="comments().length; else noComments">
              <div class="entity-item comment-item" *ngFor="let item of comments()">
                <strong>{{ fullName(item.author) }}</strong>
                <small>{{ item.createdAt | date:'yyyy-MM-dd HH:mm' }}</small>
                <p>{{ item.message }}</p>
              </div>
            </div>
            <ng-template #noComments><div class="empty-state top-space"><strong>No comments yet</strong><span>Add the first NCR comment from this record.</span></div></ng-template>
          </section>

          <section *ngIf="activeDetailTab() === 'activity'" class="card panel-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Evidence trail</span>
                <h3>Activity & evidence</h3>
                <p class="subtle">Review lifecycle history and supporting evidence for this NCR in one place.</p>
              </div>
            </div>
            <div class="entity-list top-space" *ngIf="activity().length; else noActivity">
              <div class="entity-item" *ngFor="let item of activity()">
                <strong>{{ activityLabel(item.action) }}</strong>
                <small>{{ item.createdAt | date:'yyyy-MM-dd HH:mm' }}</small>
              </div>
            </div>
            <ng-template #noActivity><div class="empty-state top-space"><strong>No activity yet</strong><span>Lifecycle events and evidence updates will appear here as the NCR progresses.</span></div></ng-template>
            <iso-attachment-panel class="top-space" [sourceType]="'ncr'" [sourceId]="selectedId()" />
          </section>
        </div>
      </section>
    </section>
  `,
  styles: [`
    .top-space { margin-top: 1rem; }
    .toolbar {
      gap: 0.8rem;
      padding: 0.85rem 0.95rem;
    }
    .toolbar-meta {
      gap: 0.75rem;
      align-items: flex-start;
    }
    .toolbar-copy {
      font-size: 0.88rem;
    }
    .toolbar-stats {
      gap: 0.5rem;
    }
    .toolbar-stat {
      min-width: 6rem;
      padding: 0.65rem 0.8rem;
      border-radius: 14px;
    }
    .toolbar-stat strong {
      margin-top: 0.22rem;
      font-size: 1.05rem;
    }
    .next-steps-banner {
      display: grid;
      gap: 0.35rem;
      padding: 1rem 1.1rem;
      border-radius: 1rem;
      border: 1px solid rgba(47, 107, 69, 0.16);
      background: rgba(47, 107, 69, 0.08);
    }
    .compliance-note {
      display: grid;
      gap: 0.35rem;
      padding: 1rem 1.1rem;
      border-radius: 1rem;
      border: 1px solid rgba(138, 99, 34, 0.16);
      background: rgba(138, 99, 34, 0.08);
    }
    .filter-grid { display: grid; gap: 0.75rem; grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .ncr-filter-grid { grid-template-columns: 1.3fr repeat(5, minmax(0, 0.9fr)); align-items: end; }
    .compact-field { gap: 0.28rem; }
    .compact-field span { font-size: 0.78rem; }
    .compact-field input,
    .compact-field select { min-height: 2.85rem; padding: 0.72rem 0.82rem; }
    .search-field { min-width: 0; }
    .checkbox-field { align-self: end; }
    .toggle-line {
      display: inline-flex;
      gap: 0.55rem;
      align-items: center;
      font-weight: 600;
      color: var(--muted-strong);
      min-height: 4.25rem;
      padding: 0 1rem;
      border: 1px solid var(--panel-border);
      border-radius: 1.1rem;
      background: rgba(255, 255, 255, 0.82);
    }
    .toggle-line input { margin: 0; }
    .inline-actions { display: grid; grid-template-columns: repeat(4, 2.4rem); gap: 0.45rem; justify-content: end; align-items: center; }
    .compact { padding: 0.5rem 0.72rem; min-height: auto; font-size: 0.82rem; }
    .detail-tabs { display: flex; gap: 0.75rem; flex-wrap: wrap; }
    .detail-tab {
      border: 1px solid var(--panel-border);
      background: rgba(255, 255, 255, 0.62);
      color: var(--text-soft);
      border-radius: 999px;
      padding: 0.7rem 1rem;
      font-weight: 700;
      cursor: pointer;
      transition: background 140ms ease, border-color 140ms ease, color 140ms ease, transform 140ms ease;
    }
    .detail-tab:hover {
      border-color: rgba(36, 79, 61, 0.18);
      background: rgba(244, 247, 242, 0.96);
      color: var(--brand-strong);
    }
    .detail-tab.active {
      background: linear-gradient(180deg, rgba(36, 79, 61, 0.12), rgba(36, 79, 61, 0.16));
      border-color: rgba(36, 79, 61, 0.24);
      color: var(--brand-strong);
      box-shadow: var(--shadow-soft);
    }
    .compact-note { padding: 0.9rem 1rem; border: 1px solid var(--border-subtle); border-radius: 1rem; background: color-mix(in srgb, var(--surface-strong) 90%, white); }
    .compact-note h4 { margin: 0 0 0.35rem; font-size: 0.95rem; }
    .compact-note p { margin: 0; color: var(--text-soft); }
    .structured-rca { border: 1px dashed var(--border-subtle); border-radius: 1rem; padding: 1rem; background: color-mix(in srgb, var(--surface-strong) 86%, white); }
    .comment-item p { margin: 0.45rem 0 0; color: var(--text-soft); line-height: 1.5; }
    tr[routerLink] { cursor: pointer; }
    @media (max-width: 1400px) { .ncr-filter-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    @media (max-width: 1100px) { .filter-grid, .ncr-filter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 760px) {
      .filter-grid, .ncr-filter-grid { grid-template-columns: minmax(0, 1fr); }
      .toggle-line { min-height: 3.5rem; }
    }
  `]
})
export class NcrPageComponent implements OnInit, OnChanges {
  @Input() forcedMode: PageMode | null = null;

  private readonly ncrApi = inject(NcrApiService);
  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
  protected readonly ncrs = signal<NcrRecord[]>([]);
  protected readonly selectedNcr = signal<NcrRecord | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly activeDetailTab = signal<'overview' | 'investigation' | 'actions' | 'verification' | 'comments' | 'activity'>('overview');
  protected readonly users = signal<UserOption[]>([]);
  protected readonly processOptions = signal<ProcessOption[]>([]);
  protected readonly ownerProcessFilterId = signal('');
  protected readonly comments = signal<NcrComment[]>([]);
  protected readonly activity = signal<NcrActivityItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly commentSaving = signal(false);
  protected readonly message = signal((history.state?.notice as string) || '');
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly statusFilter = signal('');
  protected readonly categoryFilter = signal('');
  protected readonly sourceFilter = signal('');
  protected readonly severityFilter = signal('');
  protected readonly ownerFilter = signal('');
  protected readonly statusOptions: NcrStatus[] = ['OPEN', 'UNDER_REVIEW', 'INVESTIGATION', 'ACTION_IN_PROGRESS', 'PENDING_VERIFICATION', 'CLOSED', 'ARCHIVED'];
  protected readonly categoryOptions: NcrCategory[] = ['PROCESS', 'PRODUCT', 'SERVICE', 'SUPPLIER', 'COMPLAINT'];
  protected readonly sourceOptions: NcrSource[] = ['INTERNAL', 'CUSTOMER', 'SUPPLIER', 'AUDIT'];
  protected readonly severityOptions: NcrSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  protected readonly priorityOptions: NcrPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  protected readonly rcaMethodOptions: NcrRcaMethod[] = ['FIVE_WHY', 'FISHBONE', 'IS_IS_NOT', 'OTHER'];
  protected readonly verificationOptions: NcrVerificationStatus[] = ['PENDING', 'VERIFIED', 'REJECTED'];
  protected readonly fiveWhySteps = ['Why 1', 'Why 2', 'Why 3', 'Why 4', 'Why 5'];
  protected readonly fishboneCategories = [
    { key: 'people', label: 'People' },
    { key: 'process', label: 'Process' },
    { key: 'equipment', label: 'Equipment' },
    { key: 'materials', label: 'Materials' },
    { key: 'environment', label: 'Environment' },
    { key: 'measurement', label: 'Measurement' }
  ] as const;
  protected readonly fiveWhyAnswers = signal(['', '', '', '', '']);
  protected readonly fishboneAnswers = signal<Record<string, string>>({
    people: '',
    process: '',
    equipment: '',
    materials: '',
    environment: '',
    measurement: ''
  });
  protected readonly form = this.fb.nonNullable.group({
    referenceNo: ['', [Validators.required, Validators.maxLength(40)]],
    title: ['', [Validators.required, Validators.maxLength(180)]],
    category: ['PROCESS' as NcrCategory, Validators.required],
    source: ['INTERNAL' as NcrSource, Validators.required],
    description: ['', [Validators.required, Validators.maxLength(4000)]],
    status: ['OPEN' as NcrStatus, Validators.required],
    severity: ['MEDIUM' as NcrSeverity, Validators.required],
    priority: ['MEDIUM' as NcrPriority, Validators.required],
    dateReported: [this.today(), Validators.required],
    reportedByUserId: [''],
    ownerUserId: [''],
    department: [''],
    location: [''],
    dueDate: [''],
    containmentAction: [''],
    investigationSummary: [''],
    rootCause: [''],
    rcaMethod: [''],
    correctiveActionSummary: [''],
    verificationStatus: ['PENDING' as NcrVerificationStatus, Validators.required],
    verifiedByUserId: [''],
    verificationDate: ['']
  });
  protected readonly commentForm = this.fb.nonNullable.group({
    message: ['', [Validators.required, Validators.maxLength(2000)]]
  });
  protected readonly filteredNcrs = computed(() => {
    const now = new Date();
    const term = this.search().trim().toLowerCase();
    return this.ncrs().filter((item) => {
      const matchesSearch = !term || [item.referenceNo, item.title, item.location || '', item.department || ''].some((value) => value.toLowerCase().includes(term));
      const overdue = !!item.dueDate && new Date(item.dueDate) < now && item.status !== 'CLOSED' && item.status !== 'ARCHIVED';
      const matchesStatus = !this.statusFilter() || (this.statusFilter() === 'OVERDUE' ? overdue : item.status === this.statusFilter());
      const matchesCategory = !this.categoryFilter() || item.category === this.categoryFilter();
      const matchesSource = !this.sourceFilter() || item.source === this.sourceFilter();
      const matchesSeverity = !this.severityFilter() || item.severity === this.severityFilter();
      const matchesOwner = !this.ownerFilter() || item.ownerUserId === this.ownerFilter();
      return matchesSearch && matchesStatus && matchesCategory && matchesSource && matchesSeverity && matchesOwner;
    }).sort((left, right) => this.compareNcrs(left, right));
  });

  ngOnInit() {
    this.loadUsers();
    this.loadProcesses();
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

  protected canRead() { return this.authStore.hasPermission('ncr.read'); }
  protected canWrite() { return this.authStore.hasPermission('ncr.write'); }
  protected pageTitle() { return { list: this.t('ncr.page.titleList'), create: this.t('ncr.page.titleCreate'), detail: this.selectedNcr()?.referenceNo || this.t('ncr.page.titleDetail'), edit: this.selectedNcr()?.referenceNo || this.t('ncr.page.titleEdit') }[this.mode()]; }
  protected pageDescription() { return { list: this.t('ncr.page.descriptionList'), create: this.t('ncr.page.descriptionCreate'), detail: this.t('ncr.page.descriptionDetail'), edit: this.t('ncr.page.descriptionEdit') }[this.mode()]; }
  protected breadcrumbs() {
    const crumbs: Array<{ label: string; link?: string }> = [{ label: this.t('ncr.common.label'), link: '/ncr' }];
    if (this.mode() === 'create') crumbs.push({ label: this.t('ncr.breadcrumbs.new') });
    if ((this.mode() === 'detail' || this.mode() === 'edit') && this.selectedNcr()) {
      crumbs.push({ label: this.selectedNcr()!.referenceNo, link: `/ncr/${this.selectedNcr()!.id}` });
      if (this.mode() === 'edit') crumbs.push({ label: this.t('ncr.breadcrumbs.edit') });
    }
    return crumbs;
  }
  protected editableStatusOptions() { return this.mode() === 'create' ? ['OPEN', 'UNDER_REVIEW', 'INVESTIGATION'] as NcrStatus[] : this.statusOptions; }
  protected countByStatus(status: NcrStatus) { return this.ncrs().filter((item) => item.status === status).length; }
  protected overdueCount() { const now = new Date(); return this.ncrs().filter((item) => item.dueDate && new Date(item.dueDate) < now && item.status !== 'CLOSED' && item.status !== 'ARCHIVED').length; }
  protected attentionLabel(item: NcrRecord) {
    const reasons = this.ncrAttentionReasons(item);
    if (!reasons.length) return this.t('ncr.attention.underControl');
    const first = this.attentionReasonLabel(reasons[0]);
    return reasons.length > 1 ? `${first} +${reasons.length - 1}` : first;
  }
  protected attentionClass(item: NcrRecord) {
    const reasons = this.ncrAttentionReasons(item);
    if (!reasons.length) return 'success';
    if (reasons.includes('Follow-up overdue') || reasons.includes('Verification overdue')) return 'danger';
    return 'warn';
  }
  protected attentionHeadline(record: NcrRecord | null) {
    return record && this.ncrAttentionReasons(record).length
      ? this.t('ncr.attention.headlines.needsAttention')
      : this.t('ncr.attention.headlines.underControl');
  }
  protected attentionNarrative(record: NcrRecord | null) {
    if (!record) return this.t('ncr.attention.narratives.unsaved');
    const reasons = this.ncrAttentionReasons(record);
    if (!reasons.length) {
      return this.t('ncr.attention.narratives.underControl');
    }
    return this.t('ncr.attention.narratives.needsAttention', {
      reasons: reasons.map((reason) => this.attentionReasonLabel(reason).toLowerCase()).join(', ')
    });
  }
  protected availableTransitions() { const current = this.selectedNcr()?.status; return current ? NEXT_STATUS_OPTIONS[current] : []; }
  protected canDeleteNcr() { const item = this.selectedNcr(); return this.authStore.hasPermission('admin.delete') && !!item && item.status !== 'CLOSED' && item.status !== 'ARCHIVED'; }
  protected canArchiveNcr() { const item = this.selectedNcr(); return this.authStore.hasPermission('admin.delete') && !!item && item.status !== 'ARCHIVED' && item.status !== 'OPEN'; }
  protected canDeleteRow(item: NcrRecord) { return this.authStore.hasPermission('admin.delete') && item.status !== 'CLOSED' && item.status !== 'ARCHIVED'; }
  protected canArchiveRow(item: NcrRecord) { return this.authStore.hasPermission('admin.delete') && item.status !== 'ARCHIVED' && item.status !== 'OPEN'; }
  protected showAdminRowActions() { return this.authStore.hasPermission('admin.delete'); }
  protected t(key: string, params?: Record<string, unknown>) { return this.i18n.t(key, params); }
  protected fullName(user: NcrUserSummary) { return `${user.firstName} ${user.lastName}`.trim(); }
  protected processLabel(process: ProcessOption) { return `${process.referenceNo || this.t('ncr.common.uncoded')} - ${process.name}`; }
  protected labelize(value: string) {
    const map: Record<string, string> = {
      OPEN: 'ncr.enums.status.OPEN',
      UNDER_REVIEW: 'ncr.enums.status.UNDER_REVIEW',
      INVESTIGATION: 'ncr.enums.status.INVESTIGATION',
      ACTION_IN_PROGRESS: 'ncr.enums.status.ACTION_IN_PROGRESS',
      PENDING_VERIFICATION: 'ncr.enums.status.PENDING_VERIFICATION',
      CLOSED: 'ncr.enums.status.CLOSED',
      ARCHIVED: 'ncr.enums.status.ARCHIVED',
      PROCESS: 'ncr.enums.category.PROCESS',
      PRODUCT: 'ncr.enums.category.PRODUCT',
      SERVICE: 'ncr.enums.category.SERVICE',
      SUPPLIER: 'ncr.enums.category.SUPPLIER',
      COMPLAINT: 'ncr.enums.category.COMPLAINT',
      INTERNAL: 'ncr.enums.source.INTERNAL',
      CUSTOMER: 'ncr.enums.source.CUSTOMER',
      AUDIT: 'ncr.enums.source.AUDIT',
      LOW: 'ncr.enums.level.LOW',
      MEDIUM: 'ncr.enums.level.MEDIUM',
      HIGH: 'ncr.enums.level.HIGH',
      CRITICAL: 'ncr.enums.level.CRITICAL',
      URGENT: 'ncr.enums.level.URGENT',
      FIVE_WHY: 'ncr.enums.rca.FIVE_WHY',
      FISHBONE: 'ncr.enums.rca.FISHBONE',
      IS_IS_NOT: 'ncr.enums.rca.IS_IS_NOT',
      OTHER: 'ncr.enums.rca.OTHER',
      PENDING: 'ncr.enums.verification.PENDING',
      VERIFIED: 'ncr.enums.verification.VERIFIED',
      REJECTED: 'ncr.enums.verification.REJECTED'
    };
    const key = map[value];
    return key ? this.t(key) : value.toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }
  protected statusClass(status: NcrStatus) { if (status === 'CLOSED') return 'success'; if (status === 'ARCHIVED') return 'neutral'; if (status === 'PENDING_VERIFICATION' || status === 'UNDER_REVIEW') return 'warn'; return 'attention'; }
  protected severityClass(severity: NcrSeverity) { if (severity === 'CRITICAL') return 'danger'; if (severity === 'HIGH') return 'warn'; if (severity === 'LOW') return 'neutral'; return 'attention'; }
  protected activityLabel(action: string) { return action.replace(/^ncr\./, '').split('.').map((part) => this.labelize(part)).join(' '); }
  protected readInput(event: Event) { return (event.target as HTMLInputElement).value; }
  protected readSelect(event: Event) { return (event.target as HTMLSelectElement).value; }
  protected setDetailTab(tab: 'overview' | 'investigation' | 'actions' | 'verification' | 'comments' | 'activity') { this.activeDetailTab.set(tab); }
  protected primaryWorkflowTab() {
    const record = this.selectedNcr();
    if (!record) return 'investigation' as const;
    if (record.status === 'OPEN' || record.status === 'UNDER_REVIEW' || record.status === 'INVESTIGATION') {
      return 'investigation' as const;
    }
    if (record.status === 'ACTION_IN_PROGRESS') {
      return 'actions' as const;
    }
    if (record.status === 'PENDING_VERIFICATION') {
      return 'verification' as const;
    }
    return 'overview' as const;
  }
  protected primaryWorkflowButtonLabel() {
    const tab = this.primaryWorkflowTab();
    if (tab === 'investigation') return this.t('ncr.actions.continueInvestigation');
    if (tab === 'actions') return this.t('ncr.actions.reviewFollowUpActions');
    if (tab === 'verification') return this.t('ncr.actions.openVerification');
    return this.t('ncr.actions.reviewOverview');
  }
  protected selectedRcaMethod() { return this.form.getRawValue().rcaMethod as NcrRcaMethod | ''; }
  protected ownerOptions() {
    const processId = this.ownerProcessFilterId();
    if (!processId) {
      return this.users();
    }
    const process = this.processOptions().find((item) => item.id === processId);
    if (!process?.ownerUserId) {
      return this.users();
    }
    return this.users().filter((user) => user.id === process.ownerUserId);
  }
  protected ownerFilterCopy() {
    const processId = this.ownerProcessFilterId();
    if (!processId) {
      return this.t('ncr.guidance.ownerFilterDefault');
    }
    const process = this.processOptions().find((item) => item.id === processId);
    return process?.owner
      ? this.t('ncr.guidance.ownerFilterScoped', { owner: this.fullName(process.owner), process: process.name })
      : this.t('ncr.guidance.ownerFilterNoOwner');
  }
  protected ncrNextStepsCopy() {
    const record = this.selectedNcr();
    if (!record) {
      return this.mode() === 'create'
        ? this.t('ncr.nextSteps.create')
        : this.t('ncr.nextSteps.edit');
    }
    if (record.status === 'OPEN' || record.status === 'UNDER_REVIEW') {
      return this.t('ncr.nextSteps.initial');
    }
    if (record.status === 'INVESTIGATION' || record.status === 'ACTION_IN_PROGRESS') {
      return this.t('ncr.nextSteps.actioning');
    }
    if (record.status === 'PENDING_VERIFICATION') {
      return this.t('ncr.nextSteps.verification');
    }
    return this.t('ncr.nextSteps.closed');
  }
  protected ncrStageLabel(status: NcrStatus) {
    if (status === 'OPEN' || status === 'UNDER_REVIEW') return this.t('ncr.stage.raised');
    if (status === 'INVESTIGATION') return this.t('ncr.stage.investigating');
    if (status === 'ACTION_IN_PROGRESS') return this.t('ncr.stage.correcting');
    if (status === 'PENDING_VERIFICATION') return this.t('ncr.stage.verifying');
    if (status === 'CLOSED') return this.t('ncr.stage.closed');
    return this.t('ncr.stage.archived');
  }
  protected ncrWorkflowHeading(status: NcrStatus) {
    if (status === 'OPEN' || status === 'UNDER_REVIEW') return this.t('ncr.workflow.heading.initial');
    if (status === 'INVESTIGATION') return this.t('ncr.workflow.heading.investigation');
    if (status === 'ACTION_IN_PROGRESS') return this.t('ncr.workflow.heading.correctiveAction');
    if (status === 'PENDING_VERIFICATION') return this.t('ncr.workflow.heading.verification');
    if (status === 'CLOSED') return this.t('ncr.workflow.heading.closed');
    return this.t('ncr.workflow.heading.archived');
  }
  protected ncrWorkflowGuidance(status: NcrStatus) {
    if (status === 'OPEN' || status === 'UNDER_REVIEW') {
      return this.t('ncr.workflow.guidance.initial');
    }
    if (status === 'INVESTIGATION') {
      return this.t('ncr.workflow.guidance.investigation');
    }
    if (status === 'ACTION_IN_PROGRESS') {
      return this.t('ncr.workflow.guidance.correctiveAction');
    }
    if (status === 'PENDING_VERIFICATION') {
      return this.t('ncr.workflow.guidance.verification');
    }
    if (status === 'CLOSED') {
      return this.t('ncr.workflow.guidance.closed');
    }
    return this.t('ncr.workflow.guidance.archived');
  }
  protected verificationHeading(status: NcrVerificationStatus) {
    if (status === 'VERIFIED') return this.t('ncr.verification.heading.verified');
    if (status === 'REJECTED') return this.t('ncr.verification.heading.rejected');
    return this.t('ncr.verification.heading.pending');
  }
  protected verificationGuidance(status: NcrVerificationStatus) {
    if (status === 'VERIFIED') {
      return this.t('ncr.verification.guidance.verified');
    }
    if (status === 'REJECTED') {
      return this.t('ncr.verification.guidance.rejected');
    }
    return this.t('ncr.verification.guidance.pending');
  }
  protected ncrFollowUpSummary(record: NcrRecord | null) {
    if (!record || !record.dueDate || record.status === 'CLOSED' || record.status === 'ARCHIVED') {
      return null;
    }

    const dueDate = new Date(record.dueDate);
    const today = new Date();
    const diffDays = Math.floor((dueDate.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);

    if (diffDays < 0) {
      return {
        heading: this.t('ncr.followUp.overdueHeading'),
        copy: this.t('ncr.followUp.overdueCopy', { dueDate: record.dueDate.slice(0, 10) })
      };
    }

    if (diffDays <= 14) {
      return {
        heading: this.t('ncr.followUp.approachingHeading'),
        copy: this.t('ncr.followUp.approachingCopy', { dueDate: record.dueDate.slice(0, 10) })
      };
    }

    if (record.status === 'PENDING_VERIFICATION' && record.verificationStatus === 'PENDING') {
      return {
        heading: this.t('ncr.followUp.verificationHeading'),
        copy: this.t('ncr.followUp.verificationCopy')
      };
    }

    return null;
  }
  private ncrAttentionReasons(record: NcrRecord) {
    if (record.status === 'CLOSED' || record.status === 'ARCHIVED') {
      return [];
    }
    const reasons: string[] = [];
    if (!record.ownerUserId) {
      reasons.push('Owner needed');
    }
    if (record.dueDate && new Date(record.dueDate) < new Date()) {
      reasons.push('Follow-up overdue');
    }
    if (record.status === 'PENDING_VERIFICATION' && record.verificationStatus === 'PENDING') {
      reasons.push('Verification overdue');
    }
    const updated = new Date(record.updatedAt);
    const days = (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24);
    if (days > 45) {
      reasons.push('Stale');
    }
    return reasons;
  }
  protected setOwnerProcessFilter(processId: string) {
    this.ownerProcessFilterId.set(processId);
    const currentOwnerId = this.form.getRawValue().ownerUserId;
    if (currentOwnerId && !this.ownerOptions().some((user) => user.id === currentOwnerId)) {
      this.form.patchValue({ ownerUserId: '' });
    }
  }
  protected updateFiveWhy(index: number, event: Event) {
    const next = [...this.fiveWhyAnswers()];
    next[index] = this.readInput(event);
    this.fiveWhyAnswers.set(next);
  }
  protected updateFishbone(key: string, event: Event) {
    this.fishboneAnswers.set({ ...this.fishboneAnswers(), [key]: this.readInput(event) });
  }

  protected save() {
    if (this.form.invalid || !this.canWrite()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    const payload = this.toPayload();
    const request = this.mode() === 'edit' && this.selectedId() ? this.ncrApi.update(this.selectedId() as string, payload) : this.ncrApi.create(payload);
    request.subscribe({
      next: (record) => {
        this.saving.set(false);
        void this.router.navigate(['/ncr', record.id], { state: { notice: this.mode() === 'edit' ? this.t('ncr.messages.updated') : this.t('ncr.messages.created') } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, this.t('ncr.messages.saveFailed')));
      }
    });
  }

  protected addComment() {
    if (this.commentForm.invalid || !this.selectedId() || !this.canWrite()) {
      this.commentForm.markAllAsTouched();
      return;
    }
    this.commentSaving.set(true);
    this.error.set('');
    this.ncrApi.addComment(this.selectedId() as string, this.commentForm.getRawValue().message.trim()).subscribe({
      next: (comment) => {
        this.commentSaving.set(false);
        this.commentForm.reset({ message: '' });
        this.comments.set([...this.comments(), comment]);
        this.message.set(this.t('ncr.messages.commentAdded'));
        this.fetchActivity(this.selectedId() as string);
        this.fetchNcr(this.selectedId() as string);
      },
      error: (error: HttpErrorResponse) => {
        this.commentSaving.set(false);
        this.error.set(this.readError(error, this.t('ncr.messages.commentSaveFailed')));
      }
    });
  }

  protected changeStatus(status: NcrStatus) { this.patchCurrent({ status }, this.t('ncr.messages.movedTo', { status: this.labelize(status) }), this.t('ncr.messages.statusUpdateFailed')); }
  protected archiveCurrent() { this.patchCurrent({ status: 'ARCHIVED' }, this.t('ncr.messages.archived'), this.t('ncr.messages.archiveFailed')); }

  protected deleteCurrent() {
    if (!this.selectedId() || !this.canDeleteNcr() || !window.confirm(this.t('ncr.messages.deleteConfirmCurrent'))) {
      return;
    }
    this.ncrApi.remove(this.selectedId() as string).subscribe({
      next: () => void this.router.navigate(['/ncr'], { state: { notice: this.t('ncr.messages.deleted') } }),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, this.t('ncr.messages.deleteFailed')))
    });
  }

  protected archiveRow(item: NcrRecord) {
    if (!this.canArchiveRow(item) || !window.confirm(this.t('ncr.messages.archiveConfirmRow', { referenceNo: item.referenceNo }))) {
      return;
    }
    this.ncrApi.update(item.id, { status: 'ARCHIVED' }).subscribe({
      next: () => {
        this.message.set(this.t('ncr.messages.archived'));
        this.reloadNcrs();
      },
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, this.t('ncr.messages.archiveFailed')))
    });
  }

  protected deleteRow(item: NcrRecord) {
    if (!this.canDeleteRow(item) || !window.confirm(this.t('ncr.messages.deleteConfirmRow', { referenceNo: item.referenceNo }))) {
      return;
    }
    this.ncrApi.remove(item.id).subscribe({
      next: () => {
        this.message.set(this.t('ncr.messages.deleted'));
        this.reloadNcrs();
      },
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, this.t('ncr.messages.deleteFailed')))
    });
  }

  private handleRoute(params: ParamMap) {
    const id = params.get('id');
    this.selectedId.set(id);
    this.activeDetailTab.set('overview');
    if (this.mode() === 'list') {
      this.selectedNcr.set(null);
      this.comments.set([]);
      this.activity.set([]);
      if (this.canRead()) {
        this.reloadNcrs();
      }
      return;
    }
    if (!id) {
      if (this.mode() === 'create') {
        this.resetForm();
      }
      return;
    }
    this.fetchNcr(id);
    if (this.mode() === 'detail') {
      this.fetchComments(id);
      this.fetchActivity(id);
    }
  }

  private reloadNcrs() {
    this.loading.set(true);
    this.error.set('');
    this.ncrApi.list().subscribe({
      next: (records) => {
        this.loading.set(false);
        this.ncrs.set(records);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, this.t('ncr.messages.loadListFailed')));
      }
    });
  }

  private fetchNcr(id: string) {
    this.loading.set(true);
    this.error.set('');
    this.ncrApi.get(id).subscribe({
      next: (record) => {
        this.loading.set(false);
        this.selectedNcr.set(record);
        if (this.mode() === 'edit') {
          this.patchForm(record);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, this.t('ncr.messages.loadDetailFailed')));
      }
    });
  }

  private fetchComments(id: string) {
    this.ncrApi.listComments(id).subscribe({
      next: (comments) => this.comments.set(comments),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, this.t('ncr.messages.loadCommentsFailed')))
    });
  }

  private fetchActivity(id: string) {
    this.ncrApi.activity(id).subscribe({
      next: (items) => this.activity.set(items),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, this.t('ncr.messages.loadActivityFailed')))
    });
  }

  private loadUsers() {
    this.api.get<UserOption[]>('users').subscribe((users) => this.users.set(users));
  }

  private loadProcesses() {
    this.api.get<ProcessOption[]>('process-register').subscribe({
      next: (processes) => this.processOptions.set(processes.filter((process) => process.status !== 'ARCHIVED')),
      error: () => this.processOptions.set([])
    });
  }

  private patchForm(record: NcrRecord) {
    this.ownerProcessFilterId.set('');
    this.form.patchValue({
      referenceNo: record.referenceNo,
      title: record.title,
      category: record.category,
      source: record.source,
      description: record.description,
      status: record.status,
      severity: record.severity,
      priority: record.priority,
      dateReported: record.dateReported?.slice(0, 10) || this.today(),
      reportedByUserId: record.reportedByUserId || '',
      ownerUserId: record.ownerUserId || '',
      department: record.department || '',
      location: record.location || '',
      dueDate: record.dueDate?.slice(0, 10) || '',
      containmentAction: record.containmentAction || '',
      investigationSummary: record.investigationSummary || '',
      rootCause: record.rootCause || '',
      rcaMethod: record.rcaMethod || '',
      correctiveActionSummary: record.correctiveActionSummary || '',
      verificationStatus: record.verificationStatus,
      verifiedByUserId: record.verifiedByUserId || '',
      verificationDate: record.verificationDate?.slice(0, 10) || ''
    }, { emitEvent: false });
    this.fiveWhyAnswers.set(['', '', '', '', '']);
    this.fishboneAnswers.set({ people: '', process: '', equipment: '', materials: '', environment: '', measurement: '' });
  }

  private resetForm() {
    this.ownerProcessFilterId.set('');
    this.form.reset({
      referenceNo: '',
      title: '',
      category: 'PROCESS',
      source: 'INTERNAL',
      description: '',
      status: 'OPEN',
      severity: 'MEDIUM',
      priority: 'MEDIUM',
      dateReported: this.today(),
      reportedByUserId: '',
      ownerUserId: '',
      department: '',
      location: '',
      dueDate: '',
      containmentAction: '',
      investigationSummary: '',
      rootCause: '',
      rcaMethod: '',
      correctiveActionSummary: '',
      verificationStatus: 'PENDING',
      verifiedByUserId: '',
      verificationDate: ''
    });
    this.fiveWhyAnswers.set(['', '', '', '', '']);
    this.fishboneAnswers.set({ people: '', process: '', equipment: '', materials: '', environment: '', measurement: '' });
  }

  private patchCurrent(payload: Partial<NcrUpsertPayload>, successMessage: string, fallback: string) {
    if (!this.selectedId()) {
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.ncrApi.update(this.selectedId() as string, payload).subscribe({
      next: (record) => {
        this.saving.set(false);
        this.selectedNcr.set(record);
        this.message.set(successMessage);
        this.reloadNcrs();
        this.fetchActivity(record.id);
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, fallback));
      }
    });
  }

  private toPayload(): NcrUpsertPayload {
    const raw = this.form.getRawValue();
    return {
      referenceNo: raw.referenceNo.trim(),
      title: raw.title.trim(),
      category: raw.category,
      source: raw.source,
      description: raw.description.trim(),
      status: raw.status,
      severity: raw.severity,
      priority: raw.priority,
      dateReported: raw.dateReported,
      reportedByUserId: raw.reportedByUserId || undefined,
      ownerUserId: raw.ownerUserId || undefined,
      department: raw.department.trim() || undefined,
      location: raw.location.trim() || undefined,
      dueDate: raw.dueDate || undefined,
      containmentAction: raw.containmentAction.trim() || undefined,
      investigationSummary: raw.investigationSummary.trim() || undefined,
      rootCause: (raw.rootCause.trim() || this.structuredRootCauseSummary()) || undefined,
      rcaMethod: (raw.rcaMethod as NcrRcaMethod) || undefined,
      correctiveActionSummary: raw.correctiveActionSummary.trim() || undefined,
      verificationStatus: raw.verificationStatus,
      verifiedByUserId: raw.verifiedByUserId || undefined,
      verificationDate: raw.verificationDate || undefined
    };
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }

  private today() {
    return new Date().toISOString().slice(0, 10);
  }

  private compareNcrs(left: NcrRecord, right: NcrRecord) {
    return (
      this.ncrAttentionRank(left) - this.ncrAttentionRank(right) ||
      this.compareOptionalDateAsc(left.dueDate, right.dueDate) ||
      this.compareDateDesc(left.dateReported, right.dateReported) ||
      this.compareDateDesc(left.updatedAt, right.updatedAt)
    );
  }

  private ncrAttentionRank(record: NcrRecord) {
    const reasons = this.ncrAttentionReasons(record);
    if (reasons.includes('Follow-up overdue')) return 0;
    if (reasons.includes('Verification overdue')) return 1;
    if (reasons.includes('Owner needed')) return 2;
    if (reasons.includes('Stale')) return 3;
    if (record.status !== 'CLOSED' && record.status !== 'ARCHIVED') return 4;
    if (record.status === 'CLOSED') return 5;
    return 6;
  }

  private attentionReasonLabel(reason: string) {
    const map: Record<string, string> = {
      'Owner needed': 'ncr.attention.reasons.ownerNeeded',
      'Follow-up overdue': 'ncr.attention.reasons.followUpOverdue',
      'Verification overdue': 'ncr.attention.reasons.verificationOverdue',
      Stale: 'ncr.attention.reasons.stale'
    };
    return map[reason] ? this.t(map[reason]) : reason;
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

  private structuredRootCauseSummary() {
    if (this.selectedRcaMethod() === 'FIVE_WHY') {
      const answered = this.fiveWhyAnswers()
        .map((value, index) => ({ label: this.fiveWhySteps[index], value: value.trim() }))
        .filter((item) => item.value);
      return answered.length ? answered.map((item) => `${item.label}: ${item.value}`).join('\n') : '';
    }

    if (this.selectedRcaMethod() === 'FISHBONE') {
      const answered = this.fishboneCategories
        .map((group) => ({ label: group.label, value: (this.fishboneAnswers()[group.key] || '').trim() }))
        .filter((item) => item.value);
      return answered.length ? answered.map((item) => `${item.label}: ${item.value}`).join('\n') : '';
    }

    return '';
  }
}

@Component({ standalone: true, imports: [NcrPageComponent], template: `<iso-ncr-page [forcedMode]="'list'" />` })
export class NcrRegisterPageComponent {}

@Component({ standalone: true, imports: [NcrPageComponent], template: `<iso-ncr-page [forcedMode]="'create'" />` })
export class NcrCreatePageComponent {}

@Component({ standalone: true, imports: [NcrPageComponent], template: `<iso-ncr-page [forcedMode]="'detail'" />` })
export class NcrDetailPageComponent {}

@Component({ standalone: true, imports: [NcrPageComponent], template: `<iso-ncr-page [forcedMode]="'edit'" />` })
export class NcrEditPageComponent {}
