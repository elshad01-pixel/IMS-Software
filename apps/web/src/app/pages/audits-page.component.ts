import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { PageHeaderComponent } from '../shared/page-header.component';
import { RecordWorkItemsComponent } from '../shared/record-work-items.component';

type PageMode = 'list' | 'create' | 'detail' | 'edit';
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
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, RecordWorkItemsComponent],
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
              <p class="subtle">Internal audits can seed ISO clause checklists automatically. Supplier audits stay fully custom.</p>
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
              <small>Select an ISO standard to seed clauses 4-10 automatically.</small>
            </div>
            <div class="entity-item">
              <strong>Supplier audit</strong>
              <small>Use the detail page to add or remove supplier-specific checklist items.</small>
            </div>
            <div class="entity-item">
              <strong>Findings and actions</strong>
              <small>Raise findings, create CAPA, and prepare global actions from the audit record.</small>
            </div>
          </div>
        </section>
      </section>

      <section *ngIf="mode() === 'detail' && selectedAudit()" class="page-stack">
        <div class="page-columns">
          <section class="card detail-card">
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
                <span>Checklist progress</span>
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

            <dl class="key-value top-space">
              <dt>Scope</dt>
              <dd>{{ selectedAudit()?.scope || 'No scope recorded.' }}</dd>
              <dt>Auditee area</dt>
              <dd>{{ selectedAudit()?.auditeeArea || 'Not set' }}</dd>
              <dt>Summary</dt>
              <dd>{{ selectedAudit()?.summary || 'No summary yet.' }}</dd>
            </dl>
          </section>

          <iso-record-work-items
            [sourceType]="'audit'"
            [sourceId]="selectedId()"
            [draftTitle]="draftActionTitle()"
            [draftDescription]="draftActionDescription()"
          />
        </div>

        <div class="page-columns">
          <section class="card panel-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Checklist</span>
                <h3>{{ selectedAudit()?.type === 'Internal Audit' ? 'Clause-based ISO checklist' : 'Supplier checklist' }}</h3>
                <p class="subtle">Mark clause compliance, record comments, and maintain custom supplier questions where needed.</p>
              </div>
            </div>

            <form class="page-stack top-space" [formGroup]="checklistForm" (ngSubmit)="addChecklistItem()">
              <div class="form-grid-3">
                <label class="field">
                  <span>Clause</span>
                  <input formControlName="clause" placeholder="4">
                </label>
                <label class="field">
                  <span>Question</span>
                  <input formControlName="title" placeholder="Supplier evaluation criteria are defined">
                </label>
                <label class="field">
                  <span>Order</span>
                  <input type="number" min="0" formControlName="sortOrder">
                </label>
              </div>
              <label class="field">
                <span>Comments</span>
                <textarea rows="2" formControlName="notes" placeholder="Initial audit note or planned evidence to review"></textarea>
              </label>
              <div class="button-row">
                <button type="submit" [disabled]="checklistForm.invalid || saving()">{{ saving() ? 'Saving...' : 'Add checklist item' }}</button>
              </div>
            </form>

            <div class="entity-list top-space">
              <article class="entity-item checklist-card" *ngFor="let item of selectedAudit()?.checklistItems || []">
                <div class="section-head">
                  <div>
                    <strong>Clause {{ item.clause || '-' }} | {{ item.title }}</strong>
                    <small>{{ item.standard || selectedAudit()?.standard || selectedAudit()?.type }}</small>
                  </div>
                  <button type="button" class="button-link secondary text-button" (click)="removeChecklistItem(item.id)" [disabled]="saving()">Remove</button>
                </div>
                <div class="form-grid-2 top-space">
                  <label class="field">
                    <span>Compliance</span>
                    <select [value]="item.response || ''" (change)="updateChecklistItem(item, { response: readChecklistResponse($event) })">
                      <option value="">Not assessed</option>
                      <option>YES</option>
                      <option>NO</option>
                      <option>PARTIAL</option>
                    </select>
                  </label>
                  <label class="field">
                    <span>Comments</span>
                    <textarea rows="2" [value]="item.notes || ''" (change)="updateChecklistItem(item, { notes: readTextarea($event) })"></textarea>
                  </label>
                </div>
              </article>
            </div>
          </section>

          <section class="card panel-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Findings</span>
                <h3>Observations and nonconformities</h3>
                <p class="subtle">Raise findings, create CAPA for nonconformities, or convert findings into tracked actions.</p>
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
              <button type="submit" [disabled]="findingForm.invalid || saving()">Add finding</button>
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
        </div>

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
    notes: [''],
    sortOrder: [0, [Validators.required, Validators.min(0)]]
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
      list: 'Manage internal and supplier audits with checklist progress, findings, and follow-up.',
      create: 'Set up the audit first, then execute clause reviews and findings on the detail page.',
      detail: 'Review the audit, assess each checklist question, and convert findings into CAPA or actions.',
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
        this.checklistForm.reset({ clause: '', title: '', notes: '', sortOrder: 0 });
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

  protected removeChecklistItem(id: string) {
    this.saving.set(true);
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

  protected readChecklistResponse(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    return (value || null) as ChecklistResponse | null;
  }

  protected readTextarea(event: Event) {
    return (event.target as HTMLTextAreaElement).value;
  }

  private handleRoute(params: ParamMap) {
    const id = params.get('id');
    this.selectedId.set(id);
    this.message.set((history.state?.notice as string) || '');
    this.error.set('');
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
    this.checklistForm.reset({ clause: '', title: '', notes: '', sortOrder: 0 });
    this.findingForm.reset({ title: '', description: '', severity: 'OBSERVATION', ownerId: '', dueDate: '' });
  }

  private fetchAudit(id: string) {
    this.loading.set(true);
    this.api.get<AuditRecord>(`audits/${id}`).subscribe({
      next: (audit) => {
        this.loading.set(false);
        this.selectedAudit.set(audit);
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

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}
