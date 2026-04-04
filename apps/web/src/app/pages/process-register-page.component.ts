import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import { ApiService } from '../core/api.service';
import { ContentLibraryResponse, ProcessTemplate } from '../core/content-library.models';
import { ContentLibraryService } from '../core/content-library.service';
import { PageHeaderComponent } from '../shared/page-header.component';

type PageMode = 'list' | 'create' | 'detail' | 'edit';
type ProcessStatus = 'ACTIVE' | 'ARCHIVED';
type LinkType = 'DOCUMENT' | 'RISK' | 'AUDIT' | 'KPI' | 'ACTION' | 'NCR' | 'CONTEXT_ISSUE';

type UserSummary = { id: string; firstName: string; lastName: string; email: string };
type ProcessLink = {
  id: string;
  linkType: LinkType;
  linkedId: string;
  note?: string | null;
  createdAt: string;
  path?: string | null;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  missing: boolean;
};
type ProcessRow = {
  id: string;
  referenceNo?: string | null;
  name: string;
  purpose?: string | null;
  ownerUserId?: string | null;
  department?: string | null;
  scope?: string | null;
  inputsText?: string | null;
  outputsText?: string | null;
  status: ProcessStatus;
  createdAt: string;
  updatedAt: string;
  owner?: UserSummary | null;
  linkCount?: number;
  links?: ProcessLink[];
};
type LinkCandidate = { id: string; label: string };
type ReturnNavigation = { route: string[]; label: string };

@Component({
  selector: 'iso-process-register-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent],
  template: `
    <section class="page-grid">
      <iso-page-header [label]="'Process Register'" [title]="pageTitle()" [description]="pageDescription()" [breadcrumbs]="breadcrumbs()">
        <a *ngIf="mode() === 'list' && canWrite()" routerLink="/process-register/new" class="button-link">+ New process</a>
        <a *ngIf="mode() === 'detail' && selectedProcess() && canWrite()" [routerLink]="['/process-register', selectedId(), 'edit']" class="button-link">Edit process</a>
        <button *ngIf="mode() === 'detail' && selectedProcess() && canDelete()" type="button" class="button-link danger" (click)="archiveProcess()">Archive</button>
        <a *ngIf="returnNavigation()" [routerLink]="returnNavigation()!.route" class="button-link tertiary">Back to {{ returnNavigation()!.label }}</a>
        <a *ngIf="mode() !== 'list'" routerLink="/process-register" class="button-link secondary">Back</a>
      </iso-page-header>

      <section *ngIf="mode() === 'list'" class="page-stack">
        <div class="card list-card">
          <div class="toolbar">
            <div class="toolbar-meta">
              <div>
                <p class="toolbar-title">Process filters</p>
                <p class="toolbar-copy">A lightweight process registry linked to existing IMS records.</p>
              </div>
              <div class="toolbar-stats">
                <article class="toolbar-stat"><span>Total</span><strong>{{ processes().length }}</strong></article>
                <article class="toolbar-stat"><span>Active</span><strong>{{ activeCount() }}</strong></article>
                <article class="toolbar-stat"><span>Archived</span><strong>{{ archivedCount() }}</strong></article>
              </div>
            </div>

            <div class="filter-row">
              <label class="field">
                <span>Search</span>
                <input [value]="search()" (input)="search.set(readInputValue($event))" placeholder="Reference, process, department">
              </label>
              <label class="field">
                <span>Status</span>
                <select [value]="statusFilter()" (change)="statusFilter.set(readSelectValue($event))">
                  <option value="">All</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </label>
              <label class="field">
                <span>Owner</span>
                <select [value]="ownerFilter()" (change)="ownerFilter.set(readSelectValue($event))">
                  <option value="">All</option>
                  <option *ngFor="let owner of owners()" [value]="owner.id">{{ personName(owner) }}</option>
                </select>
              </label>
            </div>
          </div>

          <p class="feedback top-space" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <div class="empty-state top-space" *ngIf="loading()"><strong>Loading process register</strong><span>Refreshing process definitions and linked record counts.</span></div>
          <div class="empty-state top-space" *ngIf="!loading() && !filteredProcesses().length"><strong>No processes found</strong><span>Create the first process record to start using this register.</span></div>

          <div class="data-table-wrap top-space" *ngIf="!loading() && filteredProcesses().length">
            <table class="data-table">
              <thead>
                <tr><th>Process</th><th>Owner</th><th>Status</th><th>Links</th><th>Updated</th></tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of filteredProcesses()" [routerLink]="['/process-register', item.id]">
                  <td><div class="table-title"><strong>{{ item.referenceNo || 'Uncoded' }} - {{ item.name }}</strong><small>{{ item.department || 'No department set' }}</small></div></td>
                  <td>{{ item.owner ? personName(item.owner) : 'Unassigned' }}</td>
                  <td><span class="status-badge" [ngClass]="item.status === 'ACTIVE' ? 'success' : 'neutral'">{{ item.status | titlecase }}</span></td>
                  <td>{{ item.linkCount || 0 }}</td>
                  <td>{{ item.updatedAt | date:'yyyy-MM-dd HH:mm' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section *ngIf="mode() === 'create' || mode() === 'edit'" class="page-stack">
        <form class="card form-card page-stack" [formGroup]="form" (ngSubmit)="save()">
          <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>
          <section class="feedback next-steps-banner success" *ngIf="mode() === 'edit' && message() && !error()">
            <strong>{{ message() }}</strong>
            <span>{{ processNextStepsCopy() }}</span>
            <div class="button-row top-space">
              <a *ngIf="selectedId()" [routerLink]="['/process-register', selectedId()]" class="button-link secondary">Review process</a>
              <a routerLink="/process-register" class="button-link tertiary">Review register</a>
            </div>
          </section>

          <section class="detail-section" *ngIf="processTemplates().length">
            <h4>How do you want to start?</h4>
            <div class="entity-list top-space">
              <div class="entity-item">
                <strong>Use a starter template</strong>
                <small>Prefill the process with common inputs, outputs, and purpose. You can edit every field before saving.</small>
              </div>
              <div class="entity-item">
                <strong>Create a custom process</strong>
                <small>Leave the template blank and write the process definition manually if this process is unique to your organization.</small>
              </div>
            </div>

            <h4>Starter process template</h4>
            <div class="form-grid-2 top-space">
              <label class="field">
                <span>Template</span>
                <select [value]="selectedTemplateId()" (change)="selectedTemplateId.set(readSelectValue($event))">
                  <option value="">Start from a blank process</option>
                  <option *ngFor="let template of processTemplates()" [value]="template.id">{{ template.name }}</option>
                </select>
              </label>
              <div class="button-row align-end">
                <button type="button" class="secondary" (click)="clearTemplateSelection()">Start custom</button>
                <button type="button" [disabled]="!selectedTemplate()" (click)="applyTemplate()">Use template</button>
              </div>
            </div>

            <div class="content-guidance top-space" *ngIf="selectedTemplate() as template">
              <div class="section-head compact-head">
                <div>
                  <h4>{{ template.name }}</h4>
                  <p class="subtle">This only pre-fills the form. You can change every field before saving.</p>
                </div>
              </div>
              <div class="section-grid-2 top-space">
                <section class="detail-section"><h4>Purpose</h4><p>{{ template.purpose }}</p></section>
                <section class="detail-section"><h4>Scope</h4><p>{{ template.scope }}</p></section>
                <section class="detail-section"><h4>Inputs</h4><p>{{ template.inputsText }}</p></section>
                <section class="detail-section"><h4>Outputs</h4><p>{{ template.outputsText }}</p></section>
              </div>
            </div>
          </section>

          <section class="detail-section">
            <h4>Core definition</h4>
            <div class="form-grid-2 top-space">
              <label class="field"><span>Reference</span><input formControlName="referenceNo" placeholder="PR-001"></label>
              <label class="field"><span>Status</span><select formControlName="status"><option value="ACTIVE">Active</option><option value="ARCHIVED">Archived</option></select></label>
            </div>
            <label class="field top-space"><span>Process name</span><input formControlName="name" placeholder="Document Control"></label>
            <label class="field top-space"><span>Purpose</span><textarea formControlName="purpose" rows="4"></textarea></label>
          </section>

          <section class="detail-section">
            <h4>Ownership and interfaces</h4>
            <div class="form-grid-2 top-space">
              <label class="field"><span>Owner</span><select formControlName="ownerUserId"><option value="">Unassigned</option><option *ngFor="let owner of owners()" [value]="owner.id">{{ personName(owner) }}</option></select></label>
              <label class="field"><span>Department</span><input formControlName="department" placeholder="Quality"></label>
            </div>
            <label class="field top-space"><span>Scope</span><textarea formControlName="scope" rows="3"></textarea></label>
            <div class="form-grid-2 top-space">
              <label class="field"><span>Inputs</span><textarea formControlName="inputsText" rows="5"></textarea></label>
              <label class="field"><span>Outputs</span><textarea formControlName="outputsText" rows="5"></textarea></label>
            </div>
          </section>

          <div class="button-row">
            <button type="submit" [disabled]="form.invalid || saving() || !canWrite()">{{ saving() ? 'Saving...' : 'Save process' }}</button>
            <a [routerLink]="selectedId() ? ['/process-register', selectedId()] : ['/process-register']" class="button-link secondary">Cancel</a>
          </div>
        </form>

      </section>

      <section *ngIf="mode() === 'detail' && selectedProcess()" class="page-stack">
        <div class="page-stack">
          <section class="card detail-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Process detail</span>
                <h3>{{ selectedProcess()?.referenceNo || 'Uncoded' }} - {{ selectedProcess()?.name }}</h3>
                <p class="subtle">{{ selectedProcess()?.purpose || 'No purpose recorded yet.' }}</p>
              </div>
              <span class="status-badge" [ngClass]="selectedProcess()?.status === 'ACTIVE' ? 'success' : 'neutral'">{{ selectedProcess()?.status | titlecase }}</span>
            </div>

            <div class="summary-strip top-space">
              <article class="summary-item"><span>Owner</span><strong>{{ selectedProcess()?.owner ? personName(selectedProcess()!.owner!) : 'Unassigned' }}</strong></article>
              <article class="summary-item"><span>Department</span><strong>{{ selectedProcess()?.department || 'Not set' }}</strong></article>
              <article class="summary-item"><span>Linked records</span><strong>{{ selectedProcess()?.links?.length || 0 }}</strong></article>
            </div>

            <section class="feedback next-steps-banner success top-space" *ngIf="message() && !error()">
              <strong>{{ message() }}</strong>
              <span>{{ processNextStepsCopy() }}</span>
              <div class="button-row top-space">
                <button *ngIf="canWrite()" type="button" (click)="openSuggestedLinkComposer()">{{ selectedProcess()?.links?.length ? 'Add another link' : 'Link first record' }}</button>
                <a routerLink="/process-register" class="button-link tertiary">Review register</a>
              </div>
            </section>

            <div class="section-grid-2 top-space">
              <section class="detail-section"><h4>Scope</h4><p>{{ selectedProcess()?.scope || 'No scope recorded.' }}</p></section>
              <section class="detail-section"><h4>Inputs</h4><p>{{ selectedProcess()?.inputsText || 'No inputs recorded.' }}</p></section>
              <section class="detail-section"><h4>Outputs</h4><p>{{ selectedProcess()?.outputsText || 'No outputs recorded.' }}</p></section>
              <section class="detail-section"><h4>Reference</h4><p>{{ selectedProcess()?.referenceNo || 'No reference assigned.' }}</p></section>
            </div>
          </section>

          <section class="card detail-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Traceability</span>
                <h3>At a glance</h3>
                <p class="subtle">Use this process as a review hub for the records already linked to it, without changing their original workflows.</p>
              </div>
            </div>

            <div class="summary-strip top-space">
              <article class="summary-item"><span>Risks</span><strong>{{ linkCountByType('RISK') }}</strong></article>
              <article class="summary-item"><span>Audits</span><strong>{{ linkCountByType('AUDIT') }}</strong></article>
              <article class="summary-item"><span>NCRs</span><strong>{{ linkCountByType('NCR') }}</strong></article>
              <article class="summary-item"><span>Actions</span><strong>{{ linkCountByType('ACTION') }}</strong></article>
            </div>

            <div class="button-row top-space">
              <a *ngIf="firstLinkByType('RISK') as firstRisk" [routerLink]="linkRoute(firstRisk)" [queryParams]="linkQueryParams(firstRisk)" [state]="linkState(firstRisk)" class="button-link secondary">Open linked risk</a>
              <a *ngIf="firstLinkByType('AUDIT') as firstAudit" [routerLink]="linkRoute(firstAudit)" [queryParams]="linkQueryParams(firstAudit)" [state]="linkState(firstAudit)" class="button-link secondary">Open linked audit</a>
              <a *ngIf="firstLinkByType('NCR') as firstNcr" [routerLink]="linkRoute(firstNcr)" [queryParams]="linkQueryParams(firstNcr)" [state]="linkState(firstNcr)" class="button-link tertiary">Open linked NCR</a>
              <a *ngIf="firstLinkByType('ACTION') as firstAction" [routerLink]="linkRoute(firstAction)" [queryParams]="linkQueryParams(firstAction)" [state]="linkState(firstAction)" class="button-link tertiary">Open linked action</a>
            </div>
          </section>

          <section class="card detail-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Linked records</span>
                <h3>Process linkage hub</h3>
                <p class="subtle">View and connect existing IMS records without changing their original workflows.</p>
              </div>
            </div>

            <div class="empty-state top-space" *ngIf="!selectedProcess()?.links?.length">
              <strong>No linked records yet</strong>
              <span>Link the risks, audits, documents, NCRs, or actions that belong to this process.</span>
            </div>

            <div class="page-stack top-space">
              <section class="detail-section link-group" *ngFor="let type of visibleLinkTypes">
                <div class="section-head compact-head">
                  <div>
                    <h4>{{ sectionTitle(type) }}</h4>
                    <p class="subtle">{{ sectionDescription(type) }}</p>
                  </div>
                  <button *ngIf="canWrite()" type="button" class="button-link secondary" (click)="openLinkComposer(type)">
                    {{ activeLinkComposerType() === type ? 'Close' : '+ Link' }}
                  </button>
                </div>

                <div class="empty-state compact-empty top-space" *ngIf="!linksByType(type).length">
                  <strong>{{ sectionEmptyTitle(type) }}</strong>
                  <span>{{ sectionEmptyCopy(type) }}</span>
                </div>

                <div class="entity-list top-space" *ngIf="linksByType(type).length">
                  <div class="entity-item" *ngFor="let link of linksByType(type)">
                    <div class="link-row">
                      <div>
                        <strong>{{ link.title }}</strong>
                        <small *ngIf="link.subtitle">{{ link.subtitle }}</small>
                        <small *ngIf="link.note">{{ link.note }}</small>
                      </div>
                      <div class="route-context">
                        <span *ngIf="link.status" class="status-badge neutral">{{ prettyStatus(link.status) }}</span>
                        <a *ngIf="link.path && !link.missing" [routerLink]="linkRoute(link)" [queryParams]="linkQueryParams(link)" [state]="linkState(link)" class="button-link secondary">Open</a>
                        <button *ngIf="canWrite()" type="button" class="button-link tertiary" (click)="removeLink(link.id)">Remove</button>
                      </div>
                    </div>
                  </div>
                </div>

                <form *ngIf="canWrite() && activeLinkComposerType() === type" class="page-stack top-space link-composer" [formGroup]="linkForm" (ngSubmit)="addLink()">
                  <div class="form-grid-2">
                    <label class="field">
                      <span>{{ sectionPickerLabel(type) }}</span>
                      <select formControlName="linkedId">
                        <option value="">Select a record</option>
                        <option *ngFor="let item of linkCandidates()" [value]="item.id">{{ item.label }}</option>
                      </select>
                    </label>
                    <label class="field">
                      <span>Context note</span>
                      <input formControlName="note" placeholder="Optional note about this link">
                    </label>
                  </div>
                  <div class="empty-state compact-empty" *ngIf="linkCandidatesLoading()">
                    <strong>Loading available records</strong>
                    <span>Fetching existing {{ sectionTitle(type).toLowerCase() }} in this tenant.</span>
                  </div>
                  <div class="empty-state compact-empty" *ngIf="!linkCandidatesLoading() && !linkCandidates().length">
                    <strong>No records available</strong>
                    <span>There are no existing {{ sectionTitle(type).toLowerCase() }} to link yet.</span>
                  </div>
                  <div class="button-row">
                    <button type="submit" [disabled]="linkForm.invalid || linkSaving() || !linkCandidates().length">{{ linkSaving() ? 'Linking...' : 'Add link' }}</button>
                    <button type="button" class="button-link secondary" (click)="closeLinkComposer()">Cancel</button>
                  </div>
                </form>
              </section>
            </div>
          </section>
        </div>

      </section>
    </section>
  `,
  styles: [`
    .link-row { display: flex; justify-content: space-between; align-items: start; gap: 1rem; }
    tr[routerLink] { cursor: pointer; }
    .link-group { border: 1px solid var(--border-subtle); border-radius: 1.25rem; padding: 1.25rem; background: color-mix(in srgb, var(--surface-strong) 84%, white); }
    .compact-head { align-items: center; }
    .compact-empty { min-height: 0; padding: 1rem 1.1rem; }
    .link-composer { border-top: 1px solid var(--border-subtle); padding-top: 1rem; }
    .align-end { align-items: end; justify-content: flex-start; }
    .content-guidance {
      border: 1px solid var(--border-subtle);
      border-radius: 1rem;
      padding: 1rem;
      background: color-mix(in srgb, var(--surface-strong) 92%, white);
    }
    .next-steps-banner {
      display: grid;
      gap: 0.35rem;
      padding: 1rem 1.1rem;
      border-radius: 1rem;
      border: 1px solid rgba(47, 107, 69, 0.16);
      background: rgba(47, 107, 69, 0.08);
    }
  `]
})
export class ProcessRegisterPageComponent implements OnInit, OnChanges {
  @Input() forcedMode: PageMode | null = null;

  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly contentLibrary = inject(ContentLibraryService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
  protected readonly processes = signal<ProcessRow[]>([]);
  protected readonly owners = signal<UserSummary[]>([]);
  protected readonly selectedProcess = signal<ProcessRow | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly linkSaving = signal(false);
  protected readonly linkCandidatesLoading = signal(false);
  protected readonly message = signal((history.state?.notice as string) || '');
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly statusFilter = signal('');
  protected readonly ownerFilter = signal('');
  protected readonly library = signal<ContentLibraryResponse | null>(null);
  protected readonly linkCandidates = signal<LinkCandidate[]>([]);
  protected readonly activeLinkComposerType = signal<LinkType | null>(null);
  protected readonly selectedTemplateId = signal('');
  protected readonly returnNavigation = signal<ReturnNavigation | null>(null);
  protected readonly linkTypes: LinkType[] = ['DOCUMENT', 'RISK', 'AUDIT', 'KPI', 'ACTION', 'NCR', 'CONTEXT_ISSUE'];
  protected readonly visibleLinkTypes: LinkType[] = ['RISK', 'AUDIT', 'DOCUMENT', 'NCR', 'ACTION', 'CONTEXT_ISSUE'];

  protected readonly form = this.fb.nonNullable.group({
    referenceNo: ['', [Validators.maxLength(40)]],
    name: ['', [Validators.required, Validators.maxLength(160)]],
    purpose: ['', [Validators.maxLength(1000)]],
    ownerUserId: [''],
    department: ['', [Validators.maxLength(120)]],
    scope: ['', [Validators.maxLength(1000)]],
    inputsText: ['', [Validators.maxLength(2000)]],
    outputsText: ['', [Validators.maxLength(2000)]],
    status: ['ACTIVE' as ProcessStatus]
  });

  protected readonly linkForm = this.fb.nonNullable.group({
    linkType: ['DOCUMENT' as LinkType, [Validators.required]],
    linkedId: ['', [Validators.required]],
    note: ['', [Validators.maxLength(500)]]
  });

  ngOnInit() {
    this.loadOwners();
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

  protected canWrite() { return this.authStore.hasPermission('processes.write'); }
  protected canDelete() { return this.authStore.hasPermission('admin.delete'); }
  protected personName(user: UserSummary) { return `${user.firstName} ${user.lastName}`.trim(); }
  protected readInputValue(event: Event) { return (event.target as HTMLInputElement).value; }
  protected readSelectValue(event: Event) { return (event.target as HTMLSelectElement).value; }
  protected prettyStatus(value?: string | null) { return value ? value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : ''; }
  protected linkTypeLabel(type: LinkType) { return { DOCUMENT: 'Document', RISK: 'Risk', AUDIT: 'Audit', KPI: 'KPI', ACTION: 'Action', NCR: 'NCR', CONTEXT_ISSUE: 'Context issue' }[type]; }
  protected sectionTitle(type: LinkType) { return { DOCUMENT: 'Linked Documents', RISK: 'Linked Risks', AUDIT: 'Linked Audits', KPI: 'Linked KPIs', ACTION: 'Linked Actions', NCR: 'Linked NCR / Issues', CONTEXT_ISSUE: 'Linked Context Issues' }[type]; }
  protected sectionDescription(type: LinkType) {
    return {
      DOCUMENT: 'Controlled documents that define or support this process.',
      RISK: 'Risk records currently associated with this process.',
      AUDIT: 'Audits that evaluate how this process is working.',
      KPI: 'Performance indicators used to monitor this process.',
      ACTION: 'Actions that are already being tracked elsewhere in the IMS.',
      NCR: 'Nonconformances or issues raised against this process.',
      CONTEXT_ISSUE: 'Internal or external issues from Clause 4 that influence this process.'
    }[type];
  }
  protected sectionEmptyTitle(type: LinkType) {
    return {
      DOCUMENT: 'No documents linked',
      RISK: 'No risks linked',
      AUDIT: 'No audits linked',
      KPI: 'No KPIs linked',
      ACTION: 'No actions linked',
      NCR: 'No NCRs linked',
      CONTEXT_ISSUE: 'No context issues linked'
    }[type];
  }
  protected sectionEmptyCopy(type: LinkType) {
    return {
      DOCUMENT: 'Link existing controlled documents to keep process context visible here.',
      RISK: 'Link existing risks to show where this process is exposed.',
      AUDIT: 'Link relevant audits so assurance activity is visible in one place.',
      KPI: 'Link KPIs if you want to monitor this process from the register.',
      ACTION: 'Link actions already tracked in the global action register.',
      NCR: 'Link related nonconformances or issues for process-level visibility.',
      CONTEXT_ISSUE: 'Link internal or external issues so process context is visible here.'
    }[type];
  }
  protected sectionPickerLabel(type: LinkType) {
    return {
      DOCUMENT: 'Document',
      RISK: 'Risk',
      AUDIT: 'Audit',
      KPI: 'KPI',
      ACTION: 'Action',
      NCR: 'NCR / Issue',
      CONTEXT_ISSUE: 'Context issue'
    }[type];
  }
  protected processNextStepsCopy() {
    const process = this.selectedProcess();
    if (!process) {
      return 'Next: review the saved process and start linking the existing IMS records that belong to it.';
    }
    if (process.links?.length) {
      return 'Next: review the linked records and add any missing risks, audits, documents, NCRs, actions, or context issues.';
    }
    return 'Next: link the first related record so this process becomes a useful hub instead of a standalone definition.';
  }
  protected processTemplates() {
    return this.library()?.processRegister.templates ?? [];
  }
  protected selectedTemplate() {
    return this.processTemplates().find((template) => template.id === this.selectedTemplateId()) ?? null;
  }
  protected activeCount() { return this.processes().filter((item) => item.status === 'ACTIVE').length; }
  protected archivedCount() { return this.processes().filter((item) => item.status === 'ARCHIVED').length; }
  protected linksByType(type: LinkType) {
    return (this.selectedProcess()?.links || []).filter((link) => link.linkType === type);
  }
  protected linkCountByType(type: LinkType) {
    return this.linksByType(type).length;
  }
  protected firstLinkByType(type: LinkType) {
    return this.linksByType(type).find((link) => !!link.path && !link.missing) ?? null;
  }
  protected linkRoute(link: ProcessLink) {
    return link.path || '/process-register';
  }
  protected linkQueryParams(link: ProcessLink) {
    return link.linkType === 'ACTION' ? { focusActionId: link.linkedId } : undefined;
  }
  protected linkState(link: ProcessLink) {
    return link.linkType === 'ACTION' && this.returnNavigation()
      ? { returnNavigation: this.returnNavigation() }
      : undefined;
  }

  protected pageTitle() {
    return { list: 'Process register', create: 'Create process', detail: this.selectedProcess()?.name || 'Process detail', edit: this.selectedProcess()?.name || 'Edit process' }[this.mode()];
  }

  protected pageDescription() {
    return {
      list: 'A lightweight registry for business processes and their linked IMS records.',
      create: 'Create a process definition without changing the existing compliance modules.',
      detail: 'Review ownership, interfaces, and linked records for this process.',
      edit: 'Update the process definition while keeping linked records in their original modules.'
    }[this.mode()];
  }

  protected breadcrumbs() {
    if (this.mode() === 'list') return [{ label: 'Process Register' }];
    const base = [{ label: 'Process Register', link: '/process-register' }];
    if (this.mode() === 'create') return [...base, { label: 'New process' }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedProcess()?.name || 'Process', link: `/process-register/${this.selectedId()}` }, { label: 'Edit' }];
    return [...base, { label: this.selectedProcess()?.name || 'Process' }];
  }

  protected filteredProcesses() {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const ownerId = this.ownerFilter();
    return this.processes().filter((item) => {
      const matchesTerm = !term || (item.referenceNo || '').toLowerCase().includes(term) || item.name.toLowerCase().includes(term) || (item.department || '').toLowerCase().includes(term);
      const matchesStatus = !status || item.status === status;
      const matchesOwner = !ownerId || item.ownerUserId === ownerId;
      return matchesTerm && matchesStatus && matchesOwner;
    });
  }

  protected save() {
    if (!this.canWrite()) return this.error.set('You do not have permission to edit the process register.');
    if (this.form.invalid) return this.error.set('Complete the required process fields.');
    this.saving.set(true);
    this.error.set('');
    const request = this.selectedId()
      ? this.api.patch<ProcessRow>(`process-register/${this.selectedId()}`, this.form.getRawValue())
      : this.api.post<ProcessRow>('process-register', this.form.getRawValue());
    request.subscribe({
      next: (process) => {
        this.saving.set(false);
        this.router.navigate(['/process-register', process.id], { state: { notice: 'Process saved successfully.' } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Process save failed.'));
      }
    });
  }

  protected archiveProcess() {
    if (!this.selectedProcess() || !this.canDelete() || !window.confirm(`Archive process "${this.selectedProcess()?.name}"?`)) return;
    this.api.delete<{ success: boolean }>(`process-register/${this.selectedId()}`).subscribe({
      next: () => this.router.navigate(['/process-register'], { state: { notice: 'Process archived successfully.' } }),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'Process archive failed.'))
    });
  }

  protected addLink() {
    if (!this.selectedId() || !this.canWrite() || this.linkForm.invalid) return;
    this.linkSaving.set(true);
    this.api.post<ProcessLink>(`process-register/${this.selectedId()}/links`, this.linkForm.getRawValue()).subscribe({
      next: () => {
        this.linkSaving.set(false);
        this.linkForm.patchValue({ linkedId: '', note: '' });
        this.activeLinkComposerType.set(null);
        this.fetchProcess(this.selectedId()!);
        this.message.set('Linked record added.');
      },
      error: (error: HttpErrorResponse) => {
        this.linkSaving.set(false);
        this.error.set(this.readError(error, 'Record link failed.'));
      }
    });
  }

  protected removeLink(linkId: string) {
    if (!this.selectedId() || !this.canWrite()) return;
    this.api.delete<{ success: boolean }>(`process-register/${this.selectedId()}/links/${linkId}`).subscribe({
      next: () => {
        this.fetchProcess(this.selectedId()!);
        this.message.set('Linked record removed.');
      },
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'Link removal failed.'))
    });
  }

  protected onLinkTypeChange() {
    this.linkForm.patchValue({ linkedId: '' });
    this.loadLinkCandidates(this.linkForm.getRawValue().linkType);
  }

  protected openLinkComposer(type: LinkType) {
    if (this.activeLinkComposerType() === type) {
      this.closeLinkComposer();
      return;
    }
    this.activeLinkComposerType.set(type);
    this.linkForm.reset({ linkType: type, linkedId: '', note: '' });
    this.loadLinkCandidates(type);
  }

  protected closeLinkComposer() {
    this.activeLinkComposerType.set(null);
    this.linkForm.reset({ linkType: 'DOCUMENT', linkedId: '', note: '' });
    this.linkCandidates.set([]);
  }
  protected applyTemplate() {
    const template = this.selectedTemplate();
    if (!template) {
      return;
    }
    this.form.patchValue({
      referenceNo: this.form.getRawValue().referenceNo || template.referenceNo,
      name: template.name,
      purpose: template.purpose,
      department: template.department,
      scope: template.scope,
      inputsText: template.inputsText,
      outputsText: template.outputsText
    });
  }
  protected clearTemplateSelection() {
    this.selectedTemplateId.set('');
  }
  protected openSuggestedLinkComposer() {
    const preferredType = this.linksByType('RISK').length ? 'DOCUMENT' : 'RISK';
    this.openLinkComposer(preferredType);
  }

  private handleRoute(params: ParamMap) {
    const id = params.get('id');
    this.selectedId.set(id);
    this.message.set((history.state?.notice as string) || '');
    this.error.set('');
    this.returnNavigation.set((history.state?.returnNavigation as ReturnNavigation | undefined) ?? null);
    if (this.mode() === 'list') {
      this.selectedProcess.set(null);
      this.resetForms();
      return this.reloadProcesses();
    }
    if (this.mode() === 'create') {
      this.selectedProcess.set(null);
      return this.resetForms();
    }
    if (id) this.fetchProcess(id);
  }

  private resetForms() {
    this.form.reset({ referenceNo: '', name: '', purpose: '', ownerUserId: '', department: '', scope: '', inputsText: '', outputsText: '', status: 'ACTIVE' });
    this.linkForm.reset({ linkType: 'DOCUMENT', linkedId: '', note: '' });
    this.linkCandidates.set([]);
    this.activeLinkComposerType.set(null);
    this.selectedTemplateId.set('');
  }

  private reloadProcesses() {
    this.loading.set(true);
    this.api.get<ProcessRow[]>('process-register').subscribe({
      next: (items) => { this.loading.set(false); this.processes.set(items); },
      error: (error: HttpErrorResponse) => { this.loading.set(false); this.error.set(this.readError(error, 'Process register could not be loaded.')); }
    });
  }

  private fetchProcess(id: string) {
    this.loading.set(true);
    this.api.get<ProcessRow>(`process-register/${id}`).subscribe({
      next: (process) => {
        this.loading.set(false);
        this.selectedProcess.set(process);
        this.form.reset({
          referenceNo: process.referenceNo || '',
          name: process.name,
          purpose: process.purpose || '',
          ownerUserId: process.ownerUserId || '',
          department: process.department || '',
          scope: process.scope || '',
          inputsText: process.inputsText || '',
          outputsText: process.outputsText || '',
          status: process.status
        });
        this.loadLinkCandidates(this.linkForm.getRawValue().linkType);
      },
      error: (error: HttpErrorResponse) => { this.loading.set(false); this.error.set(this.readError(error, 'Process details could not be loaded.')); }
    });
  }

  private loadOwners() {
    this.api.get<UserSummary[]>('users').subscribe({
      next: (users) => this.owners.set(users),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'Process owners could not be loaded.'))
    });
  }

  private loadLinkCandidates(type: LinkType) {
    if (this.mode() !== 'detail') return;
    this.linkCandidatesLoading.set(true);
    const path = { DOCUMENT: 'documents', RISK: 'risks', AUDIT: 'audits', KPI: 'kpis', ACTION: 'action-items', NCR: 'ncr', CONTEXT_ISSUE: 'context/issues' }[type];
    this.api.get<any[]>(path).subscribe({
      next: (items) => {
        this.linkCandidatesLoading.set(false);
        this.linkCandidates.set(items.map((item) => ({ id: item.id, label: this.toCandidateLabel(type, item) })));
      },
      error: () => {
        this.linkCandidatesLoading.set(false);
        this.linkCandidates.set([]);
      }
    });
  }

  private loadContentLibrary() {
    this.contentLibrary.getLibrary().subscribe({
      next: (library) => this.library.set(library),
      error: () => this.library.set(null)
    });
  }

  private toCandidateLabel(type: LinkType, item: any) {
    switch (type) {
      case 'DOCUMENT': return `${item.code} - ${item.title}`;
      case 'RISK': return item.title;
      case 'AUDIT': return `${item.code} - ${item.title}`;
      case 'KPI': return item.name;
      case 'ACTION': return item.title;
      case 'NCR': return `${item.referenceNo} - ${item.title}`;
      case 'CONTEXT_ISSUE': return `${item.type === 'INTERNAL' ? 'Internal' : 'External'} - ${item.title}`;
    }
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}

@Component({ standalone: true, imports: [ProcessRegisterPageComponent], template: `<iso-process-register-page [forcedMode]="'list'" />` })
export class ProcessRegisterListPageComponent {}

@Component({ standalone: true, imports: [ProcessRegisterPageComponent], template: `<iso-process-register-page [forcedMode]="'create'" />` })
export class ProcessRegisterCreatePageComponent {}

@Component({ standalone: true, imports: [ProcessRegisterPageComponent], template: `<iso-process-register-page [forcedMode]="'detail'" />` })
export class ProcessRegisterDetailPageComponent {}

@Component({ standalone: true, imports: [ProcessRegisterPageComponent], template: `<iso-process-register-page [forcedMode]="'edit'" />` })
export class ProcessRegisterEditPageComponent {}
