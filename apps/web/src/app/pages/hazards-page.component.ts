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
type HazardStatus = 'ACTIVE' | 'MONITORING' | 'OBSOLETE';
type HazardExposureStage = 'ROUTINE' | 'NON_ROUTINE' | 'EMERGENCY';
type HazardSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
type LinkType = 'PROCESS' | 'RISK' | 'ACTION' | 'INCIDENT';
type ReturnNavigation = { route: string[]; label: string };

type UserSummary = { id: string; firstName: string; lastName: string; email: string };
type LinkCandidate = { id: string; label: string };

type HazardLink = {
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

type HazardRow = {
  id: string;
  referenceNo?: string | null;
  activity: string;
  hazard: string;
  potentialHarm: string;
  exposureStage: HazardExposureStage;
  existingControls?: string | null;
  severity: HazardSeverity;
  ownerUserId?: string | null;
  reviewDate?: string | null;
  status: HazardStatus;
  createdAt: string;
  updatedAt: string;
  owner?: UserSummary | null;
  linkCount?: number;
  links?: HazardLink[];
};

@Component({
  selector: 'iso-hazards-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, RecordWorkItemsComponent],
  templateUrl: './hazards-page.component.html',
  styleUrl: './hazards-page.component.css'
})
export class HazardsPageComponent implements OnInit, OnChanges {
  @Input() forcedMode?: PageMode;

  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
  protected readonly hazards = signal<HazardRow[]>([]);
  protected readonly owners = signal<UserSummary[]>([]);
  protected readonly selectedHazard = signal<HazardRow | null>(null);
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
  protected readonly visibleLinkTypes: LinkType[] = ['PROCESS', 'RISK', 'ACTION', 'INCIDENT'];

  protected readonly form = this.fb.nonNullable.group({
    referenceNo: ['', [Validators.maxLength(40)]],
    activity: ['', [Validators.required, Validators.maxLength(180)]],
    hazard: ['', [Validators.required, Validators.maxLength(180)]],
    potentialHarm: ['', [Validators.required, Validators.maxLength(2000)]],
    exposureStage: ['ROUTINE' as HazardExposureStage, [Validators.required]],
    existingControls: ['', [Validators.maxLength(2000)]],
    severity: ['MEDIUM' as HazardSeverity, [Validators.required]],
    ownerUserId: [''],
    reviewDate: [''],
    status: ['ACTIVE' as HazardStatus]
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

  protected canWrite() { return this.authStore.hasPermission('hazards.write'); }
  protected canDelete() { return this.authStore.hasPermission('admin.delete'); }
  protected t(key: string, params?: Record<string, unknown>) { return this.i18n.t(key, params); }
  protected personName(user: UserSummary) { return `${user.firstName} ${user.lastName}`.trim(); }
  protected readInputValue(event: Event) { return (event.target as HTMLInputElement).value; }
  protected readSelectValue(event: Event) { return (event.target as HTMLSelectElement).value; }
  protected prettyStatus(value?: string | null) { return value ? value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (part) => part.toUpperCase()) : ''; }
  protected hazardStatusLabel(value?: HazardStatus | null) { return value ? this.t(`hazards.status.${value}`) : ''; }
  protected hazardExposureStageLabel(value?: HazardExposureStage | null) { return value ? this.t(`hazards.exposureStage.${value}`) : ''; }
  protected hazardSeverityLabel(value?: HazardSeverity | null) { return value ? this.t(`hazards.severity.${value}`) : ''; }
  protected statusClass(value: HazardStatus) { return value === 'ACTIVE' ? 'success' : value === 'MONITORING' ? 'warn' : 'neutral'; }
  protected severityClass(value: HazardSeverity) { return value === 'HIGH' ? 'danger' : value === 'MEDIUM' ? 'warn' : 'neutral'; }
  protected activeCount() { return this.hazards().filter((item) => item.status === 'ACTIVE').length; }
  protected monitoringCount() { return this.hazards().filter((item) => item.status === 'MONITORING').length; }
  protected highSeverityCount() { return this.hazards().filter((item) => item.severity === 'HIGH').length; }

  protected filteredHazards() {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const ownerId = this.ownerFilter();
    return this.hazards().filter((item) => {
      const matchesTerm =
        !term ||
        (item.referenceNo || '').toLowerCase().includes(term) ||
        item.activity.toLowerCase().includes(term) ||
        item.hazard.toLowerCase().includes(term) ||
        item.potentialHarm.toLowerCase().includes(term);
      const matchesStatus = !status || item.status === status;
      const matchesOwner = !ownerId || item.ownerUserId === ownerId;
      return matchesTerm && matchesStatus && matchesOwner;
    });
  }

  protected pageTitle() {
    return {
      list: this.t('hazards.page.titles.list'),
      create: this.t('hazards.page.titles.create'),
      detail: this.selectedHazard()?.hazard || this.t('hazards.page.titles.detail'),
      edit: this.selectedHazard()?.hazard || this.t('hazards.page.titles.edit')
    }[this.mode()];
  }

  protected pageDescription() {
    return {
      list: this.t('hazards.page.descriptions.list'),
      create: this.t('hazards.page.descriptions.create'),
      detail: this.t('hazards.page.descriptions.detail'),
      edit: this.t('hazards.page.descriptions.edit')
    }[this.mode()];
  }

  protected breadcrumbs() {
    if (this.mode() === 'list') return [{ label: this.t('hazards.page.label') }];
    const base = [{ label: this.t('hazards.page.label'), link: '/hazards' }];
    if (this.mode() === 'create') return [...base, { label: this.t('hazards.breadcrumbs.new') }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedHazard()?.hazard || this.t('hazards.breadcrumbs.record'), link: `/hazards/${this.selectedId()}` }, { label: this.t('hazards.breadcrumbs.edit') }];
    return [...base, { label: this.selectedHazard()?.hazard || this.t('hazards.breadcrumbs.record') }];
  }

  protected hazardGuidance() {
    const raw = this.form.getRawValue();
    if (raw.activity && raw.hazard && raw.potentialHarm && raw.ownerUserId) {
      return this.t('hazards.guidance.structured');
    }
    return this.t('hazards.guidance.default');
  }

  protected reviewNarrative() {
    const hazard = this.selectedHazard();
    if (!hazard) return this.t('hazards.review.noRecord');
    if (!hazard.links?.length) return this.t('hazards.review.unlinked');
    if (!this.linkCountByType('PROCESS') || !this.linkCountByType('INCIDENT')) return this.t('hazards.review.partial');
    return this.t('hazards.review.strong');
  }
  protected nextStepHeadline() {
    const hazard = this.selectedHazard();
    if (!hazard) return this.t('hazards.nextSteps.headline.default');
    if (!this.linkCountByType('RISK')) return this.t('hazards.nextSteps.headline.risk');
    if (!this.linkCountByType('ACTION') && hazard.severity === 'HIGH') return this.t('hazards.nextSteps.headline.action');
    if (!this.linkCountByType('PROCESS') || !this.linkCountByType('INCIDENT')) return this.t('hazards.nextSteps.headline.traceability');
    return this.t('hazards.nextSteps.headline.ready');
  }
  protected nextStepNarrative() {
    const hazard = this.selectedHazard();
    if (!hazard) return this.t('hazards.nextSteps.copy.default');
    if (!this.linkCountByType('RISK')) {
      return this.t('hazards.nextSteps.copy.risk');
    }
    if (!this.linkCountByType('ACTION') && hazard.severity === 'HIGH') {
      return this.t('hazards.nextSteps.copy.action');
    }
    if (!this.linkCountByType('PROCESS') || !this.linkCountByType('INCIDENT')) {
      return this.t('hazards.nextSteps.copy.traceability');
    }
    return this.t('hazards.nextSteps.copy.ready');
  }
  protected hazardDraftTitle() {
    const hazard = this.selectedHazard();
    if (!hazard) return null;
    return this.t('hazards.messages.actionDraftTitle', { title: hazard.hazard });
  }
  protected hazardDraftDescription() {
    const hazard = this.selectedHazard();
    if (!hazard) return null;
    const lines = [
      hazard.existingControls?.trim(),
      this.t('hazards.messages.potentialHarmLine', { value: hazard.potentialHarm }),
      !this.linkCountByType('RISK') ? this.t('hazards.messages.riskLinkNeeded') : ''
    ].filter(Boolean);
    return lines.join('\n\n');
  }
  protected hazardReturnNavigation(): ReturnNavigation | null {
    const id = this.selectedId();
    return id ? { route: ['/hazards', id], label: this.t('hazards.page.label') } : null;
  }

  protected sectionTitle(type: LinkType) { return this.t(`hazards.links.sections.${type}.title`); }
  protected sectionDescription(type: LinkType) {
    return this.t(`hazards.links.sections.${type}.copy`);
  }
  protected sectionEmptyCopy(type: LinkType) {
    return this.t(`hazards.links.sections.${type}.empty`);
  }
  protected sectionPickerLabel(type: LinkType) { return this.t(`hazards.links.types.${type}`); }
  protected linksByType(type: LinkType) { return (this.selectedHazard()?.links || []).filter((link) => link.linkType === type); }
  protected linkCountByType(type: LinkType) { return this.linksByType(type).length; }
  protected linkRoute(link: HazardLink) { return link.path || '/hazards'; }
  protected linkQueryParams(link: HazardLink) { return link.linkType === 'ACTION' ? { focusActionId: link.linkedId } : undefined; }
  protected linkState(link: HazardLink) {
    return link.linkType === 'ACTION'
      ? { returnNavigation: { route: ['/hazards', this.selectedId()], label: this.t('hazards.page.label') } }
      : undefined;
  }

  protected canOpenLink(link: HazardLink) {
    if (!link.path || link.missing) return false;
    const moduleKey = this.linkPackageModule(link);
    return !moduleKey || this.authStore.hasModule(moduleKey);
  }

  protected inaccessibleLinkSummary(link: HazardLink) {
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
    if (!this.canWrite()) return this.error.set(this.t('hazards.messages.noPermissionWrite'));
    if (this.form.invalid) return this.error.set(this.t('hazards.messages.completeRequired'));
    this.saving.set(true);
    this.error.set('');
    const request = this.selectedId()
      ? this.api.patch<HazardRow>(`hazards/${this.selectedId()}`, this.form.getRawValue())
      : this.api.post<HazardRow>('hazards', this.form.getRawValue());
    request.subscribe({
      next: (hazard) => {
        this.saving.set(false);
        this.router.navigate(['/hazards', hazard.id], { state: { notice: this.t('hazards.messages.saved') } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, this.t('hazards.messages.saveFailed')));
      }
    });
  }

  protected archiveHazard() {
    if (!this.selectedHazard() || !this.canDelete() || !window.confirm(this.t('hazards.messages.archiveConfirm', { title: this.selectedHazard()?.hazard }))) return;
    this.api.delete<{ success: boolean }>(`hazards/${this.selectedId()}`).subscribe({
      next: () => this.router.navigate(['/hazards'], { state: { notice: this.t('hazards.messages.archived') } }),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, this.t('hazards.messages.archiveFailed')))
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
    this.api.post<HazardLink>(`hazards/${this.selectedId()}/links`, this.linkForm.getRawValue()).subscribe({
      next: () => {
        this.linkSaving.set(false);
        this.linkForm.patchValue({ linkedId: '', note: '' });
        this.activeLinkComposerType.set(null);
        this.fetchHazard(this.selectedId()!);
        this.message.set(this.t('hazards.messages.linkAdded'));
      },
      error: (error: HttpErrorResponse) => {
        this.linkSaving.set(false);
        this.error.set(this.readError(error, this.t('hazards.messages.linkFailed')));
      }
    });
  }

  protected removeLink(linkId: string) {
    if (!this.selectedId() || !this.canWrite()) return;
    this.api.delete<{ success: boolean }>(`hazards/${this.selectedId()}/links/${linkId}`).subscribe({
      next: () => {
        this.fetchHazard(this.selectedId()!);
        this.message.set(this.t('hazards.messages.linkRemoved'));
      },
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, this.t('hazards.messages.linkRemoveFailed')))
    });
  }

  private handleRoute(params: ParamMap) {
    const id = params.get('id');
    this.selectedId.set(id);
    this.message.set((history.state?.notice as string) || '');
    this.error.set('');
    if (this.mode() === 'list') {
      this.selectedHazard.set(null);
      this.resetForms();
      return this.reloadHazards();
    }
    if (this.mode() === 'create') {
      this.selectedHazard.set(null);
      return this.resetForms();
    }
    if (id) this.fetchHazard(id);
  }

  private resetForms() {
    this.form.reset({
      referenceNo: '',
      activity: '',
      hazard: '',
      potentialHarm: '',
      exposureStage: 'ROUTINE',
      existingControls: '',
      severity: 'MEDIUM',
      ownerUserId: '',
      reviewDate: '',
      status: 'ACTIVE'
    });
    this.closeLinkComposer();
  }

  private reloadHazards() {
    this.loading.set(true);
    this.api.get<HazardRow[]>('hazards').subscribe({
      next: (items) => {
        this.loading.set(false);
        this.hazards.set(items);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, this.t('hazards.messages.loadListFailed')));
      }
    });
  }

  private fetchHazard(id: string) {
    this.loading.set(true);
    this.api.get<HazardRow>(`hazards/${id}`).subscribe({
      next: (hazard) => {
        this.loading.set(false);
        this.selectedHazard.set(hazard);
        this.form.reset({
          referenceNo: hazard.referenceNo || '',
          activity: hazard.activity,
          hazard: hazard.hazard,
          potentialHarm: hazard.potentialHarm,
          exposureStage: hazard.exposureStage,
          existingControls: hazard.existingControls || '',
          severity: hazard.severity,
          ownerUserId: hazard.ownerUserId || '',
          reviewDate: hazard.reviewDate ? hazard.reviewDate.slice(0, 10) : '',
          status: hazard.status
        });
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, this.t('hazards.messages.loadDetailsFailed')));
      }
    });
  }

  private loadOwners() {
    this.api.get<UserSummary[]>('users').subscribe({
      next: (users) => this.owners.set(users),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, this.t('hazards.messages.loadOwnersFailed')))
    });
  }

  private loadLinkCandidates(type: LinkType) {
    const path = { PROCESS: 'process-register', RISK: 'risks', ACTION: 'action-items', INCIDENT: 'incidents' }[type];
    this.api.get<any[]>(path).subscribe({
      next: (items) => this.linkCandidates.set(items.map((item) => ({ id: item.id, label: this.toCandidateLabel(type, item) }))),
      error: () => this.linkCandidates.set([])
    });
  }

  private toCandidateLabel(type: LinkType, item: any) {
    if (type === 'PROCESS') return `${item.referenceNo || this.t('hazards.common.uncoded')} - ${item.name}`;
    if (type === 'RISK') return item.title;
    if (type === 'INCIDENT') return `${item.referenceNo || this.t('hazards.common.uncoded')} - ${item.title}`;
    return item.title;
  }

  private linkPackageModule(link: HazardLink): PackageModuleKey | null {
    const mapping: Record<LinkType, PackageModuleKey> = {
      PROCESS: 'process-register',
      RISK: 'risks',
      ACTION: 'actions',
      INCIDENT: 'incidents'
    };
    return mapping[link.linkType] ?? null;
  }

  private linkModuleLabel(linkType: LinkType) {
    return {
      PROCESS: this.t('shell.nav.processRegister.label'),
      RISK: this.t('shell.nav.risks.label'),
      ACTION: this.t('shell.nav.actions.label'),
      INCIDENT: this.t('shell.nav.incidents.label')
    }[linkType];
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}

@Component({ standalone: true, imports: [HazardsPageComponent], template: `<iso-hazards-page [forcedMode]="'list'" />` })
export class HazardsListPageComponent {}

@Component({ standalone: true, imports: [HazardsPageComponent], template: `<iso-hazards-page [forcedMode]="'create'" />` })
export class HazardsCreatePageComponent {}

@Component({ standalone: true, imports: [HazardsPageComponent], template: `<iso-hazards-page [forcedMode]="'detail'" />` })
export class HazardsDetailPageComponent {}

@Component({ standalone: true, imports: [HazardsPageComponent], template: `<iso-hazards-page [forcedMode]="'edit'" />` })
export class HazardsEditPageComponent {}
