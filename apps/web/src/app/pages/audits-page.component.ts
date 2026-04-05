import { CommonModule } from '@angular/common';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
import { PageHeaderComponent } from '../shared/page-header.component';
import { AttachmentPanelComponent } from '../shared/attachment-panel.component';
import { RecordWorkItemsComponent } from '../shared/record-work-items.component';

type PageMode = 'list' | 'create' | 'detail' | 'edit';
type AuditStep = 'plan' | 'conduct' | 'review';
type AuditStatus = 'PLANNED' | 'IN_PROGRESS' | 'CHECKLIST_COMPLETED' | 'COMPLETED' | 'CLOSED';
type AuditType = 'Internal Audit' | 'Supplier Audit';
type AuditStandard = 'ISO 9001' | 'ISO 45001' | 'ISO 14001';
type ChecklistResponse = 'YES' | 'NO' | 'PARTIAL';
type FindingSeverity = 'OBSERVATION' | 'MINOR' | 'MAJOR';
type FindingStatus = 'OPEN' | 'CAPA_CREATED' | 'CLOSED';

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type AuditChecklistItem = {
  id: string;
  clause?: string | null;
  subclause?: string | null;
  standard?: string | null;
  title: string;
  notes?: string | null;
  response?: ChecklistResponse | null;
  isComplete: boolean;
  sortOrder: number;
  linkedFindingCount?: number;
  linkedFindings?: Array<{
    id: string;
    title: string;
    status: FindingStatus;
    severity: FindingSeverity;
    dueDate?: string | null;
    ownerId?: string | null;
    checklistItemId?: string | null;
    clause?: string | null;
    createdAt: string;
  }>;
};

type ChecklistGroup = {
  clause: string;
  items: AuditChecklistItem[];
};

type AuditFinding = {
  id: string;
  checklistItemId?: string | null;
  clause?: string | null;
  title: string;
  description: string;
  severity: FindingSeverity;
  ownerId?: string | null;
  dueDate?: string | null;
  linkedCapaId?: string | null;
  status: FindingStatus;
};

type AuditRecord = {
  id: string;
  code: string;
  title: string;
  type: AuditType;
  standard?: AuditStandard | null;
  scope?: string | null;
  leadAuditorId?: string | null;
  auditeeArea?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  checklistCompletedAt?: string | null;
  completedAt?: string | null;
  completedByAuditorId?: string | null;
  summary?: string | null;
  conclusion?: string | null;
  recommendations?: string | null;
  status: AuditStatus;
  checklistCount?: number;
  completedChecklistCount?: number;
  checklistAnsweredCount?: number;
  checklistYesCount?: number;
  checklistNoCount?: number;
  checklistNaCount?: number;
  isChecklistCompleted?: boolean;
  findingCount?: number;
  openFindingCount?: number;
  actionItemCount?: number;
  openActionItemCount?: number;
  checklistItems?: AuditChecklistItem[];
  findings?: AuditFinding[];
};

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, AttachmentPanelComponent, RecordWorkItemsComponent],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="'Audits'"
        [title]="pageTitle()"
        [description]="pageDescription()"
        [breadcrumbs]="breadcrumbs()"
      >
        <a *ngIf="mode() === 'list' && canWriteAudit()" routerLink="/audits/new" class="button-link">+ New audit</a>
        <a *ngIf="mode() === 'list' && canManageQuestionBank()" routerLink="/audits/checklist-question-bank" class="button-link secondary">Checklist question bank</a>
        <button *ngIf="mode() === 'detail' && selectedAudit()" type="button" class="button-link secondary" [disabled]="generatingReport()" (click)="generateReport()">
          {{ generatingReport() ? 'Preparing PDF...' : 'Download PDF report' }}
        </button>
        <a *ngIf="mode() === 'detail' && selectedAudit() && canWriteAudit()" [routerLink]="['/audits', selectedAudit()?.id, 'edit']" class="button-link">Edit audit</a>
        <button *ngIf="mode() === 'detail' && canDeleteAudit()" type="button" class="button-link danger" (click)="deleteAudit()">Delete audit</button>
        <button *ngIf="mode() === 'detail' && canArchiveAudit()" type="button" class="button-link secondary" (click)="archiveAudit()">Archive audit</button>
        <a *ngIf="mode() !== 'list'" routerLink="/audits" class="button-link secondary">Back to audits</a>
      </iso-page-header>

      <section *ngIf="mode() === 'list'" class="page-stack">
        <div class="card list-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Program</span>
              <h3>Internal and supplier audits</h3>
              <p class="subtle">Run ISO-based internal audits and dynamic supplier audits from a single structured register.</p>
            </div>
          </div>

          <div class="empty-state" *ngIf="loading()">
            <strong>Loading audits</strong>
            <span>Refreshing current audit plans, checklist progress, and findings.</span>
          </div>

          <div class="data-table-wrap" *ngIf="!loading() && audits().length">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Audit</th>
                  <th>Type</th>
                  <th>Audit date</th>
                  <th>Status</th>
                  <th>Checklist</th>
                  <th>Findings follow-up</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of audits()" [routerLink]="['/audits', item.id]">
                  <td>
                    <div class="table-title">
                      <strong>{{ item.code }}</strong>
                      <small>{{ item.title }}</small>
                    </div>
                  </td>
                  <td>{{ item.type }}<span *ngIf="item.standard"> | {{ item.standard }}</span></td>
                  <td>
                    <div class="table-title">
                      <strong>{{ auditDateValue(item) }}</strong>
                      <small>{{ auditDateLabel(item) }}</small>
                    </div>
                  </td>
                  <td><span class="status-badge" [class.warn]="item.status === 'IN_PROGRESS' || item.status === 'CHECKLIST_COMPLETED'" [class.success]="item.status === 'COMPLETED'" [class.neutral]="item.status === 'CLOSED'">{{ item.status }}</span></td>
                  <td>{{ item.completedChecklistCount || 0 }}/{{ item.checklistCount || 0 }}</td>
                  <td>
                    <div class="table-title">
                      <strong>{{ item.findingCount || 0 }} total</strong>
                      <small [ngClass]="findingsFollowUpClass(item)">{{ findingsFollowUpCopy(item) }}</small>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section *ngIf="mode() === 'create' || mode() === 'edit'" class="page-columns">
        <form class="card form-card page-stack" [formGroup]="auditForm" (ngSubmit)="saveAudit()">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Audit setup</span>
              <h3>{{ mode() === 'create' ? 'Create audit plan' : 'Edit audit plan' }}</h3>
              <p class="subtle">Internal audits preload ISO audit questions. Supplier audits stay simple and custom.</p>
            </div>
          </div>

          <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <div class="form-grid-2">
            <label class="field"><span>Code</span><input formControlName="code" placeholder="IA-2026-001"></label>
            <label class="field">
              <span>Audit type</span>
              <select formControlName="type">
                <option>Internal Audit</option>
                <option>Supplier Audit</option>
              </select>
            </label>
          </div>

          <div class="form-grid-2">
            <label class="field"><span>Title</span><input formControlName="title" placeholder="Purchasing process audit"></label>
            <label class="field" *ngIf="auditForm.getRawValue().type === 'Internal Audit'">
              <span>ISO standard</span>
              <select formControlName="standard">
                <option value="">Select standard</option>
                <option>ISO 9001</option>
                <option>ISO 45001</option>
                <option>ISO 14001</option>
              </select>
            </label>
          </div>

          <label class="field"><span>Scope</span><textarea rows="3" formControlName="scope" placeholder="Process, site, supplier, or function under audit"></textarea></label>

          <div class="form-grid-2">
            <label class="field">
              <span>Lead auditor</span>
              <select formControlName="leadAuditorId">
                <option value="">Unassigned</option>
                <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
              </select>
            </label>
            <label class="field"><span>Auditee area</span><input formControlName="auditeeArea" placeholder="Operations or supplier name"></label>
          </div>

          <div class="form-grid-2">
            <label class="field"><span>Scheduled date</span><input type="date" formControlName="scheduledAt"></label>
            <label class="field">
              <span>Status</span>
              <select formControlName="status">
                <option>PLANNED</option>
                <option>IN_PROGRESS</option>
                <option>CHECKLIST_COMPLETED</option>
                <option>COMPLETED</option>
                <option *ngIf="auditForm.getRawValue().status === 'CLOSED'">CLOSED</option>
              </select>
            </label>
          </div>

          <label class="field"><span>Summary</span><textarea rows="3" formControlName="summary" placeholder="Audit objective, site, and expected outputs"></textarea></label>

          <div class="button-row">
            <button type="submit" [disabled]="auditForm.invalid || saving() || !canWriteAudit()">{{ saving() ? 'Saving...' : 'Save audit' }}</button>
            <a [routerLink]="selectedId() ? ['/audits', selectedId()] : ['/audits']" class="button-link secondary">Cancel</a>
          </div>
        </form>

        <section class="card panel-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Execution model</span>
              <h3>Audit behavior</h3>
              <p class="subtle">Internal audits seed clause-based ISO checklists. Supplier audits rely on your own checklist questions.</p>
            </div>
          </div>
          <div class="entity-list top-space">
            <div class="entity-item">
              <strong>Internal audit</strong>
              <small>Select an ISO standard to load predefined audit questions across clauses 4-10.</small>
            </div>
            <div class="entity-item">
              <strong>Supplier audit</strong>
              <small>Use a lightweight question list with an optional section or category.</small>
            </div>
            <div class="entity-item">
              <strong>Findings and actions</strong>
              <small>Raise findings, create CAPA, and prepare global actions from the audit record.</small>
            </div>
          </div>
        </section>
      </section>

      <section *ngIf="mode() === 'detail' && selectedAudit()" class="page-stack">
        <section class="card detail-card workflow-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">{{ selectedAudit()?.type }}</span>
              <h3>{{ selectedAudit()?.title }}</h3>
              <p class="subtle">{{ selectedAudit()?.code }}<span *ngIf="selectedAudit()?.standard"> | {{ selectedAudit()?.standard }}</span></p>
            </div>
            <span class="status-badge" [class.warn]="selectedAudit()?.status === 'IN_PROGRESS' || selectedAudit()?.status === 'CHECKLIST_COMPLETED'" [class.success]="selectedAudit()?.status === 'COMPLETED'" [class.neutral]="selectedAudit()?.status === 'CLOSED'">{{ selectedAudit()?.status }}</span>
          </div>

          <div class="summary-strip top-space">
            <article class="summary-item">
              <span>Checklist</span>
              <strong>{{ selectedAudit()?.completedChecklistCount || 0 }}/{{ selectedAudit()?.checklistCount || 0 }}</strong>
            </article>
            <article class="summary-item">
              <span>Findings</span>
              <strong>{{ selectedAudit()?.findingCount || 0 }}</strong>
            </article>
            <article class="summary-item">
              <span>Open findings</span>
              <strong>{{ selectedAudit()?.openFindingCount || 0 }}</strong>
            </article>
          </div>

          <section class="feedback next-steps-banner success top-space" *ngIf="message() && !error()">
            <strong>{{ message() }}</strong>
            <span>{{ auditNextStepsCopy() }}</span>
            <div class="button-row top-space">
              <button *ngIf="selectedAudit()?.status !== 'COMPLETED' && selectedAudit()?.status !== 'CLOSED'" type="button" (click)="setActiveStep(selectedAudit()?.isChecklistCompleted ? 'review' : 'conduct')">
                {{ selectedAudit()?.isChecklistCompleted ? 'Review findings' : 'Continue checklist' }}
              </button>
              <button *ngIf="selectedAudit()?.status === 'COMPLETED' || selectedAudit()?.status === 'CLOSED'" type="button" class="secondary" [disabled]="generatingReport()" (click)="generateReport()">
                {{ generatingReport() ? 'Preparing PDF...' : 'Download PDF report' }}
              </button>
              <button *ngIf="selectedAudit()?.findingCount" type="button" class="secondary" (click)="setActiveStep('review')">Review findings</button>
            </div>
          </section>

          <nav class="audit-steps top-space" aria-label="Audit steps">
            <button type="button" class="audit-step" [class.active]="activeStep() === 'plan'" (click)="setActiveStep('plan')">
              <span>1</span>
              <div>
                <strong>Plan audit</strong>
                <small>Scope and setup</small>
              </div>
            </button>
            <button type="button" class="audit-step" [class.active]="activeStep() === 'conduct'" (click)="setActiveStep('conduct')">
              <span>2</span>
              <div>
                <strong>Conduct audit</strong>
                <small>Assess questions</small>
              </div>
            </button>
            <button type="button" class="audit-step" [class.active]="activeStep() === 'review'" (click)="setActiveStep('review')">
              <span>3</span>
              <div>
                <strong>Review findings</strong>
                <small>Close-out and completion</small>
              </div>
            </button>
          </nav>
        </section>

        <section *ngIf="activeStep() === 'plan'" class="page-columns">
          <section class="card panel-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Audit plan</span>
                <h3>Scope and readiness</h3>
                <p class="subtle">Confirm what will be audited, who owns the audit, and what outcome should be produced before starting fieldwork.</p>
              </div>
            </div>

            <dl class="key-value top-space">
              <dt>Scope</dt>
              <dd>{{ selectedAudit()?.scope || 'No scope recorded.' }}</dd>
              <dt>Auditee area</dt>
              <dd>{{ selectedAudit()?.auditeeArea || 'Not set' }}</dd>
              <dt>Scheduled date</dt>
              <dd>{{ selectedAudit()?.scheduledAt ? selectedAudit()?.scheduledAt?.slice(0, 10) : 'Not scheduled' }}</dd>
              <dt>Summary</dt>
              <dd>{{ selectedAudit()?.summary || 'No summary yet.' }}</dd>
            </dl>

            <div class="button-row top-space">
              <button type="button" (click)="setActiveStep('conduct')">Start audit</button>
              <a [routerLink]="['/audits', selectedId(), 'edit']" class="button-link secondary">Edit plan</a>
            </div>
          </section>

          <section class="card panel-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Checklist behavior</span>
                <h3>{{ selectedAudit()?.type === 'Internal Audit' ? 'Preloaded ISO questions' : 'Simple supplier checklist' }}</h3>
                <p class="subtle">{{ selectedAudit()?.type === 'Internal Audit'
                  ? 'Internal audits already include structured ISO questions under clauses 4 to 10. Auditors do not need to author the checklist.'
                  : 'Supplier audits keep authoring light: add a question, optionally assign a group, and start assessing.' }}</p>
              </div>
            </div>

            <div class="entity-list top-space">
              <div class="entity-item">
                <strong>Evidence ready</strong>
                <small>Each checklist item can hold its own attachments so supporting evidence stays tied to the exact question reviewed.</small>
              </div>
              <div class="entity-item">
                <strong>Finding trigger</strong>
                <small>When a response is No or Partial, the UI prompts the auditor to raise a finding immediately.</small>
              </div>
              <div class="entity-item">
                <strong>Closure path</strong>
                <small>When the checklist is complete, move into the review step for findings, close-out notes, and final completion.</small>
              </div>
            </div>
          </section>
        </section>

        <section *ngIf="activeStep() === 'conduct'" class="page-stack">
          <section class="card panel-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Conduct audit</span>
                <h3>{{ selectedAudit()?.type === 'Internal Audit' ? 'Clause-by-clause checklist' : 'Supplier audit checklist' }}</h3>
                <p class="subtle">Answer each question. If a requirement is not met, record a finding and continue the audit.</p>
              </div>
            </div>

            <div class="empty-state top-space" *ngIf="isChecklistReadOnly()">
              <strong>Checklist is read-only</strong>
              <span>This audit has been completed. You can still review findings and evidence, but checklist responses can no longer be changed.</span>
            </div>

            <div class="conduct-progress top-space" *ngIf="checklistGroups().length">
              <div class="conduct-progress__meta">
                <div>
                  <strong>{{ currentClauseLabel() }}</strong>
                  <small>{{ answeredChecklistCount() }}/{{ totalChecklistCount() }} questions answered</small>
                </div>
                <span>{{ currentClauseIndex() + 1 }}/{{ checklistGroups().length }} clauses</span>
              </div>
              <div class="conduct-progress__bar">
                <span [style.width.%]="progressPercent()"></span>
              </div>
            </div>

            <form *ngIf="selectedAudit()?.type === 'Supplier Audit' && !isChecklistReadOnly()" class="supplier-builder top-space" [formGroup]="checklistForm" (ngSubmit)="addChecklistItem()">
              <div class="form-grid-2">
                <label class="field">
                  <span>Section or group</span>
                  <input formControlName="clause" placeholder="Delivery">
                </label>
                <label class="field">
                  <span>Subclause</span>
                  <input formControlName="subclause" placeholder="8.4">
                </label>
              </div>
              <div class="form-grid-2">
                <label class="field">
                  <span>Add question</span>
                  <input formControlName="title" placeholder="Supplier communicates delivery delays in advance">
                </label>
              </div>
              <label class="field">
                <span>Comment prompt</span>
                <textarea rows="2" formControlName="notes" placeholder="Optional context or evidence to review"></textarea>
              </label>
              <div class="button-row">
                <button type="submit" [disabled]="checklistForm.invalid || saving()">{{ saving() ? 'Saving...' : 'Add question' }}</button>
              </div>
            </form>

            <div class="empty-state top-space" *ngIf="!checklistGroups().length">
              <strong>Start audit by answering questions</strong>
              <span>{{ selectedAudit()?.type === 'Internal Audit' ? 'Checklist questions will appear here once the audit template is available.' : 'Add the first supplier audit question to begin the audit.' }}</span>
            </div>

            <ng-container *ngIf="checklistGroups().length">
              <section class="clause-header top-space">
                <div>
                  <span class="section-eyebrow">Clause {{ currentChecklistGroup()!.clause || 'General' }}</span>
                  <h4>{{ currentChecklistGroup() ? clauseHeading(currentChecklistGroup()!.clause) : 'Checklist' }}</h4>
                  <p class="subtle">{{ currentClauseHelperText() }}</p>
                </div>
                <div class="clause-header__meta">
                  <span class="status-badge neutral">{{ answeredInCurrentClause() }}/{{ currentChecklistGroup()!.items.length || 0 }} answered</span>
                  <button *ngIf="selectedAudit()?.type === 'Internal Audit' && canManageQuestionBank() && !isChecklistReadOnly()" type="button" class="button-link secondary compact" (click)="toggleChecklistBuilder()">
                    {{ checklistBuilderOpen() ? 'Hide add question' : '+ Add extra question' }}
                  </button>
                </div>
              </section>

              <form *ngIf="selectedAudit()?.type === 'Internal Audit' && checklistBuilderOpen()" class="supplier-builder top-space" [formGroup]="checklistForm" (ngSubmit)="addChecklistItem()">
                <div class="form-grid-3">
                  <label class="field">
                    <span>Clause / section</span>
                    <input formControlName="clause" placeholder="4">
                  </label>
                  <label class="field">
                    <span>Subclause</span>
                    <input formControlName="subclause" placeholder="4.1">
                  </label>
                  <label class="field">
                    <span>Add question</span>
                    <input formControlName="title" placeholder="Are process owners reviewing key business issues and interested-party expectations?">
                  </label>
                </div>
                <label class="field">
                  <span>Comment prompt</span>
                  <textarea rows="2" formControlName="notes" placeholder="Optional context or evidence to review"></textarea>
                </label>
                <div class="button-row">
                  <button type="submit" [disabled]="checklistForm.invalid || saving()">{{ saving() ? 'Saving...' : 'Add question' }}</button>
                  <button type="button" class="secondary" (click)="closeChecklistBuilder()">Cancel</button>
                </div>
              </form>

              <div class="empty-state top-space" *ngIf="currentChecklistGroup() && !answeredInCurrentClause()">
                <strong>No questions answered in this clause</strong>
                <span>Start with the first question below, then move to the next clause when you are ready.</span>
              </div>

              <div class="question-stack top-space" *ngIf="currentChecklistGroup() as group">
                <article class="question-card" *ngFor="let item of group.items; let questionIndex = index" [class.is-open]="isChecklistExpanded(item.id)">
                  <div class="question-card__head">
                    <div class="question-card__title">
                      <div class="question-meta">
                        <span class="question-number">{{ item.subclause || questionNumber(group.clause, questionIndex) }}</span>
                        <small>Clause {{ item.clause || group.clause }}</small>
                        <span *ngIf="findingForChecklist(item)" class="finding-indicator">Finding recorded</span>
                      </div>
                      <strong>{{ item.title }}</strong>
                    </div>

                    <div class="question-card__actions">
                      <div class="response-group">
                        <button type="button" class="response-button" [class.active]="item.response === 'YES'" [disabled]="isChecklistReadOnly()" (click)="setChecklistResponse(item, 'YES')">Yes</button>
                        <button type="button" class="response-button" [class.active]="item.response === 'NO'" [disabled]="isChecklistReadOnly()" (click)="setChecklistResponse(item, 'NO')">No</button>
                        <button type="button" class="response-button" [class.active]="item.response === 'PARTIAL'" [disabled]="isChecklistReadOnly()" (click)="setChecklistResponse(item, 'PARTIAL')">N/A</button>
                      </div>

                      <div class="question-quick-actions">
                        <button type="button" class="button-link secondary compact" (click)="toggleChecklist(item.id)">
                          {{ isChecklistExpanded(item.id) ? 'Hide details' : (item.notes ? 'Edit Comment' : 'Add Comment') }}
                        </button>
                        <button type="button" class="button-link secondary compact" *ngIf="!findingForChecklist(item) && item.response === 'NO' && !isChecklistReadOnly()" (click)="openFindingComposer(item)">Add Finding</button>
                        <button type="button" class="button-link secondary compact" *ngIf="findingForChecklist(item)" (click)="viewFindingForChecklist(item)">View Finding</button>
                      </div>
                    </div>
                  </div>

                  <div class="question-body" *ngIf="isChecklistExpanded(item.id)">
                    <label class="field">
                      <span>Comment on this question</span>
                      <textarea
                        rows="3"
                        [value]="checklistNoteDraft(item)"
                        [readOnly]="isChecklistReadOnly()"
                        (input)="setChecklistNoteDraft(item.id, readTextarea($event))"
                        (blur)="saveChecklistNote(item)"
                        placeholder="Record objective evidence, comments, and observations"
                      ></textarea>
                    </label>

                    <div class="finding-prompt top-space" *ngIf="item.response === 'NO'">
                      <div>
                        <strong>{{ findingForChecklist(item) ? 'Finding recorded' : 'Requirement not met' }}</strong>
                        <p>{{ findingForChecklist(item) ? 'A finding is already linked to this question. You can continue the audit.' : 'Record a finding for this audit gap, then continue from the same question.' }}</p>
                      </div>
                      <div class="button-row compact-row">
                        <button type="button" class="secondary" *ngIf="!findingForChecklist(item) && !isChecklistReadOnly()" (click)="openFindingComposer(item)">Add Finding</button>
                        <button type="button" class="secondary" *ngIf="findingForChecklist(item)" (click)="viewFindingForChecklist(item)">View Finding</button>
                      </div>
                    </div>

                    <iso-attachment-panel class="top-space" [sourceType]="'audit-checklist-item'" [sourceId]="item.id" />
                  </div>
                </article>
              </div>

              <div class="clause-nav top-space">
                <button type="button" class="secondary" (click)="previousClause()" [disabled]="!hasPreviousClause()">Previous Clause</button>
                <button type="button" *ngIf="hasNextClause()" (click)="nextClause()">Next Clause</button>
                <button type="button" *ngIf="!hasNextClause() && isChecklistComplete()" (click)="setActiveStep('review')">Review Findings</button>
              </div>

              <section class="completion-callout top-space" *ngIf="isChecklistComplete()">
                <div>
                  <span class="section-eyebrow">Checklist complete</span>
                  <h4>Move into the review and close-out step</h4>
                  <p class="subtle">All checklist questions are answered. Review findings, capture the audit conclusion, and complete the audit record.</p>
                </div>
                <div class="button-row compact-row">
                  <button type="button" (click)="setActiveStep('review')">Review Findings</button>
                </div>
              </section>
            </ng-container>
          </section>

          <div class="finding-modal-backdrop" *ngIf="pendingFindingItem()" (click)="cancelFindingComposer()"></div>
          <section class="finding-modal card" *ngIf="pendingFindingItem() as pendingItem">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Finding</span>
                <h3>Record audit finding</h3>
                <p class="subtle">{{ questionNumber(pendingItem.clause || currentChecklistGroup()!.clause || 'Q', pendingQuestionIndex(pendingItem)) }} | {{ pendingItem.title }}</p>
              </div>
              <button type="button" class="button-link secondary compact" (click)="cancelFindingComposer()">Close</button>
            </div>

            <form [formGroup]="findingForm" class="page-stack top-space" (ngSubmit)="addFindingFromChecklist(pendingItem)">
              <label class="field">
                <span>Finding title</span>
                <input formControlName="title" placeholder="Requirement not met">
              </label>
              <label class="field">
                <span>Description</span>
                <textarea rows="4" formControlName="description" placeholder="Describe the gap, evidence, and impact"></textarea>
              </label>
              <label class="field">
                <span>Severity</span>
                <select formControlName="severity">
                  <option>OBSERVATION</option>
                  <option>MINOR</option>
                  <option>MAJOR</option>
                </select>
              </label>
              <div class="button-row">
                <button type="submit" [disabled]="findingForm.invalid || saving()">Save finding</button>
                <button type="button" class="secondary" [disabled]="saving()" (click)="cancelFindingComposer()">Cancel</button>
              </div>
            </form>
          </section>
        </section>

        <section *ngIf="activeStep() === 'review'" class="page-stack">
          <section class="card panel-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Checklist completion</span>
                <h3>Review findings and close out the audit</h3>
                <p class="subtle">Once the checklist is complete, review findings, capture the audit conclusion, and finish the audit record. Findings and actions can continue after audit completion.</p>
              </div>
            </div>

            <div class="summary-grid top-space">
              <article class="summary-item">
                <span>Total questions</span>
                <strong>{{ selectedAudit()?.checklistCount || 0 }}</strong>
              </article>
              <article class="summary-item">
                <span>Yes</span>
                <strong>{{ selectedAudit()?.checklistYesCount || 0 }}</strong>
              </article>
              <article class="summary-item">
                <span>No</span>
                <strong>{{ selectedAudit()?.checklistNoCount || 0 }}</strong>
              </article>
              <article class="summary-item">
                <span>N/A</span>
                <strong>{{ selectedAudit()?.checklistNaCount || 0 }}</strong>
              </article>
              <article class="summary-item">
                <span>Findings</span>
                <strong>{{ selectedAudit()?.findingCount || 0 }}</strong>
              </article>
              <article class="summary-item">
                <span>Linked actions</span>
                <strong>{{ selectedAudit()?.actionItemCount || 0 }}</strong>
              </article>
            </div>

            <section class="compliance-note top-space" *ngIf="findingSeveritySummary() as severitySummary">
              <strong>{{ severitySummary.heading }}</strong>
              <span>{{ severitySummary.copy }}</span>
            </section>

            <div class="empty-state top-space" *ngIf="!isChecklistComplete()">
              <strong>Checklist is not complete yet</strong>
              <span>Answer all required checklist questions before the audit can move into final completion.</span>
            </div>
          </section>

          <section class="card panel-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Review findings</span>
                <h3>Findings and corrective actions</h3>
                <p class="subtle">Review each finding, open CAPA where required, and create corrective actions only where they add value.</p>
              </div>
            </div>

            <section class="detail-section top-space" *ngIf="(selectedAudit()?.findings || []).length">
              <h4>Traceability path</h4>
              <p>{{ findingsTraceabilityCopy() }}</p>
              <div class="button-row top-space">
                <button type="button" class="secondary" (click)="scrollToAuditActions()">Open linked actions</button>
                <button *ngIf="selectedAudit()?.findingCount" type="button" class="tertiary" (click)="setActiveStep('conduct')">Review checklist evidence</button>
              </div>
            </section>

            <div class="empty-state top-space" *ngIf="!(selectedAudit()?.findings || []).length">
              <strong>No findings yet</strong>
              <span>The audit can still be completed. Add findings only where a requirement was not met during checklist execution.</span>
            </div>

            <div class="entity-list top-space" *ngIf="(selectedAudit()?.findings || []).length">
              <article class="entity-item" *ngFor="let finding of selectedAudit()?.findings || []" [class.is-highlighted]="selectedFindingId() === finding.id">
                <div class="section-head">
                  <div>
                    <strong>{{ finding.title }}</strong>
                    <small>{{ findingSeverityLabel(finding.severity) }} | {{ findingStatusLabel(finding.status) }}{{ finding.clause ? ' | clause ' + finding.clause : '' }}{{ finding.dueDate ? ' | due ' + finding.dueDate.slice(0, 10) : '' }}</small>
                  </div>
                </div>
                <p class="subtle">{{ cleanFindingDescription(finding.description) }}</p>
                <section class="compliance-note compact-note top-space">
                  <strong>{{ findingControlHeading(finding) }}</strong>
                  <span>{{ findingControlCopy(finding) }}</span>
                </section>
                <div class="button-row compact-row">
                  <button type="button" class="secondary" (click)="focusChecklistQuestion(finding)" [disabled]="!finding.checklistItemId">Open question & evidence</button>
                  <button type="button" class="secondary" [disabled]="!!finding.linkedCapaId || saving() || !canCreateCapa()" (click)="createCapaFromFinding(finding)">
                    {{ finding.linkedCapaId ? 'CAPA linked' : 'Create CAPA' }}
                  </button>
                  <a *ngIf="finding.linkedCapaId" [routerLink]="['/capa', finding.linkedCapaId]" class="button-link secondary compact">Open CAPA</a>
                  <button type="button" class="secondary" [disabled]="saving() || !canCreateActions()" (click)="prepareActionFromFinding(finding)">Create corrective action</button>
                  <button type="button" class="tertiary" (click)="scrollToAuditActions()">Open linked actions</button>
                  <button type="button" class="secondary" [disabled]="saving() || finding.status === 'CLOSED' || !canWriteAudit()" (click)="updateFindingStatus(finding, 'CLOSED')">Close finding</button>
                </div>
              </article>
            </div>
          </section>

          <div id="audit-actions-section">
            <iso-record-work-items
              [sourceType]="'audit'"
              [sourceId]="selectedId()"
              [draftTitle]="draftActionTitle()"
              [draftDescription]="draftActionDescription()"
            />
          </div>

          <section class="card panel-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Audit close-out</span>
                <h3>Conclusion and recommendations</h3>
                <p class="subtle">Capture the overall conclusion, recommendations, and who completed the audit. Open findings and actions can continue after the audit itself is completed.</p>
              </div>
            </div>

            <form [formGroup]="closeoutForm" class="page-stack top-space" (ngSubmit)="completeAudit()">
              <section class="compliance-note">
                <strong>{{ auditCloseoutHeading() }}</strong>
                <span>{{ auditCloseoutGuidance() }}</span>
              </section>
              <label class="field">
                <span>Audit conclusion</span>
                <textarea rows="4" formControlName="conclusion" placeholder="Summarize whether the audited area is effective and where the main gaps were found"></textarea>
              </label>
              <label class="field">
                <span>Recommendations</span>
                <textarea rows="4" formControlName="recommendations" placeholder="Record the main recommendations, follow-up focus areas, or further verification needed"></textarea>
              </label>
              <div class="form-grid-2">
                <label class="field">
                  <span>Completion date</span>
                  <input type="date" formControlName="completionDate">
                </label>
                <label class="field">
                  <span>Auditor</span>
                  <select formControlName="completedByAuditorId">
                    <option value="">Select auditor</option>
                    <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
                  </select>
                </label>
              </div>
              <div class="button-row">
                <button type="button" class="secondary" (click)="saveCloseoutDraft()" [disabled]="saving() || selectedAudit()?.status === 'COMPLETED' || !canWriteAudit()">Save close-out draft</button>
                <button type="submit" [disabled]="saving() || !canCompleteAudit()">Complete Audit</button>
              </div>
            </form>
          </section>
        </section>

        <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>
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

    .compact-row {
      margin-top: 0.75rem;
      flex-wrap: wrap;
    }

    .text-button {
      padding: 0;
      min-height: auto;
    }

    .workflow-card {
      display: grid;
      gap: 1rem;
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

    .followup-open {
      color: #8a6322;
      font-weight: 700;
    }

    .followup-closed {
      color: #2f6b45;
      font-weight: 700;
    }

    .followup-neutral {
      color: var(--muted);
      font-weight: 600;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      gap: 0.85rem;
    }

    .audit-steps {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.85rem;
    }

    .audit-step,
    .question-trigger,
    .response-button {
      cursor: pointer;
    }

    .audit-step {
      border: 1px solid rgba(23, 50, 37, 0.1);
      background: rgba(255, 255, 255, 0.92);
      border-radius: 18px;
      padding: 1rem;
      display: flex;
      align-items: center;
      gap: 0.9rem;
      text-align: left;
      transition: border-color 120ms ease, transform 120ms ease, box-shadow 120ms ease;
    }

    .audit-step span {
      width: 2rem;
      height: 2rem;
      border-radius: 999px;
      display: inline-grid;
      place-items: center;
      background: rgba(23, 50, 37, 0.08);
      color: var(--accent-strong);
      font-weight: 700;
      flex: 0 0 auto;
    }

    .audit-step small,
    .question-trigger small {
      color: var(--muted);
    }

    .audit-step.active {
      border-color: rgba(36, 79, 61, 0.25);
      box-shadow: 0 18px 42px rgba(24, 45, 32, 0.08);
      transform: translateY(-1px);
    }

    .audit-conduct-layout {
      grid-template-columns: minmax(0, 1.8fr) minmax(18rem, 0.8fr);
    }

    .conduct-progress,
    .finding-form {
      padding: 1rem;
      border-radius: 20px;
      background: rgba(244, 247, 242, 0.82);
      border: 1px solid rgba(23, 50, 37, 0.08);
    }

    .conduct-progress__meta,
    .clause-header,
    .clause-nav,
    .question-trigger__meta {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .conduct-progress__meta strong,
    .clause-header h4 {
      display: block;
      margin: 0;
    }

    .conduct-progress__meta small,
    .clause-header__meta {
      color: var(--muted);
    }

    .conduct-progress__bar {
      margin-top: 0.9rem;
      height: 0.6rem;
      border-radius: 999px;
      background: rgba(23, 50, 37, 0.08);
      overflow: hidden;
    }

    .conduct-progress__bar span {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, rgba(36, 79, 61, 0.72), rgba(184, 132, 51, 0.72));
    }

    .finding-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(17, 25, 20, 0.42);
      z-index: 59;
    }

    .finding-modal {
      position: fixed;
      inset: 50% auto auto 50%;
      transform: translate(-50%, -50%);
      width: min(42rem, calc(100vw - 2rem));
      max-height: calc(100vh - 3rem);
      overflow: auto;
      padding: 1.35rem 1.4rem;
      z-index: 60;
      box-shadow: 0 28px 60px rgba(18, 28, 22, 0.2);
    }

    .supplier-builder {
      padding: 1rem;
      border-radius: 20px;
      background: rgba(244, 247, 242, 0.85);
      border: 1px solid rgba(23, 50, 37, 0.06);
    }

    .question-stack {
      display: grid;
      gap: 1rem;
    }

    .question-card {
      border: 1px solid rgba(23, 50, 37, 0.08);
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.92);
      overflow: hidden;
    }

    .question-card.is-open {
      box-shadow: 0 18px 40px rgba(24, 45, 32, 0.08);
    }

    .entity-item.is-highlighted {
      border-color: rgba(184, 132, 51, 0.3);
      background: rgba(253, 248, 240, 0.96);
      box-shadow: var(--shadow-soft);
    }

    .question-card__head {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: start;
      padding: 1.1rem 1.2rem;
    }

    .question-card__title {
      display: grid;
      gap: 0.45rem;
      min-width: 0;
      flex: 1 1 auto;
    }

    .question-card__title strong {
      display: block;
      font-size: 1.03rem;
      line-height: 1.45;
      color: var(--text);
    }

    .question-card__actions {
      display: grid;
      gap: 0.75rem;
      justify-items: end;
      flex: 0 0 auto;
    }

    .question-meta {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      flex-wrap: wrap;
    }

    .question-number {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 3.2rem;
      padding: 0.32rem 0.7rem;
      border-radius: 999px;
      background: rgba(36, 79, 61, 0.1);
      color: var(--brand-strong);
      font-size: 0.8rem;
      font-weight: 800;
      letter-spacing: 0.03em;
    }

    .question-quick-actions {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
      justify-content: end;
    }

    .question-body {
      padding: 0 1.2rem 1.2rem;
      border-top: 1px solid rgba(23, 50, 37, 0.06);
      background: linear-gradient(180deg, rgba(249, 251, 248, 0.9), rgba(255, 255, 255, 0.95));
    }

    .response-group {
      display: inline-flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .response-button {
      border: 1px solid rgba(23, 50, 37, 0.12);
      background: rgba(255, 255, 255, 0.94);
      color: var(--ink);
      border-radius: 999px;
      min-height: auto;
      padding: 0.65rem 1rem;
      box-shadow: none;
    }

    .response-button.active {
      border-color: rgba(36, 79, 61, 0.35);
      background: rgba(226, 236, 229, 0.95);
      color: var(--accent-strong);
    }

    .response-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 7rem;
      padding: 0.45rem 0.75rem;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 700;
      background: rgba(23, 50, 37, 0.07);
      color: var(--ink);
    }

    .response-chip.is-empty {
      color: var(--muted);
    }

    .response-chip.is-yes {
      background: rgba(51, 117, 82, 0.14);
      color: #25533b;
    }

    .response-chip.is-partial {
      background: rgba(182, 133, 55, 0.16);
      color: #7b5d1f;
    }

    .response-chip.is-no {
      background: rgba(145, 80, 63, 0.15);
      color: #7c3f31;
    }

    .finding-indicator {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 0.35rem 0.7rem;
      background: rgba(184, 132, 51, 0.14);
      color: #7b5d1f;
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }

    .finding-prompt {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem;
      border-radius: 18px;
      border: 1px solid rgba(145, 80, 63, 0.14);
      background: rgba(253, 247, 243, 0.92);
      align-items: center;
    }

    .finding-prompt p {
      margin: 0.3rem 0 0;
      color: var(--muted);
    }

    .completion-callout {
      padding: 1rem 1.1rem;
      border-radius: 20px;
      border: 1px solid rgba(36, 79, 61, 0.12);
      background: rgba(244, 247, 242, 0.86);
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: center;
      flex-wrap: wrap;
    }

    @media (max-width: 980px) {
      .audit-steps,
      .audit-conduct-layout {
        grid-template-columns: 1fr;
      }

      .finding-prompt,
      .completion-callout,
      .question-card__head {
        display: grid;
      }

      .question-card__actions {
        justify-items: stretch;
      }

      .question-quick-actions {
        justify-content: start;
      }

      .finding-modal {
        inset: auto 1rem 1rem 1rem;
        transform: none;
        width: auto;
        max-height: calc(100vh - 2rem);
      }
    }
  `]
})
export class AuditsPageComponent {
  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
  protected readonly audits = signal<AuditRecord[]>([]);
  protected readonly users = signal<UserOption[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selectedAudit = signal<AuditRecord | null>(null);
  protected readonly activeStep = signal<AuditStep>('plan');
  protected readonly currentClauseIndex = signal(0);
  protected readonly expandedChecklistId = signal<string | null>(null);
  protected readonly checklistNoteDrafts = signal<Record<string, string>>({});
  protected readonly pendingFindingChecklistId = signal<string | null>(null);
  protected readonly checklistScrollTop = signal<number | null>(null);
  protected readonly selectedFindingId = signal<string | null>(null);
  protected readonly checklistBuilderOpen = signal(false);
  protected readonly draftActionTitle = signal<string | null>(null);
  protected readonly draftActionDescription = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly generatingReport = signal(false);
  protected readonly message = signal((history.state?.notice as string) || '');
  protected readonly error = signal('');

  protected readonly auditForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(40)]],
    title: ['', [Validators.required, Validators.maxLength(160)]],
    type: ['Internal Audit' as AuditType, Validators.required],
    standard: ['ISO 9001'],
    scope: [''],
    leadAuditorId: [''],
    auditeeArea: [''],
    scheduledAt: [''],
    summary: [''],
    status: ['PLANNED' as AuditStatus, Validators.required]
  });

  protected readonly checklistForm = this.fb.nonNullable.group({
    clause: [''],
    subclause: [''],
    title: ['', [Validators.required, Validators.maxLength(200)]],
    notes: ['']
  });

  protected readonly findingForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    description: ['', [Validators.required, Validators.maxLength(2000)]],
    severity: ['OBSERVATION' as FindingSeverity, Validators.required],
    ownerId: [''],
    dueDate: ['']
  });

  protected readonly closeoutForm = this.fb.nonNullable.group({
    conclusion: ['', [Validators.required, Validators.maxLength(4000)]],
    recommendations: ['', [Validators.required, Validators.maxLength(4000)]],
    completionDate: ['', Validators.required],
    completedByAuditorId: ['', Validators.required]
  });

  constructor() {
    this.loadUsers();
    this.route.data.subscribe((data) => {
      this.mode.set((data['mode'] as PageMode) || 'list');
      this.handleRoute(this.route.snapshot.paramMap);
    });
    this.route.paramMap.subscribe((params) => this.handleRoute(params));
  }

  protected pageTitle() {
    return {
      list: 'Audit program',
      create: 'Create audit plan',
      detail: this.selectedAudit()?.title || 'Audit detail',
      edit: this.selectedAudit()?.title || 'Edit audit'
    }[this.mode()];
  }

  protected pageDescription() {
    return {
      list: 'Manage internal and supplier audits with guided execution, findings, and follow-up.',
      create: 'Set up the audit plan first, then run the checklist from a dedicated conduct screen.',
      detail: 'Plan the audit, work through the checklist, and close findings from a guided three-step workflow.',
      edit: 'Update audit metadata without mixing it with execution details.'
    }[this.mode()];
  }

  protected breadcrumbs() {
    if (this.mode() === 'list') return [{ label: 'Audits' }];
    const base = [{ label: 'Audits', link: '/audits' }];
    if (this.mode() === 'create') return [...base, { label: 'New audit' }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedAudit()?.code || 'Audit', link: `/audits/${this.selectedId()}` }, { label: 'Edit' }];
    return [...base, { label: this.selectedAudit()?.code || 'Audit' }];
  }

  protected saveAudit() {
    if (!this.canWriteAudit()) {
      this.error.set('You do not have permission to update audits.');
      return;
    }

    if (this.auditForm.invalid) {
      this.error.set('Complete the required audit fields.');
      return;
    }

    const raw = this.auditForm.getRawValue();
    if (raw.type === 'Internal Audit' && !raw.standard) {
      this.error.set('Select an ISO standard for internal audits.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    const payload = {
      ...raw,
      code: raw.code.trim(),
      title: raw.title.trim(),
      standard: raw.type === 'Internal Audit' ? raw.standard : undefined,
      scope: raw.scope.trim() || undefined,
      leadAuditorId: raw.leadAuditorId || undefined,
      auditeeArea: raw.auditeeArea.trim() || undefined,
      scheduledAt: raw.scheduledAt || undefined,
      summary: raw.summary.trim() || undefined
    };

    const request = this.selectedId()
      ? this.api.patch<AuditRecord>(`audits/${this.selectedId()}`, payload)
      : this.api.post<AuditRecord>('audits', payload);

    request.subscribe({
      next: (audit) => {
        this.saving.set(false);
        this.router.navigate(['/audits', audit.id], { state: { notice: 'Audit saved successfully.' } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Audit save failed.'));
      }
    });
  }

  protected addChecklistItem() {
    if (!this.selectedId() || this.checklistForm.invalid || !this.canWriteAudit()) {
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    const raw = this.checklistForm.getRawValue();
    this.api.post(`audits/${this.selectedId()}/checklist-items`, {
      ...raw,
      clause: raw.clause.trim() || undefined,
      subclause: raw.subclause.trim() || undefined,
      notes: raw.notes.trim() || undefined,
      standard: this.selectedAudit()?.standard || undefined
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('Checklist item added.');
        this.checklistForm.reset({
          clause: this.currentChecklistGroup()?.clause || '',
          subclause: '',
          title: '',
          notes: ''
        });
        this.fetchAudit(this.selectedId() as string, { preserveStep: true });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Checklist item save failed.'));
      }
    });
  }

  protected updateChecklistItem(
    item: AuditChecklistItem,
    patch: { response?: ChecklistResponse | null; notes?: string },
    options?: { nextStepOnSuccess?: AuditStep }
  ) {
    if (!this.canWriteAudit()) {
      this.error.set('You do not have permission to update audits.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.api.patch(`audits/checklist-items/${item.id}`, {
      response: patch.response,
      notes: patch.notes !== undefined ? patch.notes.trim() || undefined : undefined
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('Checklist item updated.');
        this.fetchAudit(this.selectedId() as string, { preserveStep: !options?.nextStepOnSuccess });
        if (options?.nextStepOnSuccess) {
          this.activeStep.set(options.nextStepOnSuccess);
          if (options.nextStepOnSuccess === 'review') {
            this.message.set('Checklist complete. Review findings and finish the audit close-out.');
          }
        }
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Checklist update failed.'));
      }
    });
  }

  protected setChecklistResponse(item: AuditChecklistItem, response: ChecklistResponse) {
    if (response === 'NO' && !this.findingForChecklist(item)) {
      this.openFindingComposer(item);
    } else if (this.pendingFindingChecklistId() === item.id && response !== 'NO') {
      this.cancelFindingComposer();
    }

    const willAddAnswer = !item.response && !!response;
    const willCompleteChecklist =
      willAddAnswer &&
      response !== 'NO' &&
      this.totalChecklistCount() > 0 &&
      this.answeredChecklistCount() + 1 >= this.totalChecklistCount();

    this.updateChecklistItem(item, { response }, {
      nextStepOnSuccess: willCompleteChecklist ? 'review' : undefined
    });
  }

  protected checklistNoteDraft(item: AuditChecklistItem) {
    return this.checklistNoteDrafts()[item.id] ?? item.notes ?? '';
  }

  protected setChecklistNoteDraft(id: string, value: string) {
    this.checklistNoteDrafts.update((drafts) => ({ ...drafts, [id]: value }));
  }

  protected saveChecklistNote(item: AuditChecklistItem) {
    const nextValue = this.checklistNoteDraft(item).trim();
    const currentValue = item.notes?.trim() || '';
    if (nextValue === currentValue) {
      return;
    }

    this.updateChecklistItem(item, { notes: nextValue });
  }

  protected removeChecklistItem(id: string) {
    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.api.delete(`audits/checklist-items/${id}`).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('Checklist item removed.');
        this.fetchAudit(this.selectedId() as string, { preserveStep: true });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Checklist item removal failed.'));
      }
    });
  }

  protected addFinding() {
    if (!this.selectedId() || this.findingForm.invalid || !this.canWriteAudit()) {
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    const raw = this.findingForm.getRawValue();
    this.api.post(`audits/${this.selectedId()}/findings`, {
      ...raw,
      ownerId: raw.ownerId || undefined,
      dueDate: raw.dueDate || undefined
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('Finding added.');
        this.findingForm.reset({ title: '', description: '', severity: 'OBSERVATION', ownerId: '', dueDate: '' });
        this.fetchAudit(this.selectedId() as string, { preserveStep: true });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Finding save failed.'));
      }
    });
  }

  protected addFindingFromChecklist(item: AuditChecklistItem) {
    if (!this.selectedId() || this.findingForm.invalid || !this.canWriteAudit()) {
      this.findingForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    const raw = this.findingForm.getRawValue();
    this.api.post(`audits/${this.selectedId()}/findings`, {
      title: raw.title.trim(),
      description: raw.description.trim(),
      severity: raw.severity,
      ownerId: raw.ownerId || undefined,
      dueDate: raw.dueDate || undefined,
      checklistItemId: item.id,
      clause: item.clause || undefined
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('Finding recorded. Continue with the checklist.');
        this.selectedFindingId.set(null);
        this.pendingFindingChecklistId.set(null);
        this.fetchAudit(this.selectedId() as string, { preserveStep: true });
        this.restoreChecklistScrollSoon();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Finding save failed.'));
      }
    });
  }

  protected updateFindingStatus(finding: AuditFinding, status: FindingStatus) {
    if (!this.canWriteAudit()) {
      this.error.set('You do not have permission to update audits.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.api.patch(`audits/findings/${finding.id}`, { status }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('Finding updated.');
        this.fetchAudit(this.selectedId() as string, { preserveStep: true });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Finding update failed.'));
      }
    });
  }

  protected createCapaFromFinding(finding: AuditFinding) {
    if (!this.canCreateCapa()) {
      this.error.set('You do not have permission to create CAPA records.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.api.post(`audits/findings/${finding.id}/create-capa`, {
      title: `Audit finding CAPA: ${finding.title}`,
      problemStatement: this.cleanFindingDescription(finding.description),
      ownerId: finding.ownerId || undefined,
      dueDate: finding.dueDate || undefined
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('CAPA created from audit finding.');
        this.fetchAudit(this.selectedId() as string, { preserveStep: true });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'CAPA creation failed.'));
      }
    });
  }

  protected prepareActionFromFinding(finding: AuditFinding) {
    if (!this.canCreateActions()) {
      this.error.set('You do not have permission to create actions.');
      return;
    }

    this.draftActionTitle.set(`Audit action: ${finding.title}`);
    this.draftActionDescription.set(this.cleanFindingDescription(finding.description));
    this.message.set('Action form prepared from the selected finding.');
  }

  protected openFindingComposer(item: AuditChecklistItem) {
    this.checklistScrollTop.set(window.scrollY);
    this.expandedChecklistId.set(item.id);
    this.pendingFindingChecklistId.set(item.id);
    this.findingForm.patchValue({
      title: `Finding: Clause ${item.clause || 'General'} - ${item.title}`,
      description: item.notes?.trim() || `Requirement not met during audit: ${item.title}`,
      severity: 'MAJOR',
      ownerId: '',
      dueDate: ''
    });
    this.message.set('Finding form opened for the selected question.');
  }

  protected cancelFindingComposer() {
    this.pendingFindingChecklistId.set(null);
    this.selectedFindingId.set(null);
    this.findingForm.reset({ title: '', description: '', severity: 'OBSERVATION', ownerId: '', dueDate: '' });
    this.restoreChecklistScrollSoon();
  }

  protected setActiveStep(step: AuditStep) {
    this.activeStep.set(step);
  }

  protected toggleChecklistBuilder() {
    if (this.checklistBuilderOpen()) {
      this.closeChecklistBuilder();
      return;
    }

    this.checklistForm.reset({
      clause: this.currentChecklistGroup()?.clause || '',
      subclause: '',
      title: '',
      notes: ''
    });
    this.checklistBuilderOpen.set(true);
  }

  protected closeChecklistBuilder() {
    this.checklistBuilderOpen.set(false);
    this.checklistForm.reset({ clause: '', subclause: '', title: '', notes: '' });
  }

  protected toggleChecklist(id: string) {
    this.expandedChecklistId.set(this.expandedChecklistId() === id ? null : id);
  }

  protected isChecklistExpanded(id: string) {
    return this.expandedChecklistId() === id;
  }

  protected currentChecklistGroup() {
    return this.checklistGroups()[this.currentClauseIndex()] ?? null;
  }

  protected hasPreviousClause() {
    return this.currentClauseIndex() > 0;
  }

  protected hasNextClause() {
    return this.currentClauseIndex() < this.checklistGroups().length - 1;
  }

  protected previousClause() {
    if (!this.hasPreviousClause()) {
      return;
    }
    this.currentClauseIndex.update((index) => Math.max(0, index - 1));
    this.expandFirstQuestionInCurrentClause();
  }

  protected nextClause() {
    if (!this.hasNextClause()) {
      return;
    }
    this.currentClauseIndex.update((index) => Math.min(this.checklistGroups().length - 1, index + 1));
    this.expandFirstQuestionInCurrentClause();
  }

  protected currentClauseLabel() {
    const group = this.currentChecklistGroup();
    if (!group) {
      return 'No active clause';
    }
    return `Clause ${group.clause} - ${this.clauseHeading(group.clause)}`;
  }

  protected currentClauseHelperText() {
    if (this.selectedAudit()?.type === 'Supplier Audit') {
      return 'Answer each supplier audit question, record evidence, and add a finding only when a requirement is not met.';
    }
    return 'Answer each question. If a requirement is not met, record a finding and continue to the next question.';
  }

  protected answeredChecklistCount() {
    return (this.selectedAudit()?.checklistItems || []).filter((item) => !!item.response).length;
  }

  protected totalChecklistCount() {
    return this.selectedAudit()?.checklistItems?.length || 0;
  }

  protected progressPercent() {
    const total = this.totalChecklistCount();
    return total ? Math.round((this.answeredChecklistCount() / total) * 100) : 0;
  }

  protected answeredInCurrentClause() {
    return (this.currentChecklistGroup()?.items || []).filter((item) => !!item.response).length;
  }

  protected responseLabel(response?: ChecklistResponse | null) {
    if (response === 'PARTIAL') {
      return 'N/A';
    }
    return response || 'Not answered';
  }

  protected questionNumber(clause: string, index: number) {
    return `${clause}.${index + 1}`;
  }

  protected findingForChecklist(item: AuditChecklistItem) {
    return (
      item.linkedFindings?.[0] ??
      (this.selectedAudit()?.findings || []).find((finding) => finding.checklistItemId === item.id) ??
      null
    );
  }

  protected pendingFindingItem() {
    const itemId = this.pendingFindingChecklistId();
    if (!itemId) {
      return null;
    }
    return (this.selectedAudit()?.checklistItems || []).find((item) => item.id === itemId) ?? null;
  }

  protected pendingQuestionIndex(item: AuditChecklistItem) {
    const group = this.checklistGroups().find((entry) => entry.items.some((entryItem) => entryItem.id === item.id));
    if (!group) {
      return 0;
    }
    return Math.max(group.items.findIndex((entryItem) => entryItem.id === item.id), 0);
  }

  protected viewFindingForChecklist(item: AuditChecklistItem) {
    const finding = this.findingForChecklist(item);
    if (!finding) {
      return;
    }
    this.pendingFindingChecklistId.set(null);
    this.selectedFindingId.set(finding.id);
    this.activeStep.set('review');
    this.message.set('Viewing the linked finding for this checklist question.');
  }

  protected focusChecklistQuestion(finding: AuditFinding) {
    if (!finding.checklistItemId) {
      return;
    }

    const groups = this.checklistGroups();
    const targetGroupIndex = groups.findIndex((group) =>
      group.items.some((item) => item.id === finding.checklistItemId)
    );

    if (targetGroupIndex >= 0) {
      this.currentClauseIndex.set(targetGroupIndex);
    }

    this.expandedChecklistId.set(finding.checklistItemId);
    this.selectedFindingId.set(finding.id);
    this.activeStep.set('conduct');
    this.message.set('Returned to the checklist question linked to this finding.');
  }

  protected scrollToAuditActions() {
    const section = document.getElementById('audit-actions-section');
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected cleanFindingDescription(description: string) {
    return description.trim();
  }

  protected findingsTraceabilityCopy() {
    const findings = this.selectedAudit()?.findings || [];
    const capaLinkedCount = findings.filter((finding) => !!finding.linkedCapaId).length;
    const actionCount = this.selectedAudit()?.actionItemCount || 0;
    return `Follow the chain from checklist evidence to finding, then into ${capaLinkedCount ? `${capaLinkedCount} linked CAPA record${capaLinkedCount === 1 ? '' : 's'}` : 'CAPA only where needed'} and ${actionCount} linked audit action${actionCount === 1 ? '' : 's'}.`;
  }

  protected auditNextStepsCopy() {
    const audit = this.selectedAudit();
    if (!audit) {
      return 'Next: continue the audit from the current workflow step.';
    }
    if (audit.status === 'COMPLETED' || audit.status === 'CLOSED') {
      return 'Next: review the completed audit record, its findings, and the formal report output.';
    }
    if (audit.isChecklistCompleted) {
      return 'Next: review findings, complete the close-out, and then finish the audit from the review step.';
    }
    return 'Next: continue the checklist, record findings where needed, and return to the review step when the checklist is complete.';
  }

  protected findingSeverityLabel(severity: FindingSeverity) {
    if (severity === 'MAJOR') return 'Major nonconformity';
    if (severity === 'MINOR') return 'Minor nonconformity';
    return 'Observation';
  }

  protected findingStatusLabel(status: FindingStatus) {
    if (status === 'CAPA_CREATED') return 'CAPA raised';
    return status === 'CLOSED' ? 'Closed' : 'Open';
  }

  protected findingSeveritySummary() {
    const findings = this.selectedAudit()?.findings || [];
    if (!findings.length) {
      return {
        heading: 'No findings require formal follow-up',
        copy: 'This audit can move into close-out once the conclusion and recommendations are recorded.'
      };
    }

    const major = findings.filter((finding) => finding.severity === 'MAJOR').length;
    const minor = findings.filter((finding) => finding.severity === 'MINOR').length;
    const observations = findings.filter((finding) => finding.severity === 'OBSERVATION').length;
    return {
      heading: 'Findings profile',
      copy: `${major} major, ${minor} minor, and ${observations} observation${observations === 1 ? '' : 's'} are currently linked to this audit. Major findings should move into CAPA before the finding itself is closed.`
    };
  }

  protected findingControlHeading(finding: AuditFinding) {
    if (finding.linkedCapaId) {
      return 'Corrective action path is active';
    }
    if (finding.severity === 'MAJOR') {
      return 'Major finding requires CAPA';
    }
    if (finding.status === 'CLOSED') {
      return 'Finding has been closed';
    }
    return 'Finding still needs follow-up';
  }

  protected findingControlCopy(finding: AuditFinding) {
    if (finding.linkedCapaId) {
      return 'This finding already has a linked CAPA. Keep the corrective workflow and evidence trail current before closing the finding.';
    }
    if (finding.severity === 'MAJOR') {
      return 'A major nonconformity should move into CAPA so the audit trail shows formal corrective action ownership and verification.';
    }
    if (finding.status === 'CLOSED') {
      return 'The finding is closed in the audit record. Keep any linked action or CAPA evidence available for future audit review.';
    }
    return 'Use CAPA where formal corrective action is required, or create a corrective action directly when a lighter follow-up is enough.';
  }

  protected auditCloseoutHeading() {
    return this.canCompleteAudit() ? 'Audit is ready for completion' : 'Close-out requirements are still open';
  }

  protected auditCloseoutGuidance() {
    if (!this.isChecklistComplete()) {
      return 'Complete all checklist questions before the audit can be finished.';
    }
    if (this.closeoutForm.invalid) {
      return 'Record the conclusion, recommendations, completion date, and auditor before finishing the audit.';
    }
    return 'The audit record can be completed now. Findings, actions, and NCR follow-up can continue after audit completion without reopening the audit itself.';
  }

  protected auditDateValue(audit: AuditRecord) {
    const date = audit.completedAt || audit.scheduledAt || audit.startedAt;
    return date ? date.slice(0, 10) : 'Not set';
  }

  protected auditDateLabel(audit: AuditRecord) {
    if (audit.completedAt) {
      return 'Completed date';
    }
    if (audit.scheduledAt) {
      return 'Scheduled date';
    }
    if (audit.startedAt) {
      return 'Started date';
    }
    return 'No audit date';
  }

  protected findingsFollowUpCopy(audit: AuditRecord) {
    const total = audit.findingCount || 0;
    const open = audit.openFindingCount || 0;
    const closed = Math.max(total - open, 0);

    if (!total) {
      return 'No findings raised';
    }

    if (!open) {
      return `${closed} closed`;
    }

    if (!closed) {
      return `${open} open`;
    }

    return `${open} open | ${closed} closed`;
  }

  protected findingsFollowUpClass(audit: AuditRecord) {
    const total = audit.findingCount || 0;
    const open = audit.openFindingCount || 0;
    if (!total) {
      return 'followup-neutral';
    }
    if (open > 0) {
      return 'followup-open';
    }
    return 'followup-closed';
  }

  protected isChecklistReadOnly() {
    return !this.canWriteAudit() || this.selectedAudit()?.status === 'COMPLETED' || this.selectedAudit()?.status === 'CLOSED';
  }

  protected isChecklistComplete() {
    return !!this.selectedAudit()?.isChecklistCompleted;
  }

  protected canCompleteAudit() {
    return this.canWriteAudit() && this.isChecklistComplete() && this.closeoutForm.valid && this.selectedAudit()?.status !== 'COMPLETED';
  }

  protected saveCloseoutDraft() {
    if (!this.selectedId() || !this.canWriteAudit()) {
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');

    const raw = this.closeoutForm.getRawValue();
    this.api.patch<AuditRecord>(`audits/${this.selectedId()}`, {
      conclusion: raw.conclusion.trim() || undefined,
      recommendations: raw.recommendations.trim() || undefined,
      completionDate: raw.completionDate || undefined,
      completedByAuditorId: raw.completedByAuditorId || undefined
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('Audit close-out draft saved.');
        this.fetchAudit(this.selectedId() as string, { preserveStep: true });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Audit close-out could not be saved.'));
      }
    });
  }

  protected completeAudit() {
    if (!this.selectedId() || !this.canWriteAudit()) {
      return;
    }

    if (!this.canCompleteAudit()) {
      this.closeoutForm.markAllAsTouched();
      this.error.set('Complete the checklist and all close-out fields before completing the audit.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');

    const raw = this.closeoutForm.getRawValue();
    this.api.patch<AuditRecord>(`audits/${this.selectedId()}`, {
      conclusion: raw.conclusion.trim(),
      recommendations: raw.recommendations.trim(),
      completionDate: raw.completionDate || undefined,
      completedByAuditorId: raw.completedByAuditorId,
      status: 'COMPLETED'
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('Audit completed successfully.');
        this.fetchAudit(this.selectedId() as string, { preserveStep: true });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Audit completion failed.'));
      }
    });
  }

  protected updateAuditStatus(status: AuditStatus) {
    if (!this.selectedId()) {
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.api.patch<AuditRecord>(`audits/${this.selectedId()}`, { status }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set(
          status === 'COMPLETED'
            ? 'Audit completed successfully.'
            : status === 'CHECKLIST_COMPLETED'
              ? 'Checklist marked complete.'
              : status === 'CLOSED'
                ? 'Audit closed successfully.'
                : 'Audit status updated.'
        );
        this.fetchAudit(this.selectedId() as string, { preserveStep: true });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Audit status update failed.'));
      }
    });
  }

  protected canDeleteAudit() {
    return this.authStore.hasPermission('admin.delete') && this.selectedAudit()?.status === 'PLANNED';
  }

  protected canManageQuestionBank() {
    return this.authStore.hasPermission('audits.write');
  }

  protected canWriteAudit() {
    return this.authStore.hasPermission('audits.write');
  }

  protected canCreateCapa() {
    return this.authStore.hasPermission('capa.write');
  }

  protected canCreateActions() {
    return this.authStore.hasPermission('action-items.write');
  }

  protected canArchiveAudit() {
    return this.authStore.hasPermission('admin.delete') && !!this.selectedAudit() && this.selectedAudit()?.status !== 'PLANNED';
  }

  protected deleteAudit() {
    if (!this.selectedId() || !this.canDeleteAudit()) {
      return;
    }

    if (!window.confirm('Delete this planning-stage audit? Completed audits should be archived instead.')) {
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.api.delete(`audits/${this.selectedId()}`).subscribe({
      next: () => {
        this.saving.set(false);
        void this.router.navigate(['/audits'], { state: { notice: 'Audit deleted.' } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Audit deletion failed.'));
      }
    });
  }

  protected archiveAudit() {
    if (!this.selectedId() || !this.canArchiveAudit()) {
      return;
    }

    if (!window.confirm('Archive this audit? It will be removed from active lists but kept in the audit trail.')) {
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.api.patch(`audits/${this.selectedId()}/archive`, {}).subscribe({
      next: () => {
        this.saving.set(false);
        void this.router.navigate(['/audits'], { state: { notice: 'Audit archived.' } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Audit archive failed.'));
      }
    });
  }

  protected generateReport() {
    if (!this.selectedId()) {
      return;
    }

    this.generatingReport.set(true);
    this.error.set('');
    this.message.set('');

    this.api.getBlobResponse(`audits/${this.selectedId()}/report`).subscribe({
      next: (response) => {
        this.generatingReport.set(false);
        this.downloadResponse(response, `${this.selectedAudit()?.code || 'audit-report'}.pdf`);
        this.message.set('Audit PDF download started.');
      },
      error: (error: HttpErrorResponse) => {
        this.generatingReport.set(false);
        this.error.set(this.readError(error, 'Audit PDF could not be prepared.'));
      }
    });
  }

  protected readTextarea(event: Event) {
    return (event.target as HTMLTextAreaElement).value;
  }

  protected checklistGroups(): ChecklistGroup[] {
    return this.buildChecklistGroups(this.selectedAudit()?.checklistItems || []);
  }

  private buildChecklistGroups(items: AuditChecklistItem[]) {
    const groups = new Map<string, AuditChecklistItem[]>();

    for (const item of items) {
      const clause = item.clause || 'Other';
      groups.set(clause, [...(groups.get(clause) || []), item]);
    }

    return [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([clause, groupItems]) => ({ clause, items: groupItems }));
  }

  protected clauseHeading(clause: string) {
    return {
      '4': 'Context of the organization',
      '5': 'Leadership',
      '6': 'Planning',
      '7': 'Support',
      '8': 'Operation',
      '9': 'Performance evaluation',
      '10': 'Improvement'
    }[clause] || 'Additional checklist items';
  }

  private expandFirstQuestionInCurrentClause() {
    this.pendingFindingChecklistId.set(null);
    this.expandedChecklistId.set(this.currentChecklistGroup()?.items?.[0]?.id ?? null);
  }

  private restoreChecklistScrollSoon() {
    const top = this.checklistScrollTop();
    if (top === null) {
      return;
    }
    requestAnimationFrame(() => {
      window.scrollTo({ top, behavior: 'auto' });
      this.checklistScrollTop.set(null);
    });
  }

  private handleRoute(params: ParamMap) {
    const id = params.get('id');
    this.selectedId.set(id);
    this.message.set((history.state?.notice as string) || '');
    this.error.set('');
    this.activeStep.set('plan');
    this.currentClauseIndex.set(0);
    this.expandedChecklistId.set(null);
    this.pendingFindingChecklistId.set(null);
    this.selectedFindingId.set(null);
    this.checklistNoteDrafts.set({});
    this.checklistBuilderOpen.set(false);
    this.draftActionTitle.set(null);
    this.draftActionDescription.set(null);

    if (this.mode() === 'list') {
      this.selectedAudit.set(null);
      this.resetForms();
      this.reload();
      return;
    }

    if (this.mode() === 'create') {
      this.selectedAudit.set(null);
      this.resetForms();
      return;
    }

    if (id) {
      this.fetchAudit(id);
    }
  }

  private resetForms() {
    this.auditForm.reset({
      code: '',
      title: '',
      type: 'Internal Audit',
      standard: 'ISO 9001',
      scope: '',
      leadAuditorId: '',
      auditeeArea: '',
      scheduledAt: '',
      summary: '',
      status: 'PLANNED'
    });
    this.checklistForm.reset({ clause: '', subclause: '', title: '', notes: '' });
    this.findingForm.reset({ title: '', description: '', severity: 'OBSERVATION', ownerId: '', dueDate: '' });
    this.closeoutForm.reset({
      conclusion: '',
      recommendations: '',
      completionDate: '',
      completedByAuditorId: ''
    });
  }

  private fetchAudit(id: string, options?: { preserveStep?: boolean }) {
    this.loading.set(true);
    this.api.get<AuditRecord>(`audits/${id}`).subscribe({
      next: (audit) => {
        const currentExpandedId = this.expandedChecklistId();
        const currentClauseIndex = this.currentClauseIndex();
        const currentStep = this.activeStep();
        this.loading.set(false);
        this.selectedAudit.set(audit);
        this.activeStep.set(options?.preserveStep ? currentStep : this.deriveStep(audit));
        this.checklistNoteDrafts.set(
          Object.fromEntries((audit.checklistItems || []).map((item) => [item.id, item.notes ?? '']))
        );
        const groups = this.buildChecklistGroups(audit.checklistItems || []);
        this.currentClauseIndex.set(Math.min(currentClauseIndex, Math.max(groups.length - 1, 0)));
        this.expandedChecklistId.set(
          (audit.checklistItems || []).some((item) => item.id === currentExpandedId)
            ? currentExpandedId
            : groups[this.currentClauseIndex()]?.items?.[0]?.id ?? audit.checklistItems?.[0]?.id ?? null
        );
        this.auditForm.reset({
          code: audit.code,
          title: audit.title,
          type: audit.type,
          standard: audit.standard ?? 'ISO 9001',
          scope: audit.scope ?? '',
          leadAuditorId: audit.leadAuditorId ?? '',
          auditeeArea: audit.auditeeArea ?? '',
          scheduledAt: audit.scheduledAt?.slice(0, 10) ?? '',
          summary: audit.summary ?? '',
          status: audit.status
        });
        this.closeoutForm.reset({
          conclusion: audit.conclusion ?? '',
          recommendations: audit.recommendations ?? '',
          completionDate: audit.completedAt?.slice(0, 10) ?? this.todayIso(),
          completedByAuditorId: audit.completedByAuditorId ?? audit.leadAuditorId ?? ''
        });
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Audit details could not be loaded.'));
      }
    });
  }

  private reload() {
    this.loading.set(true);
    this.api.get<AuditRecord[]>('audits').subscribe({
      next: (items) => {
        this.loading.set(false);
        this.audits.set(items);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Audits could not be loaded.'));
      }
    });
  }

  private loadUsers() {
    this.api.get<UserOption[]>('users').subscribe((users) => this.users.set(users));
  }

  private deriveStep(audit: AuditRecord): AuditStep {
    if (audit.status === 'CHECKLIST_COMPLETED' || audit.status === 'COMPLETED' || audit.status === 'CLOSED') {
      return 'review';
    }

    if ((audit.completedChecklistCount || 0) > 0 || audit.status === 'IN_PROGRESS') {
      return 'conduct';
    }

    return 'plan';
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

  private todayIso() {
    return new Date().toISOString().slice(0, 10);
  }
}
