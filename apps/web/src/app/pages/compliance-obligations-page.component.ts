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
    return {
      list: 'Compliance obligations',
      create: 'Create obligation',
      detail: this.selectedObligation()?.title || 'Obligation detail',
      edit: this.selectedObligation()?.title || 'Edit obligation'
    }[this.mode()];
  }

  protected pageDescription() {
    return {
      list: 'Track legal, regulatory, and external obligations in one controlled register.',
      create: 'Record a compliance obligation and assign ownership for review.',
      detail: 'Review the obligation, owner, next review date, and linked IMS records.',
      edit: 'Update the obligation without changing the linked records themselves.'
    }[this.mode()];
  }

  protected breadcrumbs() {
    if (this.mode() === 'list') return [{ label: 'Compliance Obligations' }];
    const base = [{ label: 'Compliance Obligations', link: '/compliance-obligations' }];
    if (this.mode() === 'create') return [...base, { label: 'New obligation' }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedObligation()?.title || 'Obligation', link: `/compliance-obligations/${this.selectedId()}` }, { label: 'Edit' }];
    return [...base, { label: this.selectedObligation()?.title || 'Obligation' }];
  }

  protected obligationGuidance() {
    const raw = this.form.getRawValue();
    if (raw.sourceName && raw.ownerUserId && raw.nextReviewDate) {
      return 'This obligation is structured enough to be owned and reviewed on a defined cycle.';
    }
    return 'Record what the organization must do, who reviews it, and when it should be checked again.';
  }

  protected reviewNarrative() {
    const obligation = this.selectedObligation();
    if (!obligation) return 'Save the obligation first, then link the records that show how it is managed.';
    if (!obligation.links?.length) return 'This obligation is recorded but not yet tied to visible management evidence.';
    if (!this.linkCountByType('PROCESS') || !this.linkCountByType('RISK')) return 'This obligation has some traceability, but it would benefit from both process and risk visibility.';
    return 'This obligation is already supported by linked records for review and audit follow-up.';
  }
  protected nextStepHeadline() {
    const obligation = this.selectedObligation();
    if (!obligation) return 'Next steps appear after the obligation is saved.';
    if (!this.linkCountByType('PROCESS')) return 'Link the owning process next.';
    if (!this.linkCountByType('AUDIT')) return 'Add audit coverage for this obligation when applicable.';
    if (!this.linkCountByType('ACTION') && obligation.status !== 'OBSOLETE') return 'Prepare a compliance follow-up action if review work is still needed.';
    return 'This obligation is connected to the main review controls.';
  }
  protected nextStepNarrative() {
    const obligation = this.selectedObligation();
    if (!obligation) return 'Save the obligation first, then connect it to the process, audit, and action records that show how the requirement is managed.';
    if (!this.linkCountByType('PROCESS')) {
      return 'Link the process that owns or applies this requirement first so the obligation is grounded in the live IMS flow.';
    }
    if (!this.linkCountByType('AUDIT')) {
      return 'Link an audit when this obligation is part of formal assurance activity so review evidence is easier to show later.';
    }
    if (!this.linkCountByType('ACTION') && obligation.status !== 'OBSOLETE') {
      return 'If the obligation still needs review follow-up, gap closure, or reminder ownership, prepare an action so due dates and responsibilities stay visible.';
    }
    return 'The obligation already shows ownership, review timing, and linked process, audit, and action support in one place.';
  }
  protected obligationDraftTitle() {
    const obligation = this.selectedObligation();
    if (!obligation) return null;
    return `Obligation follow-up: ${obligation.title}`;
  }
  protected obligationDraftDescription() {
    const obligation = this.selectedObligation();
    if (!obligation) return null;
    const lines = [
      obligation.description?.trim(),
      obligation.nextReviewDate ? `Next review date: ${obligation.nextReviewDate.slice(0, 10)}` : '',
      !this.linkCountByType('AUDIT') ? 'Audit coverage is not linked yet.' : ''
    ].filter(Boolean);
    return lines.join('\n\n');
  }
  protected obligationReturnNavigation(): ReturnNavigation | null {
    const id = this.selectedId();
    return id ? { route: ['/compliance-obligations', id], label: 'compliance obligation' } : null;
  }

  protected sectionTitle(type: LinkType) {
    return { PROCESS: 'Linked Processes', RISK: 'Linked Risks', AUDIT: 'Linked Audits', ACTION: 'Linked Actions' }[type];
  }

  protected sectionDescription(type: LinkType) {
    return {
      PROCESS: 'Processes affected by or responsible for this obligation.',
      RISK: 'Risks used to track exposure or compliance impact.',
      AUDIT: 'Audits that review how this obligation is controlled.',
      ACTION: 'Actions already being tracked to address gaps or review needs.'
    }[type];
  }

  protected sectionEmptyCopy(type: LinkType) {
    return {
      PROCESS: 'Link the process that owns or applies this requirement.',
      RISK: 'Link a related risk where the obligation creates exposure or opportunity.',
      AUDIT: 'Link audits when this obligation is reviewed during assurance activity.',
      ACTION: 'Link follow-up actions already tracked in the action register.'
    }[type];
  }

  protected sectionPickerLabel(type: LinkType) {
    return { PROCESS: 'Process', RISK: 'Risk', AUDIT: 'Audit', ACTION: 'Action' }[type];
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
      ? { returnNavigation: { route: ['/compliance-obligations', this.selectedId()], label: 'compliance obligation' } }
      : undefined;
  }

  protected attentionHeadline() {
    const obligation = this.selectedObligation();
    return obligation && this.obligationAttentionReasons(obligation).length
      ? 'This obligation currently needs management attention.'
      : 'This obligation is currently under control.';
  }

  protected attentionNarrative() {
    const obligation = this.selectedObligation();
    if (!obligation) {
      return 'Attention guidance appears after the obligation is saved.';
    }
    const reasons = this.obligationAttentionReasons(obligation);
    if (!reasons.length) {
      return 'Ownership, review timing, and current status are clear enough for routine oversight.';
    }
    return `Attention is needed because ${reasons.map((reason) => reason.toLowerCase()).join(', ')}.`;
  }

  protected attentionSummary(item: ObligationRow) {
    const reasons = this.obligationAttentionReasons(item);
    return reasons.length ? reasons.join(' | ') : '';
  }

  protected attentionLabel(item: ObligationRow) {
    const reasons = this.obligationAttentionReasons(item);
    if (!reasons.length) {
      return 'Under control';
    }
    return reasons.length > 1 ? `${reasons[0]} +${reasons.length - 1}` : reasons[0];
  }

  protected attentionClass(item: ObligationRow) {
    const reasons = this.obligationAttentionReasons(item);
    if (!reasons.length) {
      return 'success';
    }
    if (reasons.includes('Review overdue')) {
      return 'danger';
    }
    return 'warn';
  }

  protected save() {
    if (!this.canWrite()) return this.error.set('You do not have permission to edit compliance obligations.');
    if (this.form.invalid) return this.error.set('Complete the required obligation fields.');
    this.saving.set(true);
    this.error.set('');
    const request = this.selectedId()
      ? this.api.patch<ObligationRow>(`compliance-obligations/${this.selectedId()}`, this.form.getRawValue())
      : this.api.post<ObligationRow>('compliance-obligations', this.form.getRawValue());
    request.subscribe({
      next: (obligation) => {
        this.saving.set(false);
        this.router.navigate(['/compliance-obligations', obligation.id], { state: { notice: 'Compliance obligation saved successfully.' } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Obligation save failed.'));
      }
    });
  }

  protected archiveObligation() {
    if (!this.selectedObligation() || !this.canDelete() || !window.confirm(`Archive obligation "${this.selectedObligation()?.title}"?`)) return;
    this.api.delete<{ success: boolean }>(`compliance-obligations/${this.selectedId()}`).subscribe({
      next: () => this.router.navigate(['/compliance-obligations'], { state: { notice: 'Compliance obligation archived successfully.' } }),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'Obligation archive failed.'))
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
    this.api.delete<{ success: boolean }>(`compliance-obligations/${this.selectedId()}/links/${linkId}`).subscribe({
      next: () => {
        this.fetchObligation(this.selectedId()!);
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
        this.error.set(this.readError(error, 'Compliance obligations could not be loaded.'));
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
        this.error.set(this.readError(error, 'Compliance obligation details could not be loaded.'));
      }
    });
  }

  private loadOwners() {
    this.api.get<UserSummary[]>('users').subscribe({
      next: (users) => this.owners.set(users),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'Obligation owners could not be loaded.'))
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
    if (type === 'PROCESS') return `${item.referenceNo || 'Uncoded'} - ${item.name}`;
    if (type === 'RISK') return item.title;
    if (type === 'AUDIT') return `${item.code} - ${item.title}`;
    return item.title;
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
      reasons.push('Owner needed');
    }
    if (!item.nextReviewDate) {
      reasons.push('Review date needed');
    } else if (this.isPastDate(item.nextReviewDate)) {
      reasons.push('Review overdue');
    } else if (this.isDateWithinDays(item.nextReviewDate, 30)) {
      reasons.push('Review due soon');
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

@Component({ standalone: true, imports: [ComplianceObligationsPageComponent], template: `<iso-compliance-obligations-page [forcedMode]="'list'" />` })
export class ComplianceObligationsListPageComponent {}

@Component({ standalone: true, imports: [ComplianceObligationsPageComponent], template: `<iso-compliance-obligations-page [forcedMode]="'create'" />` })
export class ComplianceObligationsCreatePageComponent {}

@Component({ standalone: true, imports: [ComplianceObligationsPageComponent], template: `<iso-compliance-obligations-page [forcedMode]="'detail'" />` })
export class ComplianceObligationsDetailPageComponent {}

@Component({ standalone: true, imports: [ComplianceObligationsPageComponent], template: `<iso-compliance-obligations-page [forcedMode]="'edit'" />` })
export class ComplianceObligationsEditPageComponent {}
