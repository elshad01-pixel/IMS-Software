import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnInit, SimpleChanges, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import { InterestedPartyTypeGuide } from '../core/content-library.models';
import { ContentLibraryService } from '../core/content-library.service';
import { ContextApiService } from '../core/context-api.service';
import { CustomerSurveyRequestRecord, InterestedPartyRecord, InterestedPartyType } from '../core/context.models';
import { IconActionButtonComponent } from '../shared/icon-action-button.component';
import { PageHeaderComponent } from '../shared/page-header.component';

type PageMode = 'list' | 'create' | 'edit';
type SourceNavigation = { route: string[]; label: string };

@Component({
  selector: 'iso-interested-parties-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, IconActionButtonComponent],
  template: `
    <section class="page-grid">
      <iso-page-header [label]="'Clause 4'" [title]="pageTitle()" [description]="pageDescription()" [breadcrumbs]="breadcrumbs()">
        <a *ngIf="mode() === 'list' && canWrite()" routerLink="/context/interested-parties/new" class="button-link">+ New interested party</a>
        <button *ngIf="mode() === 'edit' && selectedParty() && canWrite()" type="button" class="button-link tertiary" (click)="createNeedFromParty()">+ New need / expectation</button>
        <a *ngIf="mode() !== 'list'" routerLink="/context" class="button-link tertiary">Back to context</a>
        <a *ngIf="mode() !== 'list'" routerLink="/context/interested-parties" class="button-link secondary">Back to list</a>
      </iso-page-header>

      <section *ngIf="!canRead()" class="card list-card">
        <div class="empty-state">
          <strong>Interested party access is not available</strong>
          <span>Your current role does not include context.read.</span>
        </div>
      </section>

      <section *ngIf="canRead() && mode() === 'list'" class="page-stack">
        <div class="card panel-card" *ngIf="customerParties().length">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Customer survey</span>
              <h3>Customer feedback links</h3>
              <p class="subtle">Prepare a survey link when you need live customer feedback, then keep the response picture visible here.</p>
            </div>
          </div>

          <p class="feedback top-space" [class.is-empty]="!surveyError() && !surveyMessage()" [class.error]="!!surveyError()" [class.success]="!!surveyMessage() && !surveyError()">{{ surveyError() || surveyMessage() }}</p>

          <div class="survey-workspace top-space">
            <div class="survey-primary page-stack">
              <label class="field">
                <span>Customer</span>
                <select [value]="selectedSurveyPartyId()" (change)="selectedSurveyPartyId.set(readSelectValue($event))">
                  <option value="">Select customer</option>
                  <option *ngFor="let item of customerParties()" [value]="item.id">{{ item.name }}</option>
                </select>
              </label>

              <form class="page-stack" [formGroup]="surveyRequestForm" (ngSubmit)="createSurveyRequest()">
                <div class="form-grid-3">
                  <label class="field"><span>Recipient name</span><input formControlName="recipientName" placeholder="Optional contact name"></label>
                  <label class="field"><span>Recipient email</span><input formControlName="recipientEmail" placeholder="Optional email reference"></label>
                  <label class="field"><span>Expiry date</span><input type="date" formControlName="expiresAt"></label>
                </div>
                <div class="button-row">
                  <button type="submit" [disabled]="!selectedSurveyPartyId() || surveyRequestForm.invalid || surveySaving() || !canWrite()">{{ surveySaving() ? 'Preparing link...' : 'Prepare survey link' }}</button>
                </div>
              </form>

              <section class="guidance-card" *ngIf="latestSurveyUrl()">
                <strong>Latest survey link</strong>
                <p class="survey-link">{{ latestSurveyUrl() }}</p>
                <div class="button-row top-space">
                  <a [href]="latestSurveyUrl()" target="_blank" rel="noopener noreferrer" class="button-link">Open survey</a>
                  <button type="button" class="secondary" (click)="copyLatestSurveyLink()">Copy link</button>
                </div>
              </section>
            </div>

            <aside class="survey-secondary page-stack" *ngIf="selectedSurveyParty()">
              <section class="guidance-card">
                <strong>{{ selectedSurveyParty()!.name }}</strong>
                <p>
                  Responses: {{ selectedSurveyParty()?.surveySummary?.responseCount ?? 0 }}
                  | Open links: {{ selectedSurveyParty()?.surveySummary?.openRequestCount ?? 0 }}
                  | Average: {{ formatScore(selectedSurveyParty()?.surveySummary?.averageScore) }}
                </p>
                <small>Scale guide: 0-6 needs attention, 7-8 acceptable, 9-10 strong.</small>
              </section>

              <div class="compact-metric-grid" *ngIf="selectedSurveyParty()">
                <article class="mini-metric" *ngFor="let metric of selectedSurveyPartyMetrics()">
                  <span>{{ metric.label }}</span>
                  <strong>{{ formatScore(metric.averageScore) }}</strong>
                </article>
              </div>
            </aside>
          </div>

          <div class="entity-list top-space" *ngIf="selectedSurveyParty()?.surveyRequests?.length">
            <article class="entity-item" *ngFor="let item of selectedSurveyParty()?.surveyRequests || []">
              <div class="entity-item__head">
                <strong>{{ item.title }}</strong>
                <span class="status-badge" [class.warn]="item.status === 'OPEN' || item.status === 'EXPIRED'" [class.success]="item.status === 'COMPLETED'">{{ item.status }}</span>
              </div>
              <small>
                {{ item.recipientEmail || item.recipientName || 'No recipient reference' }}
                | Sent {{ item.sentAt ? (item.sentAt | date:'yyyy-MM-dd') : 'Not sent' }}
                | {{ item.averageScore != null ? ('Average ' + item.averageScore) : 'Awaiting response' }}
              </small>
              <small *ngIf="item.improvementPriority">Improve first: {{ item.improvementPriority }}</small>
              <small *ngIf="item.whatWorkedWell">Worked well: {{ item.whatWorkedWell }}</small>
              <small *ngIf="item.comments">{{ item.comments }}</small>
              <div class="button-row top-space">
                <a [href]="buildAbsoluteSurveyUrl(item.surveyUrl)" target="_blank" rel="noopener noreferrer" class="button-link secondary">Open survey</a>
              </div>
            </article>
          </div>
        </div>

        <div class="card list-card">
          <div class="toolbar">
            <div class="toolbar-meta">
              <div>
                <p class="toolbar-title">Interested parties</p>
                <p class="toolbar-copy">Keep customers, regulators, employees, suppliers, and other parties visible in the IMS context.</p>
              </div>
            </div>
            <div class="filter-row standard-filter-grid">
              <label class="field compact-field search-field">
                <span>Search</span>
                <input [value]="search()" (input)="search.set(readInputValue($event))" placeholder="Name or description">
              </label>
              <label class="field compact-field">
                <span>Type</span>
                <select [value]="typeFilter()" (change)="typeFilter.set(readSelectValue($event))">
                  <option value="">All types</option>
                  <option *ngFor="let item of typeOptions" [value]="item">{{ labelize(item) }}</option>
                </select>
              </label>
            </div>
          </div>

          <p class="feedback top-space" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <div class="empty-state top-space" *ngIf="loading()"><strong>Loading interested parties</strong><span>Refreshing Clause 4 stakeholder records.</span></div>
          <div class="empty-state top-space" *ngIf="!loading() && !filteredParties().length"><strong>No interested parties found</strong><span>Create the first party to maintain stakeholder needs clearly.</span></div>

          <div class="data-table-wrap top-space" *ngIf="!loading() && filteredParties().length">
            <table class="data-table">
              <thead><tr><th>Name</th><th>Type</th><th>Needs</th><th>Survey</th><th>Updated</th><th>Actions</th></tr></thead>
              <tbody>
                <tr *ngFor="let item of filteredParties()">
                  <td><div class="table-title"><strong>{{ item.name }}</strong><small>{{ item.description || 'No description recorded' }}</small></div></td>
                  <td>{{ labelize(item.type) }}</td>
                  <td>{{ item.needCount || 0 }}</td>
                  <td>{{ interestedPartySurveyStatus(item) }}</td>
                  <td>{{ item.updatedAt | date:'yyyy-MM-dd' }}</td>
                  <td>
                    <div class="inline-actions">
                      <iso-icon-action-button [icon]="'view'" [label]="'Open interested party'" [routerLink]="['/context/interested-parties', item.id, 'edit']" />
                      <iso-icon-action-button *ngIf="canDelete()" [icon]="'delete'" [label]="'Delete interested party'" [variant]="'danger'" (pressed)="deleteParty(item.id)" />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section *ngIf="canRead() && (mode() === 'create' || mode() === 'edit')" class="page-stack">
        <form class="card form-card page-stack" [formGroup]="form" (ngSubmit)="save()">
          <div class="section-head"><div><span class="section-eyebrow">Interested party</span><h3>{{ mode() === 'create' ? 'Create interested party' : 'Edit interested party' }}</h3><p class="subtle">Keep the record lightweight and link expectations in the dedicated register.</p></div></div>
          <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>
          <div class="workspace-layout">
            <div class="primary-column page-stack">
              <section class="feedback next-steps-banner success" *ngIf="message() && !error()">
                <strong>{{ message() }}</strong>
                <span>{{ nextStepsCopy() }}</span>
                <div class="button-row top-space" *ngIf="mode() === 'edit' && selectedParty()">
                  <button type="button" (click)="createNeedFromParty()">Add need / expectation</button>
                  <a routerLink="/context" class="button-link tertiary">Review context</a>
                </div>
              </section>

              <section class="detail-section">
                <div class="form-grid-2">
                  <label class="field"><span>Name</span><input formControlName="name" placeholder="Regulator, customer group, supplier"></label>
                  <label class="field"><span>Type</span><select formControlName="type"><option *ngFor="let item of typeOptions" [value]="item">{{ labelize(item) }}</option></select></label>
                </div>

                <label class="field top-space"><span>Description</span><textarea formControlName="description" rows="5" placeholder="Optional context about this interested party"></textarea></label>
              </section>
            </div>

            <aside class="secondary-column page-stack">
              <section class="content-guidance" *ngIf="selectedTypeGuide() as guide">
                <div class="section-head compact-head">
                  <div>
                    <h4>Starter examples</h4>
                    <p class="subtle">Use one of these as a starting point, then rename it to fit your organization.</p>
                  </div>
                </div>
                <div class="chip-row">
                  <button type="button" class="chip-button" *ngFor="let example of guide.examples" (click)="applyPartyExample(example)">{{ example }}</button>
                </div>
              </section>
            </aside>
          </div>

          <div class="button-row">
            <button type="submit" [disabled]="form.invalid || saving() || !canWrite()">{{ saving() ? 'Saving...' : 'Save interested party' }}</button>
            <a routerLink="/context/interested-parties" class="button-link secondary">Cancel</a>
          </div>
        </form>

        <section class="card panel-card page-stack" *ngIf="mode() === 'edit' && selectedParty()?.type === 'CUSTOMER' && selectedParty()?.surveyRequests?.length">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Survey history</span>
              <h3>Recorded customer survey responses</h3>
              <p class="subtle">This page keeps the customer record simple. Use the survey panel on the Interested Parties register to issue new survey links.</p>
            </div>
          </div>
          <div class="summary-strip">
            <article class="summary-item">
              <span>Responses</span>
              <strong>{{ selectedParty()?.surveySummary?.responseCount ?? 0 }}</strong>
            </article>
            <article class="summary-item">
              <span>Open links</span>
              <strong>{{ selectedParty()?.surveySummary?.openRequestCount ?? 0 }}</strong>
            </article>
            <article class="summary-item">
              <span>Average</span>
              <strong>{{ formatScore(selectedParty()?.surveySummary?.averageScore) }}</strong>
            </article>
          </div>

          <div class="form-grid-4 top-space category-score-grid">
            <article class="mini-metric" *ngFor="let metric of categoryMetrics()">
              <span>{{ metric.label }}</span>
              <strong>{{ formatScore(metric.averageScore) }}</strong>
            </article>
          </div>

          <div class="entity-list top-space">
            <article class="entity-item" *ngFor="let item of selectedParty()?.surveyRequests || []">
              <div class="entity-item__head">
                <strong>{{ item.title }}</strong>
                <span class="status-badge" [class.warn]="item.status === 'OPEN' || item.status === 'EXPIRED'" [class.success]="item.status === 'COMPLETED'">{{ item.status }}</span>
              </div>
              <small>
                {{ item.recipientEmail || item.recipientName || 'No recipient reference' }}
                | Sent {{ item.sentAt ? (item.sentAt | date:'yyyy-MM-dd') : 'Not sent' }}
                | {{ item.averageScore != null ? ('Average ' + item.averageScore) : 'Awaiting response' }}
              </small>
              <small *ngIf="item.improvementPriority">Improve first: {{ item.improvementPriority }}</small>
              <small *ngIf="item.whatWorkedWell">Worked well: {{ item.whatWorkedWell }}</small>
              <small *ngIf="item.comments">{{ item.comments }}</small>
              <div class="button-row top-space">
                <a [href]="buildAbsoluteSurveyUrl(item.surveyUrl)" target="_blank" rel="noopener noreferrer" class="button-link secondary">Open survey</a>
              </div>
            </article>
          </div>
        </section>

      </section>
    </section>
  `,
  styles: [`
    .workspace-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.95fr);
      gap: 1rem;
      align-items: start;
    }
    .survey-workspace {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(260px, 0.8fr);
      gap: 1rem;
      align-items: start;
    }
    .chip-row { display: flex; flex-wrap: wrap; gap: 0.6rem; }
    .chip-button {
      border: 1px solid var(--border-subtle);
      background: color-mix(in srgb, var(--surface-strong) 88%, white);
      border-radius: 999px;
      padding: 0.5rem 0.9rem;
      color: var(--text-strong);
      cursor: pointer;
      font: inherit;
    }
    .content-guidance {
      border: 1px solid var(--border-subtle);
      border-radius: 1rem;
      padding: 1rem;
      background: color-mix(in srgb, var(--surface-strong) 92%, white);
    }
    .compact-head { align-items: center; }
    .next-steps-banner {
      display: grid;
      gap: 0.35rem;
      margin-top: 1rem;
      padding: 1rem 1.1rem;
      border-radius: 1rem;
      border: 1px solid rgba(47, 107, 69, 0.16);
      background: rgba(47, 107, 69, 0.08);
    }
    .toggle-row {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      font-weight: 600;
      color: var(--text-strong);
    }
    .category-score-grid {
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    }
    .compact-metric-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(120px, 1fr));
      gap: 0.75rem;
    }
    .mini-metric {
      border: 1px solid var(--border-subtle);
      border-radius: 1rem;
      padding: 0.85rem 1rem;
      background: color-mix(in srgb, var(--surface-strong) 92%, white);
      display: grid;
      gap: 0.2rem;
    }
    .mini-metric span {
      color: var(--text-muted);
      font-size: 0.86rem;
    }
    .mini-metric strong {
      font-size: 1.35rem;
    }
    .survey-link {
      word-break: break-all;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.92rem;
    }
    .entity-item__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }
    @media (max-width: 1040px) {
      .workspace-layout,
      .survey-workspace {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `]
})
export class InterestedPartiesPageComponent implements OnInit, OnChanges {
  @Input() forcedMode: PageMode | null = null;

  private readonly authStore = inject(AuthStore);
  private readonly contentLibrary = inject(ContentLibraryService);
  private readonly contextApi = inject(ContextApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
  protected readonly parties = signal<InterestedPartyRecord[]>([]);
  protected readonly selectedParty = signal<InterestedPartyRecord | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal((history.state?.notice as string) || '');
  protected readonly surveySaving = signal(false);
  protected readonly surveyError = signal('');
  protected readonly surveyMessage = signal('');
  protected readonly latestSurveyUrl = signal('');
  protected readonly selectedSurveyPartyId = signal('');
  protected readonly search = signal('');
  protected readonly typeFilter = signal('');
  protected readonly typeGuides = signal<InterestedPartyTypeGuide[]>([]);
  protected readonly sourceNavigation = signal<SourceNavigation | null>(null);
  protected readonly typeOptions: InterestedPartyType[] = ['CUSTOMER', 'REGULATOR', 'EMPLOYEE', 'SUPPLIER', 'OTHER'];
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    type: ['CUSTOMER' as InterestedPartyType, Validators.required],
    description: ['', [Validators.maxLength(2000)]]
  });
  protected readonly surveyRequestForm = this.fb.nonNullable.group({
    recipientName: ['', [Validators.maxLength(160)]],
    recipientEmail: ['', [Validators.email, Validators.maxLength(160)]],
    expiresAt: ['']
  });
  protected readonly filteredParties = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.parties().filter((item) => {
      const matchesSearch = !term || [item.name, item.description || ''].some((value) => value.toLowerCase().includes(term));
      const matchesType = !this.typeFilter() || item.type === this.typeFilter();
      return matchesSearch && matchesType;
    });
  });
  protected readonly customerParties = computed(() => this.parties().filter((item) => item.type === 'CUSTOMER'));
  protected readonly selectedSurveyParty = computed(
    () => this.customerParties().find((item) => item.id === this.selectedSurveyPartyId()) ?? null
  );

  ngOnInit() {
    this.loadContentLibrary();
    if (this.forcedMode) {
      this.mode.set(this.forcedMode);
      this.handleRoute(this.route.snapshot.paramMap);
    }
    this.route.paramMap.subscribe((params) => this.handleRoute(params));
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['forcedMode'] && this.forcedMode) {
      this.mode.set(this.forcedMode);
      this.handleRoute(this.route.snapshot.paramMap);
    }
  }

  protected canRead() { return this.authStore.hasPermission('context.read'); }
  protected canWrite() { return this.authStore.hasPermission('context.write'); }
  protected canDelete() { return this.authStore.hasPermission('admin.delete'); }
  protected pageTitle() { return { list: 'Interested Parties', create: 'New Interested Party', edit: this.selectedParty()?.name || 'Edit Interested Party' }[this.mode()]; }
  protected pageDescription() { return this.mode() === 'list' ? 'Keep stakeholder context available for Clause 4 review.' : 'Capture the interested party in a simple, maintainable way.'; }
  protected breadcrumbs() {
    const base = [{ label: 'Context of Organization', link: '/context' }, { label: 'Interested Parties', link: '/context/interested-parties' }];
    if (this.mode() === 'create') return [...base, { label: 'New' }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedParty()?.name || 'Edit' }];
    return base;
  }
  protected labelize(value: string) { return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (part) => part.toUpperCase()); }
  protected readInputValue(event: Event) { return (event.target as HTMLInputElement).value; }
  protected readSelectValue(event: Event) { return (event.target as HTMLSelectElement).value; }
  protected selectedTypeGuide() {
    return this.typeGuides().find((guide) => guide.value === this.form.getRawValue().type) ?? null;
  }
  protected nextStepsCopy() {
    return this.mode() === 'create'
      ? 'Next: add the main need or expectation for this party so Clause 4 stays connected and reviewable.'
      : 'Next: keep this party current and add or review its main needs and expectations as they change.';
  }
  protected formatScore(value?: number | null) {
    return value == null ? 'No data' : value.toFixed(2);
  }
  protected categoryMetrics() {
    return this.selectedParty()?.surveySummary?.categoryAverages || [];
  }
  protected selectedSurveyPartyMetrics() {
    return this.selectedSurveyParty()?.surveySummary?.categoryAverages || [];
  }
  protected interestedPartySurveyStatus(item: InterestedPartyRecord) {
    if (item.type !== 'CUSTOMER') {
      return 'Not used';
    }
    const responseCount = item.surveySummary?.responseCount ?? 0;
    const openLinks = item.surveySummary?.openRequestCount ?? 0;
    if (responseCount) {
      return `${responseCount} responses`;
    }
    if (openLinks) {
      return `${openLinks} open link${openLinks === 1 ? '' : 's'}`;
    }
    return 'Ready';
  }
  protected applyPartyExample(example: string) {
    this.form.patchValue({ name: example });
  }
  protected createNeedFromParty() {
    const party = this.selectedParty();
    if (!party) {
      return;
    }

    void this.router.navigate(['/context/needs-expectations/new'], {
      state: {
        prefillInterestedPartyId: party.id,
        sourceNavigation: {
          route: ['/context', 'interested-parties', party.id, 'edit'],
          label: 'interested party'
        }
      }
    });
  }

  protected save() {
    if (this.form.invalid || !this.canWrite()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const raw = this.form.getRawValue();
    const payload = {
      name: raw.name,
      type: raw.type,
      description: raw.description
    };
    const request = this.mode() === 'edit' && this.selectedId()
      ? this.contextApi.updateInterestedParty(this.selectedId()!, payload)
      : this.contextApi.createInterestedParty(payload);
    request.subscribe({
      next: (party) => {
        this.saving.set(false);
        void this.router.navigate(['/context/interested-parties', party.id, 'edit'], {
          state: { notice: this.mode() === 'edit' ? 'Interested party updated.' : 'Interested party created.' }
        });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Interested party could not be saved.'));
      }
    });
  }

  protected createSurveyRequest() {
    if (!this.selectedSurveyPartyId() || this.surveyRequestForm.invalid || !this.canWrite()) {
      this.surveyRequestForm.markAllAsTouched();
      return;
    }
    this.surveySaving.set(true);
    this.surveyError.set('');
    this.surveyMessage.set('');
    this.contextApi.createCustomerSurveyRequest(this.selectedSurveyPartyId(), this.surveyRequestForm.getRawValue()).subscribe({
      next: (request) => {
        this.surveySaving.set(false);
        this.latestSurveyUrl.set(this.buildAbsoluteSurveyUrl(request.surveyUrl));
        this.surveyMessage.set('Survey link prepared. Share it with the customer.');
        this.surveyRequestForm.reset({
          recipientName: '',
          recipientEmail: '',
          expiresAt: ''
        });
        this.reloadCurrentParty();
      },
      error: (error: HttpErrorResponse) => {
        this.surveySaving.set(false);
        this.surveyError.set(this.readError(error, 'Survey link could not be prepared.'));
      }
    });
  }

  protected copyLatestSurveyLink() {
    const url = this.latestSurveyUrl();
    if (!url) {
      return;
    }
    void navigator.clipboard?.writeText(url);
    this.surveyMessage.set('Survey link copied.');
  }

  protected deleteParty(id: string) {
    if (!this.canDelete() || !window.confirm('Delete this interested party?')) {
      return;
    }
    this.contextApi.removeInterestedParty(id).subscribe({
      next: () => {
        this.message.set('Interested party deleted.');
        this.reloadParties();
      },
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'Interested party deletion failed.'))
    });
  }

  private handleRoute(params: ParamMap) {
    if (!this.canRead()) return;
    const id = params.get('id');
    this.selectedId.set(id);
    this.message.set((history.state?.notice as string) || '');
    this.surveyMessage.set('');
    this.surveyError.set('');
    this.latestSurveyUrl.set('');
    this.sourceNavigation.set((history.state?.sourceNavigation as SourceNavigation | undefined) ?? null);
    if (this.mode() === 'list') {
      this.selectedParty.set(null);
      this.reloadParties();
      return;
    }
    if (this.mode() === 'create' || !id) {
      this.selectedParty.set(null);
      this.resetForm();
      return;
    }
    this.loading.set(true);
    this.contextApi.getInterestedParty(id).subscribe({
      next: (party) => {
        this.loading.set(false);
        this.selectedParty.set(party);
        this.form.reset({
          name: party.name,
          type: party.type,
          description: party.description || ''
        });
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Interested party could not be loaded.'));
      }
    });
  }

  private reloadParties() {
    this.loading.set(true);
    this.contextApi.listInterestedParties().subscribe({
      next: (parties) => {
        this.loading.set(false);
        this.parties.set(parties);
        if (!this.selectedSurveyPartyId() || !parties.some((item) => item.id === this.selectedSurveyPartyId())) {
          this.selectedSurveyPartyId.set(parties.find((item) => item.type === 'CUSTOMER')?.id || '');
        }
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Interested parties could not be loaded.'));
      }
    });
  }

  private resetForm() {
    this.form.reset({
      name: '',
      type: 'CUSTOMER',
      description: ''
    });
    this.surveyRequestForm.reset({ recipientName: '', recipientEmail: '', expiresAt: '' });
  }

  private loadContentLibrary() {
    this.contentLibrary.getLibrary().subscribe({
      next: (library) => this.typeGuides.set(library.context.interestedPartyTypes),
      error: () => this.typeGuides.set([])
    });
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }

  private reloadCurrentParty() {
    if (!this.selectedId()) {
      return;
    }
    this.contextApi.getInterestedParty(this.selectedId()!).subscribe({
      next: (party) => this.selectedParty.set(party),
      error: () => undefined
    });
  }

  protected buildAbsoluteSurveyUrl(path: string) {
    return new URL(path, window.location.origin).toString();
  }
}

@Component({ standalone: true, imports: [InterestedPartiesPageComponent], template: `<iso-interested-parties-page [forcedMode]="'list'" />` })
export class InterestedPartiesListPageComponent {}
@Component({ standalone: true, imports: [InterestedPartiesPageComponent], template: `<iso-interested-parties-page [forcedMode]="'create'" />` })
export class InterestedPartyCreatePageComponent {}
@Component({ standalone: true, imports: [InterestedPartiesPageComponent], template: `<iso-interested-parties-page [forcedMode]="'edit'" />` })
export class InterestedPartyEditPageComponent {}
