import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
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
      list: 'Incidents and near misses',
      create: 'Report incident',
      detail: this.selectedIncident()?.title || 'Incident detail',
      edit: this.selectedIncident()?.title || 'Edit incident'
    }[this.mode()];
  }

  protected pageDescription() {
    return {
      list: 'Track incidents and near misses without turning the system into a full operational workflow engine.',
      create: 'Record what happened, immediate action, and who owns follow-up.',
      detail: 'Review the event, response, and linked records already managing the follow-up.',
      edit: 'Update the incident record while keeping linked processes, risks, and actions in their original modules.'
    }[this.mode()];
  }

  protected breadcrumbs() {
    if (this.mode() === 'list') return [{ label: 'Incidents' }];
    const base = [{ label: 'Incidents', link: '/incidents' }];
    if (this.mode() === 'create') return [...base, { label: 'New incident' }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedIncident()?.title || 'Incident', link: `/incidents/${this.selectedId()}` }, { label: 'Edit' }];
    return [...base, { label: this.selectedIncident()?.title || 'Incident' }];
  }

  protected incidentGuidance() {
    const raw = this.form.getRawValue();
    if (raw.eventDate && raw.ownerUserId && raw.immediateAction) {
      return 'This record already shows what happened, who owns it, and what was done immediately.';
    }
    return 'A useful incident record should show what happened, when it happened, what was done immediately, and who owns the follow-up.';
  }

  protected reviewNarrative() {
    const incident = this.selectedIncident();
    if (!incident) return 'Save the incident first, then link the process, risk, or action records that carry the follow-up.';
    if (!incident.links?.length) return 'This event is recorded, but its operational follow-up is not yet visible through linked records.';
    if (!this.linkCountByType('PROCESS') || !this.linkCountByType('RISK')) return 'This event has some traceability, but it will be easier to review once both the affected process and related risk are linked.';
    return 'This event already shows where it applies and how the follow-up is being managed.';
  }

  protected selectedRcaMethod() {
    return this.form.getRawValue().rcaMethod as IncidentRcaMethod | '';
  }

  protected investigationNarrative() {
    const raw = this.form.getRawValue();
    if (raw.rcaMethod && (raw.rootCause || this.structuredRootCauseSummary())) {
      return 'The investigation now shows both the RCA method used and the root cause captured from the review.';
    }
    if (raw.investigationSummary) {
      return 'The event has investigation notes, but the root cause method still needs to be made explicit.';
    }
    return 'Keep the first report lightweight, then use this section to capture what was found, the RCA method used, and the resulting root cause.';
  }

  protected detailInvestigationNarrative() {
    const incident = this.selectedIncident();
    if (!incident) return 'No investigation narrative is available yet.';
    if (incident.rcaMethod && incident.rootCause) {
      return 'The investigation records both the RCA method used and the current root cause summary.';
    }
    if (incident.investigationSummary) {
      return 'Investigation notes are recorded, but the root cause method has not been made explicit yet.';
    }
    return 'No structured investigation has been recorded yet.';
  }

  protected nextStepHeadline() {
    const incident = this.selectedIncident();
    if (!incident) return 'Next steps appear after the incident is saved.';
    if (!incident.rootCause) return 'Complete the investigation conclusion first.';
    if (!this.linkCountByType('ACTION')) return 'Create follow-up from the incident once the investigation is clear.';
    if (!this.linkCountByType('PROCESS') || !this.linkCountByType('RISK')) return 'Complete the traceability picture with the affected process and related risk.';
    return 'The incident has enough structure to manage follow-up and review.';
  }

  protected nextStepNarrative() {
    const incident = this.selectedIncident();
    if (!incident) return 'Save the event, then review investigation, evidence, and follow-up in one place.';
    if (!incident.rootCause) return 'Use the RCA method and root cause fields to make the investigation defensible before pushing more follow-up into actions.';
    if (!this.linkCountByType('ACTION')) return 'If the event needs corrective or preventive work, prepare an incident action from the section below so ownership and due dates are explicit.';
    if (!this.linkCountByType('PROCESS') || !this.linkCountByType('RISK')) return 'Link the affected process and related risk so the event is visible in the wider control system, not just the incident log.';
    return 'Review the linked action, evidence, and traceability regularly until the event can be closed confidently.';
  }

  protected incidentDraftTitle() {
    const incident = this.selectedIncident();
    if (!incident) return null;
    return `${incident.type === 'NEAR_MISS' ? 'Near miss' : 'Incident'} follow-up: ${incident.title}`;
  }

  protected incidentDraftDescription() {
    const incident = this.selectedIncident();
    if (!incident) return null;
    return incident.correctiveActionSummary || incident.rootCause || incident.investigationSummary || incident.immediateAction || null;
  }

  protected attentionHeadline() {
    const incident = this.selectedIncident();
    return incident && this.incidentAttentionReasons(incident).length
      ? 'This event currently needs management attention.'
      : 'This event is currently under control.';
  }

  protected attentionNarrative() {
    const incident = this.selectedIncident();
    if (!incident) {
      return 'Attention guidance appears after the event is saved.';
    }
    const reasons = this.incidentAttentionReasons(incident);
    if (!reasons.length) {
      return 'Ownership, severity, and current investigation state are clear enough for routine follow-up.';
    }
    return `Attention is needed because ${reasons.map((reason) => reason.toLowerCase()).join(', ')}.`;
  }

  protected attentionSummary(item: IncidentRow) {
    const reasons = this.incidentAttentionReasons(item);
    return reasons.length ? reasons.join(' | ') : '';
  }

  protected attentionLabel(item: IncidentRow) {
    const reasons = this.incidentAttentionReasons(item);
    if (!reasons.length) {
      return 'Under control';
    }
    return reasons.length > 1 ? `${reasons[0]} +${reasons.length - 1}` : reasons[0];
  }

  protected attentionClass(item: IncidentRow) {
    const reasons = this.incidentAttentionReasons(item);
    if (!reasons.length) {
      return 'success';
    }
    if (reasons.includes('High priority')) {
      return 'danger';
    }
    return 'warn';
  }

  protected incidentReturnNavigation() {
    const id = this.selectedId();
    return id ? { route: ['/incidents', id], label: 'incident' } : null;
  }

  protected sectionTitle(type: LinkType) {
    return { PROCESS: 'Linked Processes', RISK: 'Linked Risks', ACTION: 'Linked Actions' }[type];
  }

  protected sectionDescription(type: LinkType) {
    return {
      PROCESS: 'Processes affected by this event or responsible for maintaining the control.',
      RISK: 'Risks that reflect the exposure highlighted by this event.',
      ACTION: 'Follow-up actions already tracked in the global action register.'
    }[type];
  }

  protected sectionEmptyCopy(type: LinkType) {
    return {
      PROCESS: 'Link the affected process so the event can be reviewed in context.',
      RISK: 'Link a risk if this event exposes an existing weakness or area needing treatment.',
      ACTION: 'Link actions already being tracked for follow-up.'
    }[type];
  }

  protected sectionPickerLabel(type: LinkType) {
    return { PROCESS: 'Process', RISK: 'Risk', ACTION: 'Action' }[type];
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
      ? { returnNavigation: { route: ['/incidents', this.selectedId()], label: 'incident' } }
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
      ASSURANCE: 'Assurance',
      CORE_IMS: 'Core IMS',
      QHSE_PRO: 'QHSE Pro'
    }[packageTier];
  }

  protected save() {
    if (!this.canWrite()) return this.error.set('You do not have permission to edit incidents.');
    if (this.form.invalid) return this.error.set('Complete the required incident fields.');
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
        this.router.navigate(['/incidents', incident.id], { state: { notice: 'Incident saved successfully.' } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Incident save failed.'));
      }
    });
  }

  protected archiveIncident() {
    if (!this.selectedIncident() || !this.canDelete() || !window.confirm(`Archive incident "${this.selectedIncident()?.title}"?`)) return;
    this.api.delete<{ success: boolean }>(`incidents/${this.selectedId()}`).subscribe({
      next: () => this.router.navigate(['/incidents'], { state: { notice: 'Incident archived successfully.' } }),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'Incident archive failed.'))
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
    this.api.delete<{ success: boolean }>(`incidents/${this.selectedId()}/links/${linkId}`).subscribe({
      next: () => {
        this.fetchIncident(this.selectedId()!);
        this.message.set('Linked record removed.');
      },
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'Link removal failed.'))
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
        this.error.set(this.readError(error, 'Incident register could not be loaded.'));
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
        this.error.set(this.readError(error, 'Incident details could not be loaded.'));
      }
    });
  }

  private loadOwners() {
    this.api.get<UserSummary[]>('users').subscribe({
      next: (users) => this.owners.set(users),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'Incident owners could not be loaded.'))
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
    if (type === 'PROCESS') return `${item.referenceNo || 'Uncoded'} - ${item.name}`;
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
      PROCESS: 'Process Register',
      RISK: 'Risks',
      ACTION: 'Actions'
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
      reasons.push('Owner needed');
    }
    if (item.severity === 'HIGH' || item.severity === 'CRITICAL') {
      reasons.push('High priority');
    }
    if ((item.status === 'INVESTIGATION' || item.status === 'ACTION_IN_PROGRESS') && !item.rootCause) {
      reasons.push('Investigation incomplete');
    }
    if (this.isStale(item.updatedAt, 30)) {
      reasons.push('Stale');
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
