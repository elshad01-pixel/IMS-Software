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
type AspectStatus = 'ACTIVE' | 'MONITORING' | 'OBSOLETE';
type AspectStage = 'NORMAL_OPERATION' | 'ABNORMAL_OPERATION' | 'EMERGENCY';
type AspectSignificance = 'LOW' | 'MEDIUM' | 'HIGH';
type LinkType = 'PROCESS' | 'RISK' | 'ACTION';
type ReturnNavigation = { route: string[]; label: string };

type UserSummary = { id: string; firstName: string; lastName: string; email: string };
type LinkCandidate = { id: string; label: string };

type AspectLink = {
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

type AspectRow = {
  id: string;
  referenceNo?: string | null;
  activity: string;
  aspect: string;
  impact: string;
  lifecycleStage: AspectStage;
  controlSummary?: string | null;
  significance: AspectSignificance;
  ownerUserId?: string | null;
  reviewDate?: string | null;
  status: AspectStatus;
  createdAt: string;
  updatedAt: string;
  owner?: UserSummary | null;
  linkCount?: number;
  links?: AspectLink[];
};

@Component({
  selector: 'iso-environmental-aspects-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, RecordWorkItemsComponent],
  templateUrl: './environmental-aspects-page.component.html',
  styleUrl: './environmental-aspects-page.component.css'
})
export class EnvironmentalAspectsPageComponent implements OnInit, OnChanges {
  @Input() forcedMode?: PageMode;

  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
  protected readonly aspects = signal<AspectRow[]>([]);
  protected readonly owners = signal<UserSummary[]>([]);
  protected readonly selectedAspect = signal<AspectRow | null>(null);
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
  protected readonly visibleLinkTypes: LinkType[] = ['PROCESS', 'RISK', 'ACTION'];

  protected readonly form = this.fb.nonNullable.group({
    referenceNo: ['', [Validators.maxLength(40)]],
    activity: ['', [Validators.required, Validators.maxLength(180)]],
    aspect: ['', [Validators.required, Validators.maxLength(180)]],
    impact: ['', [Validators.required, Validators.maxLength(2000)]],
    lifecycleStage: ['NORMAL_OPERATION' as AspectStage, [Validators.required]],
    controlSummary: ['', [Validators.maxLength(2000)]],
    significance: ['MEDIUM' as AspectSignificance, [Validators.required]],
    ownerUserId: [''],
    reviewDate: [''],
    status: ['ACTIVE' as AspectStatus]
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

  protected canWrite() { return this.authStore.hasPermission('aspects.write'); }
  protected canDelete() { return this.authStore.hasPermission('admin.delete'); }
  protected t(key: string, params?: Record<string, unknown>) { return this.i18n.t(key, params); }
  protected personName(user: UserSummary) { return `${user.firstName} ${user.lastName}`.trim(); }
  protected readInputValue(event: Event) { return (event.target as HTMLInputElement).value; }
  protected readSelectValue(event: Event) { return (event.target as HTMLSelectElement).value; }
  protected prettyStatus(value?: string | null) { return value ? value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (part) => part.toUpperCase()) : ''; }
  protected aspectStatusLabel(value?: AspectStatus | null) { return value ? this.t(`environmentalAspects.status.${value}`) : ''; }
  protected aspectStageLabel(value?: AspectStage | null) { return value ? this.t(`environmentalAspects.lifecycleStage.${value}`) : ''; }
  protected aspectSignificanceLabel(value?: AspectSignificance | null) { return value ? this.t(`environmentalAspects.significance.${value}`) : ''; }
  protected statusClass(value: AspectStatus) { return value === 'ACTIVE' ? 'success' : value === 'MONITORING' ? 'warn' : 'neutral'; }
  protected significanceClass(value: AspectSignificance) { return value === 'HIGH' ? 'danger' : value === 'MEDIUM' ? 'warn' : 'neutral'; }
  protected activeCount() { return this.aspects().filter((item) => item.status === 'ACTIVE').length; }
  protected monitoringCount() { return this.aspects().filter((item) => item.status === 'MONITORING').length; }
  protected highSignificanceCount() { return this.aspects().filter((item) => item.significance === 'HIGH').length; }

  protected filteredAspects() {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const ownerId = this.ownerFilter();
    return this.aspects().filter((item) => {
      const matchesTerm =
        !term ||
        (item.referenceNo || '').toLowerCase().includes(term) ||
        item.activity.toLowerCase().includes(term) ||
        item.aspect.toLowerCase().includes(term) ||
        item.impact.toLowerCase().includes(term);
      const matchesStatus = !status || item.status === status;
      const matchesOwner = !ownerId || item.ownerUserId === ownerId;
      return matchesTerm && matchesStatus && matchesOwner;
    });
  }

  protected pageTitle() {
    return {
      list: this.t('environmentalAspects.page.titles.list'),
      create: this.t('environmentalAspects.page.titles.create'),
      detail: this.selectedAspect()?.aspect || this.t('environmentalAspects.page.titles.detail'),
      edit: this.selectedAspect()?.aspect || this.t('environmentalAspects.page.titles.edit')
    }[this.mode()];
  }

  protected pageDescription() {
    return {
      list: this.t('environmentalAspects.page.descriptions.list'),
      create: this.t('environmentalAspects.page.descriptions.create'),
      detail: this.t('environmentalAspects.page.descriptions.detail'),
      edit: this.t('environmentalAspects.page.descriptions.edit')
    }[this.mode()];
  }

  protected breadcrumbs() {
    if (this.mode() === 'list') return [{ label: this.t('environmentalAspects.page.label') }];
    const base = [{ label: this.t('environmentalAspects.page.label'), link: '/environmental-aspects' }];
    if (this.mode() === 'create') return [...base, { label: this.t('environmentalAspects.breadcrumbs.new') }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedAspect()?.aspect || this.t('environmentalAspects.breadcrumbs.record'), link: `/environmental-aspects/${this.selectedId()}` }, { label: this.t('environmentalAspects.breadcrumbs.edit') }];
    return [...base, { label: this.selectedAspect()?.aspect || this.t('environmentalAspects.breadcrumbs.record') }];
  }

  protected aspectGuidance() {
    const raw = this.form.getRawValue();
    if (raw.activity && raw.aspect && raw.impact && raw.ownerUserId) {
      return this.t('environmentalAspects.guidance.structured');
    }
    return this.t('environmentalAspects.guidance.default');
  }

  protected reviewNarrative() {
    const aspect = this.selectedAspect();
    if (!aspect) return this.t('environmentalAspects.review.noRecord');
    if (!aspect.links?.length) return this.t('environmentalAspects.review.unlinked');
    if (!this.linkCountByType('PROCESS') || !this.linkCountByType('RISK')) return this.t('environmentalAspects.review.partial');
    return this.t('environmentalAspects.review.strong');
  }
  protected nextStepHeadline() {
    const aspect = this.selectedAspect();
    if (!aspect) return this.t('environmentalAspects.nextSteps.headline.default');
    if (!this.linkCountByType('PROCESS')) return this.t('environmentalAspects.nextSteps.headline.process');
    if (!this.linkCountByType('RISK') && aspect.significance === 'HIGH') return this.t('environmentalAspects.nextSteps.headline.risk');
    if (!this.linkCountByType('ACTION') && aspect.status !== 'OBSOLETE') return this.t('environmentalAspects.nextSteps.headline.action');
    return this.t('environmentalAspects.nextSteps.headline.ready');
  }
  protected nextStepNarrative() {
    const aspect = this.selectedAspect();
    if (!aspect) return this.t('environmentalAspects.nextSteps.copy.default');
    if (!this.linkCountByType('PROCESS')) {
      return this.t('environmentalAspects.nextSteps.copy.process');
    }
    if (!this.linkCountByType('RISK') && aspect.significance === 'HIGH') {
      return this.t('environmentalAspects.nextSteps.copy.risk');
    }
    if (!this.linkCountByType('ACTION') && aspect.status !== 'OBSOLETE') {
      return this.t('environmentalAspects.nextSteps.copy.action');
    }
    return this.t('environmentalAspects.nextSteps.copy.ready');
  }
  protected aspectDraftTitle() {
    const aspect = this.selectedAspect();
    if (!aspect) return null;
    return this.t('environmentalAspects.messages.actionDraftTitle', { title: aspect.aspect });
  }
  protected aspectDraftDescription() {
    const aspect = this.selectedAspect();
    if (!aspect) return null;
    const lines = [
      aspect.controlSummary?.trim(),
      this.t('environmentalAspects.messages.impactLine', { value: aspect.impact }),
      !this.linkCountByType('RISK') && aspect.significance === 'HIGH' ? this.t('environmentalAspects.messages.riskLinkNeeded') : ''
    ].filter(Boolean);
    return lines.join('\n\n');
  }
  protected aspectReturnNavigation(): ReturnNavigation | null {
    const id = this.selectedId();
    return id ? { route: ['/environmental-aspects', id], label: this.t('environmentalAspects.page.label') } : null;
  }

  protected sectionTitle(type: LinkType) { return this.t(`environmentalAspects.links.sections.${type}.title`); }
  protected sectionDescription(type: LinkType) { return this.t(`environmentalAspects.links.sections.${type}.copy`); }
  protected sectionEmptyCopy(type: LinkType) { return this.t(`environmentalAspects.links.sections.${type}.empty`); }
  protected sectionPickerLabel(type: LinkType) { return this.t(`environmentalAspects.links.types.${type}`); }
  protected linksByType(type: LinkType) { return (this.selectedAspect()?.links || []).filter((link) => link.linkType === type); }
  protected linkCountByType(type: LinkType) { return this.linksByType(type).length; }
  protected linkRoute(link: AspectLink) { return link.path || '/environmental-aspects'; }
  protected linkQueryParams(link: AspectLink) { return link.linkType === 'ACTION' ? { focusActionId: link.linkedId } : undefined; }
  protected linkState(link: AspectLink) { return link.linkType === 'ACTION' ? { returnNavigation: { route: ['/environmental-aspects', this.selectedId()], label: 'environmental aspect' } } : undefined; }
  protected canOpenLink(link: AspectLink) {
    if (!link.path || link.missing) return false;
    const moduleKey = this.linkPackageModule(link);
    return !moduleKey || this.authStore.hasModule(moduleKey);
  }
  protected inaccessibleLinkSummary(link: AspectLink) {
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
    if (!this.canWrite()) return this.error.set(this.t('environmentalAspects.messages.noPermissionWrite'));
    if (this.form.invalid) return this.error.set(this.t('environmentalAspects.messages.completeRequired'));
    this.saving.set(true);
    this.error.set('');
    const request = this.selectedId()
      ? this.api.patch<AspectRow>(`environmental-aspects/${this.selectedId()}`, this.form.getRawValue())
      : this.api.post<AspectRow>('environmental-aspects', this.form.getRawValue());
    request.subscribe({
      next: (aspect) => {
        this.saving.set(false);
        this.router.navigate(['/environmental-aspects', aspect.id], { state: { notice: this.t('environmentalAspects.messages.saved') } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, this.t('environmentalAspects.messages.saveFailed')));
      }
    });
  }

  protected archiveAspect() {
    if (!this.selectedAspect() || !this.canDelete() || !window.confirm(this.t('environmentalAspects.messages.archiveConfirm', { title: this.selectedAspect()?.aspect }))) return;
    this.api.delete<{ success: boolean }>(`environmental-aspects/${this.selectedId()}`).subscribe({
      next: () => this.router.navigate(['/environmental-aspects'], { state: { notice: this.t('environmentalAspects.messages.archived') } }),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, this.t('environmentalAspects.messages.archiveFailed')))
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
    this.api.post<AspectLink>(`environmental-aspects/${this.selectedId()}/links`, this.linkForm.getRawValue()).subscribe({
      next: () => {
        this.linkSaving.set(false);
        this.linkForm.patchValue({ linkedId: '', note: '' });
        this.activeLinkComposerType.set(null);
        this.fetchAspect(this.selectedId()!);
        this.message.set(this.t('environmentalAspects.messages.linkAdded'));
      },
      error: (error: HttpErrorResponse) => {
        this.linkSaving.set(false);
        this.error.set(this.readError(error, this.t('environmentalAspects.messages.linkFailed')));
      }
    });
  }

  protected removeLink(linkId: string) {
    if (!this.selectedId() || !this.canWrite()) return;
    this.api.delete<{ success: boolean }>(`environmental-aspects/${this.selectedId()}/links/${linkId}`).subscribe({
      next: () => {
        this.fetchAspect(this.selectedId()!);
        this.message.set(this.t('environmentalAspects.messages.linkRemoved'));
      },
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, this.t('environmentalAspects.messages.linkRemoveFailed')))
    });
  }

  private handleRoute(params: ParamMap) {
    const id = params.get('id');
    this.selectedId.set(id);
    this.message.set((history.state?.notice as string) || '');
    this.error.set('');
    if (this.mode() === 'list') {
      this.selectedAspect.set(null);
      this.resetForms();
      return this.reloadAspects();
    }
    if (this.mode() === 'create') {
      this.selectedAspect.set(null);
      return this.resetForms();
    }
    if (id) this.fetchAspect(id);
  }

  private resetForms() {
    this.form.reset({
      referenceNo: '',
      activity: '',
      aspect: '',
      impact: '',
      lifecycleStage: 'NORMAL_OPERATION',
      controlSummary: '',
      significance: 'MEDIUM',
      ownerUserId: '',
      reviewDate: '',
      status: 'ACTIVE'
    });
    this.closeLinkComposer();
  }

  private reloadAspects() {
    this.loading.set(true);
    this.api.get<AspectRow[]>('environmental-aspects').subscribe({
      next: (items) => {
        this.loading.set(false);
        this.aspects.set(items);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, this.t('environmentalAspects.messages.loadListFailed')));
      }
    });
  }

  private fetchAspect(id: string) {
    this.loading.set(true);
    this.api.get<AspectRow>(`environmental-aspects/${id}`).subscribe({
      next: (aspect) => {
        this.loading.set(false);
        this.selectedAspect.set(aspect);
        this.form.reset({
          referenceNo: aspect.referenceNo || '',
          activity: aspect.activity,
          aspect: aspect.aspect,
          impact: aspect.impact,
          lifecycleStage: aspect.lifecycleStage,
          controlSummary: aspect.controlSummary || '',
          significance: aspect.significance,
          ownerUserId: aspect.ownerUserId || '',
          reviewDate: aspect.reviewDate ? aspect.reviewDate.slice(0, 10) : '',
          status: aspect.status
        });
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, this.t('environmentalAspects.messages.loadDetailsFailed')));
      }
    });
  }

  private loadOwners() {
    this.api.get<UserSummary[]>('users').subscribe({
      next: (users) => this.owners.set(users),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, this.t('environmentalAspects.messages.loadOwnersFailed')))
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
    if (type === 'PROCESS') return `${item.referenceNo || this.t('environmentalAspects.common.uncoded')} - ${item.name}`;
    if (type === 'RISK') return item.title;
    return item.title;
  }

  private linkPackageModule(link: AspectLink): PackageModuleKey | null {
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
}

@Component({ standalone: true, imports: [EnvironmentalAspectsPageComponent], template: `<iso-environmental-aspects-page [forcedMode]="'list'" />` })
export class EnvironmentalAspectsListPageComponent {}

@Component({ standalone: true, imports: [EnvironmentalAspectsPageComponent], template: `<iso-environmental-aspects-page [forcedMode]="'create'" />` })
export class EnvironmentalAspectsCreatePageComponent {}

@Component({ standalone: true, imports: [EnvironmentalAspectsPageComponent], template: `<iso-environmental-aspects-page [forcedMode]="'detail'" />` })
export class EnvironmentalAspectsDetailPageComponent {}

@Component({ standalone: true, imports: [EnvironmentalAspectsPageComponent], template: `<iso-environmental-aspects-page [forcedMode]="'edit'" />` })
export class EnvironmentalAspectsEditPageComponent {}
