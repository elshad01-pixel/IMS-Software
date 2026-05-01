import { CommonModule } from '@angular/common';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
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
        [label]="'Management Review'"
        [title]="pageTitle()"
        [description]="pageDescription()"
        [breadcrumbs]="breadcrumbs()"
      >
        <a *ngIf="showStartHereBackLink()" [routerLink]="['/implementation']" class="button-link secondary">Back to Start Here</a>
        <a *ngIf="mode() === 'list' && canWrite()" routerLink="/management-review/new" class="button-link">+ New review meeting</a>
        <button *ngIf="mode() === 'detail' && selectedReview()" type="button" class="button-link secondary" [disabled]="generatingReport()" (click)="generateReport()">
          {{ generatingReport() ? 'Preparing PDF...' : 'Download PDF protocol' }}
        </button>
        <button *ngIf="mode() === 'detail' && selectedReview()" type="button" class="button-link secondary" [disabled]="generatingPresentation()" (click)="generatePresentation()">
          {{ generatingPresentation() ? 'Preparing PPT...' : 'Download PPT dashboard' }}
        </button>
        <a *ngIf="mode() === 'detail' && selectedReview() && canWrite()" [routerLink]="['/management-review', selectedReview()?.id, 'edit']" class="button-link">Edit meeting</a>
        <button *ngIf="mode() === 'detail' && canArchiveReview()" type="button" class="button-link secondary" (click)="archiveReview()">Archive meeting</button>
        <a *ngIf="mode() !== 'list'" routerLink="/management-review" class="button-link secondary">Back to meetings</a>
      </iso-page-header>

      <section *ngIf="mode() === 'list'" class="page-stack">
        <div class="card list-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Meetings</span>
              <h3>Structured management reviews</h3>
              <p class="subtle">Run ISO management review meetings with explicit inputs, outputs, decisions, and action follow-up.</p>
            </div>
          </div>

          <div class="empty-state" *ngIf="loading()">
            <strong>Loading management reviews</strong>
            <span>Refreshing meetings, status, and recorded management-review content.</span>
          </div>

          <div class="data-table-wrap" *ngIf="!loading() && reviews().length">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Meeting</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Input coverage</th>
                  <th>Outputs readiness</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of reviews()" [routerLink]="['/management-review', item.id]">
                  <td>
                    <div class="table-title">
                      <strong>{{ item.title }}</strong>
                      <small>{{ item.summary || 'No summary' }}</small>
                    </div>
                  </td>
                  <td>{{ item.reviewDate ? (item.reviewDate | date:'yyyy-MM-dd') : 'TBD' }}</td>
                  <td><span class="status-badge" [class.success]="item.status === 'CLOSED'" [class.warn]="item.status === 'HELD'">{{ item.status }}</span></td>
                  <td>{{ reviewInputCoverage(item) }}/{{ inputSectionCount() }}</td>
                  <td>
                    <span class="status-badge" [class.success]="reviewOutputsReady(item)" [class.warn]="item.status !== 'PLANNED' && !reviewOutputsReady(item)">
                      {{ reviewOutputsReady(item) ? 'Recorded' : 'Pending' }}
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
              <h3>{{ mode() === 'create' ? 'Create management review' : 'Edit management review' }}</h3>
              <p class="subtle">Use the built-in ISO structure for inputs and outputs instead of a single free-form note.</p>
            </div>
          </div>

          <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <section class="readiness-strip">
            <article class="readiness-card">
              <span>Inputs captured</span>
              <strong>{{ completedInputCount() }}/{{ inputSectionCount() }}</strong>
              <small>{{ completedInputCount() >= plannedInputTarget() ? 'Input coverage is strong enough for an evidence-based review.' : 'Record the main audit, CAPA, KPI, provider, obligation, and risk inputs before the meeting.' }}</small>
            </article>
            <article class="readiness-card">
              <span>Outputs captured</span>
              <strong>{{ completedOutputCount() }}/{{ outputSectionCount() }}</strong>
              <small>{{ completedOutputCount() >= heldOutputTarget() ? 'Outputs are taking shape for controlled follow-up.' : 'Decisions, system changes, objective changes, and resources should be explicit.' }}</small>
            </article>
            <article class="readiness-card">
              <span>Meeting readiness</span>
              <strong>{{ reviewReadinessLabel() }}</strong>
              <small>{{ reviewReadinessHint() }}</small>
            </article>
          </section>

          <section class="guidance-card">
            <strong>Live system inputs</strong>
            <p>
              Use these registers as live evidence when writing the input sections below.
              <ng-container *ngIf="hasAiAddOn()"> You can also ask AI to draft the input text from the current tenant records, then edit it before saving.</ng-container>
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
                {{ generatingAiInputs() ? 'Drafting inputs...' : 'AI draft inputs from live records' }}
              </button>
            </div>
            <small class="top-space" *ngIf="hasAiAddOn()">AI fills only the management review input sections. You can edit every field before saving the meeting.</small>
          </section>

          <label class="field"><span>Title</span><input formControlName="title" placeholder="Q1 2026 management review"></label>
          <div class="form-grid-3">
            <label class="field"><span>Meeting date</span><input type="date" formControlName="reviewDate"></label>
            <label class="field">
              <span>Chairperson</span>
              <select formControlName="chairpersonId">
                <option value="">Unassigned</option>
                <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
              </select>
            </label>
            <label class="field">
              <span>Status</span>
              <select formControlName="status">
                <option>PLANNED</option>
                <option>HELD</option>
                <option>CLOSED</option>
              </select>
            </label>
          </div>

          <section class="detail-section">
            <h4>Inputs</h4>
            <div class="page-stack top-space">
              <p class="section-note">Use these sections to cover the main ISO management-review inputs across quality, environmental, and OH&amp;S performance.</p>
              <label class="field"><span>Audit results</span><textarea rows="3" formControlName="auditResults" placeholder="Summarize audit outcomes and themes"></textarea></label>
              <label class="field"><span>CAPA status</span><textarea rows="3" formControlName="capaStatus" placeholder="Summarize open, overdue, and effective CAPA"></textarea></label>
              <label class="field"><span>KPI performance</span><textarea rows="3" formControlName="kpiPerformance" placeholder="Summarize KPI performance, breaches, and trends"></textarea></label>
              <label class="field"><span>Customer and interested-party feedback</span><textarea rows="3" formControlName="customerInterestedPartiesFeedback" placeholder="Customer satisfaction, complaints, stakeholder concerns, and other feedback"></textarea></label>
              <label class="field"><span>Provider performance</span><textarea rows="3" formControlName="providerPerformance" placeholder="Supplier/provider performance, approvals, audits, and escalations"></textarea></label>
              <label class="field"><span>Compliance obligations</span><textarea rows="3" formControlName="complianceObligations" placeholder="Regulatory, legal, contractual, and compliance-obligation review status"></textarea></label>
              <label class="field"><span>Incidents and emergency performance</span><textarea rows="3" formControlName="incidentEmergencyPerformance" placeholder="Incidents, near misses, emergency response, drills, and lessons learned"></textarea></label>
              <label class="field"><span>Consultation and communication</span><textarea rows="3" formControlName="consultationCommunication" placeholder="Worker consultation, participation, communications, complaints, or relevant interested-party dialogue"></textarea></label>
              <label class="field"><span>Risks and opportunities</span><textarea rows="3" formControlName="risksOpportunities" placeholder="Summarize current risk exposure and opportunities"></textarea></label>
              <label class="field"><span>Changes affecting the system</span><textarea rows="3" formControlName="changesAffectingSystem" placeholder="Regulatory, organizational, supplier, or process changes"></textarea></label>
              <label class="field"><span>Previous actions</span><textarea rows="3" formControlName="previousActions" placeholder="Status of previous management review outputs"></textarea></label>
            </div>
          </section>

          <section class="detail-section">
            <h4>Outputs</h4>
            <div class="page-stack top-space">
              <p class="section-note">Use these sections to record the formal outputs expected from management review, not just meeting notes.</p>
              <label class="field"><span>Minutes</span><textarea rows="4" formControlName="minutes" placeholder="Formal meeting minutes"></textarea></label>
              <label class="field"><span>Decisions</span><textarea rows="3" formControlName="decisions" placeholder="Decisions made by management"></textarea></label>
              <label class="field"><span>Improvement actions</span><textarea rows="3" formControlName="improvementActions" placeholder="Improvement commitments and actions"></textarea></label>
              <label class="field"><span>System changes needed</span><textarea rows="3" formControlName="systemChangesNeeded" placeholder="Needed changes to the management system, controls, or processes"></textarea></label>
              <label class="field"><span>Objective and target changes</span><textarea rows="3" formControlName="objectiveTargetChanges" placeholder="Changes to objectives, targets, measures, or review priorities"></textarea></label>
              <label class="field"><span>Resource needs</span><textarea rows="3" formControlName="resourceNeeds" placeholder="People, budget, competence, or infrastructure needs"></textarea></label>
              <label class="field"><span>Effectiveness conclusion</span><textarea rows="3" formControlName="effectivenessConclusion" placeholder="Conclusion on suitability, adequacy, and effectiveness of the management system"></textarea></label>
              <label class="field"><span>Summary</span><textarea rows="2" formControlName="summary" placeholder="Executive summary of the review"></textarea></label>
            </div>
          </section>

          <div class="button-row">
            <button type="submit" [disabled]="reviewForm.invalid || saving() || !canWrite()">{{ saving() ? 'Saving...' : 'Save meeting' }}</button>
            <a [routerLink]="selectedId() ? ['/management-review', selectedId()] : ['/management-review']" class="button-link secondary">Cancel</a>
          </div>
        </form>
      </section>

          <section *ngIf="mode() === 'detail' && selectedReview()" class="page-columns">
        <div class="page-stack">
          <section class="card detail-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Management review</span>
                <h3>{{ selectedReview()?.title }}</h3>
                <p class="subtle">{{ selectedReview()?.reviewDate ? (selectedReview()?.reviewDate | date:'yyyy-MM-dd') : 'Date not set' }}</p>
              </div>
              <span class="status-badge" [class.success]="selectedReview()?.status === 'CLOSED'" [class.warn]="selectedReview()?.status === 'HELD'">{{ selectedReview()?.status }}</span>
            </div>

            <section class="readiness-strip top-space">
              <article class="readiness-card">
                <span>Inputs recorded</span>
                <strong>{{ detailInputCount() }}/{{ inputSectionCount() }}</strong>
                <small>Core management review inputs are recorded directly in the meeting itself.</small>
              </article>
              <article class="readiness-card">
                <span>Outputs recorded</span>
                <strong>{{ detailOutputCount() }}/{{ outputSectionCount() }}</strong>
                <small>{{ detailOutputCount() >= heldOutputTarget() ? 'Decisions and outputs are recorded for follow-up.' : 'Capture decisions, system changes, objective changes, and resources before closure.' }}</small>
              </article>
              <article class="readiness-card">
                <span>Management position</span>
                <strong>{{ managementPositionLabel() }}</strong>
                <small>{{ managementPositionHint() }}</small>
              </article>
            </section>

            <section class="guidance-card top-space" *ngIf="needsMeetingContentAttention()">
              <strong>Complete the meeting record before raising actions</strong>
              <p>This review still needs written meeting content. Use Edit meeting first, then create actions from the sections that contain actual decisions or follow-up needs.</p>
              <small>Action buttons stay available only where section content already exists.</small>
            </section>

            <section class="guidance-card top-space">
              <strong>Live review signals</strong>
              <p>These records should inform the meeting narrative, but they do not write into the review automatically. Use them when updating audit results, risks and opportunities, and changes affecting the system.</p>
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
                    <p class="subtle">{{ section.value || 'No content recorded yet.' }}</p>
                  </div>
                  <button type="button" class="secondary" [disabled]="!canCreateActionFromSection(section.value)" [title]="createActionTooltip(section.value)" (click)="prepareAction(section.label, section.value)">Prepare follow-up action</button>
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
    return {
      list: 'Management reviews',
      create: 'Create management review',
      detail: this.selectedReview()?.title || 'Management review detail',
      edit: this.selectedReview()?.title || 'Edit management review'
    }[this.mode()];
  }

  protected pageDescription() {
    return {
      list: 'Run structured ISO management reviews with clear inputs, decisions, and action outputs.',
      create: 'Capture the meeting against a structured ISO template and use live system records as evidence.',
      detail: 'Review management inputs, outputs, and linked actions in one calm operational workspace.',
      edit: 'Update the meeting record while preserving the action context and using live records as evidence.'
    }[this.mode()];
  }

  protected breadcrumbs() {
    if (this.mode() === 'list') return [{ label: 'Management Review' }];
    const base = [{ label: 'Management Review', link: '/management-review' }];
    if (this.mode() === 'create') return [...base, { label: 'New review' }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedReview()?.title || 'Review', link: `/management-review/${this.selectedId()}` }, { label: 'Edit' }];
    return [...base, { label: this.selectedReview()?.title || 'Review' }];
  }

  protected reviewSections() {
    const review = this.selectedReview();
    if (!review) return [];
    return [
      { label: 'Audit results', value: review.auditResults },
      { label: 'CAPA status', value: review.capaStatus },
      { label: 'KPI performance', value: review.kpiPerformance },
      { label: 'Customer and interested-party feedback', value: review.customerInterestedPartiesFeedback },
      { label: 'Provider performance', value: review.providerPerformance },
      { label: 'Compliance obligations', value: review.complianceObligations },
      { label: 'Incidents and emergency performance', value: review.incidentEmergencyPerformance },
      { label: 'Consultation and communication', value: review.consultationCommunication },
      { label: 'Risks and opportunities', value: review.risksOpportunities },
      { label: 'Changes affecting the system', value: review.changesAffectingSystem },
      { label: 'Previous actions', value: review.previousActions },
      { label: 'Minutes', value: review.minutes },
      { label: 'Decisions', value: review.decisions },
      { label: 'Improvement actions', value: review.improvementActions },
      { label: 'System changes needed', value: review.systemChangesNeeded },
      { label: 'Objective and target changes', value: review.objectiveTargetChanges },
      { label: 'Resource needs', value: review.resourceNeeds },
      { label: 'Effectiveness conclusion', value: review.effectivenessConclusion }
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
        label: 'Customer feedback',
        value: feedbackResponses,
        copy: feedbackResponses
          ? `${feedbackResponses} completed survey response${feedbackResponses === 1 ? '' : 's'} with an average of ${feedbackAverage ?? 0}/10. ${feedbackAttention} response${feedbackAttention === 1 ? '' : 's'} sit in the 0-6 attention range.`
          : 'No completed customer surveys are recorded yet, so this section may still rely on NCRs, complaints, and direct stakeholder discussion.',
        reviewCopy: 'Use customer survey scores, low-score comments, complaints, and other interested-party feedback when writing this section.',
        link: '/context/interested-parties'
      },
      {
        label: 'Audit and supplier assurance',
        value: openIncidents + providerReviews,
        copy: `${openIncidents} open incident${openIncidents === 1 ? '' : 's'} and ${providerReviews} provider review item${providerReviews === 1 ? '' : 's'} should inform audit results and supplier-control discussion.`,
        reviewCopy: 'Use these live records when summarising audit results and supplier assurance themes.',
        link: '/external-providers'
      },
      {
        label: 'Risk and compliance exposure',
        value: overdueObligations + highHazards + highAspects,
        copy: `${overdueObligations} obligation review item${overdueObligations === 1 ? '' : 's'}, ${highHazards} high hazard${highHazards === 1 ? '' : 's'}, and ${highAspects} significant aspect${highAspects === 1 ? '' : 's'} should inform risk and opportunity review.`,
        reviewCopy: 'Use these live records when writing risks and opportunities and wider compliance exposure.',
        link: '/compliance-obligations'
      },
      {
        label: 'Changes affecting the system',
        value: activeChanges,
        copy: `${activeChanges} active change request${activeChanges === 1 ? '' : 's'} may need to be discussed as current system change.`,
        reviewCopy: 'Use active change requests to support the changes affecting the system section.',
        link: '/change-management'
      }
    ].filter((item) => this.hasCustomerFeedbackAddOn() || item.label !== 'Customer feedback');
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
      return this.completedOutputCount() >= 6 ? 'Ready to close' : 'Closure gaps';
    }
    if (status === 'HELD') {
      return this.completedOutputCount() >= this.heldOutputTarget() ? 'Follow-up forming' : 'Outputs still thin';
    }
    return this.completedInputCount() >= this.plannedInputTarget() ? 'Agenda ready' : 'Build inputs';
  }

  protected reviewReadinessHint() {
    const status = this.reviewForm.getRawValue().status;
    if (status === 'CLOSED') {
      return 'A closed review should show decisions, system changes, objective changes, resources, and an effectiveness conclusion.';
    }
    if (status === 'HELD') {
      return 'Held meetings should already show minutes, decisions, initial actions, and management direction for follow-up.';
    }
    return 'Planned meetings should bring together audit, KPI, provider, compliance, incident, and risk inputs before discussion starts.';
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
      return 'Pending';
    }
    if (review.status === 'CLOSED') {
      return this.detailOutputCount() >= 6 ? 'Decision recorded' : 'Closure incomplete';
    }
    if (review.status === 'HELD') {
      return this.detailOutputCount() >= this.heldOutputTarget() ? 'Follow-up defined' : 'Awaiting follow-up';
    }
    return 'Planned discussion';
  }

  protected managementPositionHint() {
    const review = this.selectedReview();
    if (!review) {
      return 'Management review outputs will appear once the meeting record is saved.';
    }
    if (review.status === 'CLOSED') {
      return 'The meeting can be closed even while resulting actions continue afterward, but the conclusion and resource position should be explicit.';
    }
    if (review.status === 'HELD') {
      return 'Review the decisions, output actions, and effectiveness direction before treating this meeting as closed.';
    }
    return 'Use the live system records below to prepare evidence before the meeting is held.';
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
      this.error.set('You do not have permission to update management reviews.');
      return;
    }

    if (this.reviewForm.invalid) {
      this.error.set('Complete the required management review fields.');
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
        this.router.navigate(['/management-review', review.id], { state: { notice: 'Management review saved successfully.' } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Management review save failed.'));
      }
    });
  }

  protected draftInputsWithAi() {
    if (!this.hasAiAddOn()) {
      this.error.set('AI assistant add-on is not enabled for this tenant.');
      return;
    }

    if (!this.canWrite()) {
      this.error.set('You do not have permission to update management reviews.');
      return;
    }

    if (this.hasExistingInputContent() && !window.confirm('Replace the current management review input text with a new AI draft from live records?')) {
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
            : `Management review inputs drafted from live records using ${draft.provider} ${draft.model}.`
        );
      },
      error: (error: HttpErrorResponse) => {
        this.generatingAiInputs.set(false);
        this.error.set(this.readError(error, 'Management review AI draft failed.'));
      }
    });
  }

  protected prepareAction(sectionLabel: string, content?: string | null) {
    if (!this.canCreateActions()) {
      this.error.set('You do not have permission to create actions.');
      return;
    }

    this.draftActionTitle.set(`Management review action: ${sectionLabel}`);
    this.draftActionDescription.set(content || '');
    this.message.set(`Follow-up action draft opened below from ${sectionLabel.toLowerCase()}.`);
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
      return 'You do not have permission to create actions.';
    }
    if (!(value || '').trim()) {
      return 'Add meeting content first, then prepare an action from that section.';
    }
    return 'Prepare a follow-up action from this section.';
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

    if (!window.confirm('Archive this management review? It will be removed from the active meeting list but kept in the audit trail.')) {
      return;
    }

    this.saving.set(true);
    this.message.set('');
    this.error.set('');
    this.api.patch(`management-review/${this.selectedId()}/archive`, {}).subscribe({
      next: () => {
        this.saving.set(false);
        void this.router.navigate(['/management-review'], { state: { notice: 'Management review archived.' } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Management review archive failed.'));
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
        this.message.set('Management review PDF download started.');
      },
      error: (error: HttpErrorResponse) => {
        this.generatingReport.set(false);
        this.error.set(this.readError(error, 'Management review PDF could not be prepared.'));
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
        this.message.set('Management review PPT download started.');
      },
      error: (error: HttpErrorResponse) => {
        this.generatingPresentation.set(false);
        this.error.set(
          this.readError(error, 'Management review PPT could not be prepared.')
        );
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
      agenda: 'Review performance of the integrated management system.',
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
        this.error.set(this.readError(error, 'Management review details could not be loaded.'));
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
        this.error.set(this.readError(error, 'Management reviews could not be loaded.'));
      }
    });
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

}
