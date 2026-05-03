import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
import { I18nService } from '../core/i18n.service';
import { PackageModuleKey, TenantPackageTier, TenantScope, minimumPackageTierForModule } from '../core/package-entitlements';
import { PageHeaderComponent } from '../shared/page-header.component';
import { RecordWorkItemsComponent } from '../shared/record-work-items.component';

type PageMode = 'list' | 'create' | 'detail' | 'edit';
type ObligationStatus = 'ACTIVE' | 'UNDER_REVIEW' | 'OBSOLETE';
type LinkType = 'PROCESS' | 'RISK' | 'AUDIT' | 'ACTION';
type ReturnNavigation = { route: string[]; label: string };

type UserSummary = { id: string; firstName: string; lastName: string; email: string };
type LinkCandidate = { id: string; label: string };

type ObligationLink = {
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

type ObligationRow = {
  id: string;
  referenceNo?: string | null;
  title: string;
  sourceName: string;
  obligationType?: string | null;
  jurisdiction?: string | null;
  description?: string | null;
  ownerUserId?: string | null;
  reviewFrequencyMonths?: number | null;
  nextReviewDate?: string | null;
  status: ObligationStatus;
  createdAt: string;
  updatedAt: string;
  owner?: UserSummary | null;
  linkCount?: number;
  links?: ObligationLink[];
};

@Component({
  selector: 'iso-compliance-obligations-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, RecordWorkItemsComponent],
  templateUrl: './compliance-obligations-page.component.html',
  styleUrl: './compliance-obligations-page.component.css'
})
export class ComplianceObligationsPageComponent implements OnInit, OnChanges {
  @Input() forcedMode?: PageMode;

  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
  protected readonly obligations = signal<ObligationRow[]>([]);
  protected readonly owners = signal<UserSummary[]>([]);
  protected readonly selectedObligation = signal<ObligationRow | null>(null);
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
  protected readonly visibleLinkTypes: LinkType[] = ['PROCESS', 'RISK', 'AUDIT', 'ACTION'];

  protected readonly form = this.fb.nonNullable.group({
    referenceNo: ['', [Validators.maxLength(40)]],
    title: ['', [Validators.required, Validators.maxLength(180)]],
    sourceName: ['', [Validators.required, Validators.maxLength(180)]],
    obligationType: ['', [Validators.maxLength(80)]],
    jurisdiction: ['', [Validators.maxLength(80)]],
    description: ['', [Validators.maxLength(2000)]],
    ownerUserId: [''],
    reviewFrequencyMonths: [null as number | null],
    nextReviewDate: [''],
    status: ['ACTIVE' as ObligationStatus]
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
    return this.authStore.hasPermission('obligations.write');
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

  protected obligationStatusLabel(value?: ObligationStatus | null) {
    if (!value) {
      return '';
    }
    return this.t(`complianceObligations.status.${value}`);
  }

  protected statusClass(value: ObligationStatus) {
    return value === 'ACTIVE' ? 'success' : value === 'UNDER_REVIEW' ? 'warn' : 'neutral';
  }

  protected activeCount() {
    return this.obligations().filter((item) => item.status === 'ACTIVE').length;
  }

  protected reviewCount() {
    return this.obligations().filter((item) => item.status === 'UNDER_REVIEW').length;
  }

  protected attentionCount() {
    return this.obligations().filter((item) => this.obligationAttentionReasons(item).length > 0).length;
  }

  protected filteredObligations() {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const ownerId = this.ownerFilter();
    return this.obligations().filter((item) => {
      const matchesTerm =
        !term ||
        (item.referenceNo || '').toLowerCase().includes(term) ||
        item.title.toLowerCase().includes(term) ||
        item.sourceName.toLowerCase().includes(term) ||
        (item.obligationType || '').toLowerCase().includes(term);
      const matchesStatus = !status || item.status === status;
      const matchesOwner = !ownerId || item.ownerUserId === ownerId;
      return matchesTerm && matchesStatus && matchesOwner;
    });
  }

  protected pageTitle() {
    const label = this.pageLabel();
    return {
      list: label,
      create: this.t('complianceObligations.page.titles.create'),
      detail: this.selectedObligation()?.title || this.t('complianceObligations.page.titles.detail'),
      edit: this.selectedObligation()?.title || this.t('complianceObligations.page.titles.edit')
    }[this.mode()];
  }

  protected pageLabel() {
    return this.scopeText({
      QMS: { en: 'Requirements & obligations', az: 'Tələblər və öhdəliklər', ru: 'Требования и обязательства' },
      EMS: { en: 'Environmental obligations', az: 'Ekoloji öhdəliklər', ru: 'Экологические обязательства' },
      OHSMS: { en: 'OH&S obligations', az: 'Əməyin mühafizəsi öhdəlikləri', ru: 'Обязательства по ОТиЗ' },
      IMS: { en: this.t('complianceObligations.page.label'), az: this.t('complianceObligations.page.label'), ru: this.t('complianceObligations.page.label') },
      FSMS: { en: 'Food safety obligations', az: 'Qida təhlükəsizliyi öhdəlikləri', ru: 'Обязательства по пищевой безопасности' }
    });
  }

  protected pageDescription() {
    if (this.mode() === 'list') {
      return this.scopeText({
        QMS: {
          en: 'Track quality-related legal, customer, and external obligations in one controlled register.',
          az: 'Keyfiyyətlə bağlı hüquqi, müştəri və xarici öhdəlikləri bir idarə olunan reyestrdə izləyin.',
          ru: 'Отслеживайте связанные с качеством правовые, клиентские и внешние обязательства в одном контролируемом реестре.'
        },
        EMS: {
          en: 'Track environmental legal and other compliance obligations in one controlled register.',
          az: 'Ekoloji hüquqi və digər uyğunluq öhdəliklərini bir idarə olunan reyestrdə izləyin.',
          ru: 'Отслеживайте экологические правовые и иные обязательства по соблюдению в одном контролируемом реестре.'
        },
        OHSMS: {
          en: 'Track OH&S legal and other compliance obligations in one controlled register.',
          az: 'Əməyin mühafizəsi üzrə hüquqi və digər uyğunluq öhdəliklərini bir idarə olunan reyestrdə izləyin.',
          ru: 'Отслеживайте обязательства по охране труда и иные требования соблюдения в одном контролируемом реестре.'
        },
        IMS: {
          en: this.t('complianceObligations.page.descriptions.list'),
          az: this.t('complianceObligations.page.descriptions.list'),
          ru: this.t('complianceObligations.page.descriptions.list')
        },
        FSMS: {
          en: 'Track food safety legal, customer, and regulatory obligations in one controlled register.',
          az: 'Qida təhlükəsizliyi üzrə hüquqi, müştəri və tənzimləyici öhdəlikləri bir idarə olunan reyestrdə izləyin.',
          ru: 'Отслеживайте правовые, клиентские и регуляторные обязательства по пищевой безопасности в одном контролируемом реестре.'
        }
      });
    }

    if (this.mode() === 'create') {
      return this.t('complianceObligations.page.descriptions.create');
    }
    if (this.mode() === 'detail') {
      return this.t('complianceObligations.page.descriptions.detail');
    }
    return this.t('complianceObligations.page.descriptions.edit');
  }

  protected breadcrumbs() {
    const label = this.pageLabel();
    if (this.mode() === 'list') return [{ label }];
    const base = [{ label, link: '/compliance-obligations' }];
    if (this.mode() === 'create') return [...base, { label: this.t('complianceObligations.breadcrumbs.new') }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedObligation()?.title || this.t('complianceObligations.breadcrumbs.record'), link: `/compliance-obligations/${this.selectedId()}` }, { label: this.t('complianceObligations.breadcrumbs.edit') }];
    return [...base, { label: this.selectedObligation()?.title || this.t('complianceObligations.breadcrumbs.record') }];
  }

  protected listTitle() {
    return this.scopeText({
      QMS: { en: 'Requirement filters', az: 'Tələb filtrləri', ru: 'Фильтры требований' },
      EMS: { en: 'Environmental obligation filters', az: 'Ekoloji öhdəlik filtrləri', ru: 'Фильтры экологических обязательств' },
      OHSMS: { en: 'OH&S obligation filters', az: 'Əməyin mühafizəsi öhdəlik filtrləri', ru: 'Фильтры обязательств по ОТиЗ' },
      IMS: { en: this.t('complianceObligations.list.filtersTitle'), az: this.t('complianceObligations.list.filtersTitle'), ru: this.t('complianceObligations.list.filtersTitle') },
      FSMS: { en: 'Food safety obligation filters', az: 'Qida təhlükəsizliyi öhdəlik filtrləri', ru: 'Фильтры обязательств по пищевой безопасности' }
    });
  }

  protected listCopy() {
    return this.scopeText({
      QMS: {
        en: 'Review quality-related obligations, review dates, and follow-up in one calm register.',
        az: 'Keyfiyyətlə bağlı öhdəlikləri, baxış tarixlərini və sonrakı tədbirləri bir sakit reyestrdə izləyin.',
        ru: 'Просматривайте связанные с качеством обязательства, даты пересмотра и последующие действия в одном реестре.'
      },
      EMS: {
        en: 'Review environmental obligations, review dates, and follow-up in one calm register.',
        az: 'Ekoloji öhdəlikləri, baxış tarixlərini və sonrakı tədbirləri bir sakit reyestrdə izləyin.',
        ru: 'Просматривайте экологические обязательства, даты пересмотра и последующие действия в одном реестре.'
      },
      OHSMS: {
        en: 'Review OH&S obligations, review dates, and follow-up in one calm register.',
        az: 'Əməyin mühafizəsi öhdəliklərini, baxış tarixlərini və sonrakı tədbirləri bir sakit reyestrdə izləyin.',
        ru: 'Просматривайте обязательства по ОТиЗ, даты пересмотра и последующие действия в одном реестре.'
      },
      IMS: {
        en: this.t('complianceObligations.list.copy'),
        az: this.t('complianceObligations.list.copy'),
        ru: this.t('complianceObligations.list.copy')
      },
      FSMS: {
        en: 'Review food safety obligations, review dates, and follow-up in one calm register.',
        az: 'Qida təhlükəsizliyi öhdəliklərini, baxış tarixlərini və sonrakı tədbirləri bir sakit reyestrdə izləyin.',
        ru: 'Просматривайте обязательства по пищевой безопасности, даты пересмотра и последующие действия в одном реестре.'
      }
    });
  }

  protected obligationGuidance() {
    const raw = this.form.getRawValue();
    if (raw.sourceName && raw.ownerUserId && raw.nextReviewDate) {
      return this.t('complianceObligations.form.guidance.structured');
    }
    return this.t('complianceObligations.form.guidance.default');
  }

  protected reviewNarrative() {
    const obligation = this.selectedObligation();
    if (!obligation) return this.t('complianceObligations.review.noRecord');
    if (!obligation.links?.length) return this.t('complianceObligations.review.unlinked');
    if (!this.linkCountByType('PROCESS') || !this.linkCountByType('RISK')) return this.t('complianceObligations.review.partial');
    return this.t('complianceObligations.review.strong');
  }
  protected nextStepHeadline() {
    const obligation = this.selectedObligation();
    if (!obligation) return this.t('complianceObligations.nextSteps.headline.default');
    if (!this.linkCountByType('PROCESS')) return this.t('complianceObligations.nextSteps.headline.process');
    if (!this.linkCountByType('AUDIT')) return this.t('complianceObligations.nextSteps.headline.audit');
    if (!this.linkCountByType('ACTION') && obligation.status !== 'OBSOLETE') return this.t('complianceObligations.nextSteps.headline.action');
    return this.t('complianceObligations.nextSteps.headline.done');
  }
  protected nextStepNarrative() {
    const obligation = this.selectedObligation();
    if (!obligation) return this.t('complianceObligations.nextSteps.copy.default');
    if (!this.linkCountByType('PROCESS')) {
      return this.t('complianceObligations.nextSteps.copy.process');
    }
    if (!this.linkCountByType('AUDIT')) {
      return this.t('complianceObligations.nextSteps.copy.audit');
    }
    if (!this.linkCountByType('ACTION') && obligation.status !== 'OBSOLETE') {
      return this.t('complianceObligations.nextSteps.copy.action');
    }
    return this.t('complianceObligations.nextSteps.copy.done');
  }
  protected obligationDraftTitle() {
    const obligation = this.selectedObligation();
    if (!obligation) return null;
    return this.t('complianceObligations.messages.actionDraftTitle', { title: obligation.title });
  }
  protected obligationDraftDescription() {
    const obligation = this.selectedObligation();
    if (!obligation) return null;
    const lines = [
      obligation.description?.trim(),
      obligation.nextReviewDate ? this.t('complianceObligations.messages.nextReviewDate', { date: obligation.nextReviewDate.slice(0, 10) }) : '',
      !this.linkCountByType('AUDIT') ? this.t('complianceObligations.messages.auditCoverageMissing') : ''
    ].filter(Boolean);
    return lines.join('\n\n');
  }
  protected obligationReturnNavigation(): ReturnNavigation | null {
    const id = this.selectedId();
    return id ? { route: ['/compliance-obligations', id], label: this.t('complianceObligations.page.label') } : null;
  }

  protected sectionTitle(type: LinkType) {
    return this.t(`complianceObligations.links.sections.${type}.title`);
  }

  protected sectionDescription(type: LinkType) {
    return this.t(`complianceObligations.links.sections.${type}.copy`);
  }

  protected sectionEmptyCopy(type: LinkType) {
    return this.t(`complianceObligations.links.sections.${type}.empty`);
  }

  protected sectionPickerLabel(type: LinkType) {
    return this.t(`complianceObligations.links.types.${type}`);
  }

  protected linksByType(type: LinkType) {
    return (this.selectedObligation()?.links || []).filter((link) => link.linkType === type);
  }

  protected linkCountByType(type: LinkType) {
    return this.linksByType(type).length;
  }

  protected linkRoute(link: ObligationLink) {
    return link.path || '/compliance-obligations';
  }

  protected linkQueryParams(link: ObligationLink) {
    return link.linkType === 'ACTION' ? { focusActionId: link.linkedId } : undefined;
  }

  protected linkState(link: ObligationLink) {
    return link.linkType === 'ACTION'
      ? { returnNavigation: { route: ['/compliance-obligations', this.selectedId()], label: this.t('complianceObligations.page.label') } }
      : undefined;
  }

  protected canOpenLink(link: ObligationLink) {
    if (!link.path || link.missing) {
      return false;
    }

    const moduleKey = this.linkPackageModule(link);
    return !moduleKey || this.authStore.hasModule(moduleKey);
  }

  protected inaccessibleLinkSummary(link: ObligationLink) {
    const moduleKey = this.linkPackageModule(link);
    if (!moduleKey || this.authStore.hasModule(moduleKey)) {
      return null;
    }

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

  protected attentionHeadline() {
    const obligation = this.selectedObligation();
    return obligation && this.obligationAttentionReasons(obligation).length
      ? this.t('complianceObligations.attention.headline.needsAttention')
      : this.t('complianceObligations.attention.headline.underControl');
  }

  protected attentionNarrative() {
    const obligation = this.selectedObligation();
    if (!obligation) {
      return this.t('complianceObligations.attention.copy.default');
    }
    const reasons = this.obligationAttentionReasons(obligation);
    if (!reasons.length) {
      return this.t('complianceObligations.attention.copy.underControl');
    }
    return this.t('complianceObligations.attention.copy.needsAttention', { reasons: reasons.map((reason) => reason.toLowerCase()).join(', ') });
  }

  protected attentionSummary(item: ObligationRow) {
    const reasons = this.obligationAttentionReasons(item);
    return reasons.length ? reasons.join(' | ') : '';
  }

  protected attentionLabel(item: ObligationRow) {
    const reasons = this.obligationAttentionReasons(item);
    if (!reasons.length) {
      return this.t('complianceObligations.attention.short.ok');
    }
    return reasons.length > 1 ? `${reasons[0]} +${reasons.length - 1}` : reasons[0];
  }

  protected attentionClass(item: ObligationRow) {
    if (item.status === 'OBSOLETE') {
      return 'success';
    }
    if (item.nextReviewDate && this.isPastDate(item.nextReviewDate)) {
      return 'danger';
    }
    if (this.obligationAttentionReasons(item).length) {
      return 'warn';
    }
    return 'success';
  }

  protected save() {
    if (!this.canWrite()) return this.error.set(this.t('complianceObligations.messages.noPermissionWrite'));
    if (this.form.invalid) return this.error.set(this.t('complianceObligations.messages.completeRequired'));
    this.saving.set(true);
    this.error.set('');
    const request = this.selectedId()
      ? this.api.patch<ObligationRow>(`compliance-obligations/${this.selectedId()}`, this.form.getRawValue())
      : this.api.post<ObligationRow>('compliance-obligations', this.form.getRawValue());
    request.subscribe({
      next: (obligation) => {
        this.saving.set(false);
        this.router.navigate(['/compliance-obligations', obligation.id], { state: { notice: this.t('complianceObligations.messages.saved') } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, this.t('complianceObligations.messages.saveFailed')));
      }
    });
  }

  protected archiveObligation() {
    if (!this.selectedObligation() || !this.canDelete() || !window.confirm(this.t('complianceObligations.messages.archiveConfirm', { title: this.selectedObligation()?.title }))) return;
    this.api.delete<{ success: boolean }>(`compliance-obligations/${this.selectedId()}`).subscribe({
      next: () => this.router.navigate(['/compliance-obligations'], { state: { notice: this.t('complianceObligations.messages.archived') } }),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, this.t('complianceObligations.messages.archiveFailed')))
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
    this.api.post<ObligationLink>(`compliance-obligations/${this.selectedId()}/links`, this.linkForm.getRawValue()).subscribe({
      next: () => {
        this.linkSaving.set(false);
        this.linkForm.patchValue({ linkedId: '', note: '' });
        this.activeLinkComposerType.set(null);
        this.fetchObligation(this.selectedId()!);
        this.message.set(this.t('complianceObligations.messages.linkAdded'));
      },
      error: (error: HttpErrorResponse) => {
        this.linkSaving.set(false);
        this.error.set(this.readError(error, this.t('complianceObligations.messages.linkFailed')));
      }
    });
  }

  protected removeLink(linkId: string) {
    if (!this.selectedId() || !this.canWrite()) return;
    this.api.delete<{ success: boolean }>(`compliance-obligations/${this.selectedId()}/links/${linkId}`).subscribe({
      next: () => {
        this.fetchObligation(this.selectedId()!);
        this.message.set(this.t('complianceObligations.messages.linkRemoved'));
      },
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, this.t('complianceObligations.messages.linkRemoveFailed')))
    });
  }

  private handleRoute(params: ParamMap) {
    const id = params.get('id');
    this.selectedId.set(id);
    this.message.set((history.state?.notice as string) || '');
    this.error.set('');
    if (this.mode() === 'list') {
      this.selectedObligation.set(null);
      this.resetForms();
      return this.reloadObligations();
    }
    if (this.mode() === 'create') {
      this.selectedObligation.set(null);
      return this.resetForms();
    }
    if (id) this.fetchObligation(id);
  }

  private resetForms() {
    this.form.reset({
      referenceNo: '',
      title: '',
      sourceName: '',
      obligationType: '',
      jurisdiction: '',
      description: '',
      ownerUserId: '',
      reviewFrequencyMonths: null,
      nextReviewDate: '',
      status: 'ACTIVE'
    });
    this.closeLinkComposer();
  }

  private reloadObligations() {
    this.loading.set(true);
    this.api.get<ObligationRow[]>('compliance-obligations').subscribe({
      next: (items) => {
        this.loading.set(false);
        this.obligations.set(items);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, this.t('complianceObligations.messages.loadListFailed')));
      }
    });
  }

  private fetchObligation(id: string) {
    this.loading.set(true);
    this.api.get<ObligationRow>(`compliance-obligations/${id}`).subscribe({
      next: (obligation) => {
        this.loading.set(false);
        this.selectedObligation.set(obligation);
        this.form.reset({
          referenceNo: obligation.referenceNo || '',
          title: obligation.title,
          sourceName: obligation.sourceName,
          obligationType: obligation.obligationType || '',
          jurisdiction: obligation.jurisdiction || '',
          description: obligation.description || '',
          ownerUserId: obligation.ownerUserId || '',
          reviewFrequencyMonths: obligation.reviewFrequencyMonths || null,
          nextReviewDate: obligation.nextReviewDate ? obligation.nextReviewDate.slice(0, 10) : '',
          status: obligation.status
        });
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, this.t('complianceObligations.messages.loadDetailsFailed')));
      }
    });
  }

  private loadOwners() {
    this.api.get<UserSummary[]>('users').subscribe({
      next: (users) => this.owners.set(users),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, this.t('complianceObligations.messages.loadOwnersFailed')))
    });
  }

  private loadLinkCandidates(type: LinkType) {
    const path = { PROCESS: 'process-register', RISK: 'risks', AUDIT: 'audits', ACTION: 'action-items' }[type];
    this.api.get<any[]>(path).subscribe({
      next: (items) => this.linkCandidates.set(items.map((item) => ({ id: item.id, label: this.toCandidateLabel(type, item) }))),
      error: () => this.linkCandidates.set([])
    });
  }

  private toCandidateLabel(type: LinkType, item: any) {
    if (type === 'PROCESS') return `${item.referenceNo || this.t('complianceObligations.common.uncoded')} - ${item.name}`;
    if (type === 'RISK') return item.title;
    if (type === 'AUDIT') return `${item.code} - ${item.title}`;
    return item.title;
  }

  private linkPackageModule(link: ObligationLink): PackageModuleKey | null {
    const mapping: Record<LinkType, PackageModuleKey> = {
      PROCESS: 'process-register',
      RISK: 'risks',
      AUDIT: 'audits',
      ACTION: 'actions'
    };
    return mapping[link.linkType] ?? null;
  }

  private linkModuleLabel(linkType: LinkType) {
    return {
      PROCESS: this.t('shell.nav.processRegister.label'),
      RISK: this.t('shell.nav.risks.label'),
      AUDIT: this.t('shell.nav.audits.label'),
      ACTION: this.t('shell.nav.actions.label')
    }[linkType];
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }

  private obligationAttentionReasons(item: ObligationRow) {
    if (item.status === 'OBSOLETE') {
      return [];
    }
    const reasons: string[] = [];
    if (!item.ownerUserId) {
      reasons.push(this.t('complianceObligations.attention.reasons.ownerNeeded'));
    }
    if (!item.nextReviewDate) {
      reasons.push(this.t('complianceObligations.attention.reasons.reviewDateNeeded'));
    } else if (this.isPastDate(item.nextReviewDate)) {
      reasons.push(this.t('complianceObligations.attention.reasons.reviewOverdue'));
    } else if (this.isDateWithinDays(item.nextReviewDate, 30)) {
      reasons.push(this.t('complianceObligations.attention.reasons.reviewDueSoon'));
    }
    if (this.isStale(item.updatedAt, 90)) {
      reasons.push(this.t('complianceObligations.attention.reasons.stale'));
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

  private scopeText(content: Record<TenantScope, { en: string; az: string; ru: string }>) {
    const scope = this.authStore.scope();
    const language = this.i18n.language();
    return content[scope][language];
  }
}

@Component({ standalone: true, imports: [ComplianceObligationsPageComponent], template: `<iso-compliance-obligations-page [forcedMode]="'list'" />` })
export class ComplianceObligationsListPageComponent {}

@Component({ standalone: true, imports: [ComplianceObligationsPageComponent], template: `<iso-compliance-obligations-page [forcedMode]="'create'" />` })
export class ComplianceObligationsCreatePageComponent {}

@Component({ standalone: true, imports: [ComplianceObligationsPageComponent], template: `<iso-compliance-obligations-page [forcedMode]="'detail'" />` })
export class ComplianceObligationsDetailPageComponent {}

@Component({ standalone: true, imports: [ComplianceObligationsPageComponent], template: `<iso-compliance-obligations-page [forcedMode]="'edit'" />` })
export class ComplianceObligationsEditPageComponent {}
