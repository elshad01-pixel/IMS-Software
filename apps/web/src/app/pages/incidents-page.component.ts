import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
import { I18nService } from '../core/i18n.service';
import { PackageModuleKey, TenantPackageTier, minimumPackageTierForModule } from '../core/package-entitlements';
import { AttachmentPanelComponent } from '../shared/attachment-panel.component';
import { PageHeaderComponent } from '../shared/page-header.component';
import { RecordWorkItemsComponent } from '../shared/record-work-items.component';

type PageMode = 'list' | 'create' | 'detail' | 'edit';
type IncidentType = 'INCIDENT' | 'NEAR_MISS';
type IncidentStatus = 'REPORTED' | 'INVESTIGATION' | 'ACTION_IN_PROGRESS' | 'CLOSED' | 'ARCHIVED';
type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type IncidentCategory = 'SAFETY' | 'ENVIRONMENT' | 'QUALITY' | 'SECURITY' | 'OTHER';
type IncidentRcaMethod = 'FIVE_WHY' | 'FISHBONE' | 'IS_IS_NOT' | 'OTHER';
type LinkType = 'PROCESS' | 'RISK' | 'ACTION';

type UserSummary = { id: string; firstName: string; lastName: string; email: string };
type LinkCandidate = { id: string; label: string };
type ReturnNavigation = { route: string[]; label: string };

type IncidentLink = {
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

type IncidentRow = {
  id: string;
  referenceNo?: string | null;
  title: string;
  type: IncidentType;
  category: IncidentCategory;
  description: string;
  eventDate: string;
  location?: string | null;
  ownerUserId?: string | null;
  severity: IncidentSeverity;
  immediateAction?: string | null;
  investigationSummary?: string | null;
  rootCause?: string | null;
  rcaMethod?: IncidentRcaMethod | null;
  correctiveActionSummary?: string | null;
  status: IncidentStatus;
  createdAt: string;
  updatedAt: string;
  owner?: UserSummary | null;
  linkCount?: number;
  links?: IncidentLink[];
};

@Component({
  selector: 'iso-incidents-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, AttachmentPanelComponent, RecordWorkItemsComponent],
  templateUrl: './incidents-page.component.html',
  styleUrl: './incidents-page.component.css'
})
export class IncidentsPageComponent implements OnInit, OnChanges {
  @Input() forcedMode?: PageMode;

  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
  protected readonly incidents = signal<IncidentRow[]>([]);
  protected readonly owners = signal<UserSummary[]>([]);
  protected readonly selectedIncident = signal<IncidentRow | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly linkSaving = signal(false);
  protected readonly message = signal((history.state?.notice as string) || '');
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly statusFilter = signal('');
  protected readonly typeFilter = signal('');
  protected readonly ownerFilter = signal('');
  protected readonly linkCandidates = signal<LinkCandidate[]>([]);
  protected readonly activeLinkComposerType = signal<LinkType | null>(null);
  protected readonly returnNavigation = signal<ReturnNavigation | null>(null);
  protected readonly visibleLinkTypes: LinkType[] = ['PROCESS', 'RISK', 'ACTION'];
  protected readonly rcaMethodOptions: IncidentRcaMethod[] = ['FIVE_WHY', 'FISHBONE', 'IS_IS_NOT', 'OTHER'];
  protected readonly fiveWhySteps = ['Why 1', 'Why 2', 'Why 3', 'Why 4', 'Why 5'];
  protected readonly fishboneCategories = [
    { key: 'people', label: 'People' },
    { key: 'process', label: 'Process' },
    { key: 'equipment', label: 'Equipment' },
    { key: 'materials', label: 'Materials' },
    { key: 'environment', label: 'Environment' },
    { key: 'measurement', label: 'Measurement' }
  ];
  protected readonly fiveWhyAnswers = signal(['', '', '', '', '']);
  protected readonly fishboneAnswers = signal<Record<string, string>>({
    people: '',
    process: '',
    equipment: '',
    materials: '',
    environment: '',
    measurement: ''
  });

  protected readonly form = this.fb.nonNullable.group({
    referenceNo: ['', [Validators.maxLength(40)]],
    title: ['', [Validators.required, Validators.maxLength(180)]],
    type: ['INCIDENT' as IncidentType, [Validators.required]],
    category: ['SAFETY' as IncidentCategory, [Validators.required]],
    description: ['', [Validators.required, Validators.maxLength(2000)]],
    eventDate: ['', [Validators.required]],
    location: ['', [Validators.maxLength(120)]],
    ownerUserId: [''],
    severity: ['MEDIUM' as IncidentSeverity, [Validators.required]],
    immediateAction: ['', [Validators.maxLength(1500)]],
    investigationSummary: ['', [Validators.maxLength(2000)]],
    rootCause: ['', [Validators.maxLength(4000)]],
    rcaMethod: ['' as IncidentRcaMethod | ''],
    correctiveActionSummary: ['', [Validators.maxLength(2000)]],
    status: ['REPORTED' as IncidentStatus]
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

  protected canWrite() {
    return this.authStore.hasPermission('incidents.write');
  }

  protected canDelete() {
    return this.authStore.hasPermission('admin.delete');
  }

  protected t(key: string, params?: Record<string, unknown>) {
    return this.i18n.t(key, params);
  }

  protected personName(user: UserSummary) {
    return `${user.firstName} ${user.lastName}`.trim();
  }

  protected readInputValue(event: Event) {
    return (event.target as HTMLInputElement).value;
  }

  protected readSelectValue(event: Event) {
    return (event.target as HTMLSelectElement).value;
  }

  protected prettyStatus(value?: string | null) {
    return value ? value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (part) => part.toUpperCase()) : '';
  }

  protected incidentStatusLabel(value?: IncidentStatus | null) {
    return value ? this.t(`incidents.status.${value}`) : '';
  }

  protected incidentTypeLabel(value?: IncidentType | null) {
    return value ? this.t(`incidents.types.${value}`) : '';
  }

  protected incidentCategoryLabel(value?: IncidentCategory | null) {
    return value ? this.t(`incidents.categories.${value}`) : '';
  }

  protected incidentSeverityLabel(value?: IncidentSeverity | null) {
    return value ? this.t(`incidents.severity.${value}`) : '';
  }

  protected incidentRcaMethodLabel(value?: IncidentRcaMethod | '' | null) {
    return value ? this.t(`incidents.rcaMethods.${value}`) : '';
  }

  protected statusClass(value: IncidentStatus) {
    if (value === 'CLOSED') return 'success';
    if (value === 'ACTION_IN_PROGRESS') return 'warn';
    return 'neutral';
  }

  protected severityClass(value: IncidentSeverity) {
    if (value === 'CRITICAL') return 'danger';
    if (value === 'HIGH') return 'warn';
    return 'neutral';
  }

  protected totalNearMissCount() {
    return this.incidents().filter((item) => item.type === 'NEAR_MISS').length;
  }

  protected openFollowUpCount() {
    return this.incidents().filter((item) => item.status !== 'CLOSED' && item.status !== 'ARCHIVED').length;
  }

  protected highSeverityCount() {
    return this.incidents().filter((item) => item.severity === 'HIGH' || item.severity === 'CRITICAL').length;
  }

  protected attentionCount() {
    return this.incidents().filter((item) => this.incidentAttentionReasons(item).length > 0).length;
  }

  protected filteredIncidents() {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const type = this.typeFilter();
    const ownerId = this.ownerFilter();
    return this.incidents().filter((item) => {
      const matchesTerm =
        !term ||
        (item.referenceNo || '').toLowerCase().includes(term) ||
        item.title.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        (item.location || '').toLowerCase().includes(term);
      const matchesStatus = !status || item.status === status;
      const matchesType = !type || item.type === type;
      const matchesOwner = !ownerId || item.ownerUserId === ownerId;
      return matchesTerm && matchesStatus && matchesType && matchesOwner;
    });
  }

  protected pageTitle() {
    return {
      list: this.t('incidents.page.titles.list'),
      create: this.t('incidents.page.titles.create'),
      detail: this.selectedIncident()?.title || this.t('incidents.page.titles.detail'),
      edit: this.selectedIncident()?.title || this.t('incidents.page.titles.edit')
    }[this.mode()];
  }

  protected pageDescription() {
    return {
      list: this.t('incidents.page.descriptions.list'),
      create: this.t('incidents.page.descriptions.create'),
      detail: this.t('incidents.page.descriptions.detail'),
      edit: this.t('incidents.page.descriptions.edit')
    }[this.mode()];
  }

  protected breadcrumbs() {
    if (this.mode() === 'list') return [{ label: this.t('incidents.page.label') }];
    const base = [{ label: this.t('incidents.page.label'), link: '/incidents' }];
    if (this.mode() === 'create') return [...base, { label: this.t('incidents.breadcrumbs.new') }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedIncident()?.title || this.t('incidents.breadcrumbs.record'), link: `/incidents/${this.selectedId()}` }, { label: this.t('incidents.breadcrumbs.edit') }];
    return [...base, { label: this.selectedIncident()?.title || this.t('incidents.breadcrumbs.record') }];
  }

  protected incidentGuidance() {
    const raw = this.form.getRawValue();
    if (raw.eventDate && raw.ownerUserId && raw.immediateAction) {
      return this.t('incidents.guidance.structured');
    }
    return this.t('incidents.guidance.default');
  }

  protected reviewNarrative() {
    const incident = this.selectedIncident();
    if (!incident) return this.t('incidents.review.noRecord');
    if (!incident.links?.length) return this.t('incidents.review.unlinked');
    if (!this.linkCountByType('PROCESS') || !this.linkCountByType('RISK')) return this.t('incidents.review.partial');
    return this.t('incidents.review.strong');
  }

  protected selectedRcaMethod() {
    return this.form.getRawValue().rcaMethod as IncidentRcaMethod | '';
  }

  protected investigationNarrative() {
    const raw = this.form.getRawValue();
    if (raw.rcaMethod && (raw.rootCause || this.structuredRootCauseSummary())) {
      return this.t('incidents.investigation.structured');
    }
    if (raw.investigationSummary) {
      return this.t('incidents.investigation.summaryOnly');
    }
    return this.t('incidents.investigation.default');
  }

  protected detailInvestigationNarrative() {
    const incident = this.selectedIncident();
    if (!incident) return this.t('incidents.investigation.none');
    if (incident.rcaMethod && incident.rootCause) {
      return this.t('incidents.investigation.detailStructured');
    }
    if (incident.investigationSummary) {
      return this.t('incidents.investigation.detailSummaryOnly');
    }
    return this.t('incidents.investigation.detailNone');
  }

  protected nextStepHeadline() {
    const incident = this.selectedIncident();
    if (!incident) return this.t('incidents.nextSteps.headline.default');
    if (!incident.rootCause) return this.t('incidents.nextSteps.headline.investigation');
    if (!this.linkCountByType('ACTION')) return this.t('incidents.nextSteps.headline.action');
    if (!this.linkCountByType('PROCESS') || !this.linkCountByType('RISK')) return this.t('incidents.nextSteps.headline.traceability');
    return this.t('incidents.nextSteps.headline.ready');
  }

  protected nextStepNarrative() {
    const incident = this.selectedIncident();
    if (!incident) return this.t('incidents.nextSteps.copy.default');
    if (!incident.rootCause) return this.t('incidents.nextSteps.copy.investigation');
    if (!this.linkCountByType('ACTION')) return this.t('incidents.nextSteps.copy.action');
    if (!this.linkCountByType('PROCESS') || !this.linkCountByType('RISK')) return this.t('incidents.nextSteps.copy.traceability');
    return this.t('incidents.nextSteps.copy.ready');
  }

  protected incidentDraftTitle() {
    const incident = this.selectedIncident();
    if (!incident) return null;
    return this.t('incidents.messages.actionDraftTitle', { type: this.incidentTypeLabel(incident.type), title: incident.title });
  }

  protected incidentDraftDescription() {
    const incident = this.selectedIncident();
    if (!incident) return null;
    return incident.correctiveActionSummary || incident.rootCause || incident.investigationSummary || incident.immediateAction || null;
  }

  protected attentionHeadline() {
    const incident = this.selectedIncident();
    return incident && this.incidentAttentionReasons(incident).length
      ? this.t('incidents.attention.headline.needsAttention')
      : this.t('incidents.attention.headline.underControl');
  }

  protected attentionNarrative() {
    const incident = this.selectedIncident();
    if (!incident) {
      return this.t('incidents.attention.copy.default');
    }
    const reasons = this.incidentAttentionReasons(incident);
    if (!reasons.length) {
      return this.t('incidents.attention.copy.underControl');
    }
    return this.t('incidents.attention.copy.needsAttention', { reasons: reasons.map((reason) => reason.toLowerCase()).join(', ') });
  }

  protected attentionSummary(item: IncidentRow) {
    const reasons = this.incidentAttentionReasons(item);
    return reasons.length ? reasons.join(' | ') : '';
  }

  protected attentionLabel(item: IncidentRow) {
    const reasons = this.incidentAttentionReasons(item);
    if (!reasons.length) {
      return this.t('incidents.attention.short.ok');
    }
    return reasons.length > 1 ? `${reasons[0]} +${reasons.length - 1}` : reasons[0];
  }

  protected attentionClass(item: IncidentRow) {
    if (item.status === 'CLOSED' || item.status === 'ARCHIVED') {
      return 'success';
    }
    if (item.severity === 'HIGH' || item.severity === 'CRITICAL') {
      return 'danger';
    }
    if (this.incidentAttentionReasons(item).length) {
      return 'warn';
    }
    return 'success';
  }

  protected incidentReturnNavigation() {
    const id = this.selectedId();
    return id ? { route: ['/incidents', id], label: this.t('incidents.page.label') } : null;
  }

  protected sectionTitle(type: LinkType) {
    return this.t(`incidents.links.sections.${type}.title`);
  }

  protected sectionDescription(type: LinkType) {
    return this.t(`incidents.links.sections.${type}.copy`);
  }

  protected sectionEmptyCopy(type: LinkType) {
    return this.t(`incidents.links.sections.${type}.empty`);
  }

  protected sectionPickerLabel(type: LinkType) {
    return this.t(`incidents.links.types.${type}`);
  }

  protected linksByType(type: LinkType) {
    return (this.selectedIncident()?.links || []).filter((link) => link.linkType === type);
  }

  protected linkCountByType(type: LinkType) {
    return this.linksByType(type).length;
  }

  protected linkRoute(link: IncidentLink) {
    return link.path || '/incidents';
  }

  protected linkQueryParams(link: IncidentLink) {
    return link.linkType === 'ACTION' ? { focusActionId: link.linkedId } : undefined;
  }

  protected linkState(link: IncidentLink) {
    return link.linkType === 'ACTION'
      ? { returnNavigation: { route: ['/incidents', this.selectedId()], label: this.t('incidents.page.label') } }
      : undefined;
  }

  protected canOpenLink(link: IncidentLink) {
    if (!link.path || link.missing) return false;
    const moduleKey = this.linkPackageModule(link);
    return !moduleKey || this.authStore.hasModule(moduleKey);
  }

  protected inaccessibleLinkSummary(link: IncidentLink) {
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
    if (!this.canWrite()) return this.error.set(this.t('incidents.messages.noPermissionWrite'));
    if (this.form.invalid) return this.error.set(this.t('incidents.messages.completeRequired'));
    this.saving.set(true);
    this.error.set('');
    const raw = this.form.getRawValue();
    const payload = {
      ...raw,
      rootCause: (raw.rootCause.trim() || this.structuredRootCauseSummary()) || undefined,
      rcaMethod: (raw.rcaMethod as IncidentRcaMethod) || undefined
    };
    const request = this.selectedId()
      ? this.api.patch<IncidentRow>(`incidents/${this.selectedId()}`, payload)
      : this.api.post<IncidentRow>('incidents', payload);
    request.subscribe({
      next: (incident) => {
        this.saving.set(false);
        this.router.navigate(['/incidents', incident.id], { state: { notice: this.t('incidents.messages.saved') } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, this.t('incidents.messages.saveFailed')));
      }
    });
  }

  protected archiveIncident() {
    if (!this.selectedIncident() || !this.canDelete() || !window.confirm(this.t('incidents.messages.archiveConfirm', { title: this.selectedIncident()?.title }))) return;
    this.api.delete<{ success: boolean }>(`incidents/${this.selectedId()}`).subscribe({
      next: () => this.router.navigate(['/incidents'], { state: { notice: this.t('incidents.messages.archived') } }),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, this.t('incidents.messages.archiveFailed')))
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
    this.api.post<IncidentLink>(`incidents/${this.selectedId()}/links`, this.linkForm.getRawValue()).subscribe({
      next: () => {
        this.linkSaving.set(false);
        this.linkForm.patchValue({ linkedId: '', note: '' });
        this.activeLinkComposerType.set(null);
        this.fetchIncident(this.selectedId()!);
        this.message.set(this.t('incidents.messages.linkAdded'));
      },
      error: (error: HttpErrorResponse) => {
        this.linkSaving.set(false);
        this.error.set(this.readError(error, this.t('incidents.messages.linkFailed')));
      }
    });
  }

  protected removeLink(linkId: string) {
    if (!this.selectedId() || !this.canWrite()) return;
    this.api.delete<{ success: boolean }>(`incidents/${this.selectedId()}/links/${linkId}`).subscribe({
      next: () => {
        this.fetchIncident(this.selectedId()!);
        this.message.set(this.t('incidents.messages.linkRemoved'));
      },
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, this.t('incidents.messages.linkRemoveFailed')))
    });
  }

  protected updateFiveWhy(index: number, event: Event) {
    const next = [...this.fiveWhyAnswers()];
    next[index] = this.readInputValue(event);
    this.fiveWhyAnswers.set(next);
  }

  protected updateFishbone(key: string, event: Event) {
    this.fishboneAnswers.set({ ...this.fishboneAnswers(), [key]: this.readInputValue(event) });
  }

  private handleRoute(params: ParamMap) {
    const id = params.get('id');
    this.selectedId.set(id);
    this.message.set((history.state?.notice as string) || '');
    this.error.set('');
    this.returnNavigation.set((history.state?.returnNavigation as ReturnNavigation | undefined) ?? null);
    if (this.mode() === 'list') {
      this.selectedIncident.set(null);
      this.resetForms();
      return this.reloadIncidents();
    }
    if (this.mode() === 'create') {
      this.selectedIncident.set(null);
      return this.resetForms();
    }
    if (id) this.fetchIncident(id);
  }

  private resetForms() {
    this.form.reset({
      referenceNo: '',
      title: '',
      type: 'INCIDENT',
      category: 'SAFETY',
      description: '',
      eventDate: '',
      location: '',
      ownerUserId: '',
      severity: 'MEDIUM',
      immediateAction: '',
      investigationSummary: '',
      rootCause: '',
      rcaMethod: '',
      correctiveActionSummary: '',
      status: 'REPORTED'
    });
    this.fiveWhyAnswers.set(['', '', '', '', '']);
    this.fishboneAnswers.set({ people: '', process: '', equipment: '', materials: '', environment: '', measurement: '' });
    this.closeLinkComposer();
  }

  private reloadIncidents() {
    this.loading.set(true);
    this.api.get<IncidentRow[]>('incidents').subscribe({
      next: (items) => {
        this.loading.set(false);
        this.incidents.set(items);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, this.t('incidents.messages.loadListFailed')));
      }
    });
  }

  private fetchIncident(id: string) {
    this.loading.set(true);
    this.api.get<IncidentRow>(`incidents/${id}`).subscribe({
      next: (incident) => {
        this.loading.set(false);
        this.selectedIncident.set(incident);
        this.form.reset({
          referenceNo: incident.referenceNo || '',
          title: incident.title,
          type: incident.type,
          category: incident.category,
          description: incident.description,
          eventDate: incident.eventDate ? incident.eventDate.slice(0, 10) : '',
          location: incident.location || '',
          ownerUserId: incident.ownerUserId || '',
          severity: incident.severity,
          immediateAction: incident.immediateAction || '',
          investigationSummary: incident.investigationSummary || '',
          rootCause: incident.rootCause || '',
          rcaMethod: incident.rcaMethod || '',
          correctiveActionSummary: incident.correctiveActionSummary || '',
          status: incident.status
        });
        this.fiveWhyAnswers.set(['', '', '', '', '']);
        this.fishboneAnswers.set({ people: '', process: '', equipment: '', materials: '', environment: '', measurement: '' });
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, this.t('incidents.messages.loadDetailsFailed')));
      }
    });
  }

  private loadOwners() {
    this.api.get<UserSummary[]>('users').subscribe({
      next: (users) => this.owners.set(users),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, this.t('incidents.messages.loadOwnersFailed')))
    });
  }

  private loadLinkCandidates(type: LinkType) {
    const path = { PROCESS: 'process-register', RISK: 'risks', ACTION: 'action-items' }[type];
    this.api.get<any[]>(path).subscribe({
      next: (items) => this.linkCandidates.set(items.map((item) => ({ id: item.id, label: this.toCandidateLabel(type, item) }))),
      error: () => this.linkCandidates.set([])
    });
  }

  private toCandidateLabel(type: LinkType, item: any) {
    if (type === 'PROCESS') return `${item.referenceNo || this.t('incidents.common.uncoded')} - ${item.name}`;
    if (type === 'RISK') return item.title;
    return item.title;
  }

  private linkPackageModule(link: IncidentLink): PackageModuleKey | null {
    const mapping: Record<LinkType, PackageModuleKey> = {
      PROCESS: 'process-register',
      RISK: 'risks',
      ACTION: 'actions'
    };
    return mapping[link.linkType] ?? null;
  }

  private linkModuleLabel(linkType: LinkType) {
    return {
      PROCESS: this.t('shell.nav.processRegister.label'),
      RISK: this.t('shell.nav.risks.label'),
      ACTION: this.t('shell.nav.actions.label')
    }[linkType];
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }

  private incidentAttentionReasons(item: IncidentRow) {
    if (item.status === 'CLOSED' || item.status === 'ARCHIVED') {
      return [];
    }
    const reasons: string[] = [];
    if (!item.ownerUserId) {
      reasons.push(this.t('incidents.attention.reasons.ownerNeeded'));
    }
    if (item.severity === 'HIGH' || item.severity === 'CRITICAL') {
      reasons.push(this.t('incidents.attention.reasons.highPriority'));
    }
    if ((item.status === 'INVESTIGATION' || item.status === 'ACTION_IN_PROGRESS') && !item.rootCause) {
      reasons.push(this.t('incidents.attention.reasons.investigationIncomplete'));
    }
    if (this.isStale(item.updatedAt, 30)) {
      reasons.push(this.t('incidents.attention.reasons.stale'));
    }
    return reasons;
  }

  private isStale(value: string | null | undefined, days: number) {
    if (!value) return false;
    const updated = new Date(value);
    const today = new Date();
    const delta = (today.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);
    return delta > days;
  }

  private structuredRootCauseSummary() {
    if (this.selectedRcaMethod() === 'FIVE_WHY') {
      const answered = this.fiveWhyAnswers()
        .map((value, index) => ({ label: this.fiveWhySteps[index], value: value.trim() }))
        .filter((item) => item.value);
      return answered.length ? answered.map((item) => `${item.label}: ${item.value}`).join('\n') : '';
    }

    if (this.selectedRcaMethod() === 'FISHBONE') {
      const answered = this.fishboneCategories
        .map((group) => ({ label: group.label, value: (this.fishboneAnswers()[group.key] || '').trim() }))
        .filter((item) => item.value);
      return answered.length ? answered.map((item) => `${item.label}: ${item.value}`).join('\n') : '';
    }

    return '';
  }
}

@Component({ standalone: true, imports: [IncidentsPageComponent], template: `<iso-incidents-page [forcedMode]="'list'" />` })
export class IncidentsListPageComponent {}

@Component({ standalone: true, imports: [IncidentsPageComponent], template: `<iso-incidents-page [forcedMode]="'create'" />` })
export class IncidentsCreatePageComponent {}

@Component({ standalone: true, imports: [IncidentsPageComponent], template: `<iso-incidents-page [forcedMode]="'detail'" />` })
export class IncidentsDetailPageComponent {}

@Component({ standalone: true, imports: [IncidentsPageComponent], template: `<iso-incidents-page [forcedMode]="'edit'" />` })
export class IncidentsEditPageComponent {}
