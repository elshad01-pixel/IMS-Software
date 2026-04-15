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
type AuditReviewStage = 'findings' | 'actions' | 'closeout';
type AuditStatus = 'PLANNED' | 'IN_PROGRESS' | 'CHECKLIST_COMPLETED' | 'COMPLETED' | 'CLOSED';
type AuditType = 'Internal Audit' | 'Supplier Audit';
type AuditStandard = 'ISO 9001' | 'ISO 45001' | 'ISO 14001';
type AuditScopeType = 'Company-wide' | 'Department' | 'Process' | 'Site' | 'Supplier';
type AuditSortOption = 'attention' | 'auditDate' | 'updated' | 'programme';
type ChecklistResponse = 'YES' | 'NO' | 'PARTIAL';
type FindingSeverity = 'OBSERVATION' | 'OPPORTUNITY' | 'MINOR' | 'MAJOR';
type FindingStatus = 'OPEN' | 'CAPA_CREATED' | 'CLOSED';
type ReturnNavigation = {
  route: string[];
  label: string;
  state?: Record<string, unknown>;
};

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
    linkedCapaId?: string | null;
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
  programme?: string | null;
  scopeType?: AuditScopeType | null;
  scope?: string | null;
  objectives?: string | null;
  criteria?: string | null;
  agenda?: string | null;
  openingMeetingNotes?: string | null;
  closingMeetingNotes?: string | null;
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
  updatedAt?: string;
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

          <div class="detail-grid top-space" *ngIf="!loading() && audits().length">
            <section class="detail-section">
              <h4>Programme view</h4>
              <p>{{ auditProgrammeSummary() }}</p>
            </section>
            <section class="detail-section">
              <h4>Scope mix</h4>
              <p>{{ auditScopeMixSummary() }}</p>
            </section>
          </div>

          <div class="filter-row standard-filter-grid top-space" *ngIf="!loading() && audits().length">
            <label class="field compact-field">
              <span>Sort by</span>
              <select [value]="sortBy()" (change)="setSortBy(readSelectValue($event))">
                <option value="attention">Attention</option>
                <option value="auditDate">Audit date</option>
                <option value="updated">Updated</option>
                <option value="programme">Programme</option>
              </select>
            </label>
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
                  <th>Programme</th>
                  <th>Type</th>
                  <th>Audit date</th>
                  <th>Status</th>
                  <th>Checklist</th>
                  <th>Findings follow-up</th>
                  <th>Attention</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of sortedAudits()" [routerLink]="['/audits', item.id]">
                  <td>
                    <div class="table-title">
                      <strong>{{ item.code }}</strong>
                      <small>{{ item.title }}</small>
                    </div>
                  </td>
                  <td>
                    <div class="table-title">
                      <strong>{{ item.programme || 'Not assigned' }}</strong>
                      <small>{{ item.scopeType || 'Scope type not set' }}</small>
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
                  <td><span class="status-badge" [ngClass]="attentionClass(item)">{{ attentionLabel(item) }}</span></td>
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

          <div class="form-grid-2">
            <label class="field">
              <span>Audit programme</span>
              <input formControlName="programme" placeholder="2026 internal audit programme">
            </label>
            <label class="field">
              <span>Scope type</span>
              <select formControlName="scopeType">
                <option>Company-wide</option>
                <option>Department</option>
                <option>Process</option>
                <option>Site</option>
                <option>Supplier</option>
              </select>
            </label>
          </div>

          <label class="field"><span>Scope</span><textarea rows="3" formControlName="scope" placeholder="Process, site, supplier, or function under audit"></textarea></label>

          <div class="form-grid-2">
            <label class="field"><span>Audit objectives</span><textarea rows="3" formControlName="objectives" placeholder="Confirm process conformity, evaluate control effectiveness, and verify previous action closure."></textarea></label>
            <label class="field"><span>Audit criteria</span><textarea rows="3" formControlName="criteria" placeholder="Applicable ISO clauses, internal procedures, customer or supplier requirements, and legal obligations."></textarea></label>
          </div>

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

          <div class="button-row">
            <button type="button" class="secondary" (click)="applyAuditPlanTemplate()">Fill agenda template</button>
            <button type="button" class="secondary" (click)="applyMeetingTemplate()">Fill opening / closing notes</button>
          </div>

          <label class="field"><span>Audit agenda</span><textarea rows="5" formControlName="agenda" placeholder="Opening meeting, scope confirmation, process walk-through, evidence review, interviews, close-out."></textarea></label>

          <div class="form-grid-2">
            <label class="field"><span>Opening meeting notes</span><textarea rows="4" formControlName="openingMeetingNotes" placeholder="Attendance, scope confirmation, timing, health and safety rules, and communication expectations."></textarea></label>
            <label class="field"><span>Closing meeting notes</span><textarea rows="4" formControlName="closingMeetingNotes" placeholder="Summary of findings, agreed follow-up, next steps, and expected report timing."></textarea></label>
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
              <strong>Programme planning</strong>
              <small>Set the programme, scope type, objectives, criteria, and agenda before the audit is issued to the auditee.</small>
            </div>
            <div class="entity-item">
              <strong>Department, process, or supplier audits</strong>
              <small>Use the scope type to show whether this is a process audit, department audit, company-wide review, site audit, or supplier audit.</small>
            </div>
            <div class="entity-item">
              <strong>Meeting templates</strong>
              <small>Use the starter buttons to issue an agenda, prepare the opening meeting, and capture close-out notes before the final report.</small>
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

          <section class="guidance-card top-space">
            <strong>{{ attentionHeadline(selectedAudit()) }}</strong>
            <p>{{ attentionNarrative(selectedAudit()) }}</p>
          </section>

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
                <h3>Programme, scope, and readiness</h3>
                <p class="subtle">Confirm the audit programme, scope type, criteria, agenda, and meeting structure before starting fieldwork.</p>
              </div>
            </div>

            <div class="summary-strip top-space">
              <article class="summary-item">
                <span>Programme</span>
                <strong>{{ selectedAudit()?.programme || 'Not set' }}</strong>
              </article>
              <article class="summary-item">
                <span>Scope type</span>
                <strong>{{ selectedAudit()?.scopeType || 'Not set' }}</strong>
              </article>
              <article class="summary-item">
                <span>Scheduled date</span>
                <strong>{{ selectedAudit()?.scheduledAt ? selectedAudit()?.scheduledAt?.slice(0, 10) : 'Not scheduled' }}</strong>
              </article>
            </div>

            <dl class="key-value top-space">
              <dt>Scope</dt>
              <dd>{{ selectedAudit()?.scope || 'No scope recorded.' }}</dd>
              <dt>Audit objectives</dt>
              <dd>{{ selectedAudit()?.objectives || 'No objectives recorded.' }}</dd>
              <dt>Audit criteria</dt>
              <dd>{{ selectedAudit()?.criteria || 'No criteria recorded.' }}</dd>
              <dt>Auditee area</dt>
              <dd>{{ selectedAudit()?.auditeeArea || 'Not set' }}</dd>
              <dt>Summary</dt>
              <dd>{{ selectedAudit()?.summary || 'No summary yet.' }}</dd>
            </dl>

            <section class="detail-section top-space">
              <h4>Audit agenda</h4>
              <p>{{ selectedAudit()?.agenda || 'No agenda prepared yet.' }}</p>
            </section>

            <div class="detail-grid top-space">
              <section class="detail-section">
                <h4>Opening meeting</h4>
                <p>{{ selectedAudit()?.openingMeetingNotes || 'No opening meeting notes prepared yet.' }}</p>
              </section>
              <section class="detail-section">
                <h4>Closing meeting</h4>
                <p>{{ selectedAudit()?.closingMeetingNotes || 'No closing meeting notes prepared yet.' }}</p>
              </section>
            </div>

            <div class="button-row top-space">
              <button type="button" (click)="setActiveStep('conduct')">Start audit</button>
              <a [routerLink]="['/audits', selectedId(), 'edit']" class="button-link secondary">Edit plan</a>
            </div>
          </section>

          <section class="card panel-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Planning pack</span>
                <h3>{{ selectedAudit()?.type === 'Internal Audit' ? 'Internal audit planning guidance' : 'Supplier audit planning guidance' }}</h3>
                <p class="subtle">{{ selectedAudit()?.type === 'Internal Audit'
                  ? 'Use the programme, agenda, and opening or closing notes to issue the audit properly before the checklist starts.'
                  : 'Supplier audits should still start with a simple agenda, opening discussion, and planned close-out summary before questions are assessed.' }}</p>
              </div>
            </div>

            <div class="entity-list top-space">
              <div class="entity-item">
                <strong>Annual audit programme</strong>
                <small>Use the programme field to show which annual plan or audit cycle this audit belongs to before it moves into execution.</small>
              </div>
              <div class="entity-item">
                <strong>Department, process, or whole-company planning</strong>
                <small>The scope type makes it explicit whether the audit is company-wide, department-based, process-based, site-based, or supplier-focused.</small>
              </div>
              <div class="entity-item">
                <strong>Meeting structure</strong>
                <small>Opening and closing meeting notes let the audit record show how the agenda was issued, how the audit was opened, and how the results were closed out.</small>
              </div>
            </div>

            <section class="detail-section top-space" *ngIf="auditTouchpoints().length">
              <h4>Assurance touchpoints</h4>
              <p>{{ auditTouchpointIntro() }}</p>
              <div class="touchpoint-grid top-space">
                <a class="touchpoint-card" *ngFor="let item of auditTouchpoints()" [routerLink]="item.link">
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                  <small>{{ item.copy }}</small>
                </a>
              </div>
            </section>
          </section>
        </section>

        <section *ngIf="activeStep() === 'conduct'" class="page-stack">
          <section class="card panel-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Conduct audit</span>
                <h3>{{ selectedAudit()?.type === 'Internal Audit' ? 'Clause-by-clause checklist' : 'Supplier audit checklist' }}</h3>
                <p class="subtle">Answer each question in order. If a requirement is not met, choose No, record the finding, then continue the audit from the same question.</p>
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
                <article
                  class="question-card"
                  *ngFor="let item of group.items; let questionIndex = index"
                  [class.is-open]="isChecklistExpanded(item.id)"
                  [class.has-unresolved-gap]="checklistQuestionState(item) === 'unresolved'"
                  [class.has-capa-route]="checklistQuestionState(item) === 'capa'"
                  [class.has-closed-route]="checklistQuestionState(item) === 'closed'"
                  [attr.id]="'audit-checklist-item-' + item.id"
                >
                  <div class="question-card__head">
                    <div class="question-card__title">
                      <div class="question-meta">
                        <span class="question-number">{{ item.subclause || questionNumber(group.clause, questionIndex) }}</span>
                        <small>Clause {{ item.clause || group.clause }}</small>
                        <span *ngIf="item.response === 'NO' || findingForChecklist(item)" class="finding-indicator" [class.requires-capa]="checklistQuestionState(item) === 'unresolved'" [class.capa-linked]="checklistQuestionState(item) === 'capa'" [class.closed]="checklistQuestionState(item) === 'closed'">
                          {{ checklistFindingIndicatorLabel(item) }}
                        </span>
                      </div>
                      <strong>{{ item.title }}</strong>
                    </div>

                    <div class="question-card__actions">
                      <div class="response-group">
                        <button type="button" class="response-button" [class.active]="item.response === 'YES'" [disabled]="isChecklistReadOnly()" (click)="setChecklistResponse(item, 'YES')">Yes</button>
                        <button type="button" class="response-button" [class.active]="item.response === 'NO'" [disabled]="isChecklistReadOnly()" (click)="setChecklistResponse(item, 'NO')">No</button>
                        <button type="button" class="response-button" [class.active]="item.response === 'PARTIAL'" [disabled]="isChecklistReadOnly()" (click)="setChecklistResponse(item, 'PARTIAL')">N/A</button>
                      </div>
                      <small class="question-next-step" *ngIf="item.response === 'NO' && !findingForChecklist(item)">
                        Step 2 of 2: record the finding for this gap before moving on.
                      </small>
                      <small class="question-next-step success" *ngIf="item.response === 'NO' && findingForChecklist(item)">
                        {{ checklistFindingNextStep(item) }}
                      </small>

                      <div class="question-quick-actions">
                        <button type="button" class="button-link secondary compact" (click)="toggleChecklist(item.id)">
                          {{ isChecklistExpanded(item.id) ? 'Hide details' : (item.notes ? 'Edit Comment' : 'Add Comment') }}
                        </button>
                        <button type="button" class="button-link secondary compact" *ngIf="!findingForChecklist(item) && item.response === 'NO' && !isChecklistReadOnly()" (click)="openFindingComposer(item)">Record Finding</button>
                        <button type="button" class="button-link secondary compact" *ngIf="findingForChecklist(item)" (click)="viewFindingForChecklist(item)">Review Finding</button>
                        <a *ngIf="findingForChecklist(item)?.linkedCapaId" [routerLink]="['/capa', findingForChecklist(item)?.linkedCapaId]" [state]="auditLinkState(findingForChecklist(item))" class="button-link secondary compact">Open CAPA</a>
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
                        <strong>{{ checklistFindingPromptHeading(item) }}</strong>
                        <p>{{ checklistFindingPromptCopy(item) }}</p>
                      </div>
                      <div class="button-row compact-row">
                        <button type="button" class="secondary" *ngIf="!findingForChecklist(item) && !isChecklistReadOnly()" (click)="openFindingComposer(item)">Record finding now</button>
                        <button type="button" class="secondary" *ngIf="findingForChecklist(item)" (click)="viewFindingForChecklist(item)">Review Finding</button>
                        <a *ngIf="findingForChecklist(item)?.linkedCapaId" [routerLink]="['/capa', findingForChecklist(item)?.linkedCapaId]" [state]="auditLinkState(findingForChecklist(item))" class="button-link secondary compact">Open CAPA</a>
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
                  <h4>Next step: review findings</h4>
                  <p class="subtle">All checklist questions are answered. Open Review findings now, decide the follow-up route for each gap, then complete the audit close-out last.</p>
                </div>
                <div class="button-row compact-row">
                  <button type="button" (click)="openReviewFindings()">Next: Review findings</button>
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
              <section class="detail-section">
                <h4>What to do now</h4>
                <p>{{ findingModalChecklistCopy() }}</p>
                <div class="button-row compact-row top-space">
                  <button type="button" class="secondary" (click)="draftFindingWithAi(pendingItem)" [disabled]="saving() || draftingFindingWithAi()">
                    {{ draftingFindingWithAi() ? 'Drafting...' : 'Draft with AI' }}
                  </button>
                </div>
                <p class="field-helper top-space" *ngIf="findingAiNotice()" [class.error]="findingAiNoticeIsError()">{{ findingAiNotice() }}</p>
              </section>
              <section class="compliance-note">
                <strong>{{ findingDraftHeading() }}</strong>
                <span>{{ findingDraftGuidance() }}</span>
              </section>
              <label class="field">
                <span>Finding title</span>
                <input formControlName="title" placeholder="Clause 4.1 gap">
              </label>
              <label class="field">
                <span>Auditor note / description</span>
                <textarea rows="4" formControlName="description" placeholder="Write a few words in your own way first. Example: Process owners are named on paper, but team interviews showed decision authority is not understood consistently."></textarea>
              </label>
              <small class="field-helper">Write the real situation first, then use AI only if you want help turning it into cleaner audit wording.</small>
              <label class="field">
                <span>Severity</span>
                <select formControlName="severity">
                  <option value="OBSERVATION">Observation</option>
                  <option value="OPPORTUNITY">Opportunity for improvement</option>
                  <option value="MINOR">Minor nonconformity</option>
                  <option value="MAJOR">Major nonconformity</option>
                </select>
              </label>
              <small class="field-helper">{{ findingSeverityHelperCopy() }}</small>
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
                <span class="section-eyebrow">Review flow</span>
                <h3>Review findings, then finish the audit</h3>
                <p class="subtle">Finish the finding routes first. Use Audit actions only for lighter follow-up, then complete close-out last.</p>
              </div>
            </div>

            <div class="summary-grid review-summary-grid top-space">
              <article class="summary-item review-summary-item">
                <span>Questions</span>
                <strong>{{ selectedAudit()?.checklistCount || 0 }}</strong>
              </article>
              <article class="summary-item review-summary-item">
                <span>Findings</span>
                <strong>{{ selectedAudit()?.findingCount || 0 }}</strong>
              </article>
              <article class="summary-item review-summary-item">
                <span>Major</span>
                <strong>{{ majorFindingCount() }}</strong>
              </article>
              <article class="summary-item review-summary-item">
                <span>Routes open</span>
                <strong>{{ openFindingFollowUpCount() }}</strong>
              </article>
            </div>

            <section class="review-focus-banner top-space">
              <div class="review-focus-banner__copy">
                <strong>{{ reviewFocusHeading() }}</strong>
                <span>{{ reviewFocusCopy() }}</span>
              </div>
              <div class="button-row compact-row review-focus-banner__actions">
                <button type="button" class="secondary" *ngIf="nextUnresolvedFindingId()" (click)="goToNextUnresolvedFinding()">Next unresolved finding</button>
                <button type="button" class="secondary" *ngIf="!unresolvedFindingCount() && isChecklistComplete()" (click)="setReviewStage('closeout')">Go to close-out</button>
              </div>
            </section>

            <div class="empty-state top-space" *ngIf="!isChecklistComplete()">
              <strong>Checklist is not complete yet</strong>
              <span>Answer all required checklist questions before the audit can move into final completion.</span>
            </div>
          </section>

          <nav class="audit-review-stages" *ngIf="isChecklistComplete()" aria-label="Audit review stages">
            <button type="button" class="audit-review-stage" [class.active]="reviewStage() === 'findings'" (click)="setReviewStage('findings')">
              <strong>1. Findings</strong>
              <small>Decide the route</small>
            </button>
            <button type="button" class="audit-review-stage" [class.active]="reviewStage() === 'actions'" (click)="setReviewStage('actions')">
              <strong>2. Audit actions</strong>
              <small>Lighter follow-up only</small>
            </button>
            <button type="button" class="audit-review-stage" [class.active]="reviewStage() === 'closeout'" (click)="setReviewStage('closeout')">
              <strong>3. Close-out</strong>
              <small>Finish the audit record</small>
            </button>
          </nav>

          <section class="card panel-card" *ngIf="reviewStage() === 'findings'">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Stage 1</span>
                <h3>Review findings and decide the follow-up route</h3>
                <p class="subtle">Pick one finding, review the gap, then choose the right route: CAPA for nonconformities, audit action for lighter follow-up, or close when no tracked action is needed.</p>
              </div>
            </div>

            <div class="empty-state top-space" *ngIf="!(selectedAudit()?.findings || []).length">
              <strong>No findings yet</strong>
              <span>The audit can still be completed. Add findings only where a requirement was not met during checklist execution.</span>
            </div>

            <div class="review-findings-layout top-space" *ngIf="(selectedAudit()?.findings || []).length">
              <aside class="review-findings-list">
                <header class="review-findings-list__header">
                  <strong>Findings in this audit</strong>
                  <small>Select one finding to review its gap, evidence route, and follow-up decision.</small>
                </header>

                <button
                  type="button"
                  class="review-finding-list-item"
                  *ngFor="let finding of selectedAudit()?.findings || []"
                  [class.active]="activeReviewFinding()?.id === finding.id"
                  (click)="selectFinding(finding)"
                >
                  <span class="review-finding-list-item__meta">
                    <strong>{{ finding.title }}</strong>
                    <div class="review-finding-chip-row">
                      <span class="review-mini-chip" [class.requires-capa]="requiresCapaRoute(finding)" [class.light-route]="canUseAuditActionRoute(finding)">
                        {{ findingSeverityLabel(finding.severity) }}
                      </span>
                      <span class="review-mini-chip" [class.ready]="!findingNeedsRoute(finding)">
                        {{ findingRouteStateLabel(finding) }}
                      </span>
                    </div>
                    <small>{{ findingStatusLabel(finding.status) }}{{ finding.clause ? ' | clause ' + finding.clause : '' }}</small>
                    <small *ngIf="findingOwnerDueCopy(finding)">{{ findingOwnerDueCopy(finding) }}</small>
                  </span>
                  <span class="review-finding-list-item__status">{{ findingDecisionBadge(finding) }}</span>
                </button>
              </aside>

              <section class="review-finding-workspace" *ngIf="activeReviewFinding() as finding">
                <div class="review-finding-workspace__header">
                  <div>
                    <span class="section-eyebrow">Current finding</span>
                    <h4>{{ finding.title }}</h4>
                    <p class="subtle">{{ findingSeverityLabel(finding.severity) }} | {{ findingStatusLabel(finding.status) }}{{ finding.clause ? ' | clause ' + finding.clause : '' }}{{ finding.dueDate ? ' | due ' + finding.dueDate.slice(0, 10) : '' }}</p>
                  </div>
                </div>

                <section class="review-callout">
                  <strong>{{ findingControlHeading(finding) }}</strong>
                  <span>{{ findingControlCopy(finding) }}</span>
                </section>

                <section class="detail-section review-detail-card">
                  <h4>Route status</h4>
                  <p>{{ findingRouteSummaryCopy(finding) }}</p>
                  <small *ngIf="findingOwnerDueCopy(finding)">{{ findingOwnerDueCopy(finding) }}</small>
                </section>

                <section class="detail-section review-detail-card">
                  <h4>Finding description</h4>
                  <p>{{ cleanFindingDescription(finding.description) }}</p>
                </section>

                <section class="detail-section review-detail-card">
                  <h4>Next required step</h4>
                  <p>{{ findingNextStepCopy(finding) }}</p>
                </section>

                <section class="detail-section review-detail-card review-evidence-row">
                  <div>
                    <h4>Evidence and traceability</h4>
                    <p>{{ findingsTraceabilityCopy() }}</p>
                  </div>
                  <div class="button-row compact-row">
                    <button type="button" class="secondary" (click)="focusChecklistQuestion(finding)" [disabled]="!finding.checklistItemId">Open question & evidence</button>
                    <button type="button" class="tertiary" (click)="setReviewStage('actions')">Review audit actions</button>
                    <a *ngIf="finding.linkedCapaId" [routerLink]="['/capa', finding.linkedCapaId]" [state]="auditLinkState(finding)" class="button-link secondary compact">Open linked CAPA</a>
                  </div>
                </section>

                <section class="review-decision-panel">
                  <div class="review-decision-panel__copy">
                    <strong>Choose the follow-up route</strong>
                    <small>{{ findingDecisionRuleCopy(finding) }}</small>
                  </div>
                  <div class="button-row review-decision-panel__actions">
                    <button type="button" class="secondary" [disabled]="saving() || finding.status === 'CLOSED' || !canWriteAudit() || (requiresCapaRoute(finding) && !finding.linkedCapaId)" (click)="updateFindingStatus(finding, 'CLOSED')">Close finding</button>
                    <button type="button" class="secondary" *ngIf="canUseAuditActionRoute(finding) && !finding.linkedCapaId" [disabled]="saving() || !canCreateActions()" (click)="prepareActionFromFinding(finding)">Create audit action</button>
                    <button type="button" class="secondary" *ngIf="requiresCapaRoute(finding) && !finding.linkedCapaId" [disabled]="saving() || !canCreateCapa()" (click)="createCapaFromFinding(finding)">
                      Create CAPA
                    </button>
                    <a *ngIf="requiresCapaRoute(finding) && finding.linkedCapaId" [routerLink]="['/capa', finding.linkedCapaId]" [state]="auditLinkState(finding)" class="button-link secondary compact">Open CAPA</a>
                  </div>
                  <div class="button-row compact-row" *ngIf="!findingNeedsRoute(finding) || nextUnresolvedFindingId(finding.id)">
                    <button type="button" class="secondary" *ngIf="nextUnresolvedFindingId(finding.id)" (click)="goToNextUnresolvedFinding(finding.id)">Next unresolved finding</button>
                    <button type="button" class="secondary" *ngIf="!unresolvedFindingCount()" (click)="setReviewStage('closeout')">All routes decided: go to close-out</button>
                  </div>
                </section>
              </section>
            </div>

            <section class="detail-section top-space" *ngIf="auditTouchpoints().length">
              <h4>Wider assurance inputs</h4>
              <p>{{ auditReviewTouchpointCopy() }}</p>
              <div class="touchpoint-grid top-space">
                <a class="touchpoint-card" *ngFor="let item of auditTouchpoints()" [routerLink]="item.link">
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                  <small>{{ item.reviewCopy || item.copy }}</small>
                </a>
              </div>
            </section>
          </section>

          <section class="page-stack" id="audit-actions-section" *ngIf="reviewStage() === 'actions'">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Stage 2</span>
                <h3>Assign audit follow-up actions</h3>
                <p class="subtle">Use this only for observations and opportunities for improvement that need tracked follow-up.</p>
              </div>
            </div>

            <section class="review-focus-banner" *ngIf="activeReviewFinding() as finding">
              <div class="review-focus-banner__copy">
                <strong>Current finding: {{ finding.title }}</strong>
                <span>{{ auditActionStageCopy(finding) }}</span>
              </div>
              <div class="button-row compact-row review-focus-banner__actions">
                <button type="button" class="secondary" (click)="setReviewStage('findings')">Back to current finding</button>
              </div>
            </section>

            <section class="detail-section">
              <h4>How to use audit actions</h4>
              <p>Keep CAPA for major and minor nonconformities. Use audit actions only for observations and opportunities for improvement. After the action is created, return to Findings and close the finding when the route is clear.</p>
            </section>

            <iso-record-work-items
              [sourceType]="'audit'"
              [sourceId]="selectedId()"
              [draftTitle]="draftActionTitle()"
              [draftDescription]="draftActionDescription()"
              [returnNavigation]="auditReturnNavigation()"
            />

            <div class="button-row">
              <button type="button" class="secondary" (click)="setReviewStage('findings')">Back to findings</button>
              <button type="button" (click)="setReviewStage('closeout')">Go to close-out</button>
            </div>
          </section>

          <section class="card panel-card" *ngIf="reviewStage() === 'closeout'">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Stage 3</span>
                <h3>Complete the audit close-out</h3>
                <p class="subtle">Capture the overall conclusion, recommendations, and auditor details once the checklist is complete and the follow-up route for findings is clear. Findings and actions can continue after the audit itself is completed.</p>
              </div>
            </div>

            <form [formGroup]="closeoutForm" class="page-stack top-space" (ngSubmit)="completeAudit()">
              <section class="compliance-note">
                <strong>{{ auditCloseoutHeading() }}</strong>
                <span>{{ auditCloseoutGuidance() }}</span>
              </section>
              <section class="review-blocker-note" *ngIf="unresolvedFindingCount()">
                <strong>Finish finding routes first</strong>
                <span>{{ unresolvedFindingCount() }} finding{{ unresolvedFindingCount() === 1 ? '' : 's' }} still need a clear route before this audit should be completed.</span>
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
                <button type="button" class="secondary" (click)="setReviewStage('findings')">Back to findings</button>
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

    .review-blocker-note {
      display: grid;
      gap: 0.35rem;
      padding: 1rem 1.1rem;
      border-radius: 1rem;
      border: 1px solid rgba(145, 80, 63, 0.18);
      background: rgba(253, 244, 240, 0.95);
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

    .review-summary-grid {
      grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
    }

    .review-summary-item {
      min-height: auto;
      padding: 0.85rem 1rem;
      background: rgba(250, 251, 248, 0.96);
      border-color: rgba(23, 50, 37, 0.08);
    }

    .review-focus-banner {
      display: grid;
      gap: 0.35rem;
      padding: 1rem 1.15rem;
      border-radius: 18px;
      border: 1px solid rgba(184, 132, 51, 0.24);
      background: linear-gradient(180deg, rgba(252, 248, 240, 0.96), rgba(248, 242, 230, 0.9));
    }

    .review-focus-banner__copy {
      display: grid;
      gap: 0.35rem;
    }

    .review-focus-banner__actions {
      margin-top: 0;
    }

    .review-focus-banner strong {
      color: #203427;
      font-size: 1rem;
    }

    .review-focus-banner span {
      color: #46564b;
      line-height: 1.55;
    }

    .audit-steps {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.85rem;
    }

    .audit-review-stages {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.75rem;
    }

    .audit-review-stage {
      border: 1px solid rgba(23, 50, 37, 0.1);
      background: rgba(248, 250, 246, 0.92);
      border-radius: 18px;
      padding: 0.9rem 1rem;
      display: grid;
      gap: 0.2rem;
      text-align: left;
      cursor: pointer;
      transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
    }

    .audit-review-stage small {
      color: var(--muted);
    }

    .audit-review-stage.active {
      border-color: rgba(36, 79, 61, 0.32);
      background: rgba(255, 255, 255, 0.98);
      box-shadow: 0 18px 42px rgba(24, 45, 32, 0.08);
      transform: translateY(-1px);
    }

    .review-findings-layout {
      display: grid;
      grid-template-columns: minmax(16rem, 0.88fr) minmax(0, 1.45fr);
      gap: 1rem;
      align-items: start;
    }

    .review-findings-list,
    .review-finding-workspace {
      border: 1px solid rgba(23, 50, 37, 0.08);
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.96);
      box-shadow: 0 16px 34px rgba(24, 45, 32, 0.05);
    }

    .review-findings-list {
      padding: 1rem;
      display: grid;
      gap: 0.75rem;
    }

    .review-findings-list__header {
      display: grid;
      gap: 0.25rem;
    }

    .review-findings-list__header strong {
      color: #203427;
    }

    .review-findings-list__header small {
      color: #627267;
      line-height: 1.5;
    }

    .review-finding-list-item {
      width: 100%;
      border: 1px solid rgba(23, 50, 37, 0.08);
      border-radius: 18px;
      background: rgba(246, 249, 244, 0.88);
      padding: 0.95rem 1rem;
      display: flex;
      justify-content: space-between;
      align-items: start;
      gap: 0.75rem;
      text-align: left;
      cursor: pointer;
      transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease, background 120ms ease;
    }

    .review-finding-list-item:hover {
      border-color: rgba(36, 79, 61, 0.2);
      background: rgba(250, 251, 249, 0.98);
    }

    .review-finding-list-item.active {
      border-color: rgba(184, 132, 51, 0.3);
      background: rgba(253, 248, 240, 0.96);
      box-shadow: 0 12px 28px rgba(26, 45, 34, 0.08);
      transform: translateY(-1px);
    }

    .review-finding-list-item__meta {
      display: grid;
      gap: 0.28rem;
      min-width: 0;
    }

    .review-finding-list-item__meta strong {
      color: #203427;
      line-height: 1.4;
    }

    .review-finding-list-item__meta small {
      color: #607165;
      line-height: 1.45;
    }

    .review-finding-chip-row {
      display: flex;
      gap: 0.35rem;
      flex-wrap: wrap;
    }

    .review-mini-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.18rem 0.55rem;
      border-radius: 999px;
      background: rgba(23, 50, 37, 0.08);
      color: #274233;
      font-size: 0.72rem;
      font-weight: 700;
      line-height: 1.2;
    }

    .review-mini-chip.requires-capa {
      background: rgba(145, 80, 63, 0.14);
      color: #7c3f31;
    }

    .review-mini-chip.light-route {
      background: rgba(184, 132, 51, 0.14);
      color: #7b5d1f;
    }

    .review-mini-chip.ready {
      background: rgba(51, 117, 82, 0.14);
      color: #25533b;
    }

    .review-finding-route-state {
      font-weight: 700;
    }

    .review-finding-route-state.ready {
      color: #2f654a;
    }

    .review-finding-list-item__status {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.3rem 0.65rem;
      border-radius: 999px;
      background: rgba(23, 50, 37, 0.08);
      color: #274233;
      font-size: 0.75rem;
      font-weight: 700;
      white-space: nowrap;
      flex: 0 0 auto;
    }

    .review-finding-workspace {
      padding: 1.1rem 1.15rem;
      display: grid;
      gap: 0.95rem;
    }

    .review-finding-workspace__header h4 {
      margin: 0.2rem 0 0;
      font-size: 1.2rem;
      color: #172519;
    }

    .review-callout {
      display: grid;
      gap: 0.25rem;
      padding: 0.9rem 1rem;
      border-radius: 18px;
      border: 1px solid rgba(184, 132, 51, 0.2);
      background: rgba(252, 247, 238, 0.92);
    }

    .review-callout strong {
      color: #203427;
    }

    .review-callout span {
      color: #46564b;
      line-height: 1.55;
    }

    .review-detail-card {
      background: rgba(248, 250, 247, 0.92);
    }

    .review-detail-card small {
      color: #617165;
      line-height: 1.45;
    }

    .review-evidence-row {
      display: grid;
      gap: 0.8rem;
    }

    .review-decision-panel {
      display: grid;
      gap: 0.9rem;
      padding: 1rem 1.05rem;
      border-radius: 20px;
      border: 1px solid rgba(36, 79, 61, 0.14);
      background: linear-gradient(180deg, rgba(242, 247, 243, 0.96), rgba(248, 251, 248, 0.96));
    }

    .review-decision-panel__copy {
      display: grid;
      gap: 0.25rem;
    }

    .review-decision-panel__copy strong {
      color: #1f3427;
    }

    .review-decision-panel__copy small {
      color: #55665b;
      line-height: 1.55;
    }

    .review-decision-panel__actions {
      margin-top: 0;
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

    .touchpoint-grid {
      display: grid;
      gap: 0.8rem;
      grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    }

    .touchpoint-card {
      display: grid;
      gap: 0.35rem;
      padding: 0.95rem 1rem;
      border-radius: 1rem;
      border: 1px solid rgba(46, 67, 56, 0.1);
      background: rgba(252, 253, 250, 0.82);
      text-decoration: none;
      color: inherit;
    }

    .touchpoint-card span,
    .touchpoint-card small {
      display: block;
    }

    .touchpoint-card span {
      color: #5e6e63;
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .touchpoint-card strong {
      font-size: 1.5rem;
      color: #203427;
      line-height: 1;
    }

    .touchpoint-card small {
      color: #617165;
      line-height: 1.45;
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

    .question-card.has-unresolved-gap {
      border-color: rgba(145, 80, 63, 0.18);
      background: rgba(255, 251, 249, 0.96);
    }

    .question-card.has-capa-route {
      border-color: rgba(184, 132, 51, 0.18);
      background: rgba(255, 252, 246, 0.96);
    }

    .question-card.has-closed-route {
      border-color: rgba(51, 117, 82, 0.16);
      background: rgba(249, 252, 249, 0.96);
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

    .question-next-step {
      max-width: 18rem;
      color: #8a6322;
      font-size: 0.84rem;
      font-weight: 700;
      line-height: 1.45;
      text-align: right;
    }

    .question-next-step.success {
      color: #2f6b45;
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

    .finding-indicator.requires-capa {
      background: rgba(145, 80, 63, 0.15);
      color: #7c3f31;
    }

    .finding-indicator.capa-linked {
      background: rgba(184, 132, 51, 0.14);
      color: #7b5d1f;
    }

    .finding-indicator.closed {
      background: rgba(51, 117, 82, 0.14);
      color: #25533b;
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

    .finding-next-step h4 {
      margin-bottom: 0.35rem;
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
      .audit-review-stages,
      .audit-conduct-layout,
      .review-findings-layout {
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

      .question-next-step {
        max-width: none;
        text-align: left;
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
  protected readonly incidents = signal<IncidentSummaryRow[]>([]);
  protected readonly providers = signal<ProviderSummaryRow[]>([]);
  protected readonly obligations = signal<ObligationSummaryRow[]>([]);
  protected readonly hazards = signal<HazardSummaryRow[]>([]);
  protected readonly aspects = signal<AspectSummaryRow[]>([]);
  protected readonly changes = signal<ChangeSummaryRow[]>([]);
  protected readonly activeStep = signal<AuditStep>('plan');
  protected readonly reviewStage = signal<AuditReviewStage>('findings');
  protected readonly currentClauseIndex = signal(0);
  protected readonly expandedChecklistId = signal<string | null>(null);
  protected readonly checklistNoteDrafts = signal<Record<string, string>>({});
  protected readonly pendingFindingChecklistId = signal<string | null>(null);
  protected readonly checklistScrollTop = signal<number | null>(null);
  protected readonly checklistScrollTargetId = signal<string | null>(null);
  protected readonly selectedFindingId = signal<string | null>(null);
  protected readonly checklistBuilderOpen = signal(false);
  protected readonly draftActionTitle = signal<string | null>(null);
  protected readonly draftActionDescription = signal<string | null>(null);
  protected readonly sortBy = signal<AuditSortOption>('attention');
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly draftingFindingWithAi = signal(false);
  protected readonly findingAiNotice = signal('');
  protected readonly findingAiNoticeIsError = signal(false);
  protected readonly generatingReport = signal(false);
  protected readonly message = signal((history.state?.notice as string) || '');
  protected readonly error = signal('');

  protected readonly auditForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(40)]],
    title: ['', [Validators.required, Validators.maxLength(160)]],
    type: ['Internal Audit' as AuditType, Validators.required],
    standard: ['ISO 9001'],
    programme: [''],
    scopeType: ['Process' as AuditScopeType],
    scope: [''],
    objectives: [''],
    criteria: [''],
    agenda: [''],
    openingMeetingNotes: [''],
    closingMeetingNotes: [''],
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
    this.loadAssuranceInputs();
    this.route.data.subscribe((data) => {
      this.mode.set((data['mode'] as PageMode) || 'list');
      this.handleRoute(this.route.snapshot.paramMap);
    });
    this.route.paramMap.subscribe((params) => this.handleRoute(params));
  }

  private loadAssuranceInputs() {
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
      list: 'Manage internal and supplier audits with planning, guided execution, findings, and follow-up.',
      create: 'Set up the programme, agenda, and meeting notes first, then run the checklist from a dedicated conduct screen.',
      detail: 'Plan the audit properly, work through the checklist, and close findings from a guided three-step workflow.',
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

  protected applyAuditPlanTemplate() {
    const raw = this.auditForm.getRawValue();
    const auditLabel = this.auditLabel(raw.type, raw.scopeType);
    const agenda = [
      `1. Opening meeting and attendance for the ${auditLabel}`,
      `2. Confirm scope, objectives, criteria, and timing`,
      `3. Review applicable documents, records, and previous follow-up`,
      `4. Conduct interviews, sampling, and on-site or process verification`,
      `5. Consolidate evidence and agree the initial findings position`,
      `6. Run the closing meeting and confirm report timing`
    ].join('\n');

    this.auditForm.patchValue({
      agenda,
      summary: raw.summary || `Planned ${auditLabel} covering ${this.scopeTypeSummary(raw.scopeType, raw.auditeeArea)}.`
    });
    this.message.set('Audit agenda template applied.');
    this.error.set('');
  }

  protected applyMeetingTemplate() {
    const raw = this.auditForm.getRawValue();
    const openingMeetingNotes = [
      `Opening meeting for ${this.auditLabel(raw.type, raw.scopeType)}`,
      `- Confirm attendees, scope, objectives, and criteria`,
      `- Confirm timetable, sampling approach, and communication route`,
      `- Confirm health, safety, confidentiality, and site rules where relevant`
    ].join('\n');
    const closingMeetingNotes = [
      `Closing meeting for ${this.auditLabel(raw.type, raw.scopeType)}`,
      `- Present the summary of evidence reviewed`,
      `- Confirm observations, nonconformities, and next steps`,
      `- Confirm action ownership, expected response dates, and report issue timing`
    ].join('\n');

    this.auditForm.patchValue({
      openingMeetingNotes,
      closingMeetingNotes
    });
    this.message.set('Opening and closing meeting templates applied.');
    this.error.set('');
  }

  protected draftFindingWithAi(item: AuditChecklistItem) {
    const audit = this.selectedAudit();
    const clause = item.clause || this.currentChecklistGroup()?.clause || 'Clause';
    const evidenceNote = this.findingForm.getRawValue().description.trim() || this.checklistNoteDraft(item).trim();

    if (!evidenceNote) {
      this.findingAiNotice.set('Add a short auditor note first, then use AI to clean up the wording.');
      this.findingAiNoticeIsError.set(true);
      return;
    }

    this.draftingFindingWithAi.set(true);
    this.findingAiNotice.set('');
    this.findingAiNoticeIsError.set(false);
    this.message.set('');
    this.error.set('');

    this.api.post<{
      title: string;
      description: string;
      suggestedSeverity: FindingSeverity;
      warning?: string;
    }>('ai/audit-finding-draft', {
      clause,
      question: item.title,
      evidenceNote,
      auditType: audit?.type || 'Internal Audit',
      standard: audit?.standard || 'ISO 9001'
    }).subscribe({
      next: (draft) => {
        this.draftingFindingWithAi.set(false);
        this.findingForm.patchValue({
          title: draft.title,
          description: draft.description,
          severity: draft.suggestedSeverity
        });
        this.findingAiNotice.set(draft.warning || 'AI draft applied. Review and edit it before saving the finding.');
        this.findingAiNoticeIsError.set(false);
        this.message.set('');
      },
      error: (error: HttpErrorResponse) => {
        this.draftingFindingWithAi.set(false);
        const message = this.readError(error, 'AI draft could not be created.');
        this.findingAiNotice.set(message);
        this.findingAiNoticeIsError.set(true);
        this.error.set(message);
      }
    });
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
      programme: raw.programme.trim() || undefined,
      scopeType: raw.scopeType || undefined,
      scope: raw.scope.trim() || undefined,
      objectives: raw.objectives.trim() || undefined,
      criteria: raw.criteria.trim() || undefined,
      agenda: raw.agenda.trim() || undefined,
      openingMeetingNotes: raw.openingMeetingNotes.trim() || undefined,
      closingMeetingNotes: raw.closingMeetingNotes.trim() || undefined,
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
    this.checklistScrollTop.set(window.scrollY);
    this.checklistScrollTargetId.set(item.id);
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

    this.checklistScrollTop.set(window.scrollY);
    this.checklistScrollTargetId.set(item.id);
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
    this.api.post<AuditFinding>(`audits/${this.selectedId()}/findings`, {
      title: raw.title.trim(),
      description: raw.description.trim(),
      severity: raw.severity,
      ownerId: raw.ownerId || undefined,
      dueDate: raw.dueDate || undefined,
      checklistItemId: item.id,
      clause: item.clause || undefined
    }).subscribe({
      next: (finding) => {
        this.saving.set(false);
        const shouldMoveToReview = this.isChecklistComplete();
        this.message.set(
          shouldMoveToReview
            ? 'Finding recorded. Next step: review findings and decide the follow-up route.'
            : 'Finding recorded. Continue with the checklist.'
        );
        this.selectedFindingId.set(finding.id);
        this.pendingFindingChecklistId.set(null);
        if (shouldMoveToReview) {
          this.activeStep.set('review');
          this.reviewStage.set('findings');
        }
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
    this.api.post<{ id: string }>(`audits/findings/${finding.id}/create-capa`, {
      title: `Audit finding CAPA: ${finding.title}`,
      problemStatement: this.cleanFindingDescription(finding.description),
      ownerId: finding.ownerId || undefined,
      dueDate: finding.dueDate || undefined
    }).subscribe({
      next: (capa) => {
        this.saving.set(false);
        void this.router.navigate(['/capa', capa.id, 'edit'], {
          state: {
            notice: 'CAPA created from audit finding.',
            returnNavigation: this.auditReturnNavigation(finding)
          }
        });
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

    this.selectedFindingId.set(finding.id);
    this.draftActionTitle.set(`Audit action: ${finding.title}`);
    this.draftActionDescription.set(this.cleanFindingDescription(finding.description));
    this.setReviewStage('actions');
    this.message.set('Audit action form prepared from the selected finding. Create the action in Stage 2, then return to Findings and close the finding when the route is set.');
  }

  protected openFindingComposer(item: AuditChecklistItem) {
    this.checklistScrollTop.set(window.scrollY);
    this.checklistScrollTargetId.set(item.id);
    this.expandedChecklistId.set(item.id);
    this.pendingFindingChecklistId.set(item.id);
    this.findingAiNotice.set('');
    this.findingAiNoticeIsError.set(false);
    this.findingForm.patchValue({
      title: this.defaultFindingTitle(item),
      description: item.notes?.trim() || '',
      severity: 'MINOR',
      ownerId: '',
      dueDate: ''
    });
    this.message.set('Finding form opened for the selected question.');
  }

  protected cancelFindingComposer() {
    this.pendingFindingChecklistId.set(null);
    this.selectedFindingId.set(null);
    this.findingAiNotice.set('');
    this.findingAiNoticeIsError.set(false);
    this.findingForm.reset({ title: '', description: '', severity: 'OBSERVATION', ownerId: '', dueDate: '' });
    this.restoreChecklistScrollSoon();
  }

  protected setActiveStep(step: AuditStep) {
    this.activeStep.set(step);
    if (step === 'review') {
      this.reviewStage.set('findings');
      if (!this.selectedFindingId()) {
        this.selectedFindingId.set(this.selectedAudit()?.findings?.[0]?.id ?? null);
      }
    }
  }

  protected setReviewStage(stage: AuditReviewStage) {
    if (stage === 'closeout' && this.unresolvedFindingCount()) {
      this.message.set('Finish the remaining finding routes before moving into audit close-out.');
      return;
    }
    this.reviewStage.set(stage);
    if (stage === 'findings' && !this.selectedFindingId()) {
      this.selectedFindingId.set(this.selectedAudit()?.findings?.[0]?.id ?? null);
    }
    if (stage === 'actions') {
      setTimeout(() => this.scrollToAuditActions(), 0);
    }
  }

  protected openReviewFindings() {
    this.setActiveStep('review');
    this.message.set('Next step: review each finding, decide its route, then move into close-out once all routes are clear.');
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
    this.focusCurrentClauseStart();
  }

  protected nextClause() {
    if (!this.hasNextClause()) {
      return;
    }
    this.currentClauseIndex.update((index) => Math.min(this.checklistGroups().length - 1, index + 1));
    this.expandFirstQuestionInCurrentClause();
    this.focusCurrentClauseStart();
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
    const findings = this.selectedAudit()?.findings || [];
    const linkedFindingId = item.linkedFindings?.[0]?.id;
    if (linkedFindingId) {
      const fullFinding = findings.find((finding) => finding.id === linkedFindingId);
      if (fullFinding) {
        return fullFinding;
      }
      const partialFinding = item.linkedFindings?.[0];
      if (partialFinding) {
        return {
          ...partialFinding,
          description: '',
          checklistItemId: partialFinding.checklistItemId || item.id
        } satisfies AuditFinding;
      }
    }
    return findings.find((finding) => finding.checklistItemId === item.id) ?? null;
  }

  protected checklistQuestionState(item: AuditChecklistItem) {
    const finding = this.findingForChecklist(item);
    if (!finding) {
      return item.response === 'NO' ? 'unresolved' : 'none';
    }
    if (finding.status === 'CLOSED') {
      return 'closed';
    }
    if (finding.linkedCapaId) {
      return 'capa';
    }
    return 'unresolved';
  }

  protected checklistFindingIndicatorLabel(item: AuditChecklistItem) {
    const finding = this.findingForChecklist(item);
    if (!finding) {
      return 'Finding needed';
    }
    if (finding.status === 'CLOSED') {
      return 'Finding closed';
    }
    if (finding.linkedCapaId) {
      return 'CAPA linked';
    }
    if (this.requiresCapaRoute(finding)) {
      return 'CAPA needed';
    }
    return 'Finding open';
  }

  protected checklistFindingNextStep(item: AuditChecklistItem) {
    const finding = this.findingForChecklist(item);
    if (!finding) {
      return 'Record the finding before moving on so the failed requirement has a complete audit trail.';
    }
    if (finding.status === 'CLOSED') {
      return 'This finding route is already closed for the question. Review it if needed, or continue with the next question.';
    }
    if (finding.linkedCapaId) {
      return 'Finding and CAPA are already linked. Review the linked CAPA or continue with the next question.';
    }
    if (this.requiresCapaRoute(finding)) {
      return 'Finding recorded. CAPA still needs to be raised for this nonconformity before the route is complete.';
    }
    return 'Finding recorded. Review the lighter follow-up route or continue with the next question.';
  }

  protected checklistFindingPromptHeading(item: AuditChecklistItem) {
    const finding = this.findingForChecklist(item);
    if (!finding) {
      return 'Requirement not met: finding required';
    }
    if (finding.status === 'CLOSED') {
      return 'Finding route is already closed for this question';
    }
    if (finding.linkedCapaId) {
      return 'Finding and CAPA already linked for this question';
    }
    if (this.requiresCapaRoute(finding)) {
      return 'Finding recorded: CAPA still needed for this question';
    }
    return 'Finding recorded for this question';
  }

  protected checklistFindingPromptCopy(item: AuditChecklistItem) {
    const finding = this.findingForChecklist(item);
    if (!finding) {
      return 'The No answer has been recorded. Now capture the finding title, gap description, and severity so the review step has a complete audit trail.';
    }
    if (finding.status === 'CLOSED') {
      return 'This failed answer already has a finding with a closed route. Use Review Finding if you need to reopen that trail before continuing.';
    }
    if (finding.linkedCapaId) {
      return 'This failed answer already has a linked finding and CAPA. Use Review Finding or Open CAPA if you need to return to that trail before continuing.';
    }
    if (this.requiresCapaRoute(finding)) {
      return 'This failed answer already has a finding, but the nonconformity still needs CAPA before the route is complete. Use Review Finding to continue that decision.';
    }
    return 'This failed answer already has a lighter finding route. Use Review Finding if you need to review action or closure before continuing.';
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
    this.checklistScrollTargetId.set(finding.checklistItemId);
    this.selectedFindingId.set(finding.id);
    this.activeStep.set('conduct');
    this.message.set('Returned to the checklist question linked to this finding.');
    requestAnimationFrame(() => this.restoreChecklistScrollSoon());
  }

  protected scrollToAuditActions() {
    const section = document.getElementById('audit-actions-section');
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected focusCurrentClauseStart() {
    const firstItemId = this.currentChecklistGroup()?.items?.[0]?.id ?? null;
    this.checklistScrollTop.set(null);
    this.checklistScrollTargetId.set(firstItemId);
    requestAnimationFrame(() => this.restoreChecklistScrollSoon());
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

  protected majorFindingCount() {
    return (this.selectedAudit()?.findings || []).filter((finding) => finding.severity === 'MAJOR').length;
  }

  protected openFindingFollowUpCount() {
    const findings = this.selectedAudit()?.findings || [];
    const openFindings = findings.filter((finding) => finding.status !== 'CLOSED').length;
    return openFindings + (this.selectedAudit()?.actionItemCount || 0);
  }

  protected reviewFocusHeading() {
    const finding = this.activeReviewFinding();
    return finding ? `Current focus: ${finding.title}` : 'Current focus: review each finding one at a time';
  }

  protected reviewFocusCopy() {
    const finding = this.activeReviewFinding();
    if (!finding) {
      return 'Select a finding, decide whether it should close, move into an audit action, or move into CAPA, then continue to the next finding.';
    }
    return `${this.findingDecisionBadge(finding)}. ${this.findingNextStepCopy(finding)}`;
  }

  protected selectFinding(finding: AuditFinding) {
    this.selectedFindingId.set(finding.id);
  }

  protected activeReviewFinding() {
    const findings = this.selectedAudit()?.findings || [];
    if (!findings.length) {
      return null;
    }
    return findings.find((finding) => finding.id === this.selectedFindingId()) || findings[0];
  }

  protected findingNeedsRoute(finding: AuditFinding) {
    return finding.status !== 'CLOSED' && !finding.linkedCapaId;
  }

  protected requiresCapaRoute(finding: AuditFinding) {
    return finding.severity === 'MINOR' || finding.severity === 'MAJOR';
  }

  protected canUseAuditActionRoute(finding: AuditFinding) {
    return finding.severity === 'OBSERVATION' || finding.severity === 'OPPORTUNITY';
  }

  protected findingRouteStateLabel(finding: AuditFinding) {
    if (finding.status === 'CLOSED') {
      return 'Closed';
    }
    if (finding.linkedCapaId) {
      return 'CAPA linked';
    }
    return this.requiresCapaRoute(finding) ? 'CAPA still needed' : 'Route still needed';
  }

  protected unresolvedFindingCount() {
    return (this.selectedAudit()?.findings || []).filter((finding) => this.findingNeedsRoute(finding)).length;
  }

  protected nextUnresolvedFindingId(fromFindingId?: string | null) {
    const unresolved = (this.selectedAudit()?.findings || []).filter((finding) => this.findingNeedsRoute(finding));
    if (!unresolved.length) {
      return null;
    }

    const currentId = fromFindingId || this.selectedFindingId();
    if (!currentId) {
      return unresolved[0]?.id ?? null;
    }

    const currentIndex = unresolved.findIndex((finding) => finding.id === currentId);
    if (currentIndex === -1) {
      return unresolved[0]?.id ?? null;
    }

    return unresolved[currentIndex + 1]?.id ?? null;
  }

  protected goToNextUnresolvedFinding(fromFindingId?: string | null) {
    const nextId = this.nextUnresolvedFindingId(fromFindingId);
    if (!nextId) {
      if (!this.unresolvedFindingCount()) {
        this.message.set('All finding routes are decided. You can move into close-out now.');
      }
      return;
    }

    this.selectedFindingId.set(nextId);
    this.message.set('Moved to the next finding that still needs a follow-up decision.');
  }

  protected findingDecisionBadge(finding: AuditFinding) {
    if (finding.status === 'CLOSED') {
      return 'Closed';
    }
    if (finding.linkedCapaId) {
      return 'CAPA active';
    }
    if (finding.severity === 'MAJOR') {
      return 'CAPA expected';
    }
    if (finding.severity === 'MINOR') {
      return 'CAPA required';
    }
    if (finding.severity === 'OPPORTUNITY') {
      return 'Action recommended';
    }
    return 'Observation review';
  }

  protected findingOwnerDueCopy(finding: AuditFinding) {
    const owner = this.users().find((user) => user.id === finding.ownerId);
    const ownerLabel = owner ? `${owner.firstName} ${owner.lastName}` : '';
    const dueLabel = finding.dueDate ? finding.dueDate.slice(0, 10) : '';
    if (ownerLabel && dueLabel) {
      return `Owner: ${ownerLabel} | due ${dueLabel}`;
    }
    if (ownerLabel) {
      return `Owner: ${ownerLabel}`;
    }
    if (dueLabel) {
      return `Due ${dueLabel}`;
    }
    return '';
  }

  protected findingDraftHeading() {
    const severity = this.findingForm.getRawValue().severity;
    if (severity === 'MAJOR') {
      return 'Major finding path';
    }
    if (severity === 'MINOR') {
      return 'Minor finding path';
    }
    if (severity === 'OPPORTUNITY') {
      return 'Opportunity path';
    }
    return 'Observation path';
  }

  protected findingDraftGuidance() {
    const severity = this.findingForm.getRawValue().severity;
    if (severity === 'MAJOR') {
      return 'Use major only when the gap needs formal corrective action and later CAPA tracking before the finding should be closed.';
    }
    if (severity === 'MINOR') {
      return 'Use minor when the requirement was not met and the finding should still move into CAPA, even if the issue is lighter than a major nonconformity.';
    }
    if (severity === 'OPPORTUNITY') {
      return 'Use opportunity for improvement when the auditor sees a clear improvement point and wants lighter follow-up without CAPA.';
    }
    return 'Use observation when the auditor wants the issue visible, but formal corrective action may not be necessary.';
  }

  protected findingModalChecklistCopy() {
    return '1. Write a short note in your own words. 2. Use AI only if you want cleaner wording. 3. Choose severity. 4. Save the finding. 5. Decide CAPA or audit action later in Review findings.';
  }

  protected findingSeverityHelperCopy() {
    const severity = this.findingForm.getRawValue().severity;
    if (severity === 'MAJOR') {
      return 'Major: formal CAPA route is normally expected before the finding should be closed.';
    }
    if (severity === 'MINOR') {
      return 'Minor: CAPA is still required, but the issue is lighter than a major nonconformity.';
    }
    if (severity === 'OPPORTUNITY') {
      return 'Opportunity for improvement: keep the point visible and use a lighter audit action if follow-up should be tracked.';
    }
    return 'Observation: keep the issue visible when formal corrective action may not be necessary.';
  }

  protected auditTouchpointIntro() {
    const audit = this.selectedAudit();
    if (!audit) {
      return 'Use the surrounding registers as evidence sources before the audit starts.';
    }
    if (audit.type === 'Supplier Audit') {
      return 'Use these live records as supplier-audit evidence before you start fieldwork. They highlight provider control gaps, obligations needing review, and active changes that may affect the supplier relationship.';
    }
    if (audit.standard === 'ISO 14001') {
      return 'These live records are the strongest environmental inputs for this audit: significant aspects, active incidents, review-due obligations, and active changes.';
    }
    if (audit.standard === 'ISO 45001') {
      return 'These live records are the strongest OH&S inputs for this audit: open incidents, high hazards, review-due obligations, and active changes.';
    }
    return 'Use these live records as current assurance inputs before and during the audit. They give the auditor current evidence on provider control, obligations, and change activity.';
  }

  protected auditReviewTouchpointCopy() {
    return 'Use these registers alongside audit findings so the audit conclusion reflects current supplier control, compliance review, incidents, hazards, aspects, and system changes.';
  }

  protected auditTouchpoints() {
    const audit = this.selectedAudit();
    if (!audit) {
      return [];
    }

    const supplierReviews = this.providers().filter((item) =>
      item.status === 'UNDER_REVIEW' ||
      item.evaluationOutcome === 'ESCALATED' ||
      item.evaluationOutcome === 'DISQUALIFIED' ||
      (!!item.supplierAuditRequired && !item.supplierAuditLinked)
    ).length;
    const overdueObligations = this.obligations().filter((item) =>
      item.status === 'UNDER_REVIEW' || this.isDatePast(item.nextReviewDate)
    ).length;
    const openIncidents = this.incidents().filter((item) => item.status !== 'CLOSED' && item.status !== 'ARCHIVED').length;
    const highHazards = this.hazards().filter((item) => item.status !== 'OBSOLETE' && item.severity === 'HIGH').length;
    const highAspects = this.aspects().filter((item) => item.status !== 'OBSOLETE' && item.significance === 'HIGH').length;
    const activeChanges = this.changes().filter((item) => !['CLOSED', 'REJECTED'].includes(item.status)).length;

    if (audit.type === 'Supplier Audit') {
      return [
        { label: 'Provider controls', value: supplierReviews, copy: 'Providers that still need annual review, escalation follow-up, or a linked supplier audit.', reviewCopy: 'Use this register when testing approval, evaluation, and supplier audit coverage.', link: '/external-providers' },
        { label: 'Obligations under review', value: overdueObligations, copy: 'Customer or legal obligations that should be checked during supplier control.', reviewCopy: 'Compare findings against obligations that are overdue or under review.', link: '/compliance-obligations' },
        { label: 'Open changes', value: activeChanges, copy: 'Supplier-related or operational changes that may affect approved controls.', reviewCopy: 'Use active changes as context when deciding whether findings point to a wider control weakness.', link: '/change-management' }
      ];
    }

    if (audit.standard === 'ISO 14001') {
      return [
        { label: 'Significant aspects', value: highAspects, copy: 'High-significance environmental aspects that should appear in audit evidence.', reviewCopy: 'Check whether findings line up with the significant aspects register and controls.', link: '/environmental-aspects' },
        { label: 'Open incidents', value: openIncidents, copy: 'Environmental or mixed incidents still needing investigation or action.', reviewCopy: 'Use current incident follow-up as evidence when assessing environmental control effectiveness.', link: '/incidents' },
        { label: 'Obligations under review', value: overdueObligations, copy: 'Environmental obligations that still need review or closure evidence.', reviewCopy: 'Use overdue obligations to test whether compliance review is truly current.', link: '/compliance-obligations' }
      ];
    }

    if (audit.standard === 'ISO 45001') {
      return [
        { label: 'Open incidents', value: openIncidents, copy: 'Incidents and near misses still under investigation or action follow-up.', reviewCopy: 'Use live incident follow-up to challenge the effectiveness of OH&S controls.', link: '/incidents' },
        { label: 'High hazards', value: highHazards, copy: 'High-severity hazards that should be visible in audit sampling and worker-protection evidence.', reviewCopy: 'Compare audit findings with the current hazard register before finalising the conclusion.', link: '/hazards' },
        { label: 'Obligations under review', value: overdueObligations, copy: 'OH&S obligations that need current review or closure evidence.', reviewCopy: 'Use obligation review gaps as potential assurance themes, not just isolated findings.', link: '/compliance-obligations' }
      ];
    }

    return [
      { label: 'Provider controls', value: supplierReviews, copy: 'Provider approvals, evaluations, and supplier audit coverage that may influence quality control.', reviewCopy: 'Use provider review gaps as wider quality-system signals when finalising the audit outcome.', link: '/external-providers' },
      { label: 'Obligations under review', value: overdueObligations, copy: 'Customer, legal, or contractual obligations that should already be under control.', reviewCopy: 'Compare findings with obligation review gaps before treating them as isolated issues.', link: '/compliance-obligations' },
      { label: 'Open changes', value: activeChanges, copy: 'Operational or supplier-driven changes that may be affecting the system right now.', reviewCopy: 'Use active changes as context when deciding whether the audit points to a broader system change risk.', link: '/change-management' }
    ];
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
    if (severity === 'OPPORTUNITY') return 'Opportunity for improvement';
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
    const opportunities = findings.filter((finding) => finding.severity === 'OPPORTUNITY').length;
    return {
      heading: 'Findings profile',
      copy: `${major} major, ${minor} minor, ${observations} observation${observations === 1 ? '' : 's'}, and ${opportunities} opportunit${opportunities === 1 ? 'y' : 'ies'} for improvement are currently linked to this audit. Minor and major findings should move into CAPA before the finding itself is closed.`
    };
  }

  protected findingControlHeading(finding: AuditFinding) {
    if (finding.linkedCapaId) {
      return 'Corrective action path is active';
    }
    if (finding.severity === 'MAJOR') {
      return 'Major finding requires CAPA';
    }
    if (finding.severity === 'MINOR') {
      return 'Minor finding requires CAPA';
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
    if (finding.severity === 'MINOR') {
      return 'A minor nonconformity should also move into CAPA, but it normally needs a lighter corrective route than a major issue.';
    }
    if (finding.severity === 'OPPORTUNITY') {
      return 'Opportunity for improvement stays on the lighter route. Use an audit action if the improvement should be tracked, or close the finding if no formal follow-up is needed.';
    }
    if (finding.status === 'CLOSED') {
      return 'The finding is closed in the audit record. Keep any linked action or CAPA evidence available for future audit review.';
    }
    return 'Observation stays on the lighter route. Use an audit action if follow-up should be tracked, or close the finding when the auditor is satisfied.';
  }

  protected findingRouteSummaryCopy(finding: AuditFinding) {
    if (finding.status === 'CLOSED') {
      return 'This finding is already closed in the audit trail. Keep any supporting evidence available for later review.';
    }
    if (finding.linkedCapaId) {
      return 'The finding has moved into CAPA. Continue that corrective route, then return here and close the finding when the CAPA evidence trail is in place.';
    }
    if (this.requiresCapaRoute(finding)) {
      return 'This nonconformity still needs a linked CAPA before the audit route is complete. Audit close-out should wait until that route is decided.';
    }
    return 'This lighter finding can either move into an audit action or be closed directly once the auditor is satisfied that no formal tracked follow-up is needed.';
  }

  protected findingNextStepCopy(finding: AuditFinding) {
    if (finding.status === 'CLOSED') {
      return 'The finding is already closed. Keep the linked evidence trail available for later audit review.';
    }
    if (finding.linkedCapaId) {
      return 'Keep the linked CAPA moving, then close the finding once the corrective path and evidence are under control.';
    }
    if (finding.severity === 'MAJOR') {
      return 'Raise CAPA before closure. Major findings should not stay on the lighter audit-action route.';
    }
    if (finding.severity === 'MINOR') {
      return 'Raise CAPA before closure. Minor findings should also move into the formal corrective-action route.';
    }
    if (finding.severity === 'OPPORTUNITY') {
      return 'Use an audit action if you want the improvement tracked, or close the finding when no formal follow-up is needed.';
    }
    return 'Observation can stay visible, move into a light audit action, or close once the auditor is satisfied that no formal correction is needed.';
  }

  protected findingDecisionRuleCopy(finding: AuditFinding) {
    if (finding.linkedCapaId) {
      return 'This finding already has a linked CAPA. Keep that corrective route moving and close the finding only when the evidence trail is ready.';
    }
    if (finding.severity === 'MAJOR') {
      return 'Major nonconformity: create CAPA. Audit action is not used for this route.';
    }
    if (finding.severity === 'MINOR') {
      return 'Minor nonconformity: create CAPA. Audit action is not used for this route.';
    }
    if (finding.severity === 'OPPORTUNITY') {
      return 'Opportunity for improvement: use an audit action if you want lighter follow-up, or close it directly if no tracked action is needed.';
    }
    return 'Observation: use an audit action if you want lighter follow-up, or close it directly if no tracked action is needed.';
  }

  protected auditActionStageCopy(finding: AuditFinding) {
    if (this.requiresCapaRoute(finding)) {
      return 'This finding belongs on the CAPA route, not the lighter audit-action route. Return to Findings and create CAPA for it there.';
    }
    return 'Create the lighter follow-up action here, then return to Findings and close this finding once ownership and due date are set.';
  }

  protected auditReturnNavigation(finding?: AuditFinding | null): ReturnNavigation | null {
    return this.selectedId()
      ? {
          route: ['/audits', this.selectedId() as string],
          label: 'audit',
          state: {
            notice: 'Returned from CAPA to the audit review trail.',
            returnToStep: 'review',
            returnToReviewStage: 'findings',
            returnToFindingId: finding?.id || this.selectedFindingId()
          }
        }
      : null;
  }

  protected auditLinkState(finding?: AuditFinding | null) {
    const returnNavigation = this.auditReturnNavigation(finding);
    return returnNavigation ? { returnNavigation } : undefined;
  }

  protected auditCloseoutHeading() {
    return this.canCompleteAudit() ? 'Audit is ready for completion' : 'Close-out requirements are still open';
  }

  protected auditCloseoutGuidance() {
    if (!this.isChecklistComplete()) {
      return 'Complete all checklist questions before the audit can be finished.';
    }
    if (this.unresolvedFindingCount()) {
      return 'Each finding still needs a clear route before this audit should move into final close-out.';
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

  protected auditLabel(type: AuditType, scopeType?: AuditScopeType | string | null) {
    const scope = scopeType?.trim() || (type === 'Supplier Audit' ? 'Supplier' : 'Process');
    return `${scope} ${type}`.trim();
  }

  protected scopeTypeSummary(scopeType?: AuditScopeType | string | null, auditeeArea?: string | null) {
    if (!scopeType && !auditeeArea) {
      return 'the selected audit scope';
    }
    if (!scopeType) {
      return auditeeArea || 'the selected audit scope';
    }
    if (!auditeeArea) {
      return `${scopeType.toLowerCase()} scope`;
    }
    return `${scopeType.toLowerCase()} scope for ${auditeeArea}`;
  }

  protected auditProgrammeSummary() {
    const audits = this.audits();
    const withProgramme = audits.filter((item) => !!item.programme?.trim());
    if (!audits.length) {
      return 'No audits are recorded yet.';
    }
    if (!withProgramme.length) {
      return 'No audit programme names have been assigned yet. Use the programme field to show which annual plan or audit cycle each audit belongs to.';
    }
    const distinctProgrammes = new Set(withProgramme.map((item) => item.programme!.trim())).size;
    return `${withProgramme.length} of ${audits.length} audits are assigned to ${distinctProgrammes} programme${distinctProgrammes === 1 ? '' : 's'}. Use this to separate annual internal plans, supplier plans, or special audit cycles.`;
  }

  protected auditScopeMixSummary() {
    const audits = this.audits();
    if (!audits.length) {
      return 'No audit scope types are visible yet.';
    }
    const scopeCounts = audits.reduce<Record<string, number>>((counts, audit) => {
      const key = audit.scopeType || 'Unspecified';
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
    const topScopes = Object.entries(scopeCounts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([label, count]) => `${label}: ${count}`);
    return topScopes.length
      ? `Current audit planning is weighted toward ${topScopes.join(', ')}.`
      : 'No audit scope types are visible yet.';
  }

  protected sortedAudits() {
    return [...this.audits()].sort((left, right) => this.compareAudits(left, right));
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

  protected attentionLabel(audit: AuditRecord) {
    const reasons = this.auditAttentionReasons(audit);
    if (!reasons.length) return 'Under control';
    return reasons.length > 1 ? `${reasons[0]} +${reasons.length - 1}` : reasons[0];
  }

  protected attentionClass(audit: AuditRecord) {
    const reasons = this.auditAttentionReasons(audit);
    if (!reasons.length) return 'success';
    if (reasons.includes('Audit overdue') || reasons.includes('Findings still open')) return 'danger';
    return 'warn';
  }

  protected attentionHeadline(audit: AuditRecord | null) {
    return audit && this.auditAttentionReasons(audit).length
      ? 'This audit currently needs management attention.'
      : 'This audit is currently under control.';
  }

  protected attentionNarrative(audit: AuditRecord | null) {
    if (!audit) return 'Attention guidance appears after the audit is loaded.';
    const reasons = this.auditAttentionReasons(audit);
    if (!reasons.length) {
      return 'Audit timing, checklist execution, and findings follow-up are controlled enough for routine oversight.';
    }
    return `Attention is needed because ${reasons.map((reason) => reason.toLowerCase()).join(', ')}.`;
  }

  protected isChecklistReadOnly() {
    return !this.canWriteAudit() || this.selectedAudit()?.status === 'COMPLETED' || this.selectedAudit()?.status === 'CLOSED';
  }

  protected isChecklistComplete() {
    return !!this.selectedAudit()?.isChecklistCompleted;
  }

  protected canCompleteAudit() {
    return this.canWriteAudit() && this.isChecklistComplete() && !this.unresolvedFindingCount() && this.closeoutForm.valid && this.selectedAudit()?.status !== 'COMPLETED';
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

  private isDatePast(value?: string | null) {
    if (!value) {
      return false;
    }
    return new Date(value).getTime() < Date.now();
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

  protected readSelectValue(event: Event) {
    return (event.target as HTMLSelectElement).value;
  }

  protected setSortBy(value: string) {
    this.sortBy.set((value as AuditSortOption) || 'attention');
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
    const targetId = this.checklistScrollTargetId();
    if (top === null && !targetId) {
      return;
    }
    requestAnimationFrame(() => {
      if (targetId) {
        const element = document.getElementById(`audit-checklist-item-${targetId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
      } else if (top !== null) {
        window.scrollTo({ top, behavior: 'auto' });
      }
      this.checklistScrollTop.set(null);
      this.checklistScrollTargetId.set(null);
    });
  }

  private handleRoute(params: ParamMap) {
    const id = params.get('id');
    const historyState = history.state as {
      notice?: string;
      returnToStep?: AuditStep;
      returnToReviewStage?: AuditReviewStage;
      returnToFindingId?: string;
    };
    this.selectedId.set(id);
    this.message.set(historyState.notice || '');
    this.error.set('');
    this.activeStep.set(historyState.returnToStep || 'plan');
    this.reviewStage.set(historyState.returnToReviewStage || 'findings');
    this.currentClauseIndex.set(0);
    this.expandedChecklistId.set(null);
    this.pendingFindingChecklistId.set(null);
    this.selectedFindingId.set(historyState.returnToFindingId || null);
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
      programme: '',
      scopeType: 'Process',
      scope: '',
      objectives: '',
      criteria: '',
      agenda: '',
      openingMeetingNotes: '',
      closingMeetingNotes: '',
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
        const currentReviewStage = this.reviewStage();
        const currentSelectedFindingId = this.selectedFindingId();
        this.loading.set(false);
        this.selectedAudit.set(audit);
        this.activeStep.set(options?.preserveStep ? currentStep : this.deriveStep(audit));
        this.reviewStage.set(options?.preserveStep ? currentReviewStage : 'findings');
        this.selectedFindingId.set(
          (audit.findings || []).some((finding) => finding.id === currentSelectedFindingId)
            ? currentSelectedFindingId
            : audit.findings?.[0]?.id ?? null
        );
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
          programme: audit.programme ?? '',
          scopeType: audit.scopeType ?? (audit.type === 'Supplier Audit' ? 'Supplier' : 'Process'),
          scope: audit.scope ?? '',
          objectives: audit.objectives ?? '',
          criteria: audit.criteria ?? '',
          agenda: audit.agenda ?? '',
          openingMeetingNotes: audit.openingMeetingNotes ?? '',
          closingMeetingNotes: audit.closingMeetingNotes ?? '',
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
        this.restoreChecklistScrollSoon();
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

  private compareAudits(left: AuditRecord, right: AuditRecord) {
    switch (this.sortBy()) {
      case 'auditDate':
        return this.compareOptionalDateAsc(this.auditSortDate(left), this.auditSortDate(right)) || this.compareDateDesc(left.updatedAt, right.updatedAt);
      case 'updated':
        return this.compareDateDesc(left.updatedAt, right.updatedAt) || this.compareOptionalDateAsc(this.auditSortDate(left), this.auditSortDate(right));
      case 'programme':
        return (
          (left.programme || 'ZZZ').localeCompare(right.programme || 'ZZZ') ||
          this.compareOptionalDateAsc(this.auditSortDate(left), this.auditSortDate(right))
        );
      case 'attention':
      default:
        return (
          this.auditAttentionRank(left) - this.auditAttentionRank(right) ||
          this.compareOptionalDateAsc(this.auditSortDate(left), this.auditSortDate(right)) ||
          this.compareDateDesc(left.updatedAt, right.updatedAt)
        );
    }
  }

  private auditAttentionReasons(audit: AuditRecord) {
    if (audit.status === 'CLOSED') {
      return [];
    }
    const reasons: string[] = [];
    if (audit.status === 'PLANNED' && audit.scheduledAt && this.isDatePast(audit.scheduledAt)) {
      reasons.push('Audit overdue');
    }
    if ((audit.status === 'COMPLETED' || audit.status === 'CHECKLIST_COMPLETED') && (audit.openFindingCount || 0) > 0) {
      reasons.push('Findings still open');
    }
    if (audit.status === 'IN_PROGRESS' && !(audit.leadAuditorId || '').trim()) {
      reasons.push('Owner needed');
    }
    if ((audit.status === 'IN_PROGRESS' || audit.status === 'CHECKLIST_COMPLETED') && (audit.completedChecklistCount || 0) === 0 && audit.scheduledAt && this.isDatePast(audit.scheduledAt)) {
      reasons.push('Execution stalled');
    }
    return reasons;
  }

  private auditAttentionRank(audit: AuditRecord) {
    const reasons = this.auditAttentionReasons(audit);
    if (reasons.includes('Audit overdue')) return 0;
    if (reasons.includes('Findings still open')) return 1;
    if (reasons.includes('Execution stalled')) return 2;
    if (reasons.includes('Owner needed')) return 3;
    if (audit.status !== 'CLOSED') return 4;
    return 5;
  }

  private auditSortDate(audit: AuditRecord) {
    return audit.scheduledAt || audit.startedAt || audit.completedAt || null;
  }

  private defaultFindingTitle(item: AuditChecklistItem) {
    const clause = item.subclause?.trim() || item.clause?.trim() || 'General';
    const trimmedTitle = item.title.trim();
    if (trimmedTitle.length <= 64) {
      return `Clause ${clause} gap`;
    }
    return `Clause ${clause} gap`;
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
