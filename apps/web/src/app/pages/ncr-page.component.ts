import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnInit, SimpleChanges, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
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
      <iso-page-header [label]="'NCR'" [title]="pageTitle()" [description]="pageDescription()" [breadcrumbs]="breadcrumbs()">
        <a *ngIf="mode() === 'list' && canWrite()" routerLink="/ncr/new" class="button-link">+ New NCR</a>
        <a *ngIf="mode() === 'detail' && selectedNcr() && canWrite()" [routerLink]="['/ncr', selectedNcr()?.id, 'edit']" class="button-link">Edit NCR</a>
        <button *ngIf="mode() === 'detail' && canArchiveNcr()" type="button" class="button-link secondary" (click)="archiveCurrent()">Archive NCR</button>
        <button *ngIf="mode() === 'detail' && canDeleteNcr()" type="button" class="button-link danger" (click)="deleteCurrent()">Delete NCR</button>
        <a *ngIf="mode() !== 'list'" routerLink="/ncr" class="button-link secondary">Back to NCR log</a>
      </iso-page-header>

      <section *ngIf="!canRead()" class="card list-card">
        <div class="empty-state">
          <strong>NCR access is not available</strong>
          <span>Your current role does not include ncr.read.</span>
        </div>
      </section>

      <section *ngIf="canRead() && mode() === 'list'" class="page-stack">
        <div class="card list-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">NCR log</span>
              <h3>Nonconformance log</h3>
              <p class="subtle">NCR records the nonconformance first, then keeps the investigation, action follow-up, and verification trail together.</p>
            </div>
          </div>

          <div class="toolbar top-space">
            <div class="toolbar-meta">
              <div>
                <p class="toolbar-title">Filter NCRs</p>
                <p class="toolbar-copy">Filter by status, category, source, severity, or owner.</p>
              </div>
              <div class="toolbar-stats">
                <article class="toolbar-stat"><span>Total</span><strong>{{ ncrs().length }}</strong></article>
                <article class="toolbar-stat"><span>Open</span><strong>{{ countByStatus('OPEN') }}</strong></article>
                <article class="toolbar-stat"><span>Overdue</span><strong>{{ overdueCount() }}</strong></article>
              </div>
            </div>

            <div class="filter-grid ncr-filter-grid">
              <label class="field compact-field search-field">
                <span>Search</span>
                <input [value]="search()" (input)="search.set(readInput($event))" placeholder="Reference or title">
              </label>
              <label class="field compact-field">
                <span>Status</span>
                <select [value]="statusFilter()" (change)="statusFilter.set(readSelect($event))">
                  <option value="">All statuses</option>
                  <option value="OVERDUE">Overdue</option>
                  <option *ngFor="let item of statusOptions" [value]="item">{{ labelize(item) }}</option>
                </select>
              </label>
              <label class="field compact-field">
                <span>Category</span>
                <select [value]="categoryFilter()" (change)="categoryFilter.set(readSelect($event))">
                  <option value="">All categories</option>
                  <option *ngFor="let item of categoryOptions" [value]="item">{{ labelize(item) }}</option>
                </select>
              </label>
              <label class="field compact-field">
                <span>Source</span>
                <select [value]="sourceFilter()" (change)="sourceFilter.set(readSelect($event))">
                  <option value="">All sources</option>
                  <option *ngFor="let item of sourceOptions" [value]="item">{{ labelize(item) }}</option>
                </select>
              </label>
              <label class="field compact-field">
                <span>Severity</span>
                <select [value]="severityFilter()" (change)="severityFilter.set(readSelect($event))">
                  <option value="">All severities</option>
                  <option *ngFor="let item of severityOptions" [value]="item">{{ labelize(item) }}</option>
                </select>
              </label>
              <label class="field compact-field">
                <span>Owner</span>
                <select [value]="ownerFilter()" (change)="ownerFilter.set(readSelect($event))">
                  <option value="">All owners</option>
                  <option *ngFor="let item of users()" [value]="item.id">{{ fullName(item) }}</option>
                </select>
              </label>
            </div>
          </div>

          <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <div class="empty-state" *ngIf="loading()">
            <strong>Loading NCR log</strong>
            <span>Refreshing tenant nonconformance records.</span>
          </div>

          <div class="empty-state top-space" *ngIf="!loading() && !filteredNcrs().length">
            <strong>No NCR records match the current filter</strong>
            <span>Adjust the filters or create the first NCR entry for this tenant.</span>
          </div>

          <div class="data-table-wrap" *ngIf="!loading() && filteredNcrs().length">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Category</th>
                  <th>Source</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Due date</th>
                  <th>Updated</th>
                  <th>Attention</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of filteredNcrs()" [routerLink]="['/ncr', item.id]">
                  <td><div class="table-title"><strong>{{ item.referenceNo }}</strong><small>{{ item.title }}</small></div></td>
                  <td>{{ labelize(item.category) }}</td>
                  <td>{{ labelize(item.source) }}</td>
                  <td><span class="status-badge" [ngClass]="severityClass(item.severity)">{{ labelize(item.severity) }}</span></td>
                  <td><span class="status-badge" [ngClass]="statusClass(item.status)">{{ labelize(item.status) }}</span></td>
                  <td>{{ item.owner ? fullName(item.owner) : 'Unassigned' }}</td>
                  <td>{{ item.dueDate ? (item.dueDate | date:'yyyy-MM-dd') : 'Not set' }}</td>
                  <td>{{ item.updatedAt | date:'yyyy-MM-dd' }}</td>
                  <td><span class="status-badge" [ngClass]="attentionClass(item)">{{ attentionLabel(item) }}</span></td>
                  <td>
                    <div class="inline-actions" (click)="$event.stopPropagation()">
                      <iso-icon-action-button [icon]="'view'" [label]="'View NCR'" [routerLink]="['/ncr', item.id]" />
                      <iso-icon-action-button *ngIf="canWrite()" [icon]="'edit'" [label]="'Edit NCR'" [routerLink]="['/ncr', item.id, 'edit']" />
                      <iso-icon-action-button
                        *ngIf="showAdminRowActions()"
                        [icon]="'archive'"
                        [label]="canArchiveRow(item) ? 'Archive NCR' : 'Archive unavailable'"
                        [disabled]="!canArchiveRow(item)"
                        (pressed)="archiveRow(item)"
                      />
                      <iso-icon-action-button
                        *ngIf="showAdminRowActions()"
                        [icon]="'delete'"
                        [label]="canDeleteRow(item) ? 'Delete NCR' : 'Delete unavailable'"
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
              <a *ngIf="selectedId()" [routerLink]="['/ncr', selectedId()]" class="button-link secondary">Review NCR</a>
              <a routerLink="/ncr" class="button-link tertiary">Review NCR log</a>
            </div>
          </section>

          <section class="detail-section">
            <h4>Overview</h4>
            <div class="form-grid-2 top-space">
              <label class="field"><span>Reference no.</span><input formControlName="referenceNo" placeholder="NCR-2026-001"></label>
              <label class="field"><span>Title</span><input formControlName="title" placeholder="Unapproved process change"></label>
            </div>
            <div class="form-grid-3 top-space">
              <label class="field"><span>Category</span><select formControlName="category"><option *ngFor="let item of categoryOptions" [value]="item">{{ labelize(item) }}</option></select></label>
              <label class="field"><span>Source</span><select formControlName="source"><option *ngFor="let item of sourceOptions" [value]="item">{{ labelize(item) }}</option></select></label>
              <label class="field"><span>Status</span><select formControlName="status"><option *ngFor="let item of editableStatusOptions()" [value]="item">{{ labelize(item) }}</option></select></label>
            </div>
            <label class="field top-space"><span>Description</span><textarea rows="4" formControlName="description" placeholder="Describe what happened and what requirement was missed"></textarea></label>
            <div class="form-grid-3 top-space">
              <label class="field"><span>Severity</span><select formControlName="severity"><option *ngFor="let item of severityOptions" [value]="item">{{ labelize(item) }}</option></select></label>
              <label class="field"><span>Priority</span><select formControlName="priority"><option *ngFor="let item of priorityOptions" [value]="item">{{ labelize(item) }}</option></select></label>
              <label class="field"><span>Date reported</span><input type="date" formControlName="dateReported"></label>
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
            <button type="submit" [disabled]="form.invalid || saving() || !canWrite()">{{ saving() ? 'Saving...' : 'Save NCR' }}</button>
            <a [routerLink]="selectedId() ? ['/ncr', selectedId()] : ['/ncr']" class="button-link secondary">Cancel</a>
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
                <span class="section-eyebrow">Workflow</span>
                <h3>NCR workflow</h3>
                <p class="subtle">Work from investigation to task follow-up and then formal verification before closure.</p>
              </div>
            </div>

            <nav class="detail-tabs top-space" aria-label="NCR detail sections">
              <button type="button" class="detail-tab" [class.active]="activeDetailTab() === 'overview'" (click)="setDetailTab('overview')">Overview</button>
              <button type="button" class="detail-tab" [class.active]="activeDetailTab() === 'investigation'" (click)="setDetailTab('investigation')">Investigation</button>
              <button type="button" class="detail-tab" [class.active]="activeDetailTab() === 'actions'" (click)="setDetailTab('actions')">Follow-up actions</button>
              <button type="button" class="detail-tab" [class.active]="activeDetailTab() === 'verification'" (click)="setDetailTab('verification')">Verification</button>
              <button type="button" class="detail-tab" [class.active]="activeDetailTab() === 'comments'" (click)="setDetailTab('comments')">Comments</button>
              <button type="button" class="detail-tab" [class.active]="activeDetailTab() === 'activity'" (click)="setDetailTab('activity')">Activity & evidence</button>
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
  protected pageTitle() { return { list: 'Nonconformance log', create: 'Raise NCR', detail: this.selectedNcr()?.referenceNo || 'NCR detail', edit: this.selectedNcr()?.referenceNo || 'Edit NCR' }[this.mode()]; }
  protected pageDescription() { return { list: 'Use NCR to record the nonconformance, who owns it, what follow-up is needed, and whether verification is complete.', create: 'Capture the nonconformance first, then continue the investigation and corrective trail from the record.', detail: 'Review the nonconformance, investigation, follow-up actions, verification, comments, attachments, and activity.', edit: 'Update the NCR while keeping the investigation and verification trail clear.' }[this.mode()]; }
  protected breadcrumbs() {
    const crumbs: Array<{ label: string; link?: string }> = [{ label: 'NCR', link: '/ncr' }];
    if (this.mode() === 'create') crumbs.push({ label: 'New NCR' });
    if ((this.mode() === 'detail' || this.mode() === 'edit') && this.selectedNcr()) {
      crumbs.push({ label: this.selectedNcr()!.referenceNo, link: `/ncr/${this.selectedNcr()!.id}` });
      if (this.mode() === 'edit') crumbs.push({ label: 'Edit' });
    }
    return crumbs;
  }
  protected editableStatusOptions() { return this.mode() === 'create' ? ['OPEN', 'UNDER_REVIEW', 'INVESTIGATION'] as NcrStatus[] : this.statusOptions; }
  protected countByStatus(status: NcrStatus) { return this.ncrs().filter((item) => item.status === status).length; }
  protected overdueCount() { const now = new Date(); return this.ncrs().filter((item) => item.dueDate && new Date(item.dueDate) < now && item.status !== 'CLOSED' && item.status !== 'ARCHIVED').length; }
  protected attentionLabel(item: NcrRecord) {
    const reasons = this.ncrAttentionReasons(item);
    if (!reasons.length) return 'Under control';
    return reasons.length > 1 ? `${reasons[0]} +${reasons.length - 1}` : reasons[0];
  }
  protected attentionClass(item: NcrRecord) {
    const reasons = this.ncrAttentionReasons(item);
    if (!reasons.length) return 'success';
    if (reasons.includes('Follow-up overdue') || reasons.includes('Verification overdue')) return 'danger';
    return 'warn';
  }
  protected attentionHeadline(record: NcrRecord | null) {
    return record && this.ncrAttentionReasons(record).length
      ? 'This NCR currently needs management attention.'
      : 'This NCR is currently under control.';
  }
  protected attentionNarrative(record: NcrRecord | null) {
    if (!record) return 'Attention guidance appears after the NCR is saved.';
    const reasons = this.ncrAttentionReasons(record);
    if (!reasons.length) {
      return 'Ownership, due date, verification state, and current NCR stage are controlled enough for routine follow-up.';
    }
    return `Attention is needed because ${reasons.map((reason) => reason.toLowerCase()).join(', ')}.`;
  }
  protected availableTransitions() { const current = this.selectedNcr()?.status; return current ? NEXT_STATUS_OPTIONS[current] : []; }
  protected canDeleteNcr() { const item = this.selectedNcr(); return this.authStore.hasPermission('admin.delete') && !!item && item.status !== 'CLOSED' && item.status !== 'ARCHIVED'; }
  protected canArchiveNcr() { const item = this.selectedNcr(); return this.authStore.hasPermission('admin.delete') && !!item && item.status !== 'ARCHIVED' && item.status !== 'OPEN'; }
  protected canDeleteRow(item: NcrRecord) { return this.authStore.hasPermission('admin.delete') && item.status !== 'CLOSED' && item.status !== 'ARCHIVED'; }
  protected canArchiveRow(item: NcrRecord) { return this.authStore.hasPermission('admin.delete') && item.status !== 'ARCHIVED' && item.status !== 'OPEN'; }
  protected showAdminRowActions() { return this.authStore.hasPermission('admin.delete'); }
  protected fullName(user: NcrUserSummary) { return `${user.firstName} ${user.lastName}`.trim(); }
  protected processLabel(process: ProcessOption) { return `${process.referenceNo || 'Uncoded'} - ${process.name}`; }
  protected labelize(value: string) { return value.toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '); }
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
    if (tab === 'investigation') return 'Continue investigation';
    if (tab === 'actions') return 'Review follow-up actions';
    if (tab === 'verification') return 'Open verification';
    return 'Review overview';
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
      return 'Select a process if you want to suggest the process owner as the most likely NCR owner.';
    }
    const process = this.processOptions().find((item) => item.id === processId);
    return process?.owner
      ? `Owner options are narrowed to ${this.fullName(process.owner)} from ${process.name}.`
      : 'This process does not have an assigned process owner yet, so all users remain available.';
  }
  protected ncrNextStepsCopy() {
    const record = this.selectedNcr();
    if (!record) {
      return this.mode() === 'create'
        ? 'Next: open the saved NCR and continue with investigation, actions, and verification from the record.'
        : 'Next: continue the NCR from the relevant workflow tab.';
    }
    if (record.status === 'OPEN' || record.status === 'UNDER_REVIEW') {
      return 'Next: continue the investigation, capture root cause, and then move into corrective actions.';
    }
    if (record.status === 'INVESTIGATION' || record.status === 'ACTION_IN_PROGRESS') {
      return 'Next: review corrective actions, keep comments and evidence current, and prepare for verification.';
    }
    if (record.status === 'PENDING_VERIFICATION') {
      return 'Next: complete verification and confirm whether the NCR can be closed or needs more action.';
    }
    return 'Next: review the investigation trail, linked actions, and evidence as part of the NCR record.';
  }
  protected ncrStageLabel(status: NcrStatus) {
    if (status === 'OPEN' || status === 'UNDER_REVIEW') return 'Raised';
    if (status === 'INVESTIGATION') return 'Investigating';
    if (status === 'ACTION_IN_PROGRESS') return 'Correcting';
    if (status === 'PENDING_VERIFICATION') return 'Verifying';
    if (status === 'CLOSED') return 'Closed';
    return 'Archived';
  }
  protected ncrWorkflowHeading(status: NcrStatus) {
    if (status === 'OPEN' || status === 'UNDER_REVIEW') return 'NCR is in initial review';
    if (status === 'INVESTIGATION') return 'Root cause investigation is active';
    if (status === 'ACTION_IN_PROGRESS') return 'Corrective action is being implemented';
    if (status === 'PENDING_VERIFICATION') return 'Effectiveness verification is due';
    if (status === 'CLOSED') return 'NCR has been closed';
    return 'NCR is archived';
  }
  protected ncrWorkflowGuidance(status: NcrStatus) {
    if (status === 'OPEN' || status === 'UNDER_REVIEW') {
      return 'Capture containment first, then record enough investigation detail to justify why the NCR is moving into root cause analysis.';
    }
    if (status === 'INVESTIGATION') {
      return 'Complete the investigation summary and root cause before moving fully into corrective action ownership.';
    }
    if (status === 'ACTION_IN_PROGRESS') {
      return 'Keep corrective action summary, ownership, comments, and evidence current so the NCR is ready for verification.';
    }
    if (status === 'PENDING_VERIFICATION') {
      return 'Use verification to confirm the corrective action was effective, not just completed. Reject verification if the issue can still recur.';
    }
    if (status === 'CLOSED') {
      return 'Keep the NCR record available as evidence of containment, root cause, corrective action, and verification outcome.';
    }
    return 'Archived NCRs remain available for traceability and should not be treated as active issues.';
  }
  protected verificationHeading(status: NcrVerificationStatus) {
    if (status === 'VERIFIED') return 'Verification has passed';
    if (status === 'REJECTED') return 'Verification failed';
    return 'Verification is still pending';
  }
  protected verificationGuidance(status: NcrVerificationStatus) {
    if (status === 'VERIFIED') {
      return 'The corrective action has been confirmed as effective. Keep the verifier and verification date visible in the record.';
    }
    if (status === 'REJECTED') {
      return 'Use rejected when the corrective action did not prevent recurrence. Return to investigation or action in progress with updated evidence.';
    }
    return 'Pending means the action may be implemented, but effectiveness has not yet been confirmed.';
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
        heading: 'NCR follow-up is overdue',
        copy: `The due date passed on ${record.dueDate.slice(0, 10)}. Review corrective actions, verification status, and owner accountability before the NCR drifts further.`
      };
    }

    if (diffDays <= 14) {
      return {
        heading: 'NCR follow-up is approaching',
        copy: `The due date is ${record.dueDate.slice(0, 10)}. Confirm the investigation, root cause, and corrective action trail before the due date arrives.`
      };
    }

    if (record.status === 'PENDING_VERIFICATION' && record.verificationStatus === 'PENDING') {
      return {
        heading: 'Verification still needs a formal result',
        copy: 'This NCR is pending verification. Record who verified the action and whether the result was accepted or rejected.'
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
        void this.router.navigate(['/ncr', record.id], { state: { notice: this.mode() === 'edit' ? 'NCR updated.' : 'NCR created.' } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'NCR could not be saved.'));
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
        this.message.set('Comment added.');
        this.fetchActivity(this.selectedId() as string);
        this.fetchNcr(this.selectedId() as string);
      },
      error: (error: HttpErrorResponse) => {
        this.commentSaving.set(false);
        this.error.set(this.readError(error, 'Comment could not be saved.'));
      }
    });
  }

  protected changeStatus(status: NcrStatus) { this.patchCurrent({ status }, `NCR moved to ${this.labelize(status)}.`, 'NCR status update failed.'); }
  protected archiveCurrent() { this.patchCurrent({ status: 'ARCHIVED' }, 'NCR archived.', 'NCR archival failed.'); }

  protected deleteCurrent() {
    if (!this.selectedId() || !this.canDeleteNcr() || !window.confirm('Delete this NCR? Closed records should be archived instead.')) {
      return;
    }
    this.ncrApi.remove(this.selectedId() as string).subscribe({
      next: () => void this.router.navigate(['/ncr'], { state: { notice: 'NCR deleted.' } }),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'NCR deletion failed.'))
    });
  }

  protected archiveRow(item: NcrRecord) {
    if (!this.canArchiveRow(item) || !window.confirm(`Archive NCR "${item.referenceNo}"?`)) {
      return;
    }
    this.ncrApi.update(item.id, { status: 'ARCHIVED' }).subscribe({
      next: () => {
        this.message.set('NCR archived.');
        this.reloadNcrs();
      },
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'NCR archival failed.'))
    });
  }

  protected deleteRow(item: NcrRecord) {
    if (!this.canDeleteRow(item) || !window.confirm(`Delete NCR "${item.referenceNo}"?`)) {
      return;
    }
    this.ncrApi.remove(item.id).subscribe({
      next: () => {
        this.message.set('NCR deleted.');
        this.reloadNcrs();
      },
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'NCR deletion failed.'))
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
        this.error.set(this.readError(error, 'NCR log could not be loaded.'));
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
        this.error.set(this.readError(error, 'NCR details could not be loaded.'));
      }
    });
  }

  private fetchComments(id: string) {
    this.ncrApi.listComments(id).subscribe({
      next: (comments) => this.comments.set(comments),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'NCR comments could not be loaded.'))
    });
  }

  private fetchActivity(id: string) {
    this.ncrApi.activity(id).subscribe({
      next: (items) => this.activity.set(items),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'NCR activity could not be loaded.'))
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
