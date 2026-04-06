import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
import { PageHeaderComponent } from '../shared/page-header.component';
import { RecordWorkItemsComponent } from '../shared/record-work-items.component';

type PageMode = 'list' | 'create' | 'detail' | 'edit';
type ChangeType = 'PROCESS' | 'PRODUCT' | 'EQUIPMENT' | 'MATERIAL' | 'ORGANIZATIONAL' | 'DOCUMENTATION' | 'FACILITY' | 'OTHER';
type ChangeStatus = 'PROPOSED' | 'REVIEWING' | 'APPROVED' | 'IMPLEMENTING' | 'VERIFIED' | 'CLOSED' | 'REJECTED';
type LinkType = 'PROCESS' | 'RISK' | 'ACTION' | 'DOCUMENT' | 'OBLIGATION' | 'PROVIDER';
type UserSummary = { id: string; firstName: string; lastName: string; email: string };
type LinkCandidate = { id: string; label: string };
type ReturnNavigation = { route: string[]; label: string };

type ChangeLink = {
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

type ChangeRow = {
  id: string;
  referenceNo?: string | null;
  title: string;
  changeType: ChangeType;
  reason: string;
  affectedArea: string;
  proposedChange: string;
  impactSummary?: string | null;
  controlSummary?: string | null;
  ownerUserId?: string | null;
  targetImplementationDate?: string | null;
  reviewDate?: string | null;
  status: ChangeStatus;
  createdAt: string;
  updatedAt: string;
  owner?: UserSummary | null;
  linkCount?: number;
  links?: ChangeLink[];
};

@Component({
  selector: 'iso-change-management-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, RecordWorkItemsComponent],
  templateUrl: './change-management-page.component.html',
  styleUrl: './change-management-page.component.css'
})
export class ChangeManagementPageComponent implements OnInit, OnChanges {
  @Input() forcedMode?: PageMode;

  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
  protected readonly records = signal<ChangeRow[]>([]);
  protected readonly owners = signal<UserSummary[]>([]);
  protected readonly selectedRecord = signal<ChangeRow | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly linkSaving = signal(false);
  protected readonly message = signal((history.state?.notice as string) || '');
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly statusFilter = signal('');
  protected readonly ownerFilter = signal('');
  protected readonly linkCandidates = signal<LinkCandidate[]>([]);
  protected readonly activeLinkComposerType = signal<LinkType | null>(null);
  protected readonly visibleLinkTypes: LinkType[] = ['PROCESS', 'RISK', 'ACTION', 'DOCUMENT', 'OBLIGATION', 'PROVIDER'];

  protected readonly form = this.fb.nonNullable.group({
    referenceNo: ['', [Validators.maxLength(40)]],
    title: ['', [Validators.required, Validators.maxLength(180)]],
    changeType: ['PROCESS' as ChangeType, [Validators.required]],
    reason: ['', [Validators.required, Validators.maxLength(2000)]],
    affectedArea: ['', [Validators.required, Validators.maxLength(180)]],
    proposedChange: ['', [Validators.required, Validators.maxLength(2000)]],
    impactSummary: ['', [Validators.maxLength(2000)]],
    controlSummary: ['', [Validators.maxLength(2000)]],
    ownerUserId: [''],
    targetImplementationDate: [''],
    reviewDate: [''],
    status: ['PROPOSED' as ChangeStatus, [Validators.required]]
  });

  protected readonly linkForm = this.fb.nonNullable.group({
    linkType: ['PROCESS' as LinkType, [Validators.required]],
    linkedId: ['', [Validators.required]],
    note: ['', [Validators.maxLength(500)]]
  });

  ngOnInit() {
    this.loadOwners();
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

  protected canWrite() { return this.authStore.hasPermission('change.write'); }
  protected canDelete() { return this.authStore.hasPermission('admin.delete'); }
  protected personName(user?: UserSummary | null) { return user ? `${user.firstName} ${user.lastName}`.trim() : ''; }
  protected readInputValue(event: Event) { return (event.target as HTMLInputElement).value; }
  protected readSelectValue(event: Event) { return (event.target as HTMLSelectElement).value; }
  protected prettyStatus(value?: string | null) { return value ? value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (part) => part.toUpperCase()) : ''; }
  protected statusClass(value: ChangeStatus) { return value === 'CLOSED' || value === 'VERIFIED' ? 'success' : value === 'APPROVED' || value === 'IMPLEMENTING' ? 'warn' : value === 'REJECTED' ? 'danger' : 'neutral'; }
  protected proposedCount() { return this.records().filter((item) => item.status === 'PROPOSED' || item.status === 'REVIEWING').length; }
  protected liveCount() { return this.records().filter((item) => item.status === 'APPROVED' || item.status === 'IMPLEMENTING').length; }
  protected verifiedCount() { return this.records().filter((item) => item.status === 'VERIFIED' || item.status === 'CLOSED').length; }

  protected filteredRecords() {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const ownerId = this.ownerFilter();
    return this.records().filter((item) => {
      const matchesTerm = !term || (item.referenceNo || '').toLowerCase().includes(term) || item.title.toLowerCase().includes(term) || item.affectedArea.toLowerCase().includes(term) || item.proposedChange.toLowerCase().includes(term);
      const matchesStatus = !status || item.status === status;
      const matchesOwner = !ownerId || item.ownerUserId === ownerId;
      return matchesTerm && matchesStatus && matchesOwner;
    });
  }

  protected pageTitle() { return { list: 'Change management', create: 'Create change request', detail: this.selectedRecord()?.title || 'Change request detail', edit: this.selectedRecord()?.title || 'Edit change request' }[this.mode()]; }
  protected pageDescription() { return { list: 'Keep planned changes visible, reviewed, and linked to the existing process, risk, document, and supplier controls.', create: 'Record what is changing, why it matters, who owns the review, and what existing controls should stay connected.', detail: 'Review the change position, implementation target, review ownership, and linked IMS records.', edit: 'Update the change request while keeping risks, processes, documents, and actions in their original modules.' }[this.mode()]; }
  protected breadcrumbs() {
    if (this.mode() === 'list') return [{ label: 'Change Management' }];
    const base = [{ label: 'Change Management', link: '/change-management' }];
    if (this.mode() === 'create') return [...base, { label: 'New change request' }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedRecord()?.title || 'Change request', link: `/change-management/${this.selectedId()}` }, { label: 'Edit' }];
    return [...base, { label: this.selectedRecord()?.title || 'Change request' }];
  }

  protected changeGuidance() {
    const raw = this.form.getRawValue();
    if (raw.title && raw.reason && raw.proposedChange && raw.ownerUserId) {
      return 'This change request already shows what is changing, why it is needed, and who owns the review before implementation.';
    }
    return 'Record the planned change, why it is needed, which area is affected, and who is responsible for controlled review and implementation.';
  }

  protected reviewNarrative() {
    const record = this.selectedRecord();
    if (!record) return 'Save the change request first, then link the existing process, risk, action, document, obligation, or provider records that already carry the live control evidence.';
    if (!record.links?.length) return 'This change is recorded, but the supporting process, risk, document, and provider context is not yet visible through linked records.';
    if (!this.linkCountByType('PROCESS') || !this.linkCountByType('RISK')) return 'This change has some traceability, but it will be much easier to review once the owning process and the related risk are both linked.';
    if (!this.linkCountByType('DOCUMENT')) return 'The change has operational traceability, but it still needs the supporting document or procedure link if controlled instructions are affected.';
    return 'This change request already shows where it is controlled, what could be affected, and which follow-up records support implementation.';
  }

  protected stageNarrative() {
    const record = this.selectedRecord();
    if (!record) return 'Changes usually move from proposal, through review and approval, into implementation, then verification and closure.';
    if (record.status === 'PROPOSED') return 'This change is still being defined. Confirm the reason, the affected area, and the expected impact before moving it into review.';
    if (record.status === 'REVIEWING') return 'This change is under formal review. Use the linked records to confirm process ownership, risk impact, and any required document updates.';
    if (record.status === 'APPROVED') return 'This change has been approved. The next step is controlled implementation with any required actions or document updates visible.';
    if (record.status === 'IMPLEMENTING') return 'This change is being implemented. Keep follow-up actions and evidence visible until the result is verified.';
    if (record.status === 'VERIFIED') return 'Implementation is complete and the result has been checked. Close the request once no further follow-up is needed.';
    if (record.status === 'CLOSED') return 'This change is closed and now acts as a reviewable change-history record.';
    return 'This change was rejected and remains as a recorded review decision.';
  }
  protected nextStepHeadline() {
    const record = this.selectedRecord();
    if (!record) return 'Next steps appear after the change request is saved.';
    if (record.status === 'PROPOSED') return 'Start the formal review before implementation.';
    if (record.status === 'REVIEWING' && (!this.linkCountByType('PROCESS') || !this.linkCountByType('RISK') || !this.linkCountByType('DOCUMENT'))) {
      return 'Complete the review context before approval.';
    }
    if (!this.linkCountByType('ACTION') && (record.status === 'APPROVED' || record.status === 'IMPLEMENTING')) {
      return 'Prepare an implementation follow-up action next.';
    }
    if (record.status === 'VERIFIED' || record.status === 'CLOSED') return 'Review final actions and traceability before treating the change as complete.';
    return 'This change request is connected to the main controls that support implementation.';
  }
  protected nextStepNarrative() {
    const record = this.selectedRecord();
    if (!record) return 'Save the change request first, then decide whether the immediate next step is review, traceability completion, or implementation follow-up.';
    if (record.status === 'PROPOSED') {
      return 'Keep the change in proposal until the reason, impact, owner, and affected area are clear enough for formal review.';
    }
    if (record.status === 'REVIEWING' && (!this.linkCountByType('PROCESS') || !this.linkCountByType('RISK') || !this.linkCountByType('DOCUMENT'))) {
      return 'During review, link the owning process, related risk, and affected controlled document so approval decisions are based on the full change picture.';
    }
    if (!this.linkCountByType('ACTION') && (record.status === 'APPROVED' || record.status === 'IMPLEMENTING')) {
      return 'The change is ready for execution control. Prepare a follow-up action so implementation ownership and due dates stay visible in the Actions tracker.';
    }
    if (record.status === 'VERIFIED' || record.status === 'CLOSED') {
      return 'The change result has been verified. Use linked actions and traceability to confirm nothing is still open before final closure.';
    }
    return 'The change request already shows why the change exists, where it applies, and which linked records support review and implementation.';
  }
  protected changeDraftTitle() {
    const record = this.selectedRecord();
    if (!record) return null;
    return `Change follow-up: ${record.title}`;
  }
  protected changeDraftDescription() {
    const record = this.selectedRecord();
    if (!record) return null;
    return record.controlSummary?.trim() || record.impactSummary?.trim() || record.proposedChange || null;
  }
  protected changeReturnNavigation(): ReturnNavigation | null {
    const id = this.selectedId();
    return id ? { route: ['/change-management', id], label: 'change request' } : null;
  }

  protected sectionTitle(type: LinkType) { return { PROCESS: 'Linked Processes', RISK: 'Linked Risks', ACTION: 'Linked Actions', DOCUMENT: 'Linked Documents', OBLIGATION: 'Linked Obligations', PROVIDER: 'Linked Providers' }[type]; }
  protected sectionDescription(type: LinkType) { return { PROCESS: 'Processes that own or are affected by this planned change.', RISK: 'Risks used to assess what could go wrong or what needs treatment before implementation.', ACTION: 'Follow-up actions already tracked in the global action register.', DOCUMENT: 'Controlled procedures, instructions, or records that need review as part of the change.', OBLIGATION: 'Customer, legal, or compliance obligations that the change could affect.', PROVIDER: 'External providers involved in or impacted by the planned change.' }[type]; }
  protected sectionEmptyCopy(type: LinkType) { return { PROCESS: 'Link the process that owns the change or will feel its effect first.', RISK: 'Link the risk that formally assesses the exposure created by this change.', ACTION: 'Link actions already being tracked for planning, implementation, or verification.', DOCUMENT: 'Link any controlled document that must be updated, reviewed, or checked because of the change.', OBLIGATION: 'Link obligations if the change could affect customer, legal, or regulatory requirements.', PROVIDER: 'Link providers when the change depends on or impacts an external supplier or service.' }[type]; }
  protected sectionPickerLabel(type: LinkType) { return { PROCESS: 'Process', RISK: 'Risk', ACTION: 'Action', DOCUMENT: 'Document', OBLIGATION: 'Obligation', PROVIDER: 'Provider' }[type]; }
  protected linksByType(type: LinkType) { return (this.selectedRecord()?.links || []).filter((link) => link.linkType === type); }
  protected linkCountByType(type: LinkType) { return this.linksByType(type).length; }
  protected linkRoute(link: ChangeLink) { return link.path || '/change-management'; }
  protected linkQueryParams(link: ChangeLink) { return link.linkType === 'ACTION' ? { focusActionId: link.linkedId } : undefined; }
  protected linkState(link: ChangeLink) { return link.linkType === 'ACTION' ? { returnNavigation: { route: ['/change-management', this.selectedId()], label: 'change request' } } : undefined; }

  protected save() {
    if (!this.canWrite()) return this.error.set('You do not have permission to edit change requests.');
    if (this.form.invalid) return this.error.set('Complete the required change-management fields.');
    this.saving.set(true);
    this.error.set('');
    const request = this.selectedId() ? this.api.patch<ChangeRow>(`change-management/${this.selectedId()}`, this.form.getRawValue()) : this.api.post<ChangeRow>('change-management', this.form.getRawValue());
    request.subscribe({
      next: (record) => {
        this.saving.set(false);
        this.router.navigate(['/change-management', record.id], { state: { notice: 'Change request saved successfully.' } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Change request save failed.'));
      }
    });
  }

  protected archiveRecord() {
    if (!this.selectedRecord() || !this.canDelete() || !window.confirm(`Archive change request "${this.selectedRecord()?.title}"?`)) return;
    this.api.delete<{ success: boolean }>(`change-management/${this.selectedId()}`).subscribe({
      next: () => this.router.navigate(['/change-management'], { state: { notice: 'Change request archived successfully.' } }),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'Change request archive failed.'))
    });
  }

  protected openLinkComposer(type: LinkType) {
    if (this.activeLinkComposerType() === type) return this.closeLinkComposer();
    this.activeLinkComposerType.set(type);
    this.linkForm.reset({ linkType: type, linkedId: '', note: '' });
    this.loadLinkCandidates(type);
  }

  protected closeLinkComposer() {
    this.activeLinkComposerType.set(null);
    this.linkForm.reset({ linkType: 'PROCESS', linkedId: '', note: '' });
    this.linkCandidates.set([]);
  }

  protected addLink() {
    if (!this.selectedId() || !this.canWrite() || this.linkForm.invalid) return;
    this.linkSaving.set(true);
    this.api.post<ChangeLink>(`change-management/${this.selectedId()}/links`, this.linkForm.getRawValue()).subscribe({
      next: () => {
        this.linkSaving.set(false);
        this.linkForm.patchValue({ linkedId: '', note: '' });
        this.activeLinkComposerType.set(null);
        this.fetchRecord(this.selectedId()!);
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
    this.api.delete<{ success: boolean }>(`change-management/${this.selectedId()}/links/${linkId}`).subscribe({
      next: () => {
        this.fetchRecord(this.selectedId()!);
        this.message.set('Linked record removed.');
      },
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'Link removal failed.'))
    });
  }

  private handleRoute(params: ParamMap) {
    const id = params.get('id');
    this.selectedId.set(id);
    this.message.set((history.state?.notice as string) || '');
    this.error.set('');
    if (this.mode() === 'list') {
      this.selectedRecord.set(null);
      this.resetForms();
      return this.reloadRecords();
    }
    if (this.mode() === 'create') {
      this.selectedRecord.set(null);
      return this.resetForms();
    }
    if (id) this.fetchRecord(id);
  }

  private resetForms() {
    this.form.reset({ referenceNo: '', title: '', changeType: 'PROCESS', reason: '', affectedArea: '', proposedChange: '', impactSummary: '', controlSummary: '', ownerUserId: '', targetImplementationDate: '', reviewDate: '', status: 'PROPOSED' });
    this.closeLinkComposer();
  }

  private reloadRecords() {
    this.loading.set(true);
    this.api.get<ChangeRow[]>('change-management').subscribe({
      next: (items) => {
        this.loading.set(false);
        this.records.set(items);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Change requests could not be loaded.'));
      }
    });
  }

  private fetchRecord(id: string) {
    this.loading.set(true);
    this.api.get<ChangeRow>(`change-management/${id}`).subscribe({
      next: (record) => {
        this.loading.set(false);
        this.selectedRecord.set(record);
        this.form.reset({
          referenceNo: record.referenceNo || '',
          title: record.title,
          changeType: record.changeType,
          reason: record.reason,
          affectedArea: record.affectedArea,
          proposedChange: record.proposedChange,
          impactSummary: record.impactSummary || '',
          controlSummary: record.controlSummary || '',
          ownerUserId: record.ownerUserId || '',
          targetImplementationDate: record.targetImplementationDate ? record.targetImplementationDate.slice(0, 10) : '',
          reviewDate: record.reviewDate ? record.reviewDate.slice(0, 10) : '',
          status: record.status
        });
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Change request details could not be loaded.'));
      }
    });
  }

  private loadOwners() {
    this.api.get<UserSummary[]>('users').subscribe({
      next: (users) => this.owners.set(users),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'Change request owners could not be loaded.'))
    });
  }

  private loadLinkCandidates(type: LinkType) {
    const path = { PROCESS: 'process-register', RISK: 'risks', ACTION: 'action-items', DOCUMENT: 'documents', OBLIGATION: 'compliance-obligations', PROVIDER: 'external-providers' }[type];
    this.api.get<any[]>(path).subscribe({
      next: (items) => this.linkCandidates.set(items.map((item) => ({ id: item.id, label: this.toCandidateLabel(type, item) }))),
      error: () => this.linkCandidates.set([])
    });
  }

  private toCandidateLabel(type: LinkType, item: any) {
    if (type === 'PROCESS') return `${item.referenceNo || 'Uncoded'} - ${item.name}`;
    if (type === 'RISK') return item.title;
    if (type === 'DOCUMENT') return `${item.code || 'Uncoded'} - ${item.title}`;
    if (type === 'OBLIGATION') return `${item.referenceNo || 'Uncoded'} - ${item.title}`;
    if (type === 'PROVIDER') return `${item.referenceNo || 'Uncoded'} - ${item.providerName}`;
    return item.title;
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}

@Component({ standalone: true, imports: [ChangeManagementPageComponent], template: `<iso-change-management-page [forcedMode]="'list'" />` })
export class ChangeManagementListPageComponent {}

@Component({ standalone: true, imports: [ChangeManagementPageComponent], template: `<iso-change-management-page [forcedMode]="'create'" />` })
export class ChangeManagementCreatePageComponent {}

@Component({ standalone: true, imports: [ChangeManagementPageComponent], template: `<iso-change-management-page [forcedMode]="'detail'" />` })
export class ChangeManagementDetailPageComponent {}

@Component({ standalone: true, imports: [ChangeManagementPageComponent], template: `<iso-change-management-page [forcedMode]="'edit'" />` })
export class ChangeManagementEditPageComponent {}
