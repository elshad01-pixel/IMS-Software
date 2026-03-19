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
  title: string;
  notes?: string | null;
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
  type: string;
  scope?: string | null;
  leadAuditorId?: string | null;
  auditeeArea?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
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
              <h3>Audit program</h3>
              <p class="subtle">A clean program view for planned audits, progress, checklist completion, and open findings.</p>
            </div>
          </div>

          <div class="empty-state" *ngIf="loading()">Loading audits...</div>
          <table class="data-table" *ngIf="!loading()">
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th>Status</th>
                <th>Checklist</th>
                <th>Open findings</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of audits()" [routerLink]="['/audits', item.id]">
                <td><strong>{{ item.code }}</strong></td>
                <td>{{ item.title }}</td>
                <td><span class="status-badge" [class.warn]="item.status === 'IN_PROGRESS'" [class.success]="item.status === 'CLOSED'">{{ item.status }}</span></td>
                <td>{{ item.completedChecklistCount || 0 }}/{{ item.checklistCount || 0 }}</td>
                <td>{{ item.openFindingCount || 0 }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section *ngIf="mode() === 'create' || mode() === 'edit'" class="page-columns">
        <form class="card form-card page-stack" [formGroup]="auditForm" (ngSubmit)="saveAudit()">
          <div class="section-head">
            <div>
              <h3>{{ mode() === 'create' ? 'Create audit plan' : 'Edit audit plan' }}</h3>
              <p class="subtle">Capture the program entry first. Checklist, findings, and CAPA links stay on the audit detail page.</p>
            </div>
          </div>

          <p class="feedback" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <div class="form-grid-2">
            <label class="field"><span>Code</span><input formControlName="code" placeholder="IA-2026-001"></label>
            <label class="field"><span>Type</span><input formControlName="type" placeholder="Internal process audit"></label>
          </div>
          <label class="field"><span>Title</span><input formControlName="title" placeholder="Purchasing process audit"></label>
          <label class="field"><span>Scope</span><textarea rows="3" formControlName="scope" placeholder="Suppliers, receiving, and approvals"></textarea></label>
          <div class="form-grid-2">
            <label class="field">
              <span>Lead auditor</span>
              <select formControlName="leadAuditorId">
                <option value="">Unassigned</option>
                <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
              </select>
            </label>
            <label class="field"><span>Auditee area</span><input formControlName="auditeeArea" placeholder="Operations"></label>
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
          <label class="field"><span>Summary</span><textarea rows="3" formControlName="summary" placeholder="Program notes or conclusions"></textarea></label>

          <div class="button-row">
            <button type="submit" [disabled]="auditForm.invalid || saving()">{{ saving() ? 'Saving...' : 'Save audit' }}</button>
            <a [routerLink]="selectedId() ? ['/audits', selectedId()] : ['/audits']" class="button-link secondary">Cancel</a>
          </div>
        </form>

        <section class="card panel-card">
          <div class="section-head">
            <div>
              <h3>Program structure</h3>
              <p class="subtle">The plan stays simple here. Execution evidence lives on the audit page itself.</p>
            </div>
          </div>
          <div class="entity-list top-space">
            <div class="entity-item">
              <strong>Create the plan</strong>
              <small>Register the audit with schedule, scope, lead auditor, and auditee area.</small>
            </div>
            <div class="entity-item">
              <strong>Execute from the detail page</strong>
              <small>Use the detail page for checklist progress, findings, and linked CAPA.</small>
            </div>
            <div class="entity-item">
              <strong>Close with evidence</strong>
              <small>Use actions and attachments only after the audit record exists.</small>
            </div>
          </div>
          <iso-record-work-items *ngIf="selectedId()" [sourceType]="'audit'" [sourceId]="selectedId()" />
        </section>
      </section>

      <section *ngIf="mode() === 'detail' && selectedAudit()" class="page-stack">
        <div class="page-columns">
          <section class="card detail-card">
            <div class="section-head">
              <div>
                <h3>{{ selectedAudit()?.title }}</h3>
                <p class="subtle">{{ selectedAudit()?.code }} | {{ selectedAudit()?.type }}</p>
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

            <dl class="key-value top-space">
              <dt>Scope</dt>
              <dd>{{ selectedAudit()?.scope || 'No scope provided.' }}</dd>
              <dt>Auditee area</dt>
              <dd>{{ selectedAudit()?.auditeeArea || 'Not set' }}</dd>
              <dt>Scheduled date</dt>
              <dd>{{ selectedAudit()?.scheduledAt ? (selectedAudit()?.scheduledAt | date:'yyyy-MM-dd') : 'Not set' }}</dd>
              <dt>Summary</dt>
              <dd>{{ selectedAudit()?.summary || 'No summary yet.' }}</dd>
            </dl>
          </section>

          <iso-record-work-items [sourceType]="'audit'" [sourceId]="selectedId()" />
        </div>

        <div class="page-columns">
          <section class="card panel-card">
            <div class="section-head">
              <div>
                <h3>Checklist</h3>
                <p class="subtle">Track audit execution separately from the audit planning data.</p>
              </div>
            </div>

            <form [formGroup]="checklistForm" class="form-grid-2 top-space" (ngSubmit)="addChecklistItem()">
              <label class="field"><span>Checklist item</span><input formControlName="title" placeholder="Verify approved supplier list is current"></label>
              <label class="field"><span>Order</span><input formControlName="sortOrder" type="number" min="0"></label>
              <button type="submit" [disabled]="checklistForm.invalid || saving()">Add checklist item</button>
            </form>

            <div class="entity-list top-space">
              <article class="entity-item" *ngFor="let item of selectedAudit()?.checklistItems || []">
                <div class="section-head">
                  <div>
                    <strong>{{ item.title }}</strong>
                    <small>{{ item.notes || 'No notes' }}</small>
                  </div>
                  <button type="button" class="secondary" (click)="toggleChecklistItem(item, !item.isComplete)" [disabled]="saving()">
                    {{ item.isComplete ? 'Mark open' : 'Mark complete' }}
                  </button>
                </div>
              </article>
            </div>
          </section>

          <section class="card panel-card">
            <div class="section-head">
              <div>
                <h3>Findings</h3>
                <p class="subtle">Record audit findings and create CAPA directly from them when needed.</p>
              </div>
            </div>

            <form [formGroup]="findingForm" class="page-stack top-space" (ngSubmit)="addFinding()">
              <label class="field"><span>Finding title</span><input formControlName="title" placeholder="Approved supplier evaluation missing"></label>
              <label class="field"><span>Description</span><textarea rows="3" formControlName="description" placeholder="Describe the observation or nonconformity"></textarea></label>
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
                  <button type="button" class="secondary" [disabled]="!!finding.linkedCapaId || saving()" (click)="createCapaFromFinding(finding)">
                    {{ finding.linkedCapaId ? 'CAPA linked' : 'Create CAPA' }}
                  </button>
                </div>
                <p class="subtle">{{ finding.description }}</p>
              </article>
            </div>
          </section>
        </div>

        <p class="feedback" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>
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
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal((history.state?.notice as string) || '');
  protected readonly error = signal('');

  protected readonly auditForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(40)]],
    title: ['', [Validators.required, Validators.maxLength(160)]],
    type: ['', [Validators.required, Validators.maxLength(80)]],
    scope: [''],
    leadAuditorId: [''],
    auditeeArea: [''],
    scheduledAt: [''],
    summary: [''],
    status: ['PLANNED' as AuditStatus, Validators.required]
  });

  protected readonly checklistForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
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
      list: 'A calmer audit program view with direct access to checklist progress and findings.',
      create: 'Plan the audit in its own page without mixing execution controls into the same screen.',
      detail: 'Run the audit from a focused detail page with checklist, findings, CAPA creation, and follow-up.',
      edit: 'Update audit plan metadata without distracting execution panels.'
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

    this.saving.set(true);
    this.message.set('');
    this.error.set('');
    const payload = this.toAuditPayload();
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
    this.api.post(`audits/${this.selectedId()}/checklist-items`, this.checklistForm.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('Checklist item added.');
        this.checklistForm.reset({ title: '', sortOrder: 0 });
        this.fetchAudit(this.selectedId() as string);
        this.reload();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Checklist item save failed.'));
      }
    });
  }

  protected toggleChecklistItem(item: AuditChecklistItem, isComplete: boolean) {
    this.saving.set(true);
    this.api.patch(`audits/checklist-items/${item.id}`, { isComplete }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('Checklist item updated.');
        this.fetchAudit(this.selectedId() as string);
        this.reload();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Checklist update failed.'));
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
        this.reload();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Finding save failed.'));
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
        this.reload();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'CAPA creation failed.'));
      }
    });
  }

  private handleRoute(params: ParamMap) {
    const id = params.get('id');
    this.selectedId.set(id);
    this.message.set((history.state?.notice as string) || '');
    this.error.set('');

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
      type: '',
      scope: '',
      leadAuditorId: '',
      auditeeArea: '',
      scheduledAt: '',
      summary: '',
      status: 'PLANNED'
    });
    this.checklistForm.reset({ title: '', sortOrder: 0 });
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

  private toAuditPayload() {
    const raw = this.auditForm.getRawValue();
    return {
      ...raw,
      code: raw.code.trim(),
      title: raw.title.trim(),
      type: raw.type.trim(),
      scope: raw.scope.trim() || undefined,
      leadAuditorId: raw.leadAuditorId || undefined,
      auditeeArea: raw.auditeeArea.trim() || undefined,
      scheduledAt: raw.scheduledAt || undefined,
      summary: raw.summary.trim() || undefined
    };
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}
