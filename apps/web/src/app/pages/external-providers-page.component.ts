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
type ProviderType = 'SUPPLIER' | 'OUTSOURCED_SERVICE' | 'CONTRACTOR' | 'CALIBRATION' | 'LOGISTICS' | 'OTHER';
type ProviderCriticality = 'LOW' | 'MEDIUM' | 'HIGH';
type ProviderStatus = 'APPROVED' | 'CONDITIONAL' | 'UNDER_REVIEW' | 'INACTIVE';
type ProviderEvaluationOutcome = 'APPROVED' | 'APPROVED_WITH_CONDITIONS' | 'ESCALATED' | 'DISQUALIFIED';
type LinkType = 'PROCESS' | 'RISK' | 'AUDIT' | 'ACTION' | 'OBLIGATION';
type EvaluationCriterion = { score: number; title: string; definition: string };
type EvaluationMetricKey =
  | 'qualityScore'
  | 'deliveryScore'
  | 'responsivenessScore'
  | 'complianceScore'
  | 'traceabilityScore'
  | 'changeControlScore';
type ReturnNavigation = { route: string[]; label: string };

type UserSummary = { id: string; firstName: string; lastName: string; email: string };
type LinkCandidate = { id: string; label: string };
type ProviderAttentionReason =
  | 'OWNER_NEEDED'
  | 'REVIEW_DATE_NEEDED'
  | 'REVIEW_OVERDUE'
  | 'REVIEW_DUE_SOON'
  | 'SUPPLIER_AUDIT_REQUIRED'
  | 'HIGH_PRIORITY'
  | 'STALE';

type ProviderLink = {
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

type ProviderRow = {
  id: string;
  referenceNo?: string | null;
  providerName: string;
  providerType: ProviderType;
  suppliedScope: string;
  approvalBasis?: string | null;
  criticality: ProviderCriticality;
  ownerUserId?: string | null;
  evaluationDate?: string | null;
  qualityScore?: number | null;
  deliveryScore?: number | null;
  responsivenessScore?: number | null;
  complianceScore?: number | null;
  traceabilityScore?: number | null;
  changeControlScore?: number | null;
  evaluationScore?: number | null;
  evaluationOutcome?: ProviderEvaluationOutcome | null;
  evaluationSummary?: string | null;
  nextReviewDate?: string | null;
  status: ProviderStatus;
  createdAt: string;
  updatedAt: string;
  owner?: UserSummary | null;
  linkCount?: number;
  supplierAuditRequired?: boolean;
  supplierAuditLinked?: boolean;
  links?: ProviderLink[];
};

type EvaluationMetric = {
  key: EvaluationMetricKey;
  labelKey: string;
  hintKey: string;
};

const EVALUATION_CRITERIA: EvaluationCriterion[] = [
  { score: 1, title: 'weak', definition: 'weak' },
  { score: 2, title: 'fragile', definition: 'fragile' },
  { score: 3, title: 'acceptable', definition: 'acceptable' },
  { score: 4, title: 'controlled', definition: 'controlled' },
  { score: 5, title: 'strong', definition: 'strong' }
];

const EVALUATION_METRICS: EvaluationMetric[] = [
  { key: 'qualityScore', labelKey: 'qualityScore', hintKey: 'qualityScore' },
  { key: 'deliveryScore', labelKey: 'deliveryScore', hintKey: 'deliveryScore' },
  { key: 'responsivenessScore', labelKey: 'responsivenessScore', hintKey: 'responsivenessScore' },
  { key: 'complianceScore', labelKey: 'complianceScore', hintKey: 'complianceScore' },
  { key: 'traceabilityScore', labelKey: 'traceabilityScore', hintKey: 'traceabilityScore' },
  { key: 'changeControlScore', labelKey: 'changeControlScore', hintKey: 'changeControlScore' }
];

@Component({
  selector: 'iso-external-providers-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, RecordWorkItemsComponent],
  templateUrl: './external-providers-page.component.html',
  styleUrl: './external-providers-page.component.css'
})
export class ExternalProvidersPageComponent implements OnInit, OnChanges {
  @Input() forcedMode?: PageMode;

  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
  protected readonly records = signal<ProviderRow[]>([]);
  protected readonly owners = signal<UserSummary[]>([]);
  protected readonly selectedRecord = signal<ProviderRow | null>(null);
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
  protected readonly visibleLinkTypes: LinkType[] = ['PROCESS', 'RISK', 'AUDIT', 'ACTION', 'OBLIGATION'];

  protected readonly form = this.fb.group({
    referenceNo: ['', [Validators.maxLength(40)]],
    providerName: ['', [Validators.required, Validators.maxLength(180)]],
    providerType: ['SUPPLIER' as ProviderType, [Validators.required]],
    suppliedScope: ['', [Validators.required, Validators.maxLength(2000)]],
    approvalBasis: ['', [Validators.maxLength(2000)]],
    criticality: ['MEDIUM' as ProviderCriticality, [Validators.required]],
    ownerUserId: [''],
    evaluationDate: [''],
    qualityScore: [null as number | null],
    deliveryScore: [null as number | null],
    responsivenessScore: [null as number | null],
    complianceScore: [null as number | null],
    traceabilityScore: [null as number | null],
    changeControlScore: [null as number | null],
    evaluationSummary: [''],
    nextReviewDate: [''],
    status: ['APPROVED' as ProviderStatus, [Validators.required]]
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

  protected canWrite() { return this.authStore.hasPermission('providers.write'); }
  protected canDelete() { return this.authStore.hasPermission('admin.delete'); }
  protected t(key: string, params?: Record<string, unknown>) { return this.i18n.t(key, params); }
  protected personName(user?: UserSummary | null) { return user ? `${user.firstName} ${user.lastName}`.trim() : ''; }
  protected readInputValue(event: Event) { return (event.target as HTMLInputElement).value; }
  protected readSelectValue(event: Event) { return (event.target as HTMLSelectElement).value; }
  protected prettyStatus(value?: string | null) { return value ? value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (part) => part.toUpperCase()) : ''; }
  protected providerTypeLabel(value?: ProviderType | null) { return value ? this.t(`externalProviders.providerType.${value}`) : ''; }
  protected providerCriticalityLabel(value?: ProviderCriticality | null) { return value ? this.t(`externalProviders.criticality.${value}`) : ''; }
  protected providerStatusLabel(value?: ProviderStatus | null) { return value ? this.t(`externalProviders.status.${value}`) : ''; }
  protected statusClass(value: ProviderStatus) { return value === 'APPROVED' ? 'success' : value === 'CONDITIONAL' ? 'warn' : value === 'UNDER_REVIEW' ? 'neutral' : 'danger'; }
  protected criticalityClass(value: ProviderCriticality) { return value === 'HIGH' ? 'danger' : value === 'MEDIUM' ? 'warn' : 'neutral'; }
  protected approvedCount() { return this.records().filter((item) => item.status === 'APPROVED').length; }
  protected reviewCount() { return this.records().filter((item) => item.status === 'UNDER_REVIEW').length; }
  protected highCriticalityCount() { return this.records().filter((item) => item.criticality === 'HIGH').length; }
  protected evaluatedCount() { return this.records().filter((item) => item.evaluationScore !== null && item.evaluationScore !== undefined).length; }
  protected attentionCount() { return this.records().filter((item) => this.providerAttentionReasons(item).length > 0).length; }
  protected evaluationCriteria() { return EVALUATION_CRITERIA; }
  protected evaluationMetrics() {
    return EVALUATION_METRICS.map((metric) => ({
      key: metric.key,
      label: this.t(`externalProviders.evaluation.metrics.${metric.labelKey}.label`),
      hint: this.t(`externalProviders.evaluation.metrics.${metric.hintKey}.hint`)
    }));
  }
  protected evaluationCriterionTitle(score: number) { return this.t(`externalProviders.evaluation.criteria.${score}.title`); }
  protected evaluationCriterionDefinition(score: number) { return this.t(`externalProviders.evaluation.criteria.${score}.definition`); }
  protected evaluationOutcomeClass(value?: ProviderEvaluationOutcome | null) {
    return value === 'APPROVED'
      ? 'success'
      : value === 'APPROVED_WITH_CONDITIONS'
        ? 'warn'
        : value === 'ESCALATED'
          ? 'danger'
          : value === 'DISQUALIFIED'
            ? 'danger'
            : 'neutral';
  }
  protected evaluationOutcomeLabel(value?: ProviderEvaluationOutcome | null) {
    if (!value) return this.t('externalProviders.evaluation.common.notEvaluated');
    return this.t(`externalProviders.evaluation.outcome.${value}`);
  }
  protected auditCoverageClass(record?: ProviderRow | null) {
    if (!record) return 'neutral';
    if (!record.supplierAuditRequired) return 'neutral';
    return record.supplierAuditLinked ? 'success' : 'warn';
  }
  protected auditCoverageLabel(record?: ProviderRow | null) {
    if (!record) return this.t('externalProviders.auditCoverage.notRequired');
    if (!record.supplierAuditRequired) return this.t('externalProviders.auditCoverage.notRequired');
    return record.supplierAuditLinked ? this.t('externalProviders.auditCoverage.linked') : this.t('externalProviders.auditCoverage.required');
  }
  protected evaluationNarrative(record: ProviderRow | null) {
    if (!record) return this.t('externalProviders.evaluation.narrative.default');
    if (record.evaluationScore === null || record.evaluationScore === undefined) {
      return this.t('externalProviders.evaluation.narrative.notRecorded');
    }
    record = record!;
    if (record!.evaluationOutcome === 'APPROVED') return this.t('externalProviders.evaluation.narrative.approved');
    if (record!.evaluationOutcome === 'APPROVED_WITH_CONDITIONS') return this.t('externalProviders.evaluation.narrative.approvedWithConditions');
    if (record!.evaluationOutcome === 'ESCALATED') return this.t('externalProviders.evaluation.narrative.escalated');
    return this.t('externalProviders.evaluation.narrative.disqualified');
    if (record!.evaluationOutcome === 'APPROVED') return 'This provider’s latest annual evaluation is strong and supports routine approved status.';
    if (record!.evaluationOutcome === 'APPROVED_WITH_CONDITIONS') return 'This provider is acceptable, but the annual evaluation shows follow-up is still needed in one or more control areas.';
    if (record!.evaluationOutcome === 'ESCALATED') return 'This provider’s annual evaluation needs management attention and a clear follow-up plan.';
    return 'This provider’s annual evaluation is poor enough to question continued approval without further review.';
  }
  protected questionnaireAverage() {
    const values = this.questionnaireScores();
    if (!values.length) return null;
    return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
  }
  protected questionnairePercent() {
    const values = this.questionnaireScores();
    if (values.length !== 6) return null;
    return Math.round((values.reduce((sum, value) => sum + value, 0) / 30) * 100);
  }
  protected scoreChoices() { return [1, 2, 3, 4, 5]; }
  protected scoreDefinition(score?: number | null) {
    const criterion = EVALUATION_CRITERIA.find((item) => item.score === score);
    return criterion ? { score: criterion.score, definition: this.evaluationCriterionDefinition(criterion.score) } : null;
  }
  protected liveOutcomeLabel() {
    const percent = this.questionnairePercent();
    if (percent === null) return this.t('externalProviders.liveOutcome.incomplete');
    if (percent >= 85) return this.t('externalProviders.liveOutcome.approved');
    if (percent >= 70) return this.t('externalProviders.liveOutcome.approvedWithConditions');
    if (percent >= 55) return this.t('externalProviders.liveOutcome.escalated');
    return this.t('externalProviders.liveOutcome.disqualificationRisk');
  }
  protected liveOutcomeClass() {
    const percent = this.questionnairePercent();
    if (percent === null) return 'neutral';
    if (percent >= 85) return 'success';
    if (percent >= 70) return 'warn';
    return 'danger';
  }
  protected livePerformanceHeadline() {
    const percent = this.questionnairePercent();
    if (percent === null) return this.t('externalProviders.livePerformance.headline.incomplete');
    if (percent >= 85) return this.t('externalProviders.livePerformance.headline.strong');
    if (percent >= 70) return this.t('externalProviders.livePerformance.headline.acceptable');
    if (percent >= 55) return this.t('externalProviders.livePerformance.headline.escalated');
    return this.t('externalProviders.livePerformance.headline.weak');
  }
  protected livePerformanceNarrative() {
    const values = this.questionnaireMetricValues();
    if (values.length !== 6) {
      return this.t('externalProviders.livePerformance.copy.incomplete');
    }
    const weak = values.filter((item) => item.score <= 2).map((item) => item.label.toLowerCase());
    const watch = values.filter((item) => item.score === 3).map((item) => item.label.toLowerCase());
    if (weak.length) {
      return this.t('externalProviders.livePerformance.copy.weak', { areas: weak.join(', ') });
    }
    if (watch.length) {
      return this.t('externalProviders.livePerformance.copy.watch', { areas: watch.join(', ') });
    }
    return this.t('externalProviders.livePerformance.copy.strong');
  }
  protected strongestAreas() {
    return this.questionnaireMetricValues().filter((item) => item.score >= 4);
  }
  protected weakAreas() {
    return this.questionnaireMetricValues().filter((item) => item.score <= 2);
  }
  protected watchAreas() {
    return this.questionnaireMetricValues().filter((item) => item.score === 3);
  }
  protected areaLabels(items: Array<{ label: string }>) {
    return items.map((item) => item.label).join(', ');
  }
  protected nextStepHeadline() {
    let record = this.selectedRecord();
    if (!record) return this.t('externalProviders.nextSteps.headline.default');
    record = record!;
    if (record.supplierAuditRequired && !record.supplierAuditLinked) return this.t('externalProviders.nextSteps.headline.audit');
    if (!this.linkCountByType('ACTION') && record.evaluationOutcome && record.evaluationOutcome !== 'APPROVED') {
      return this.t('externalProviders.nextSteps.headline.action');
    }
    if (!this.linkCountByType('PROCESS') || !this.linkCountByType('AUDIT')) {
      return this.t('externalProviders.nextSteps.headline.traceability');
    }
    return this.t('externalProviders.nextSteps.headline.ready');
    if (!record) return 'Next steps appear after the provider is saved.';
    if (record!.supplierAuditRequired && !record!.supplierAuditLinked) return 'Link the required supplier audit next.';
    if (!this.linkCountByType('ACTION') && record!.evaluationOutcome && record!.evaluationOutcome !== 'APPROVED') {
      return 'Prepare a provider follow-up action from this review.';
    }
    if (!this.linkCountByType('PROCESS') || !this.linkCountByType('AUDIT')) {
      return 'Complete the review picture with process and audit traceability.';
    }
    return 'This provider review is connected and ready for routine oversight.';
  }
  protected nextStepNarrative() {
    let record = this.selectedRecord();
    if (!record) return this.t('externalProviders.nextSteps.copy.default');
    record = record!;
    if (record.supplierAuditRequired && !record.supplierAuditLinked) {
      return this.t('externalProviders.nextSteps.copy.audit');
    }
    if (!this.linkCountByType('ACTION') && record.evaluationOutcome && record.evaluationOutcome !== 'APPROVED') {
      return this.t('externalProviders.nextSteps.copy.action');
    }
    if (!this.linkCountByType('PROCESS') || !this.linkCountByType('AUDIT')) {
      return this.t('externalProviders.nextSteps.copy.traceability');
    }
    return this.t('externalProviders.nextSteps.copy.ready');
    if (!record) return 'Save the provider first, then decide whether the next control step is supplier audit coverage, action follow-up, or traceability completion.';
    if (record!.supplierAuditRequired && !record!.supplierAuditLinked) {
      return 'This provider is high criticality, so annual oversight is not complete until a supplier audit is linked.';
    }
    if (!this.linkCountByType('ACTION') && record!.evaluationOutcome && record!.evaluationOutcome !== 'APPROVED') {
      return 'The annual evaluation already shows follow-up is needed. Prepare an action so ownership, due date, and review stay visible in the global tracker.';
    }
    if (!this.linkCountByType('PROCESS') || !this.linkCountByType('AUDIT')) {
      return 'Link the owning process and a supporting audit so this provider review is easier to defend during management review and audit follow-up.';
    }
    return 'The provider already shows approval basis, annual evaluation, supplier-audit coverage, and linked operational controls in one place.';
  }
  protected providerDraftTitle() {
    const record = this.selectedRecord();
    if (!record) return null;
    return this.t('externalProviders.messages.actionDraftTitle', { title: record.providerName });
  }
  protected providerDraftDescription() {
    const record = this.selectedRecord();
    if (!record) return null;
    const lines = [
      record.evaluationSummary?.trim(),
      record.supplierAuditRequired && !record.supplierAuditLinked ? this.t('externalProviders.messages.auditLinkNeeded') : '',
      record.evaluationOutcome && record.evaluationOutcome !== 'APPROVED'
        ? this.t('externalProviders.messages.evaluationOutcomeLine', { value: this.evaluationOutcomeLabel(record.evaluationOutcome) })
        : ''
    ].filter(Boolean);
    return lines.length ? lines.join('\n\n') : this.t('externalProviders.messages.defaultDraftDescription', { title: record.providerName });
  }
  protected providerReturnNavigation(): ReturnNavigation | null {
    const id = this.selectedId();
    return id ? { route: ['/external-providers', id], label: this.t('externalProviders.page.label') } : null;
  }

  protected attentionHeadline() {
    const record = this.selectedRecord();
    return record && this.providerAttentionReasons(record).length
      ? this.t('externalProviders.attention.headline.needsAttention')
      : this.t('externalProviders.attention.headline.underControl');
  }

  protected attentionNarrative() {
    const record = this.selectedRecord();
    if (!record) {
      return this.t('externalProviders.attention.copy.unsaved');
    }
    const reasons = this.providerAttentionReasons(record);
    if (!reasons.length) {
      return this.t('externalProviders.attention.copy.underControl');
    }
    return this.t('externalProviders.attention.copy.needsAttention', { reasons: reasons.map((reason) => this.attentionReasonLabel(reason)).join(', ') });
  }

  protected attentionSummary(item: ProviderRow) {
    const reasons = this.providerAttentionReasons(item);
    return reasons.length ? reasons.map((reason) => this.attentionReasonLabel(reason)).join(' | ') : '';
  }

  protected attentionLabel(item: ProviderRow) {
    const reasons = this.providerAttentionReasons(item);
    if (!reasons.length) {
      return this.t('externalProviders.attention.underControl');
    }
    return reasons.length > 1 ? this.t('externalProviders.attention.multi', { first: this.attentionReasonLabel(reasons[0]), count: reasons.length - 1 }) : this.attentionReasonLabel(reasons[0]);
  }

  protected attentionClass(item: ProviderRow) {
    const reasons = this.providerAttentionReasons(item);
    if (!reasons.length) {
      return 'success';
    }
    if (reasons.includes('HIGH_PRIORITY') || reasons.includes('SUPPLIER_AUDIT_REQUIRED') || reasons.includes('REVIEW_OVERDUE')) {
      return 'danger';
    }
    return 'warn';
  }

  protected filteredRecords() {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const ownerId = this.ownerFilter();
    return this.records().filter((item) => {
      const matchesTerm =
        !term ||
        (item.referenceNo || '').toLowerCase().includes(term) ||
        item.providerName.toLowerCase().includes(term) ||
        item.suppliedScope.toLowerCase().includes(term) ||
        (item.approvalBasis || '').toLowerCase().includes(term);
      const matchesStatus = !status || item.status === status;
      const matchesOwner = !ownerId || item.ownerUserId === ownerId;
      return matchesTerm && matchesStatus && matchesOwner;
    });
  }

  protected pageTitle() {
    return {
      list: this.t('externalProviders.page.titles.list'),
      create: this.t('externalProviders.page.titles.create'),
      detail: this.selectedRecord()?.providerName || this.t('externalProviders.page.titles.detail'),
      edit: this.selectedRecord()?.providerName || this.t('externalProviders.page.titles.edit')
    }[this.mode()];
  }

  protected pageDescription() {
    return {
      list: this.t('externalProviders.page.descriptions.list'),
      create: this.t('externalProviders.page.descriptions.create'),
      detail: this.t('externalProviders.page.descriptions.detail'),
      edit: this.t('externalProviders.page.descriptions.edit')
    }[this.mode()];
  }

  protected breadcrumbs() {
    if (this.mode() === 'list') return [{ label: this.t('externalProviders.page.label') }];
    const base = [{ label: this.t('externalProviders.page.label'), link: '/external-providers' }];
    if (this.mode() === 'create') return [...base, { label: this.t('externalProviders.breadcrumbs.new') }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedRecord()?.providerName || this.t('externalProviders.breadcrumbs.record'), link: `/external-providers/${this.selectedId()}` }, { label: this.t('externalProviders.breadcrumbs.edit') }];
    return [...base, { label: this.selectedRecord()?.providerName || this.t('externalProviders.breadcrumbs.record') }];
  }

  protected guidance() {
    const raw = this.form.getRawValue();
    if (raw.providerName && raw.suppliedScope && raw.approvalBasis && raw.ownerUserId) {
      return this.t('externalProviders.guidance.structured');
    }
    return this.t('externalProviders.guidance.default');
  }

  protected reviewNarrative() {
    const record = this.selectedRecord();
    if (!record) return this.t('externalProviders.review.noRecord');
    if (!record.links?.length) return this.t('externalProviders.review.unlinked');
    if (record.supplierAuditRequired && !record.supplierAuditLinked) return this.t('externalProviders.review.auditMissing');
    if (!this.linkCountByType('PROCESS') || !this.linkCountByType('AUDIT')) return this.t('externalProviders.review.partial');
    return this.t('externalProviders.review.strong');
  }

  protected sectionTitle(type: LinkType) { return this.t(`externalProviders.links.sections.${type}.title`); }
  protected sectionDescription(type: LinkType) { return this.t(`externalProviders.links.sections.${type}.copy`); }
  protected sectionEmptyCopy(type: LinkType) { return this.t(`externalProviders.links.sections.${type}.empty`); }
  protected sectionPickerLabel(type: LinkType) { return this.t(`externalProviders.links.types.${type}`); }
  protected linksByType(type: LinkType) { return (this.selectedRecord()?.links || []).filter((link) => link.linkType === type); }
  protected linkCountByType(type: LinkType) { return this.linksByType(type).length; }
  protected linkRoute(link: ProviderLink) { return link.path || '/external-providers'; }
  protected linkQueryParams(link: ProviderLink) { return link.linkType === 'ACTION' ? { focusActionId: link.linkedId } : undefined; }
  protected linkState(link: ProviderLink) {
    return link.linkType === 'ACTION'
      ? { returnNavigation: { route: ['/external-providers', this.selectedId()], label: 'external provider' } }
      : undefined;
  }

  protected canOpenLink(link: ProviderLink) {
    if (!link.path || link.missing) {
      return false;
    }

    const moduleKey = this.linkPackageModule(link);
    return !moduleKey || this.authStore.hasModule(moduleKey);
  }

  protected inaccessibleLinkSummary(link: ProviderLink) {
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

  protected save() {
    if (!this.canWrite()) return this.error.set(this.t('externalProviders.messages.noPermissionWrite'));
    if (this.form.invalid) return this.error.set(this.t('externalProviders.messages.completeRequired'));
    this.saving.set(true);
    this.error.set('');
    const request = this.selectedId()
      ? this.api.patch<ProviderRow>(`external-providers/${this.selectedId()}`, this.form.getRawValue())
      : this.api.post<ProviderRow>('external-providers', this.form.getRawValue());
    request.subscribe({
      next: (record) => {
        this.saving.set(false);
        this.router.navigate(['/external-providers', record.id], { state: { notice: this.t('externalProviders.messages.saved') } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, this.t('externalProviders.messages.saveFailed')));
      }
    });
  }

  protected archiveRecord() {
    if (!this.selectedRecord() || !this.canDelete() || !window.confirm(this.t('externalProviders.messages.archiveConfirm', { title: this.selectedRecord()?.providerName }))) return;
    this.api.delete<{ success: boolean }>(`external-providers/${this.selectedId()}`).subscribe({
      next: () => this.router.navigate(['/external-providers'], { state: { notice: this.t('externalProviders.messages.archived') } }),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, this.t('externalProviders.messages.archiveFailed')))
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
    this.api.post<ProviderLink>(`external-providers/${this.selectedId()}/links`, this.linkForm.getRawValue()).subscribe({
      next: () => {
        this.linkSaving.set(false);
        this.linkForm.patchValue({ linkedId: '', note: '' });
        this.activeLinkComposerType.set(null);
        this.fetchRecord(this.selectedId()!);
        this.message.set(this.t('externalProviders.messages.linkAdded'));
      },
      error: (error: HttpErrorResponse) => {
        this.linkSaving.set(false);
        this.error.set(this.readError(error, this.t('externalProviders.messages.linkFailed')));
      }
    });
  }

  protected removeLink(linkId: string) {
    if (!this.selectedId() || !this.canWrite()) return;
    this.api.delete<{ success: boolean }>(`external-providers/${this.selectedId()}/links/${linkId}`).subscribe({
      next: () => {
        this.fetchRecord(this.selectedId()!);
        this.message.set(this.t('externalProviders.messages.linkRemoved'));
      },
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, this.t('externalProviders.messages.linkRemoveFailed')))
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
    this.form.reset({
      referenceNo: '',
      providerName: '',
      providerType: 'SUPPLIER',
      suppliedScope: '',
      approvalBasis: '',
      criticality: 'MEDIUM',
      ownerUserId: '',
      evaluationDate: '',
      qualityScore: null,
      deliveryScore: null,
      responsivenessScore: null,
      complianceScore: null,
      traceabilityScore: null,
      changeControlScore: null,
      evaluationSummary: '',
      nextReviewDate: '',
      status: 'APPROVED'
    });
    this.closeLinkComposer();
  }

  private reloadRecords() {
    this.loading.set(true);
    this.api.get<ProviderRow[]>('external-providers').subscribe({
      next: (items) => {
        this.loading.set(false);
        this.records.set(items);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, this.t('externalProviders.messages.loadListFailed')));
      }
    });
  }

  private fetchRecord(id: string) {
    this.loading.set(true);
    this.api.get<ProviderRow>(`external-providers/${id}`).subscribe({
      next: (record) => {
        this.loading.set(false);
        this.selectedRecord.set(record);
        this.form.reset({
          referenceNo: record.referenceNo || '',
          providerName: record.providerName,
          providerType: record.providerType,
          suppliedScope: record.suppliedScope,
          approvalBasis: record.approvalBasis || '',
          criticality: record.criticality,
          ownerUserId: record.ownerUserId || '',
          evaluationDate: record.evaluationDate ? record.evaluationDate.slice(0, 10) : '',
          qualityScore: record.qualityScore ?? null,
          deliveryScore: record.deliveryScore ?? null,
          responsivenessScore: record.responsivenessScore ?? null,
          complianceScore: record.complianceScore ?? null,
          traceabilityScore: record.traceabilityScore ?? null,
          changeControlScore: record.changeControlScore ?? null,
          evaluationSummary: record.evaluationSummary || '',
          nextReviewDate: record.nextReviewDate ? record.nextReviewDate.slice(0, 10) : '',
          status: record.status
        });
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, this.t('externalProviders.messages.loadDetailsFailed')));
      }
    });
  }

  private loadOwners() {
    this.api.get<UserSummary[]>('users').subscribe({
      next: (users) => this.owners.set(users),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, this.t('externalProviders.messages.loadOwnersFailed')))
    });
  }

  private loadLinkCandidates(type: LinkType) {
    const path = { PROCESS: 'process-register', RISK: 'risks', AUDIT: 'audits', ACTION: 'action-items', OBLIGATION: 'compliance-obligations' }[type];
    this.api.get<any[]>(path).subscribe({
      next: (items) => this.linkCandidates.set(items.map((item) => ({ id: item.id, label: this.toCandidateLabel(type, item) }))),
      error: () => this.linkCandidates.set([])
    });
  }

  private toCandidateLabel(type: LinkType, item: any) {
    if (type === 'PROCESS') return `${item.referenceNo || this.t('externalProviders.common.uncoded')} - ${item.name}`;
    if (type === 'RISK') return item.title;
    if (type === 'AUDIT') return `${item.code} - ${item.title}`;
    if (type === 'OBLIGATION') return `${item.referenceNo || this.t('externalProviders.common.uncoded')} - ${item.title}`;
    return item.title;
  }

  private linkPackageModule(link: ProviderLink): PackageModuleKey | null {
    const mapping: Record<LinkType, PackageModuleKey> = {
      PROCESS: 'process-register',
      RISK: 'risks',
      AUDIT: 'audits',
      ACTION: 'actions',
      OBLIGATION: 'compliance-obligations'
    };
    return mapping[link.linkType] ?? null;
  }

  private linkModuleLabel(linkType: LinkType) {
    return {
      PROCESS: this.t('shell.nav.processRegister.label'),
      RISK: this.t('shell.nav.risks.label'),
      AUDIT: this.t('shell.nav.audits.label'),
      ACTION: this.t('shell.nav.actions.label'),
      OBLIGATION: this.t('shell.nav.complianceObligations.label')
    }[linkType];
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }

  protected questionnaireScores() {
    return [
      this.form.getRawValue().qualityScore,
      this.form.getRawValue().deliveryScore,
      this.form.getRawValue().responsivenessScore,
      this.form.getRawValue().complianceScore,
      this.form.getRawValue().traceabilityScore,
      this.form.getRawValue().changeControlScore
    ].filter((value): value is number => typeof value === 'number');
  }

  protected questionnaireMetricValues() {
    const raw = this.form.getRawValue();
    return EVALUATION_METRICS
      .map((metric) => ({ label: this.t(`externalProviders.evaluation.metrics.${metric.labelKey}.label`), score: raw[metric.key] }))
      .filter((item): item is { label: string; score: number } => typeof item.score === 'number');
  }

  private providerAttentionReasons(item: ProviderRow): ProviderAttentionReason[] {
    if (item.status === 'INACTIVE') {
      return [];
    }
    const reasons: ProviderAttentionReason[] = [];
    if (!item.ownerUserId) {
      reasons.push('OWNER_NEEDED');
    }
    if (!item.nextReviewDate) {
      reasons.push('REVIEW_DATE_NEEDED');
    } else if (this.isPastDate(item.nextReviewDate)) {
      reasons.push('REVIEW_OVERDUE');
    } else if (this.isDateWithinDays(item.nextReviewDate, 30)) {
      reasons.push('REVIEW_DUE_SOON');
    }
    if (item.supplierAuditRequired && !item.supplierAuditLinked) {
      reasons.push('SUPPLIER_AUDIT_REQUIRED');
    }
    if (item.evaluationOutcome === 'ESCALATED' || item.evaluationOutcome === 'DISQUALIFIED') {
      reasons.push('HIGH_PRIORITY');
    }
    if (this.isStale(item.updatedAt, 90)) {
      reasons.push('STALE');
    }
    return reasons;
  }

  private attentionReasonLabel(reason: ProviderAttentionReason) {
    return this.t(`externalProviders.attention.reasons.${reason}`);
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

@Component({ standalone: true, imports: [ExternalProvidersPageComponent], template: `<iso-external-providers-page [forcedMode]="'list'" />` })
export class ExternalProvidersListPageComponent {}

@Component({ standalone: true, imports: [ExternalProvidersPageComponent], template: `<iso-external-providers-page [forcedMode]="'create'" />` })
export class ExternalProvidersCreatePageComponent {}

@Component({ standalone: true, imports: [ExternalProvidersPageComponent], template: `<iso-external-providers-page [forcedMode]="'detail'" />` })
export class ExternalProvidersDetailPageComponent {}

@Component({ standalone: true, imports: [ExternalProvidersPageComponent], template: `<iso-external-providers-page [forcedMode]="'edit'" />` })
export class ExternalProvidersEditPageComponent {}

