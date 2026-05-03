import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
import { I18nService } from '../core/i18n.service';
import { PackageModuleKey, TenantPackageTier, minimumPackageTierForModule } from '../core/package-entitlements';
import { PageHeaderComponent } from '../shared/page-header.component';
import { RecordWorkItemsComponent } from '../shared/record-work-items.component';

type PageMode = 'list' | 'create' | 'detail' | 'edit';
type ChangeType = 'PROCESS' | 'PRODUCT' | 'EQUIPMENT' | 'MATERIAL' | 'ORGANIZATIONAL' | 'DOCUMENTATION' | 'FACILITY' | 'OTHER';
type ChangeStatus = 'PROPOSED' | 'REVIEWING' | 'APPROVED' | 'IMPLEMENTING' | 'VERIFIED' | 'CLOSED' | 'REJECTED';
type LinkType = 'PROCESS' | 'RISK' | 'ACTION' | 'DOCUMENT' | 'OBLIGATION' | 'PROVIDER';
type ChangeAttentionReason = 'OWNER_NEEDED' | 'REVIEW_DATE_NEEDED' | 'REVIEW_OVERDUE' | 'REVIEW_DUE_SOON' | 'IMPLEMENTATION_OVERDUE' | 'IMPLEMENTATION_DUE_SOON' | 'STALE';
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
  private readonly i18n = inject(I18nService);
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
  protected t(key: string, params?: Record<string, string | number>) { return this.i18n.t(key, params); }
  protected prettyStatus(value?: string | null) { return value ? value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (part) => part.toUpperCase()) : ''; }
  protected changeTypeLabel(value?: ChangeType | null) { return value ? this.t(`changeManagement.changeType.${value}`) : ''; }
  protected changeStatusLabel(value?: ChangeStatus | null) { return value ? this.t(`changeManagement.status.${value}`) : ''; }
  protected statusClass(value: ChangeStatus) { return value === 'CLOSED' || value === 'VERIFIED' ? 'success' : value === 'APPROVED' || value === 'IMPLEMENTING' ? 'warn' : value === 'REJECTED' ? 'danger' : 'neutral'; }
  protected proposedCount() { return this.records().filter((item) => item.status === 'PROPOSED' || item.status === 'REVIEWING').length; }
  protected liveCount() { return this.records().filter((item) => item.status === 'APPROVED' || item.status === 'IMPLEMENTING').length; }
  protected verifiedCount() { return this.records().filter((item) => item.status === 'VERIFIED' || item.status === 'CLOSED').length; }
  protected attentionCount() { return this.records().filter((item) => this.changeAttentionReasons(item).length > 0).length; }

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

  protected pageTitle() { return { list: this.t('changeManagement.page.titles.list'), create: this.t('changeManagement.page.titles.create'), detail: this.selectedRecord()?.title || this.t('changeManagement.page.titles.detail'), edit: this.selectedRecord()?.title || this.t('changeManagement.page.titles.edit') }[this.mode()]; }
  protected pageDescription() { return { list: this.t('changeManagement.page.descriptions.list'), create: this.t('changeManagement.page.descriptions.create'), detail: this.t('changeManagement.page.descriptions.detail'), edit: this.t('changeManagement.page.descriptions.edit') }[this.mode()]; }
  protected breadcrumbs() {
    if (this.mode() === 'list') return [{ label: this.t('changeManagement.page.label') }];
    const base = [{ label: this.t('changeManagement.page.label'), link: '/change-management' }];
    if (this.mode() === 'create') return [...base, { label: this.t('changeManagement.breadcrumbs.new') }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedRecord()?.title || this.t('changeManagement.breadcrumbs.record'), link: `/change-management/${this.selectedId()}` }, { label: this.t('changeManagement.breadcrumbs.edit') }];
    return [...base, { label: this.selectedRecord()?.title || this.t('changeManagement.breadcrumbs.record') }];
  }

  protected changeGuidance() {
    const raw = this.form.getRawValue();
    if (raw.title && raw.reason && raw.proposedChange && raw.ownerUserId) {
      return this.t('changeManagement.guidance.structured');
    }
    return this.t('changeManagement.guidance.default');
  }

  protected reviewNarrative() {
    const record = this.selectedRecord();
    if (!record) return this.t('changeManagement.review.noRecord');
    if (!record.links?.length) return this.t('changeManagement.review.unlinked');
    if (!this.linkCountByType('PROCESS') || !this.linkCountByType('RISK')) return this.t('changeManagement.review.partial');
    if (!this.linkCountByType('DOCUMENT')) return this.t('changeManagement.review.documentNeeded');
    return this.t('changeManagement.review.strong');
  }

  protected stageNarrative() {
    const record = this.selectedRecord();
    if (!record) return this.t('changeManagement.stageNarrative.default');
    if (record.status === 'PROPOSED') return this.t('changeManagement.stageNarrative.PROPOSED');
    if (record.status === 'REVIEWING') return this.t('changeManagement.stageNarrative.REVIEWING');
    if (record.status === 'APPROVED') return this.t('changeManagement.stageNarrative.APPROVED');
    if (record.status === 'IMPLEMENTING') return this.t('changeManagement.stageNarrative.IMPLEMENTING');
    if (record.status === 'VERIFIED') return this.t('changeManagement.stageNarrative.VERIFIED');
    if (record.status === 'CLOSED') return this.t('changeManagement.stageNarrative.CLOSED');
    return this.t('changeManagement.stageNarrative.REJECTED');
  }
  protected nextStepHeadline() {
    const record = this.selectedRecord();
    if (!record) return this.t('changeManagement.nextSteps.headline.default');
    if (record.status === 'PROPOSED') return this.t('changeManagement.nextSteps.headline.proposed');
    if (record.status === 'REVIEWING' && (!this.linkCountByType('PROCESS') || !this.linkCountByType('RISK') || !this.linkCountByType('DOCUMENT'))) {
      return this.t('changeManagement.nextSteps.headline.reviewing');
    }
    if (!this.linkCountByType('ACTION') && (record.status === 'APPROVED' || record.status === 'IMPLEMENTING')) {
      return this.t('changeManagement.nextSteps.headline.action');
    }
    if (record.status === 'VERIFIED' || record.status === 'CLOSED') return this.t('changeManagement.nextSteps.headline.verified');
    return this.t('changeManagement.nextSteps.headline.ready');
  }
  protected nextStepNarrative() {
    const record = this.selectedRecord();
    if (!record) return this.t('changeManagement.nextSteps.copy.default');
    if (record.status === 'PROPOSED') {
      return this.t('changeManagement.nextSteps.copy.proposed');
    }
    if (record.status === 'REVIEWING' && (!this.linkCountByType('PROCESS') || !this.linkCountByType('RISK') || !this.linkCountByType('DOCUMENT'))) {
      return this.t('changeManagement.nextSteps.copy.reviewing');
    }
    if (!this.linkCountByType('ACTION') && (record.status === 'APPROVED' || record.status === 'IMPLEMENTING')) {
      return this.t('changeManagement.nextSteps.copy.action');
    }
    if (record.status === 'VERIFIED' || record.status === 'CLOSED') {
      return this.t('changeManagement.nextSteps.copy.verified');
    }
    return this.t('changeManagement.nextSteps.copy.ready');
  }
  protected changeDraftTitle() {
    const record = this.selectedRecord();
    if (!record) return null;
    return this.t('changeManagement.messages.actionDraftTitle', { title: record.title });
  }
  protected changeDraftDescription() {
    const record = this.selectedRecord();
    if (!record) return null;
    return record.controlSummary?.trim() || record.impactSummary?.trim() || record.proposedChange || null;
  }
  protected changeReturnNavigation(): ReturnNavigation | null {
    const id = this.selectedId();
    return id ? { route: ['/change-management', id], label: this.t('changeManagement.page.label') } : null;
  }

  protected attentionHeadline() {
    const record = this.selectedRecord();
    return record && this.changeAttentionReasons(record).length
      ? this.t('changeManagement.attention.headline.needsAttention')
      : this.t('changeManagement.attention.headline.underControl');
  }

  protected attentionNarrative() {
    const record = this.selectedRecord();
    if (!record) {
      return this.t('changeManagement.attention.copy.unsaved');
    }
    const reasons = this.changeAttentionReasons(record);
    if (!reasons.length) {
      return this.t('changeManagement.attention.copy.underControl');
    }
    return this.t('changeManagement.attention.copy.needsAttention', { reasons: reasons.map((reason) => this.attentionReasonLabel(reason).toLowerCase()).join(', ') });
  }

  protected attentionSummary(item: ChangeRow) {
    const reasons = this.changeAttentionReasons(item);
    return reasons.length ? reasons.map((reason) => this.attentionReasonLabel(reason)).join(' | ') : '';
  }

  protected attentionLabel(item: ChangeRow) {
    const reasons = this.changeAttentionReasons(item);
    if (!reasons.length) {
      return this.t('changeManagement.attention.underControl');
    }
    return reasons.length > 1 ? this.t('changeManagement.attention.multi', { first: this.attentionReasonLabel(reasons[0]), count: reasons.length - 1 }) : this.attentionReasonLabel(reasons[0]);
  }

  protected attentionClass(item: ChangeRow) {
    const reasons = this.changeAttentionReasons(item);
    if (!reasons.length) {
      return 'success';
    }
    if (reasons.includes('REVIEW_OVERDUE') || reasons.includes('IMPLEMENTATION_OVERDUE')) {
      return 'danger';
    }
    return 'warn';
  }
  private attentionReasonLabel(reason: ChangeAttentionReason) { return this.t(`changeManagement.attention.reasons.${reason}`); }
  protected sectionTitle(type: LinkType) { return this.t(`changeManagement.links.sections.${type}.title`); }
  protected sectionDescription(type: LinkType) { return this.t(`changeManagement.links.sections.${type}.copy`); }
  protected sectionEmptyCopy(type: LinkType) { return this.t(`changeManagement.links.sections.${type}.empty`); }
  protected sectionPickerLabel(type: LinkType) { return this.t(`changeManagement.links.types.${type}`); }
  protected linksByType(type: LinkType) { return (this.selectedRecord()?.links || []).filter((link) => link.linkType === type); }
  protected linkCountByType(type: LinkType) { return this.linksByType(type).length; }
  protected linkRoute(link: ChangeLink) { return link.path || '/change-management'; }
  protected linkQueryParams(link: ChangeLink) { return link.linkType === 'ACTION' ? { focusActionId: link.linkedId } : undefined; }
  protected linkState(link: ChangeLink) { return link.linkType === 'ACTION' ? { returnNavigation: { route: ['/change-management', this.selectedId()], label: 'change request' } } : undefined; }
  protected canOpenLink(link: ChangeLink) {
    if (!link.path || link.missing) return false;
    const moduleKey = this.linkPackageModule(link);
    return !moduleKey || this.authStore.hasModule(moduleKey);
  }
  protected inaccessibleLinkSummary(link: ChangeLink) {
    const moduleKey = this.linkPackageModule(link);
    if (!moduleKey || this.authStore.hasModule(moduleKey)) return null;
    return {
      title: link.title,
      subtitle: link.subtitle,
      statusLabel: link.status ? this.prettyStatus(link.status) : '',
      moduleLabel: this.linkModuleLabel(link.linkType),
      requiredTier: minimumPackageTierForModule(moduleKey)
    };
  }
  protected packageTierLabel(packageTier: TenantPackageTier) {
    return {
      ASSURANCE: this.t('packages.assurance'),
      CORE_IMS: this.t('packages.coreIms'),
      QHSE_PRO: this.t('packages.qhsePro')
    }[packageTier];
  }

  protected save() {
    if (!this.canWrite()) return this.error.set(this.t('changeManagement.messages.noPermissionWrite'));
    if (this.form.invalid) return this.error.set(this.t('changeManagement.messages.completeRequired'));
    this.saving.set(true);
    this.error.set('');
    const request = this.selectedId() ? this.api.patch<ChangeRow>(`change-management/${this.selectedId()}`, this.form.getRawValue()) : this.api.post<ChangeRow>('change-management', this.form.getRawValue());
    request.subscribe({
      next: (record) => {
        this.saving.set(false);
        this.router.navigate(['/change-management', record.id], { state: { notice: this.t('changeManagement.messages.saved') } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, this.t('changeManagement.messages.saveFailed')));
      }
    });
  }

  protected archiveRecord() {
    if (!this.selectedRecord() || !this.canDelete() || !window.confirm(this.t('changeManagement.messages.archiveConfirm', { title: this.selectedRecord()?.title || '' }))) return;
    this.api.delete<{ success: boolean }>(`change-management/${this.selectedId()}`).subscribe({
      next: () => this.router.navigate(['/change-management'], { state: { notice: this.t('changeManagement.messages.archived') } }),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, this.t('changeManagement.messages.archiveFailed')))
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
        this.message.set(this.t('changeManagement.messages.linkAdded'));
      },
      error: (error: HttpErrorResponse) => {
        this.linkSaving.set(false);
        this.error.set(this.readError(error, this.t('changeManagement.messages.linkFailed')));
      }
    });
  }

  protected removeLink(linkId: string) {
    if (!this.selectedId() || !this.canWrite()) return;
    this.api.delete<{ success: boolean }>(`change-management/${this.selectedId()}/links/${linkId}`).subscribe({
      next: () => {
        this.fetchRecord(this.selectedId()!);
        this.message.set(this.t('changeManagement.messages.linkRemoved'));
      },
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, this.t('changeManagement.messages.linkRemoveFailed')))
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
        this.error.set(this.readError(error, this.t('changeManagement.messages.loadListFailed')));
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
        this.error.set(this.readError(error, this.t('changeManagement.messages.loadDetailsFailed')));
      }
    });
  }

  private loadOwners() {
    this.api.get<UserSummary[]>('users').subscribe({
      next: (users) => this.owners.set(users),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, this.t('changeManagement.messages.loadOwnersFailed')))
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
    if (type === 'PROCESS') return `${item.referenceNo || this.t('changeManagement.common.uncoded')} - ${item.name}`;
    if (type === 'RISK') return item.title;
    if (type === 'DOCUMENT') return `${item.code || this.t('changeManagement.common.uncoded')} - ${item.title}`;
    if (type === 'OBLIGATION') return `${item.referenceNo || this.t('changeManagement.common.uncoded')} - ${item.title}`;
    if (type === 'PROVIDER') return `${item.referenceNo || this.t('changeManagement.common.uncoded')} - ${item.providerName}`;
    return item.title;
  }

  private linkPackageModule(link: ChangeLink): PackageModuleKey | null {
    const mapping: Record<LinkType, PackageModuleKey> = {
      PROCESS: 'process-register',
      RISK: 'risks',
      ACTION: 'actions',
      DOCUMENT: 'documents',
      OBLIGATION: 'compliance-obligations',
      PROVIDER: 'external-providers'
    };
    return mapping[link.linkType] ?? null;
  }

  private linkModuleLabel(linkType: LinkType) {
    return {
      PROCESS: this.t('shell.nav.processRegister.label'),
      RISK: this.t('shell.nav.risks.label'),
      ACTION: this.t('shell.nav.actions.label'),
      DOCUMENT: this.t('shell.nav.documents.label'),
      OBLIGATION: this.t('shell.nav.complianceObligations.label'),
      PROVIDER: this.t('shell.nav.externalProviders.label')
    }[linkType];
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }

  private changeAttentionReasons(item: ChangeRow): ChangeAttentionReason[] {
    if (item.status === 'CLOSED' || item.status === 'REJECTED') {
      return [];
    }
    const reasons: ChangeAttentionReason[] = [];
    if (!item.ownerUserId) {
      reasons.push('OWNER_NEEDED');
    }
    if (item.status === 'REVIEWING') {
      if (!item.reviewDate) {
        reasons.push('REVIEW_DATE_NEEDED');
      } else if (this.isPastDate(item.reviewDate)) {
        reasons.push('REVIEW_OVERDUE');
      } else if (this.isDateWithinDays(item.reviewDate, 14)) {
        reasons.push('REVIEW_DUE_SOON');
      }
    }
    if ((item.status === 'APPROVED' || item.status === 'IMPLEMENTING') && item.targetImplementationDate) {
      if (this.isPastDate(item.targetImplementationDate)) {
        reasons.push('IMPLEMENTATION_OVERDUE');
      } else if (this.isDateWithinDays(item.targetImplementationDate, 14)) {
        reasons.push('IMPLEMENTATION_DUE_SOON');
      }
    }
    if (this.isStale(item.updatedAt, 45)) {
      reasons.push('STALE');
    }
    return reasons;
  }

  private isPastDate(value?: string | null) {
    return !!value && new Date(value) < new Date();
  }

  private isDateWithinDays(value: string | null | undefined, days: number) {
    if (!value) return false;
    const date = new Date(value);
    const today = new Date();
    const delta = (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return delta >= 0 && delta <= days;
  }

  private isStale(value: string | null | undefined, days: number) {
    if (!value) return false;
    const updated = new Date(value);
    const today = new Date();
    const delta = (today.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);
    return delta > days;
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
