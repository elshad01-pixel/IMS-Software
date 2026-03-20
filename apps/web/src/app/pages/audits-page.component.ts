import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { PageHeaderComponent } from '../shared/page-header.component';
import { AttachmentPanelComponent } from '../shared/attachment-panel.component';
import { RecordWorkItemsComponent } from '../shared/record-work-items.component';

type PageMode = 'list' | 'create' | 'detail' | 'edit';
type AuditStep = 'plan' | 'conduct' | 'review';
type AuditStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED';
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
  standard?: string | null;
  title: string;
  notes?: string | null;
  response?: ChecklistResponse | null;
  isComplete: boolean;
  sortOrder: number;
};

type ChecklistGroup = {
  clause: string;
  items: AuditChecklistItem[];
};

type AuditFinding = {
  id: string;
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
  summary?: string | null;
  status: AuditStatus;
  checklistCount?: number;
  completedChecklistCount?: number;
  findingCount?: number;
  openFindingCount?: number;
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
        <a *ngIf="mode() === 'list'" routerLink="/audits/new" class="button-link">+ New audit</a>
        <a *ngIf="mode() === 'detail' && selectedAudit()" [routerLink]="['/audits', selectedAudit()?.id, 'edit']" class="button-link">Edit audit</a>
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
                  <th>Status</th>
                  <th>Checklist</th>
                  <th>Findings</th>
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
                  <td><span class="status-badge" [class.warn]="item.status === 'IN_PROGRESS'" [class.success]="item.status === 'CLOSED'">{{ item.status }}</span></td>
                  <td>{{ item.completedChecklistCount || 0 }}/{{ item.checklistCount || 0 }}</td>
                  <td>{{ item.findingCount || 0 }}</td>
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
                <option>COMPLETED</option>
                <option>CLOSED</option>
              </select>
            </label>
          </div>

          <label class="field"><span>Summary</span><textarea rows="3" formControlName="summary" placeholder="Audit objective, site, and expected outputs"></textarea></label>

          <div class="button-row">
            <button type="submit" [disabled]="auditForm.invalid || saving()">{{ saving() ? 'Saving...' : 'Save audit' }}</button>
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
            <span class="status-badge" [class.warn]="selectedAudit()?.status === 'IN_PROGRESS'" [class.success]="selectedAudit()?.status === 'CLOSED'">{{ selectedAudit()?.status }}</span>
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
                <strong>Review & close</strong>
                <small>Findings and follow-up</small>
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
                <small>The review step consolidates findings, CAPA creation, actions, and final closure in one place.</small>
              </div>
            </div>
          </section>
        </section>

        <section *ngIf="activeStep() === 'conduct'" class="page-columns audit-conduct-layout">
          <section class="card panel-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Conduct audit</span>
                <h3>{{ selectedAudit()?.type === 'Internal Audit' ? 'Checklist walkthrough' : 'Supplier audit questions' }}</h3>
                <p class="subtle">{{ selectedAudit()?.type === 'Internal Audit'
                  ? 'Work through the ISO checklist question by question. Open an item, assess compliance, capture evidence, then move to the next.'
                  : 'Build and assess supplier questions without clutter. Each item expands into a simple evaluation view.' }}</p>
              </div>
            </div>

            <form *ngIf="selectedAudit()?.type === 'Supplier Audit'" class="supplier-builder top-space" [formGroup]="checklistForm" (ngSubmit)="addChecklistItem()">
              <div class="form-grid-2">
                <label class="field">
                  <span>Section or group</span>
                  <input formControlName="clause" placeholder="Delivery">
                </label>
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

            <div class="page-stack top-space" *ngIf="selectedAudit()?.type === 'Internal Audit'; else supplierChecklist">
              <section class="detail-section" *ngFor="let group of checklistGroups()">
                <div class="section-head">
                  <div>
                    <span class="section-eyebrow">Clause {{ group.clause }}</span>
                    <h4>{{ clauseHeading(group.clause) }}</h4>
                  </div>
                </div>

                <div class="question-stack top-space">
                  <article class="question-card" *ngFor="let item of group.items" [class.is-open]="isChecklistExpanded(item.id)">
                    <button type="button" class="question-trigger" (click)="toggleChecklist(item.id)">
                      <div>
                        <small>Clause {{ item.clause || group.clause }}</small>
                        <strong>{{ item.title }}</strong>
                      </div>
                      <span class="response-chip" [class.is-empty]="!item.response" [class.is-yes]="item.response === 'YES'" [class.is-no]="item.response === 'NO'" [class.is-partial]="item.response === 'PARTIAL'">
                        {{ item.response || 'Not assessed' }}
                      </span>
                    </button>

                    <div class="question-body" *ngIf="isChecklistExpanded(item.id)">
                      <div class="response-group">
                        <button type="button" class="response-button" [class.active]="item.response === 'YES'" (click)="setChecklistResponse(item, 'YES')">Yes</button>
                        <button type="button" class="response-button" [class.active]="item.response === 'PARTIAL'" (click)="setChecklistResponse(item, 'PARTIAL')">Partial</button>
                        <button type="button" class="response-button" [class.active]="item.response === 'NO'" (click)="setChecklistResponse(item, 'NO')">No</button>
                      </div>

                      <label class="field top-space">
                        <span>Comments</span>
                        <textarea
                          rows="3"
                          [value]="checklistNoteDraft(item)"
                          (input)="setChecklistNoteDraft(item.id, readTextarea($event))"
                          (blur)="saveChecklistNote(item)"
                          placeholder="Record objective evidence, comments, and observations"
                        ></textarea>
                      </label>

                      <div class="finding-prompt top-space" *ngIf="shouldSuggestFinding(item)">
                        <div>
                          <strong>Finding suggested</strong>
                          <p>This response indicates a possible gap. Create a finding now and continue the follow-up from the review step.</p>
                        </div>
                        <button type="button" class="secondary" (click)="prepareFindingFromChecklist(item)">Create finding</button>
                      </div>

                      <iso-attachment-panel class="top-space" [sourceType]="'audit-checklist-item'" [sourceId]="item.id" />
                    </div>
                  </article>
                </div>
              </section>
            </div>

            <ng-template #supplierChecklist>
              <div class="question-stack top-space">
                <article class="question-card" *ngFor="let item of selectedAudit()?.checklistItems || []" [class.is-open]="isChecklistExpanded(item.id)">
                  <button type="button" class="question-trigger" (click)="toggleChecklist(item.id)">
                    <div>
                      <small>{{ item.clause || 'General' }}</small>
                      <strong>{{ item.title }}</strong>
                    </div>
                    <span class="response-chip" [class.is-empty]="!item.response" [class.is-yes]="item.response === 'YES'" [class.is-no]="item.response === 'NO'" [class.is-partial]="item.response === 'PARTIAL'">
                      {{ item.response || 'Not assessed' }}
                    </span>
                  </button>

                  <div class="question-body" *ngIf="isChecklistExpanded(item.id)">
                    <div class="section-head">
                      <div>
                        <span class="section-eyebrow">Supplier question</span>
                        <h4>{{ item.clause || 'General' }}</h4>
                      </div>
                      <button type="button" class="button-link secondary text-button" (click)="removeChecklistItem(item.id)" [disabled]="saving()">Delete</button>
                    </div>

                    <div class="response-group top-space">
                      <button type="button" class="response-button" [class.active]="item.response === 'YES'" (click)="setChecklistResponse(item, 'YES')">Yes</button>
                      <button type="button" class="response-button" [class.active]="item.response === 'PARTIAL'" (click)="setChecklistResponse(item, 'PARTIAL')">Partial</button>
                      <button type="button" class="response-button" [class.active]="item.response === 'NO'" (click)="setChecklistResponse(item, 'NO')">No</button>
                    </div>

                    <label class="field top-space">
                      <span>Comments</span>
                      <textarea
                        rows="3"
                        [value]="checklistNoteDraft(item)"
                        (input)="setChecklistNoteDraft(item.id, readTextarea($event))"
                        (blur)="saveChecklistNote(item)"
                        placeholder="Record supplier evidence, observations, and follow-up notes"
                      ></textarea>
                    </label>

                    <div class="finding-prompt top-space" *ngIf="shouldSuggestFinding(item)">
                      <div>
                        <strong>Finding suggested</strong>
                        <p>This response indicates a supplier gap that may require a finding and follow-up action.</p>
                      </div>
                      <button type="button" class="secondary" (click)="prepareFindingFromChecklist(item)">Create finding</button>
                    </div>

                    <iso-attachment-panel class="top-space" [sourceType]="'audit-checklist-item'" [sourceId]="item.id" />
                  </div>
                </article>
              </div>
            </ng-template>
          </section>

          <section class="card panel-card conduct-sidecard">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Audit guide</span>
                <h3>How to assess each question</h3>
                <p class="subtle">Keep answers short, objective, and supported by evidence. Findings should only be raised where a real gap exists.</p>
              </div>
            </div>

            <div class="entity-list top-space">
              <div class="entity-item">
                <strong>Yes</strong>
                <small>Requirement is met and objective evidence is available.</small>
              </div>
              <div class="entity-item">
                <strong>Partial</strong>
                <small>Requirement is partly met or inconsistent across the audited area.</small>
              </div>
              <div class="entity-item">
                <strong>No</strong>
                <small>Requirement is not met or required evidence is missing.</small>
              </div>
            </div>

            <div class="button-row top-space">
              <button type="button" class="secondary" (click)="setActiveStep('review')">Go to review</button>
            </div>
          </section>
        </section>

        <section *ngIf="activeStep() === 'review'" class="page-columns">
          <section class="card panel-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Review & close</span>
                <h3>Findings and follow-up</h3>
                <p class="subtle">Capture findings, create CAPA where required, and only close the audit once actions are clearly assigned.</p>
              </div>
            </div>

            <form [formGroup]="findingForm" class="page-stack top-space" (ngSubmit)="addFinding()">
              <label class="field"><span>Finding title</span><input formControlName="title" placeholder="Supplier evaluation records were incomplete"></label>
              <label class="field"><span>Description</span><textarea rows="3" formControlName="description" placeholder="Describe the gap, evidence, and impact"></textarea></label>
              <div class="form-grid-3">
                <label class="field">
                  <span>Severity</span>
                  <select formControlName="severity">
                    <option>OBSERVATION</option>
                    <option>MINOR</option>
                    <option>MAJOR</option>
                  </select>
                </label>
                <label class="field">
                  <span>Owner</span>
                  <select formControlName="ownerId">
                    <option value="">Unassigned</option>
                    <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
                  </select>
                </label>
                <label class="field"><span>Due date</span><input type="date" formControlName="dueDate"></label>
              </div>
              <div class="button-row">
                <button type="submit" [disabled]="findingForm.invalid || saving()">Add finding</button>
                <button type="button" class="secondary" [disabled]="saving() || selectedAudit()?.status === 'COMPLETED'" (click)="updateAuditStatus('COMPLETED')">Mark completed</button>
                <button type="button" class="secondary" [disabled]="saving() || selectedAudit()?.status === 'CLOSED'" (click)="updateAuditStatus('CLOSED')">Close audit</button>
              </div>
            </form>

            <div class="entity-list top-space">
              <article class="entity-item" *ngFor="let finding of selectedAudit()?.findings || []">
                <div class="section-head">
                  <div>
                    <strong>{{ finding.title }}</strong>
                    <small>{{ finding.severity }} | {{ finding.status }}{{ finding.dueDate ? ' | due ' + finding.dueDate.slice(0, 10) : '' }}</small>
                  </div>
                </div>
                <p class="subtle">{{ finding.description }}</p>
                <div class="button-row compact-row">
                  <button type="button" class="secondary" [disabled]="!!finding.linkedCapaId || saving()" (click)="createCapaFromFinding(finding)">
                    {{ finding.linkedCapaId ? 'CAPA linked' : 'Create CAPA' }}
                  </button>
                  <button type="button" class="secondary" [disabled]="saving()" (click)="prepareActionFromFinding(finding)">Create action</button>
                  <button type="button" class="secondary" [disabled]="saving() || finding.status === 'CLOSED'" (click)="updateFindingStatus(finding, 'CLOSED')">Close finding</button>
                </div>
              </article>
            </div>
          </section>

          <iso-record-work-items
            [sourceType]="'audit'"
            [sourceId]="selectedId()"
            [draftTitle]="draftActionTitle()"
            [draftDescription]="draftActionDescription()"
          />
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

    .question-trigger {
      width: 100%;
      border: 0;
      background: transparent;
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: center;
      text-align: left;
      padding: 1.1rem 1.2rem;
    }

    .question-trigger strong {
      display: block;
      margin-top: 0.3rem;
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

    .conduct-sidecard {
      align-self: start;
      position: sticky;
      top: 1rem;
    }

    @media (max-width: 980px) {
      .audit-steps,
      .audit-conduct-layout {
        grid-template-columns: 1fr;
      }

      .conduct-sidecard {
        position: static;
      }

      .finding-prompt,
      .question-trigger {
        display: grid;
      }
    }
  `]
})
export class AuditsPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
  protected readonly audits = signal<AuditRecord[]>([]);
  protected readonly users = signal<UserOption[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly selectedAudit = signal<AuditRecord | null>(null);
  protected readonly activeStep = signal<AuditStep>('plan');
  protected readonly expandedChecklistId = signal<string | null>(null);
  protected readonly checklistNoteDrafts = signal<Record<string, string>>({});
  protected readonly draftActionTitle = signal<string | null>(null);
  protected readonly draftActionDescription = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
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
    if (!this.selectedId() || this.checklistForm.invalid) {
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    const raw = this.checklistForm.getRawValue();
    this.api.post(`audits/${this.selectedId()}/checklist-items`, {
      ...raw,
      clause: raw.clause.trim() || undefined,
      notes: raw.notes.trim() || undefined,
      standard: this.selectedAudit()?.standard || undefined
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('Checklist item added.');
        this.checklistForm.reset({ clause: '', title: '', notes: '' });
        this.fetchAudit(this.selectedId() as string);
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Checklist item save failed.'));
      }
    });
  }

  protected updateChecklistItem(item: AuditChecklistItem, patch: { response?: ChecklistResponse | null; notes?: string }) {
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
        this.fetchAudit(this.selectedId() as string);
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Checklist update failed.'));
      }
    });
  }

  protected setChecklistResponse(item: AuditChecklistItem, response: ChecklistResponse) {
    this.updateChecklistItem(item, { response });
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
        this.fetchAudit(this.selectedId() as string);
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Checklist item removal failed.'));
      }
    });
  }

  protected addFinding() {
    if (!this.selectedId() || this.findingForm.invalid) {
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
        this.fetchAudit(this.selectedId() as string);
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Finding save failed.'));
      }
    });
  }

  protected updateFindingStatus(finding: AuditFinding, status: FindingStatus) {
    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.api.patch(`audits/findings/${finding.id}`, { status }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('Finding updated.');
        this.fetchAudit(this.selectedId() as string);
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Finding update failed.'));
      }
    });
  }

  protected createCapaFromFinding(finding: AuditFinding) {
    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.api.post(`audits/findings/${finding.id}/create-capa`, {
      title: `Audit finding CAPA: ${finding.title}`,
      problemStatement: finding.description,
      ownerId: finding.ownerId || undefined,
      dueDate: finding.dueDate || undefined
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('CAPA created from audit finding.');
        this.fetchAudit(this.selectedId() as string);
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'CAPA creation failed.'));
      }
    });
  }

  protected prepareActionFromFinding(finding: AuditFinding) {
    this.draftActionTitle.set(`Audit action: ${finding.title}`);
    this.draftActionDescription.set(finding.description);
    this.message.set('Action form prepared from the selected finding.');
  }

  protected prepareFindingFromChecklist(item: AuditChecklistItem) {
    this.findingForm.patchValue({
      title: `Checklist finding: ${item.title}`,
      description: item.notes?.trim() || `Potential nonconformity identified during audit question review: ${item.title}`,
      severity: item.response === 'NO' ? 'MAJOR' : 'MINOR'
    });
    this.activeStep.set('review');
    this.message.set('Finding form prepared from the selected checklist question.');
  }

  protected shouldSuggestFinding(item: AuditChecklistItem) {
    return item.response === 'NO' || item.response === 'PARTIAL';
  }

  protected setActiveStep(step: AuditStep) {
    this.activeStep.set(step);
  }

  protected toggleChecklist(id: string) {
    this.expandedChecklistId.set(this.expandedChecklistId() === id ? null : id);
  }

  protected isChecklistExpanded(id: string) {
    return this.expandedChecklistId() === id;
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
        this.message.set(status === 'CLOSED' ? 'Audit closed successfully.' : 'Audit status updated.');
        this.fetchAudit(this.selectedId() as string);
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Audit status update failed.'));
      }
    });
  }

  protected readTextarea(event: Event) {
    return (event.target as HTMLTextAreaElement).value;
  }

  protected checklistGroups(): ChecklistGroup[] {
    const items = this.selectedAudit()?.checklistItems || [];
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

  private handleRoute(params: ParamMap) {
    const id = params.get('id');
    this.selectedId.set(id);
    this.message.set((history.state?.notice as string) || '');
    this.error.set('');
    this.activeStep.set('plan');
    this.expandedChecklistId.set(null);
    this.checklistNoteDrafts.set({});
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
    this.checklistForm.reset({ clause: '', title: '', notes: '' });
    this.findingForm.reset({ title: '', description: '', severity: 'OBSERVATION', ownerId: '', dueDate: '' });
  }

  private fetchAudit(id: string) {
    this.loading.set(true);
    this.api.get<AuditRecord>(`audits/${id}`).subscribe({
      next: (audit) => {
        const currentExpandedId = this.expandedChecklistId();
        this.loading.set(false);
        this.selectedAudit.set(audit);
        this.activeStep.set(this.deriveStep(audit));
        this.checklistNoteDrafts.set(
          Object.fromEntries((audit.checklistItems || []).map((item) => [item.id, item.notes ?? '']))
        );
        this.expandedChecklistId.set(
          (audit.checklistItems || []).some((item) => item.id === currentExpandedId)
            ? currentExpandedId
            : audit.checklistItems?.[0]?.id ?? null
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
    if (audit.status === 'COMPLETED' || audit.status === 'CLOSED' || (audit.findingCount || 0) > 0) {
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
}
