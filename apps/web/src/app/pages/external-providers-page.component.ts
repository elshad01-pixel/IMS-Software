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
  label: string;
  hint: string;
};

const EVALUATION_CRITERIA: EvaluationCriterion[] = [
  { score: 1, title: 'Weak', definition: 'Performance is not controlled. Repeated gaps or major concerns are visible.' },
  { score: 2, title: 'Fragile', definition: 'Some control exists, but performance is inconsistent and needs prompt follow-up.' },
  { score: 3, title: 'Acceptable', definition: 'The requirement is generally met, but follow-up or tighter consistency is still needed.' },
  { score: 4, title: 'Controlled', definition: 'Performance is reliable and effective, with only minor improvement needed.' },
  { score: 5, title: 'Strong', definition: 'Performance is consistently strong, proactive, and well controlled.' }
];

const EVALUATION_METRICS: EvaluationMetric[] = [
  { key: 'qualityScore', label: 'Quality performance', hint: 'Conformance, defect history, and complaint performance.' },
  { key: 'deliveryScore', label: 'Delivery performance', hint: 'On-time delivery, service reliability, and schedule stability.' },
  { key: 'responsivenessScore', label: 'Responsiveness', hint: 'Speed and clarity when issues, requests, or escalations arise.' },
  { key: 'complianceScore', label: 'Compliance and documentation', hint: 'Certificates, approvals, and required supporting records.' },
  { key: 'traceabilityScore', label: 'Traceability and control', hint: 'Record retrieval, identification, and control of supplied product or service.' },
  { key: 'changeControlScore', label: 'Change notification', hint: 'How reliably the provider communicates changes before impact occurs.' }
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
  protected personName(user?: UserSummary | null) { return user ? `${user.firstName} ${user.lastName}`.trim() : ''; }
  protected readInputValue(event: Event) { return (event.target as HTMLInputElement).value; }
  protected readSelectValue(event: Event) { return (event.target as HTMLSelectElement).value; }
  protected prettyStatus(value?: string | null) { return value ? value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (part) => part.toUpperCase()) : ''; }
  protected statusClass(value: ProviderStatus) { return value === 'APPROVED' ? 'success' : value === 'CONDITIONAL' ? 'warn' : value === 'UNDER_REVIEW' ? 'neutral' : 'danger'; }
  protected criticalityClass(value: ProviderCriticality) { return value === 'HIGH' ? 'danger' : value === 'MEDIUM' ? 'warn' : 'neutral'; }
  protected approvedCount() { return this.records().filter((item) => item.status === 'APPROVED').length; }
  protected reviewCount() { return this.records().filter((item) => item.status === 'UNDER_REVIEW').length; }
  protected highCriticalityCount() { return this.records().filter((item) => item.criticality === 'HIGH').length; }
  protected evaluatedCount() { return this.records().filter((item) => item.evaluationScore !== null && item.evaluationScore !== undefined).length; }
  protected attentionCount() { return this.records().filter((item) => this.providerAttentionReasons(item).length > 0).length; }
  protected evaluationCriteria() { return EVALUATION_CRITERIA; }
  protected evaluationMetrics() { return EVALUATION_METRICS; }
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
    if (!value) return 'Not evaluated';
    return value === 'APPROVED_WITH_CONDITIONS' ? 'Approved with conditions' : this.prettyStatus(value);
  }
  protected auditCoverageClass(record?: ProviderRow | null) {
    if (!record) return 'neutral';
    if (!record.supplierAuditRequired) return 'neutral';
    return record.supplierAuditLinked ? 'success' : 'warn';
  }
  protected auditCoverageLabel(record?: ProviderRow | null) {
    if (!record) return 'Not required';
    if (!record.supplierAuditRequired) return 'Not required';
    return record.supplierAuditLinked ? 'Linked' : 'Required';
  }
  protected evaluationNarrative(record: ProviderRow | null) {
    if (!record) return 'Annual evaluation uses one consistent questionnaire so provider review stays comparable year to year.';
    if (record.evaluationScore === null || record.evaluationScore === undefined) {
      return 'No annual evaluation has been recorded yet. Use the questionnaire to score quality, delivery, responsiveness, compliance, traceability, and change control.';
    }
    if (record.evaluationOutcome === 'APPROVED') return 'This provider’s latest annual evaluation is strong and supports routine approved status.';
    if (record.evaluationOutcome === 'APPROVED_WITH_CONDITIONS') return 'This provider is acceptable, but the annual evaluation shows follow-up is still needed in one or more control areas.';
    if (record.evaluationOutcome === 'ESCALATED') return 'This provider’s annual evaluation needs management attention and a clear follow-up plan.';
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
    return EVALUATION_CRITERIA.find((item) => item.score === score) ?? null;
  }
  protected liveOutcomeLabel() {
    const percent = this.questionnairePercent();
    if (percent === null) return 'Incomplete annual evaluation';
    if (percent >= 85) return 'Approved';
    if (percent >= 70) return 'Approved with conditions';
    if (percent >= 55) return 'Escalated review';
    return 'Disqualification risk';
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
    if (percent === null) return 'Complete all six questions to see the live supplier-performance view.';
    if (percent >= 85) return 'Current performance looks strong and stable.';
    if (percent >= 70) return 'Current performance is acceptable, with some areas needing follow-up.';
    if (percent >= 55) return 'Current performance needs escalation and a focused improvement plan.';
    return 'Current performance is weak enough to question ongoing approval without intervention.';
  }
  protected livePerformanceNarrative() {
    const values = this.questionnaireMetricValues();
    if (values.length !== 6) {
      return 'The live performance view appears once the annual questionnaire is fully scored.';
    }
    const weak = values.filter((item) => item.score <= 2).map((item) => item.label.toLowerCase());
    const watch = values.filter((item) => item.score === 3).map((item) => item.label.toLowerCase());
    if (weak.length) {
      return `Priority follow-up is needed in ${weak.join(', ')}.`;
    }
    if (watch.length) {
      return `The provider is generally acceptable, but follow-up is still needed in ${watch.join(', ')}.`;
    }
    return 'All scored areas are controlled or strong, which supports routine supplier review.';
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
    const record = this.selectedRecord();
    if (!record) return 'Next steps appear after the provider is saved.';
    if (record.supplierAuditRequired && !record.supplierAuditLinked) return 'Link the required supplier audit next.';
    if (!this.linkCountByType('ACTION') && record.evaluationOutcome && record.evaluationOutcome !== 'APPROVED') {
      return 'Prepare a provider follow-up action from this review.';
    }
    if (!this.linkCountByType('PROCESS') || !this.linkCountByType('AUDIT')) {
      return 'Complete the review picture with process and audit traceability.';
    }
    return 'This provider review is connected and ready for routine oversight.';
  }
  protected nextStepNarrative() {
    const record = this.selectedRecord();
    if (!record) return 'Save the provider first, then decide whether the next control step is supplier audit coverage, action follow-up, or traceability completion.';
    if (record.supplierAuditRequired && !record.supplierAuditLinked) {
      return 'This provider is high criticality, so annual oversight is not complete until a supplier audit is linked.';
    }
    if (!this.linkCountByType('ACTION') && record.evaluationOutcome && record.evaluationOutcome !== 'APPROVED') {
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
    return `Provider follow-up: ${record.providerName}`;
  }
  protected providerDraftDescription() {
    const record = this.selectedRecord();
    if (!record) return null;
    const lines = [
      record.evaluationSummary?.trim(),
      record.supplierAuditRequired && !record.supplierAuditLinked ? 'Supplier audit still needs to be linked for this critical provider.' : '',
      record.evaluationOutcome && record.evaluationOutcome !== 'APPROVED'
        ? `Evaluation outcome: ${this.evaluationOutcomeLabel(record.evaluationOutcome)}.`
        : ''
    ].filter(Boolean);
    return lines.length ? lines.join('\n\n') : `Follow up annual provider review for ${record.providerName}.`;
  }
  protected providerReturnNavigation(): ReturnNavigation | null {
    const id = this.selectedId();
    return id ? { route: ['/external-providers', id], label: 'external provider' } : null;
  }

  protected attentionHeadline() {
    const record = this.selectedRecord();
    return record && this.providerAttentionReasons(record).length
      ? 'This provider currently needs management attention.'
      : 'This provider is currently under control.';
  }

  protected attentionNarrative() {
    const record = this.selectedRecord();
    if (!record) {
      return 'Attention guidance appears after the provider is saved.';
    }
    const reasons = this.providerAttentionReasons(record);
    if (!reasons.length) {
      return 'Approval status, review timing, evaluation, and supplier-audit coverage are controlled enough for routine oversight.';
    }
    return `Attention is needed because ${reasons.map((reason) => reason.toLowerCase()).join(', ')}.`;
  }

  protected attentionSummary(item: ProviderRow) {
    const reasons = this.providerAttentionReasons(item);
    return reasons.length ? reasons.join(' | ') : '';
  }

  protected attentionLabel(item: ProviderRow) {
    const reasons = this.providerAttentionReasons(item);
    if (!reasons.length) {
      return 'Under control';
    }
    return reasons.length > 1 ? `${reasons[0]} +${reasons.length - 1}` : reasons[0];
  }

  protected attentionClass(item: ProviderRow) {
    const reasons = this.providerAttentionReasons(item);
    if (!reasons.length) {
      return 'success';
    }
    if (reasons.includes('High priority') || reasons.includes('Supplier audit required') || reasons.includes('Review overdue')) {
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
      list: 'External providers',
      create: 'Create external provider',
      detail: this.selectedRecord()?.providerName || 'External provider detail',
      edit: this.selectedRecord()?.providerName || 'Edit external provider'
    }[this.mode()];
  }

  protected pageDescription() {
    return {
      list: 'Keep approved suppliers, contractors, and outsourced services visible without turning the app into a procurement system.',
      create: 'Record the provider, annual evaluation, approval basis, and review ownership in one lightweight supplier-control register.',
      detail: 'Review provider control position, annual evaluation, supplier-audit coverage, and linked IMS records.',
      edit: 'Update the provider record while keeping audits, risks, obligations, and actions in their original modules.'
    }[this.mode()];
  }

  protected breadcrumbs() {
    if (this.mode() === 'list') return [{ label: 'External Providers' }];
    const base = [{ label: 'External Providers', link: '/external-providers' }];
    if (this.mode() === 'create') return [...base, { label: 'New provider' }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedRecord()?.providerName || 'Provider', link: `/external-providers/${this.selectedId()}` }, { label: 'Edit' }];
    return [...base, { label: this.selectedRecord()?.providerName || 'Provider' }];
  }

  protected guidance() {
    const raw = this.form.getRawValue();
    if (raw.providerName && raw.suppliedScope && raw.approvalBasis && raw.ownerUserId) {
      return 'This provider record already shows what is being supplied, why the provider is approved, who reviews it, and how the latest annual evaluation landed.';
    }
    return 'Record the provider, what they supply, why they are approved or conditionally accepted, who reviews the relationship, and how the annual evaluation scored them.';
  }

  protected reviewNarrative() {
    const record = this.selectedRecord();
    if (!record) return 'Save the provider first, then link the process, audit, risk, action, or obligation records that show how it is controlled.';
    if (!record.links?.length) return 'This provider is recorded, but its operational control and review evidence are not yet visible through linked records.';
    if (record.supplierAuditRequired && !record.supplierAuditLinked) return 'This critical supplier has supporting links, but it still needs a linked supplier audit to complete the review picture.';
    if (!this.linkCountByType('PROCESS') || !this.linkCountByType('AUDIT')) return 'This provider has some traceability, but it will be easier to review once both the owning process and a supporting audit or control record are linked.';
    return 'This provider already shows where it is controlled and which IMS records support review and follow-up.';
  }

  protected sectionTitle(type: LinkType) { return { PROCESS: 'Linked Processes', RISK: 'Linked Risks', AUDIT: 'Linked Audits', ACTION: 'Linked Actions', OBLIGATION: 'Linked Obligations' }[type]; }
  protected sectionDescription(type: LinkType) {
    return {
      PROCESS: 'Processes that depend on or control this external provider relationship.',
      RISK: 'Risks used to track dependence, continuity, quality, or control exposure for this provider.',
      AUDIT: 'Audits that reviewed the provider or the process controls around this provider. High-criticality suppliers should have a linked supplier audit.',
      ACTION: 'Follow-up actions already tracked in the global action register.',
      OBLIGATION: 'Compliance or customer obligations that apply to this provider relationship.'
    }[type];
  }
  protected sectionEmptyCopy(type: LinkType) {
    return {
      PROCESS: 'Link the process that owns or relies on this provider relationship.',
      RISK: 'Link a risk if this provider creates continuity, quality, or compliance exposure.',
      AUDIT: 'Link an audit that checked supplier or outsourced-provider control. For high-criticality suppliers, use a supplier audit.',
      ACTION: 'Link actions already being tracked for provider follow-up.',
      OBLIGATION: 'Link obligations when customer, legal, or regulatory requirements apply to this provider.'
    }[type];
  }
  protected sectionPickerLabel(type: LinkType) { return { PROCESS: 'Process', RISK: 'Risk', AUDIT: 'Audit', ACTION: 'Action', OBLIGATION: 'Obligation' }[type]; }
  protected linksByType(type: LinkType) { return (this.selectedRecord()?.links || []).filter((link) => link.linkType === type); }
  protected linkCountByType(type: LinkType) { return this.linksByType(type).length; }
  protected linkRoute(link: ProviderLink) { return link.path || '/external-providers'; }
  protected linkQueryParams(link: ProviderLink) { return link.linkType === 'ACTION' ? { focusActionId: link.linkedId } : undefined; }
  protected linkState(link: ProviderLink) {
    return link.linkType === 'ACTION'
      ? { returnNavigation: { route: ['/external-providers', this.selectedId()], label: 'external provider' } }
      : undefined;
  }

  protected save() {
    if (!this.canWrite()) return this.error.set('You do not have permission to edit external providers.');
    if (this.form.invalid) return this.error.set('Complete the required external provider fields.');
    this.saving.set(true);
    this.error.set('');
    const request = this.selectedId()
      ? this.api.patch<ProviderRow>(`external-providers/${this.selectedId()}`, this.form.getRawValue())
      : this.api.post<ProviderRow>('external-providers', this.form.getRawValue());
    request.subscribe({
      next: (record) => {
        this.saving.set(false);
        this.router.navigate(['/external-providers', record.id], { state: { notice: 'External provider saved successfully.' } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'External provider save failed.'));
      }
    });
  }

  protected archiveRecord() {
    if (!this.selectedRecord() || !this.canDelete() || !window.confirm(`Archive external provider "${this.selectedRecord()?.providerName}"?`)) return;
    this.api.delete<{ success: boolean }>(`external-providers/${this.selectedId()}`).subscribe({
      next: () => this.router.navigate(['/external-providers'], { state: { notice: 'External provider archived successfully.' } }),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'External provider archive failed.'))
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
    this.api.delete<{ success: boolean }>(`external-providers/${this.selectedId()}/links/${linkId}`).subscribe({
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
        this.error.set(this.readError(error, 'External providers could not be loaded.'));
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
        this.error.set(this.readError(error, 'External provider details could not be loaded.'));
      }
    });
  }

  private loadOwners() {
    this.api.get<UserSummary[]>('users').subscribe({
      next: (users) => this.owners.set(users),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'External provider owners could not be loaded.'))
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
    if (type === 'PROCESS') return `${item.referenceNo || 'Uncoded'} - ${item.name}`;
    if (type === 'RISK') return item.title;
    if (type === 'AUDIT') return `${item.code} - ${item.title}`;
    if (type === 'OBLIGATION') return `${item.referenceNo || 'Uncoded'} - ${item.title}`;
    return item.title;
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
      .map((metric) => ({ label: metric.label, score: raw[metric.key] }))
      .filter((item): item is { label: string; score: number } => typeof item.score === 'number');
  }

  private providerAttentionReasons(item: ProviderRow) {
    if (item.status === 'INACTIVE') {
      return [];
    }
    const reasons: string[] = [];
    if (!item.ownerUserId) {
      reasons.push('Owner needed');
    }
    if (!item.nextReviewDate) {
      reasons.push('Review date needed');
    } else if (this.isPastDate(item.nextReviewDate)) {
      reasons.push('Review overdue');
    } else if (this.isDateWithinDays(item.nextReviewDate, 30)) {
      reasons.push('Review due soon');
    }
    if (item.supplierAuditRequired && !item.supplierAuditLinked) {
      reasons.push('Supplier audit required');
    }
    if (item.evaluationOutcome === 'ESCALATED' || item.evaluationOutcome === 'DISQUALIFIED') {
      reasons.push('High priority');
    }
    if (this.isStale(item.updatedAt, 90)) {
      reasons.push('Stale');
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

@Component({ standalone: true, imports: [ExternalProvidersPageComponent], template: `<iso-external-providers-page [forcedMode]="'list'" />` })
export class ExternalProvidersListPageComponent {}

@Component({ standalone: true, imports: [ExternalProvidersPageComponent], template: `<iso-external-providers-page [forcedMode]="'create'" />` })
export class ExternalProvidersCreatePageComponent {}

@Component({ standalone: true, imports: [ExternalProvidersPageComponent], template: `<iso-external-providers-page [forcedMode]="'detail'" />` })
export class ExternalProvidersDetailPageComponent {}

@Component({ standalone: true, imports: [ExternalProvidersPageComponent], template: `<iso-external-providers-page [forcedMode]="'edit'" />` })
export class ExternalProvidersEditPageComponent {}
