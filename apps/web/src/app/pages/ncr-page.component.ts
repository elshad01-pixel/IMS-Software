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
import { PageHeaderComponent } from '../shared/page-header.component';
import { RecordWorkItemsComponent } from '../shared/record-work-items.component';

type PageMode = 'list' | 'create' | 'detail' | 'edit';
type UserOption = NcrUserSummary;

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
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, AttachmentPanelComponent, RecordWorkItemsComponent],
  template: `
    <section class="page-grid">
      <iso-page-header [label]="'NCR'" [title]="pageTitle()" [description]="pageDescription()" [breadcrumbs]="breadcrumbs()">
        <a *ngIf="mode() === 'list' && canWrite()" routerLink="/ncr/new" class="button-link">+ New NCR</a>
        <a *ngIf="mode() === 'detail' && selectedNcr() && canWrite()" [routerLink]="['/ncr', selectedNcr()?.id, 'edit']" class="button-link">Edit NCR</a>
        <button *ngIf="mode() === 'detail' && canArchiveNcr()" type="button" class="button-link secondary" (click)="archiveCurrent()">Archive NCR</button>
        <button *ngIf="mode() === 'detail' && canDeleteNcr()" type="button" class="button-link danger" (click)="deleteCurrent()">Delete NCR</button>
        <a *ngIf="mode() !== 'list'" routerLink="/ncr" class="button-link secondary">Back to register</a>
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
              <span class="section-eyebrow">Register</span>
              <h3>Nonconformance register</h3>
              <p class="subtle">Track nonconformances by severity, source, owner, due date, and current lifecycle.</p>
            </div>
          </div>

          <div class="toolbar top-space">
            <div class="toolbar-meta">
              <div>
                <p class="toolbar-title">Register filters</p>
                <p class="toolbar-copy">Filter by status, category, source, severity, owner, or overdue NCRs.</p>
              </div>
              <div class="toolbar-stats">
                <article class="toolbar-stat"><span>Total</span><strong>{{ ncrs().length }}</strong></article>
                <article class="toolbar-stat"><span>Open</span><strong>{{ countByStatus('OPEN') }}</strong></article>
                <article class="toolbar-stat"><span>Overdue</span><strong>{{ overdueCount() }}</strong></article>
              </div>
            </div>

            <div class="filter-grid">
              <label class="field">
                <span>Search</span>
                <input [value]="search()" (input)="search.set(readInput($event))" placeholder="Reference, title, location">
              </label>
              <label class="field">
                <span>Status</span>
                <select [value]="statusFilter()" (change)="statusFilter.set(readSelect($event))">
                  <option value="">All statuses</option>
                  <option *ngFor="let item of statusOptions" [value]="item">{{ labelize(item) }}</option>
                </select>
              </label>
              <label class="field">
                <span>Category</span>
                <select [value]="categoryFilter()" (change)="categoryFilter.set(readSelect($event))">
                  <option value="">All categories</option>
                  <option *ngFor="let item of categoryOptions" [value]="item">{{ labelize(item) }}</option>
                </select>
              </label>
              <label class="field">
                <span>Source</span>
                <select [value]="sourceFilter()" (change)="sourceFilter.set(readSelect($event))">
                  <option value="">All sources</option>
                  <option *ngFor="let item of sourceOptions" [value]="item">{{ labelize(item) }}</option>
                </select>
              </label>
              <label class="field">
                <span>Severity</span>
                <select [value]="severityFilter()" (change)="severityFilter.set(readSelect($event))">
                  <option value="">All severities</option>
                  <option *ngFor="let item of severityOptions" [value]="item">{{ labelize(item) }}</option>
                </select>
              </label>
              <label class="field">
                <span>Owner</span>
                <select [value]="ownerFilter()" (change)="ownerFilter.set(readSelect($event))">
                  <option value="">All owners</option>
                  <option *ngFor="let item of users()" [value]="item.id">{{ fullName(item) }}</option>
                </select>
              </label>
            </div>

            <label class="toggle-line">
              <input type="checkbox" [checked]="overdueOnly()" (change)="overdueOnly.set(readChecked($event))">
              <span>Show overdue only</span>
            </label>
          </div>

          <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <div class="empty-state" *ngIf="loading()">
            <strong>Loading NCR register</strong>
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
                  <td>
                    <div class="inline-actions" (click)="$event.stopPropagation()">
                      <a [routerLink]="['/ncr', item.id]" class="button-link secondary compact">View</a>
                      <a *ngIf="canWrite()" [routerLink]="['/ncr', item.id, 'edit']" class="button-link secondary compact">Edit</a>
                      <button *ngIf="canArchiveRow(item)" type="button" class="button-link secondary compact" (click)="archiveRow(item)">Archive</button>
                      <button *ngIf="canDeleteRow(item)" type="button" class="button-link danger compact" (click)="deleteRow(item)">Delete</button>
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
              <label class="field"><span>Reported by</span><select formControlName="reportedByUserId"><option value="">Unassigned</option><option *ngFor="let item of users()" [value]="item.id">{{ fullName(item) }}</option></select></label>
              <label class="field"><span>Owner</span><select formControlName="ownerUserId"><option value="">Unassigned</option><option *ngFor="let item of users()" [value]="item.id">{{ fullName(item) }}</option></select></label>
            </div>
            <div class="form-grid-3 top-space">
              <label class="field"><span>Department</span><input formControlName="department" placeholder="Quality"></label>
              <label class="field"><span>Location</span><input formControlName="location" placeholder="Line 2"></label>
              <label class="field"><span>Due date</span><input type="date" formControlName="dueDate"></label>
            </div>
          </section>

          <section class="detail-section">
            <h4>Investigation</h4>
            <label class="field top-space"><span>Containment action</span><textarea rows="3" formControlName="containmentAction"></textarea></label>
            <label class="field top-space"><span>Investigation summary</span><textarea rows="3" formControlName="investigationSummary"></textarea></label>
            <div class="form-grid-2 top-space">
              <label class="field"><span>Root cause</span><textarea rows="3" formControlName="rootCause"></textarea></label>
              <label class="field"><span>RCA method</span><select formControlName="rcaMethod"><option value="">Not set</option><option *ngFor="let item of rcaMethodOptions" [value]="item">{{ labelize(item) }}</option></select></label>
            </div>
            <label class="field top-space"><span>Corrective action summary</span><textarea rows="3" formControlName="correctiveActionSummary"></textarea></label>
          </section>

          <section class="detail-section">
            <h4>Verification</h4>
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

        <section class="card panel-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Workflow</span>
              <h3>NCR workflow guidance</h3>
              <p class="subtle">Use the detail record for comments, attachments, activity, and linked actions after the NCR has been created.</p>
            </div>
          </div>
          <div class="entity-list top-space">
            <div class="entity-item"><strong>1. Capture the issue</strong><small>Log the core issue, source, severity, owner, and due date.</small></div>
            <div class="entity-item"><strong>2. Investigate</strong><small>Add containment, root cause, and corrective action summary as the NCR progresses.</small></div>
            <div class="entity-item"><strong>3. Verify and close</strong><small>Verification data is required before the backend allows final closure.</small></div>
          </div>
        </section>
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
              <article class="summary-item"><span>Severity</span><strong>{{ labelize(selectedNcr()?.severity || '') }}</strong></article>
              <article class="summary-item"><span>Priority</span><strong>{{ labelize(selectedNcr()?.priority || '') }}</strong></article>
              <article class="summary-item"><span>Due date</span><strong>{{ selectedNcr()?.dueDate ? (selectedNcr()?.dueDate | date:'yyyy-MM-dd') : 'Not set' }}</strong></article>
              <article class="summary-item"><span>Comments</span><strong>{{ comments().length }}</strong></article>
            </div>
          </section>

          <section class="card panel-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Workflow</span>
                <h3>NCR workflow</h3>
                <p class="subtle">Work from investigation to root cause and then assign corrective actions before closure.</p>
              </div>
            </div>

            <nav class="detail-tabs top-space" aria-label="NCR detail sections">
              <button type="button" class="detail-tab" [class.active]="activeDetailTab() === 'overview'" (click)="setDetailTab('overview')">Overview</button>
              <button type="button" class="detail-tab" [class.active]="activeDetailTab() === 'investigation'" (click)="setDetailTab('investigation')">Investigation</button>
              <button type="button" class="detail-tab" [class.active]="activeDetailTab() === 'actions'" (click)="setDetailTab('actions')">Actions</button>
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
                <p class="subtle">Containment, summary, root cause, and corrective response.</p>
              </div>
            </div>
            <div class="section-grid-2 top-space">
              <section class="detail-section"><h4>Containment action</h4><p>{{ selectedNcr()?.containmentAction || 'No containment action recorded.' }}</p></section>
              <section class="detail-section"><h4>Investigation summary</h4><p>{{ selectedNcr()?.investigationSummary || 'No investigation summary recorded.' }}</p></section>
              <section class="detail-section"><h4>Root cause</h4><p>{{ selectedNcr()?.rootCause || 'No root cause recorded.' }}</p></section>
              <section class="detail-section"><h4>RCA method</h4><p>{{ selectedNcr()?.rcaMethod ? labelize(selectedNcr()?.rcaMethod || '') : 'Not set' }}</p></section>
              <section class="detail-section"><h4>Corrective action summary</h4><p>{{ selectedNcr()?.correctiveActionSummary || 'No corrective action summary recorded.' }}</p></section>
              <section class="detail-section"><h4>Verified by</h4><p>{{ selectedNcr()?.verifiedBy ? fullName(selectedNcr()?.verifiedBy!) : 'Not assigned' }}<span *ngIf="selectedNcr()?.verificationDate"> | {{ selectedNcr()?.verificationDate | date:'yyyy-MM-dd' }}</span></p></section>
            </div>
            <div class="button-row top-space" *ngIf="availableTransitions().length && canWrite()">
              <button *ngFor="let item of availableTransitions()" type="button" class="secondary" [disabled]="saving()" (click)="changeStatus(item)">Move to {{ labelize(item) }}</button>
            </div>
          </section>

          <iso-record-work-items *ngIf="activeDetailTab() === 'actions'" [sourceType]="'ncr'" [sourceId]="selectedId()" />

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
                <span class="section-eyebrow">Activity</span>
                <h3>Activity log</h3>
                <p class="subtle">Backend audit events for this NCR record.</p>
              </div>
            </div>
            <div class="entity-list top-space" *ngIf="activity().length; else noActivity">
              <div class="entity-item" *ngFor="let item of activity()">
                <strong>{{ activityLabel(item.action) }}</strong>
                <small>{{ item.createdAt | date:'yyyy-MM-dd HH:mm' }}</small>
              </div>
            </div>
            <ng-template #noActivity><div class="empty-state top-space"><strong>No activity yet</strong><span>Lifecycle events will appear here as the NCR changes.</span></div></ng-template>
            <iso-attachment-panel class="top-space" [sourceType]="'ncr'" [sourceId]="selectedId()" />
          </section>
        </div>
      </section>
    </section>
  `,
  styles: [`
    .debug-render-banner {
      padding: 0.9rem 1rem;
      border-radius: 14px;
      border: 1px solid rgba(176, 73, 58, 0.45);
      background: #b0493a;
      color: #fff7f4;
      font-weight: 800;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      box-shadow: var(--shadow-soft);
    }

    .top-space { margin-top: 1rem; }
    .filter-grid { display: grid; gap: 0.9rem; grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .toggle-line { display: inline-flex; gap: 0.55rem; align-items: center; font-weight: 600; color: var(--muted-strong); }
    .inline-actions { display: flex; gap: 0.45rem; flex-wrap: wrap; justify-content: flex-end; }
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
    .comment-item p { margin: 0.45rem 0 0; color: var(--text-soft); line-height: 1.5; }
    tr[routerLink] { cursor: pointer; }
    @media (max-width: 1100px) { .filter-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 760px) { .filter-grid { grid-template-columns: minmax(0, 1fr); } }
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
  protected readonly activeDetailTab = signal<'overview' | 'investigation' | 'actions' | 'comments' | 'activity'>('overview');
  protected readonly users = signal<UserOption[]>([]);
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
  protected readonly overdueOnly = signal(false);
  protected readonly statusOptions: NcrStatus[] = ['OPEN', 'UNDER_REVIEW', 'INVESTIGATION', 'ACTION_IN_PROGRESS', 'PENDING_VERIFICATION', 'CLOSED', 'ARCHIVED'];
  protected readonly categoryOptions: NcrCategory[] = ['PROCESS', 'PRODUCT', 'SERVICE', 'SUPPLIER', 'COMPLAINT'];
  protected readonly sourceOptions: NcrSource[] = ['INTERNAL', 'CUSTOMER', 'SUPPLIER', 'AUDIT'];
  protected readonly severityOptions: NcrSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  protected readonly priorityOptions: NcrPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  protected readonly rcaMethodOptions: NcrRcaMethod[] = ['FIVE_WHY', 'FISHBONE', 'IS_IS_NOT', 'OTHER'];
  protected readonly verificationOptions: NcrVerificationStatus[] = ['PENDING', 'VERIFIED', 'REJECTED'];
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
      const matchesStatus = !this.statusFilter() || item.status === this.statusFilter();
      const matchesCategory = !this.categoryFilter() || item.category === this.categoryFilter();
      const matchesSource = !this.sourceFilter() || item.source === this.sourceFilter();
      const matchesSeverity = !this.severityFilter() || item.severity === this.severityFilter();
      const matchesOwner = !this.ownerFilter() || item.ownerUserId === this.ownerFilter();
      const overdue = !!item.dueDate && new Date(item.dueDate) < now && item.status !== 'CLOSED' && item.status !== 'ARCHIVED';
      return matchesSearch && matchesStatus && matchesCategory && matchesSource && matchesSeverity && matchesOwner && (!this.overdueOnly() || overdue);
    });
  });

  ngOnInit() {
    this.loadUsers();
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
  protected pageTitle() { return { list: 'Nonconformance register', create: 'Raise NCR', detail: this.selectedNcr()?.referenceNo || 'NCR detail', edit: this.selectedNcr()?.referenceNo || 'Edit NCR' }[this.mode()]; }
  protected pageDescription() { return { list: 'Review NCRs by lifecycle, severity, source, owner, and due date.', create: 'Capture the nonconformance first, then continue the investigation from the record.', detail: 'Review overview, investigation, actions, comments, attachments, and activity.', edit: 'Update the NCR without leaving the controlled workflow.' }[this.mode()]; }
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
  protected availableTransitions() { const current = this.selectedNcr()?.status; return current ? NEXT_STATUS_OPTIONS[current] : []; }
  protected canDeleteNcr() { const item = this.selectedNcr(); return this.authStore.hasPermission('admin.delete') && !!item && item.status !== 'CLOSED' && item.status !== 'ARCHIVED'; }
  protected canArchiveNcr() { const item = this.selectedNcr(); return this.authStore.hasPermission('admin.delete') && !!item && item.status !== 'ARCHIVED' && item.status !== 'OPEN'; }
  protected canDeleteRow(item: NcrRecord) { return this.authStore.hasPermission('admin.delete') && item.status !== 'CLOSED' && item.status !== 'ARCHIVED'; }
  protected canArchiveRow(item: NcrRecord) { return this.authStore.hasPermission('admin.delete') && item.status !== 'ARCHIVED' && item.status !== 'OPEN'; }
  protected fullName(user: NcrUserSummary) { return `${user.firstName} ${user.lastName}`.trim(); }
  protected labelize(value: string) { return value.toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '); }
  protected statusClass(status: NcrStatus) { if (status === 'CLOSED') return 'success'; if (status === 'ARCHIVED') return 'neutral'; if (status === 'PENDING_VERIFICATION' || status === 'UNDER_REVIEW') return 'warn'; return 'attention'; }
  protected severityClass(severity: NcrSeverity) { if (severity === 'CRITICAL') return 'danger'; if (severity === 'HIGH') return 'warn'; if (severity === 'LOW') return 'neutral'; return 'attention'; }
  protected activityLabel(action: string) { return action.replace(/^ncr\./, '').split('.').map((part) => this.labelize(part)).join(' '); }
  protected readInput(event: Event) { return (event.target as HTMLInputElement).value; }
  protected readSelect(event: Event) { return (event.target as HTMLSelectElement).value; }
  protected readChecked(event: Event) { return (event.target as HTMLInputElement).checked; }
  protected setDetailTab(tab: 'overview' | 'investigation' | 'actions' | 'comments' | 'activity') { this.activeDetailTab.set(tab); }

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
        this.error.set(this.readError(error, 'NCR register could not be loaded.'));
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

  private patchForm(record: NcrRecord) {
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
  }

  private resetForm() {
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
      rootCause: raw.rootCause.trim() || undefined,
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
}

@Component({ standalone: true, imports: [NcrPageComponent], template: `<iso-ncr-page [forcedMode]="'list'" />` })
export class NcrRegisterPageComponent {}

@Component({ standalone: true, imports: [NcrPageComponent], template: `<iso-ncr-page [forcedMode]="'create'" />` })
export class NcrCreatePageComponent {}

@Component({ standalone: true, imports: [NcrPageComponent], template: `<iso-ncr-page [forcedMode]="'detail'" />` })
export class NcrDetailPageComponent {}

@Component({ standalone: true, imports: [NcrPageComponent], template: `<iso-ncr-page [forcedMode]="'edit'" />` })
export class NcrEditPageComponent {}
