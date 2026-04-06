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
  protected personName(user: UserSummary) { return `${user.firstName} ${user.lastName}`.trim(); }
  protected readInputValue(event: Event) { return (event.target as HTMLInputElement).value; }
  protected readSelectValue(event: Event) { return (event.target as HTMLSelectElement).value; }
  protected prettyStatus(value?: string | null) { return value ? value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (part) => part.toUpperCase()) : ''; }
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
      list: 'Hazard identification',
      create: 'Create hazard record',
      detail: this.selectedHazard()?.hazard || 'Hazard detail',
      edit: this.selectedHazard()?.hazard || 'Edit hazard'
    }[this.mode()];
  }

  protected pageDescription() {
    return {
      list: 'Keep workplace hazards, potential harm, and linked controls visible without creating a duplicate incident or risk workflow.',
      create: 'Record the activity, hazard, potential harm, current controls, and review owner in one lightweight register.',
      detail: 'Review the hazard, its potential harm, current controls, and linked IMS records.',
      edit: 'Update the hazard record while keeping incidents, risks, processes, and actions in their original modules.'
    }[this.mode()];
  }

  protected breadcrumbs() {
    if (this.mode() === 'list') return [{ label: 'Hazard Identification' }];
    const base = [{ label: 'Hazard Identification', link: '/hazards' }];
    if (this.mode() === 'create') return [...base, { label: 'New hazard' }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedHazard()?.hazard || 'Hazard', link: `/hazards/${this.selectedId()}` }, { label: 'Edit' }];
    return [...base, { label: this.selectedHazard()?.hazard || 'Hazard' }];
  }

  protected hazardGuidance() {
    const raw = this.form.getRawValue();
    if (raw.activity && raw.hazard && raw.potentialHarm && raw.ownerUserId) {
      return 'This hazard record already shows the activity, the exposed harm, and who reviews the control position.';
    }
    return 'Record the activity, the hazard, the potential harm, and who reviews the current controls so the exposure stays visible.';
  }

  protected reviewNarrative() {
    const hazard = this.selectedHazard();
    if (!hazard) return 'Save the hazard first, then link the process, incident, risk, or action records that show how it is being managed.';
    if (!hazard.links?.length) return 'This hazard is recorded, but the operational controls and event history are not yet visible through linked records.';
    if (!this.linkCountByType('PROCESS') || !this.linkCountByType('INCIDENT')) return 'This hazard has some traceability, but it will be stronger once the owning process and the closest incident or near miss are both linked.';
    return 'This hazard already shows where it is controlled and where the supporting incident, risk, and action evidence sits.';
  }
  protected nextStepHeadline() {
    const hazard = this.selectedHazard();
    if (!hazard) return 'Next steps appear after the hazard is saved.';
    if (!this.linkCountByType('RISK')) return 'Link the formal risk assessment next.';
    if (!this.linkCountByType('ACTION') && hazard.severity === 'HIGH') return 'Prepare a hazard follow-up action next.';
    if (!this.linkCountByType('PROCESS') || !this.linkCountByType('INCIDENT')) return 'Complete the control and event picture for this hazard.';
    return 'This hazard is connected to the main control records.';
  }
  protected nextStepNarrative() {
    const hazard = this.selectedHazard();
    if (!hazard) return 'Save the hazard first, then decide whether the next step is risk assessment, action follow-up, or event/process traceability.';
    if (!this.linkCountByType('RISK')) {
      return 'This hazard identifies the source of harm, but the formal assessment still needs to be visible in the Risk register.';
    }
    if (!this.linkCountByType('ACTION') && hazard.severity === 'HIGH') {
      return 'The hazard is already visible and high severity. Prepare an action so control improvement ownership and due dates stay visible in the global tracker.';
    }
    if (!this.linkCountByType('PROCESS') || !this.linkCountByType('INCIDENT')) {
      return 'Link the owning process and any related incident or near miss so this hazard is easier to review during OH&S follow-up.';
    }
    return 'The hazard already shows identification, formal risk connection, event context, and action follow-up in one place.';
  }
  protected hazardDraftTitle() {
    const hazard = this.selectedHazard();
    if (!hazard) return null;
    return `Hazard follow-up: ${hazard.hazard}`;
  }
  protected hazardDraftDescription() {
    const hazard = this.selectedHazard();
    if (!hazard) return null;
    const lines = [
      hazard.existingControls?.trim(),
      `Potential harm: ${hazard.potentialHarm}`,
      !this.linkCountByType('RISK') ? 'Formal risk assessment still needs to be linked.' : ''
    ].filter(Boolean);
    return lines.join('\n\n');
  }
  protected hazardReturnNavigation(): ReturnNavigation | null {
    const id = this.selectedId();
    return id ? { route: ['/hazards', id], label: 'hazard record' } : null;
  }

  protected sectionTitle(type: LinkType) { return { PROCESS: 'Linked Processes', RISK: 'Linked Risks', ACTION: 'Linked Actions', INCIDENT: 'Linked Incidents' }[type]; }
  protected sectionDescription(type: LinkType) {
    return {
      PROCESS: 'Processes that own or apply the operational control for this hazard.',
      RISK: 'Risks that formally assess and manage the exposure created by this hazard. The hazard stays as the identification record, while the risk holds the assessed treatment path.',
      ACTION: 'Follow-up actions already tracked in the global action register.',
      INCIDENT: 'Incidents or near misses that show the hazard in a real event context.'
    }[type];
  }
  protected sectionEmptyCopy(type: LinkType) {
    return {
      PROCESS: 'Link the process that owns the routine control for this hazard.',
      RISK: 'Link a risk when this hazard has been formally assessed in the Risk register and is being managed through the risk workflow.',
      ACTION: 'Link actions already being tracked for follow-up.',
      INCIDENT: 'Link a related incident or near miss to keep event evidence visible.'
    }[type];
  }
  protected sectionPickerLabel(type: LinkType) { return { PROCESS: 'Process', RISK: 'Risk', ACTION: 'Action', INCIDENT: 'Incident' }[type]; }
  protected linksByType(type: LinkType) { return (this.selectedHazard()?.links || []).filter((link) => link.linkType === type); }
  protected linkCountByType(type: LinkType) { return this.linksByType(type).length; }
  protected linkRoute(link: HazardLink) { return link.path || '/hazards'; }
  protected linkQueryParams(link: HazardLink) { return link.linkType === 'ACTION' ? { focusActionId: link.linkedId } : undefined; }
  protected linkState(link: HazardLink) {
    return link.linkType === 'ACTION'
      ? { returnNavigation: { route: ['/hazards', this.selectedId()], label: 'hazard record' } }
      : undefined;
  }

  protected save() {
    if (!this.canWrite()) return this.error.set('You do not have permission to edit hazards.');
    if (this.form.invalid) return this.error.set('Complete the required hazard fields.');
    this.saving.set(true);
    this.error.set('');
    const request = this.selectedId()
      ? this.api.patch<HazardRow>(`hazards/${this.selectedId()}`, this.form.getRawValue())
      : this.api.post<HazardRow>('hazards', this.form.getRawValue());
    request.subscribe({
      next: (hazard) => {
        this.saving.set(false);
        this.router.navigate(['/hazards', hazard.id], { state: { notice: 'Hazard saved successfully.' } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Hazard save failed.'));
      }
    });
  }

  protected archiveHazard() {
    if (!this.selectedHazard() || !this.canDelete() || !window.confirm(`Archive hazard "${this.selectedHazard()?.hazard}"?`)) return;
    this.api.delete<{ success: boolean }>(`hazards/${this.selectedId()}`).subscribe({
      next: () => this.router.navigate(['/hazards'], { state: { notice: 'Hazard archived successfully.' } }),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'Hazard archive failed.'))
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
    this.api.delete<{ success: boolean }>(`hazards/${this.selectedId()}/links/${linkId}`).subscribe({
      next: () => {
        this.fetchHazard(this.selectedId()!);
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
        this.error.set(this.readError(error, 'Hazards could not be loaded.'));
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
        this.error.set(this.readError(error, 'Hazard details could not be loaded.'));
      }
    });
  }

  private loadOwners() {
    this.api.get<UserSummary[]>('users').subscribe({
      next: (users) => this.owners.set(users),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'Hazard owners could not be loaded.'))
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
    if (type === 'PROCESS') return `${item.referenceNo || 'Uncoded'} - ${item.name}`;
    if (type === 'RISK') return item.title;
    if (type === 'INCIDENT') return `${item.referenceNo || 'Uncoded'} - ${item.title}`;
    return item.title;
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
