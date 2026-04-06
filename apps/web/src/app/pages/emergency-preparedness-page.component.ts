import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
import { PageHeaderComponent } from '../shared/page-header.component';

type PageMode = 'list' | 'create' | 'detail' | 'edit';
type EmergencyStatus = 'ACTIVE' | 'MONITORING' | 'OBSOLETE';
type EmergencyType = 'FIRE' | 'CHEMICAL_SPILL' | 'MEDICAL' | 'EVACUATION' | 'POWER_LOSS' | 'OTHER';
type LinkType = 'PROCESS' | 'RISK' | 'ACTION' | 'INCIDENT';

type UserSummary = { id: string; firstName: string; lastName: string; email: string };
type LinkCandidate = { id: string; label: string };

type EmergencyLink = {
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

type EmergencyRow = {
  id: string;
  referenceNo?: string | null;
  scenario: string;
  emergencyType: EmergencyType;
  potentialImpact: string;
  responseSummary?: string | null;
  resourceSummary?: string | null;
  ownerUserId?: string | null;
  drillFrequencyMonths?: number | null;
  nextDrillDate?: string | null;
  status: EmergencyStatus;
  createdAt: string;
  updatedAt: string;
  owner?: UserSummary | null;
  linkCount?: number;
  links?: EmergencyLink[];
};

@Component({
  selector: 'iso-emergency-preparedness-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent],
  templateUrl: './emergency-preparedness-page.component.html',
  styleUrl: './emergency-preparedness-page.component.css'
})
export class EmergencyPreparednessPageComponent implements OnInit, OnChanges {
  @Input() forcedMode?: PageMode;

  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
  protected readonly records = signal<EmergencyRow[]>([]);
  protected readonly owners = signal<UserSummary[]>([]);
  protected readonly selectedRecord = signal<EmergencyRow | null>(null);
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
    scenario: ['', [Validators.required, Validators.maxLength(180)]],
    emergencyType: ['OTHER' as EmergencyType, [Validators.required]],
    potentialImpact: ['', [Validators.required, Validators.maxLength(2000)]],
    responseSummary: ['', [Validators.maxLength(2000)]],
    resourceSummary: ['', [Validators.maxLength(2000)]],
    ownerUserId: [''],
    drillFrequencyMonths: [null as number | null],
    nextDrillDate: [''],
    status: ['ACTIVE' as EmergencyStatus]
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

  protected canWrite() { return this.authStore.hasPermission('emergency.write'); }
  protected canDelete() { return this.authStore.hasPermission('admin.delete'); }
  protected personName(user: UserSummary) { return `${user.firstName} ${user.lastName}`.trim(); }
  protected readInputValue(event: Event) { return (event.target as HTMLInputElement).value; }
  protected readSelectValue(event: Event) { return (event.target as HTMLSelectElement).value; }
  protected prettyStatus(value?: string | null) { return value ? value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (part) => part.toUpperCase()) : ''; }
  protected statusClass(value: EmergencyStatus) { return value === 'ACTIVE' ? 'success' : value === 'MONITORING' ? 'warn' : 'neutral'; }
  protected activeCount() { return this.records().filter((item) => item.status === 'ACTIVE').length; }
  protected monitoringCount() { return this.records().filter((item) => item.status === 'MONITORING').length; }
  protected dueSoonCount() { return this.records().filter((item) => !!item.nextDrillDate).length; }

  protected filteredRecords() {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const ownerId = this.ownerFilter();
    return this.records().filter((item) => {
      const matchesTerm =
        !term ||
        (item.referenceNo || '').toLowerCase().includes(term) ||
        item.scenario.toLowerCase().includes(term) ||
        item.potentialImpact.toLowerCase().includes(term);
      const matchesStatus = !status || item.status === status;
      const matchesOwner = !ownerId || item.ownerUserId === ownerId;
      return matchesTerm && matchesStatus && matchesOwner;
    });
  }

  protected pageTitle() {
    return {
      list: 'Emergency preparedness',
      create: 'Create emergency scenario',
      detail: this.selectedRecord()?.scenario || 'Emergency preparedness detail',
      edit: this.selectedRecord()?.scenario || 'Edit emergency scenario'
    }[this.mode()];
  }

  protected pageDescription() {
    return {
      list: 'Keep emergency scenarios, response expectations, and drill dates visible without turning the app into a response management system.',
      create: 'Record the scenario, expected impact, response summary, resources, and drill ownership in one lightweight register.',
      detail: 'Review the scenario, response controls, readiness timing, and linked IMS records.',
      edit: 'Update the preparedness record while keeping incidents, risks, processes, and actions in their original modules.'
    }[this.mode()];
  }

  protected breadcrumbs() {
    if (this.mode() === 'list') return [{ label: 'Emergency Preparedness' }];
    const base = [{ label: 'Emergency Preparedness', link: '/emergency-preparedness' }];
    if (this.mode() === 'create') return [...base, { label: 'New scenario' }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedRecord()?.scenario || 'Scenario', link: `/emergency-preparedness/${this.selectedId()}` }, { label: 'Edit' }];
    return [...base, { label: this.selectedRecord()?.scenario || 'Scenario' }];
  }

  protected guidance() {
    const raw = this.form.getRawValue();
    if (raw.scenario && raw.potentialImpact && raw.responseSummary && raw.ownerUserId) {
      return 'This scenario already shows what could happen, how the first response should work, and who owns the drill review.';
    }
    return 'Record the scenario, the potential impact, the expected response, and who keeps drills or readiness reviews on track.';
  }

  protected reviewNarrative() {
    const record = this.selectedRecord();
    if (!record) return 'Save the scenario first, then link the process, incident, risk, or action records that show how it is maintained.';
    if (!record.links?.length) return 'This emergency scenario is recorded, but its live controls and event traceability are not yet visible through linked records.';
    if (!this.linkCountByType('PROCESS') || !this.linkCountByType('INCIDENT')) return 'This scenario has some traceability, but it will be easier to review once both the owning process and the closest incident or near miss are linked.';
    return 'This scenario already shows where it is controlled and which linked records support readiness and follow-up.';
  }

  protected sectionTitle(type: LinkType) { return { PROCESS: 'Linked Processes', RISK: 'Linked Risks', ACTION: 'Linked Actions', INCIDENT: 'Linked Incidents' }[type]; }
  protected sectionDescription(type: LinkType) {
    return {
      PROCESS: 'Processes that own the operational controls or first response for this emergency scenario.',
      RISK: 'Risks used to track the exposure or preparedness weakness connected to this scenario.',
      ACTION: 'Follow-up actions already tracked in the global action register.',
      INCIDENT: 'Incidents or near misses that show why this scenario matters in practice.'
    }[type];
  }
  protected sectionEmptyCopy(type: LinkType) {
    return {
      PROCESS: 'Link the process that owns the response controls or local readiness checks.',
      RISK: 'Link a risk when this emergency scenario is also tracked through the formal Risk register.',
      ACTION: 'Link actions already being tracked for preparedness follow-up.',
      INCIDENT: 'Link an incident or near miss that demonstrates the scenario in practice.'
    }[type];
  }
  protected sectionPickerLabel(type: LinkType) { return { PROCESS: 'Process', RISK: 'Risk', ACTION: 'Action', INCIDENT: 'Incident' }[type]; }
  protected linksByType(type: LinkType) { return (this.selectedRecord()?.links || []).filter((link) => link.linkType === type); }
  protected linkCountByType(type: LinkType) { return this.linksByType(type).length; }
  protected linkRoute(link: EmergencyLink) { return link.path || '/emergency-preparedness'; }
  protected linkQueryParams(link: EmergencyLink) { return link.linkType === 'ACTION' ? { focusActionId: link.linkedId } : undefined; }
  protected linkState(link: EmergencyLink) {
    return link.linkType === 'ACTION'
      ? { returnNavigation: { route: ['/emergency-preparedness', this.selectedId()], label: 'emergency scenario' } }
      : undefined;
  }

  protected save() {
    if (!this.canWrite()) return this.error.set('You do not have permission to edit emergency preparedness records.');
    if (this.form.invalid) return this.error.set('Complete the required emergency preparedness fields.');
    this.saving.set(true);
    this.error.set('');
    const request = this.selectedId()
      ? this.api.patch<EmergencyRow>(`emergency-preparedness/${this.selectedId()}`, this.form.getRawValue())
      : this.api.post<EmergencyRow>('emergency-preparedness', this.form.getRawValue());
    request.subscribe({
      next: (record) => {
        this.saving.set(false);
        this.router.navigate(['/emergency-preparedness', record.id], { state: { notice: 'Emergency preparedness record saved successfully.' } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Emergency preparedness save failed.'));
      }
    });
  }

  protected archiveRecord() {
    if (!this.selectedRecord() || !this.canDelete() || !window.confirm(`Archive emergency scenario "${this.selectedRecord()?.scenario}"?`)) return;
    this.api.delete<{ success: boolean }>(`emergency-preparedness/${this.selectedId()}`).subscribe({
      next: () => this.router.navigate(['/emergency-preparedness'], { state: { notice: 'Emergency preparedness record archived successfully.' } }),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'Emergency preparedness archive failed.'))
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
    this.api.post<EmergencyLink>(`emergency-preparedness/${this.selectedId()}/links`, this.linkForm.getRawValue()).subscribe({
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
    this.api.delete<{ success: boolean }>(`emergency-preparedness/${this.selectedId()}/links/${linkId}`).subscribe({
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
      scenario: '',
      emergencyType: 'OTHER',
      potentialImpact: '',
      responseSummary: '',
      resourceSummary: '',
      ownerUserId: '',
      drillFrequencyMonths: null,
      nextDrillDate: '',
      status: 'ACTIVE'
    });
    this.closeLinkComposer();
  }

  private reloadRecords() {
    this.loading.set(true);
    this.api.get<EmergencyRow[]>('emergency-preparedness').subscribe({
      next: (items) => {
        this.loading.set(false);
        this.records.set(items);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Emergency preparedness records could not be loaded.'));
      }
    });
  }

  private fetchRecord(id: string) {
    this.loading.set(true);
    this.api.get<EmergencyRow>(`emergency-preparedness/${id}`).subscribe({
      next: (record) => {
        this.loading.set(false);
        this.selectedRecord.set(record);
        this.form.reset({
          referenceNo: record.referenceNo || '',
          scenario: record.scenario,
          emergencyType: record.emergencyType,
          potentialImpact: record.potentialImpact,
          responseSummary: record.responseSummary || '',
          resourceSummary: record.resourceSummary || '',
          ownerUserId: record.ownerUserId || '',
          drillFrequencyMonths: record.drillFrequencyMonths ?? null,
          nextDrillDate: record.nextDrillDate ? record.nextDrillDate.slice(0, 10) : '',
          status: record.status
        });
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Emergency preparedness details could not be loaded.'));
      }
    });
  }

  private loadOwners() {
    this.api.get<UserSummary[]>('users').subscribe({
      next: (users) => this.owners.set(users),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'Emergency preparedness owners could not be loaded.'))
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

@Component({ standalone: true, imports: [EmergencyPreparednessPageComponent], template: `<iso-emergency-preparedness-page [forcedMode]="'list'" />` })
export class EmergencyPreparednessListPageComponent {}

@Component({ standalone: true, imports: [EmergencyPreparednessPageComponent], template: `<iso-emergency-preparedness-page [forcedMode]="'create'" />` })
export class EmergencyPreparednessCreatePageComponent {}

@Component({ standalone: true, imports: [EmergencyPreparednessPageComponent], template: `<iso-emergency-preparedness-page [forcedMode]="'detail'" />` })
export class EmergencyPreparednessDetailPageComponent {}

@Component({ standalone: true, imports: [EmergencyPreparednessPageComponent], template: `<iso-emergency-preparedness-page [forcedMode]="'edit'" />` })
export class EmergencyPreparednessEditPageComponent {}
