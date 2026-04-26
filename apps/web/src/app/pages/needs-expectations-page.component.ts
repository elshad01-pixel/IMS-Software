import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnInit, SimpleChanges, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import { ContentLibraryResponse } from '../core/content-library.models';
import { ContentLibraryService } from '../core/content-library.service';
import { ContextApiService } from '../core/context-api.service';
import { InterestedPartyRecord, NeedExpectationRecord } from '../core/context.models';
import { IconActionButtonComponent } from '../shared/icon-action-button.component';
import { PageHeaderComponent } from '../shared/page-header.component';

type PageMode = 'list' | 'create' | 'edit';
type SourceNavigation = { route: string[]; label: string };

@Component({
  selector: 'iso-needs-expectations-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, IconActionButtonComponent],
  template: `
    <section class="page-grid">
      <iso-page-header [label]="'Clause 4'" [title]="pageTitle()" [description]="pageDescription()" [breadcrumbs]="breadcrumbs()">
        <a *ngIf="mode() === 'list' && canWrite()" routerLink="/context/needs-expectations/new" class="button-link">+ New need / expectation</a>
        <a *ngIf="sourceNavigation()" [routerLink]="sourceNavigation()!.route" class="button-link tertiary">Back to {{ sourceNavigation()!.label }}</a>
        <a *ngIf="mode() !== 'list'" routerLink="/context" class="button-link tertiary">Back to context</a>
        <a *ngIf="mode() !== 'list'" routerLink="/context/needs-expectations" class="button-link secondary">Back to list</a>
      </iso-page-header>

      <section *ngIf="!canRead()" class="card list-card">
        <div class="empty-state">
          <strong>Needs & expectations access is not available</strong>
          <span>Your current role does not include context.read.</span>
        </div>
      </section>

      <section *ngIf="canRead() && mode() === 'list'" class="page-stack">
        <div class="card list-card">
          <div class="toolbar">
            <div class="toolbar-meta">
              <div>
                <p class="toolbar-title">Needs & expectations</p>
                <p class="toolbar-copy">Keep stakeholder expectations visible without introducing complex workflow.</p>
              </div>
              <div class="toolbar-stats">
                <article class="toolbar-stat"><span>Total</span><strong>{{ needs().length }}</strong></article>
                <article class="toolbar-stat"><span>Parties</span><strong>{{ interestedParties().length }}</strong></article>
              </div>
            </div>
            <div class="filter-row standard-filter-grid">
              <label class="field compact-field">
                <span>Interested party</span>
                <select [value]="partyFilter()" (change)="partyFilter.set(readSelectValue($event))">
                  <option value="">All parties</option>
                  <option *ngFor="let item of interestedParties()" [value]="item.id">{{ item.name }}</option>
                </select>
              </label>
            </div>
          </div>

          <p class="feedback top-space" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <div class="empty-state top-space" *ngIf="loading()"><strong>Loading needs & expectations</strong><span>Refreshing stakeholder requirements.</span></div>
          <div class="empty-state top-space" *ngIf="!loading() && !filteredNeeds().length"><strong>No needs or expectations found</strong><span>Create the first record to make stakeholder expectations visible.</span></div>

          <div class="data-table-wrap top-space" *ngIf="!loading() && filteredNeeds().length">
            <table class="data-table">
              <thead><tr><th>Interested party</th><th>Description</th><th>Updated</th><th>Actions</th></tr></thead>
              <tbody>
                <tr *ngFor="let item of filteredNeeds()">
                  <td>{{ item.interestedParty?.name || 'Unknown party' }}</td>
                  <td>{{ item.description }}</td>
                  <td>{{ item.updatedAt | date:'yyyy-MM-dd' }}</td>
                  <td>
                    <div class="inline-actions">
                      <iso-icon-action-button [icon]="'view'" [label]="'Open need or expectation'" [routerLink]="['/context/needs-expectations', item.id, 'edit']" />
                      <iso-icon-action-button *ngIf="canDelete()" [icon]="'delete'" [label]="'Delete need or expectation'" [variant]="'danger'" (pressed)="deleteNeed(item.id)" />
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
          <div class="section-head"><div><span class="section-eyebrow">Needs & expectations</span><h3>{{ mode() === 'create' ? 'Create record' : 'Edit record' }}</h3><p class="subtle">Capture a stakeholder need or expectation in plain language.</p></div></div>
          <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>
          <div class="workspace-layout">
            <div class="primary-column page-stack">
              <section class="feedback next-steps-banner success" *ngIf="message() && !error()">
                <strong>{{ message() }}</strong>
                <span>{{ nextStepsCopy() }}</span>
                <div class="button-row top-space">
                  <a *ngIf="sourceNavigation()" [routerLink]="sourceNavigation()!.route" class="button-link secondary">Review {{ sourceNavigation()!.label }}</a>
                  <a routerLink="/context" class="button-link tertiary">Review context</a>
                </div>
              </section>

              <section class="detail-section">
                <label class="field"><span>Interested party</span><select formControlName="interestedPartyId"><option value="">Select a party</option><option *ngFor="let item of interestedParties()" [value]="item.id">{{ item.name }}</option></select></label>
                <label class="field top-space"><span>Description</span><textarea formControlName="description" rows="6" placeholder="Describe the need or expectation"></textarea></label>
              </section>
            </div>

            <aside class="secondary-column page-stack">
              <section class="content-guidance" *ngIf="suggestedNeeds().length">
                <div class="section-head compact-head">
                  <div>
                    <h4>Starter examples</h4>
                    <p class="subtle">Choose a common expectation for this interested party type, then refine it as needed.</p>
                  </div>
                </div>
                <div class="chip-row">
                  <button type="button" class="chip-button" *ngFor="let item of suggestedNeeds()" (click)="applyNeedExample(item)">{{ item }}</button>
                </div>
              </section>
            </aside>
          </div>
          <div class="button-row">
            <button type="submit" [disabled]="form.invalid || saving() || !canWrite()">{{ saving() ? 'Saving...' : 'Save need / expectation' }}</button>
            <a routerLink="/context/needs-expectations" class="button-link secondary">Cancel</a>
          </div>
        </form>

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
    @media (max-width: 1040px) {
      .workspace-layout {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `]
})
export class NeedsExpectationsPageComponent implements OnInit, OnChanges {
  @Input() forcedMode: PageMode | null = null;

  private readonly authStore = inject(AuthStore);
  private readonly contentLibrary = inject(ContentLibraryService);
  private readonly contextApi = inject(ContextApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
  protected readonly needs = signal<NeedExpectationRecord[]>([]);
  protected readonly interestedParties = signal<InterestedPartyRecord[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal((history.state?.notice as string) || '');
  protected readonly partyFilter = signal('');
  protected readonly library = signal<ContentLibraryResponse | null>(null);
  protected readonly sourceNavigation = signal<SourceNavigation | null>(null);
  protected readonly form = this.fb.nonNullable.group({
    interestedPartyId: ['', Validators.required],
    description: ['', [Validators.required, Validators.maxLength(4000)]]
  });
  protected readonly filteredNeeds = computed(() => {
    return this.needs().filter((item) => !this.partyFilter() || item.interestedPartyId === this.partyFilter());
  });

  ngOnInit() {
    this.loadInterestedParties();
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
  protected pageTitle() { return { list: 'Needs & Expectations', create: 'New Need / Expectation', edit: 'Edit Need / Expectation' }[this.mode()]; }
  protected pageDescription() { return this.mode() === 'list' ? 'Maintain stakeholder needs and expectations for Clause 4 review.' : 'Capture the need or expectation and link it to the right interested party.'; }
  protected breadcrumbs() {
    const base = [{ label: 'Context of Organization', link: '/context' }, { label: 'Needs & Expectations', link: '/context/needs-expectations' }];
    if (this.mode() === 'create') return [...base, { label: 'New' }];
    if (this.mode() === 'edit') return [...base, { label: 'Edit' }];
    return base;
  }
  protected readSelectValue(event: Event) { return (event.target as HTMLSelectElement).value; }
  protected suggestedNeeds() {
    const party = this.interestedParties().find((item) => item.id === this.form.getRawValue().interestedPartyId);
    if (!party || !this.library()) {
      return [];
    }
    return this.library()!.context.needsExpectationExamples[party.type] || [];
  }
  protected nextStepsCopy() {
    return this.mode() === 'create'
      ? 'Next: review the interested party and keep the expectation visible as part of Clause 4 context.'
      : 'Next: review the interested party and keep its expectations current as stakeholder needs change.';
  }
  protected applyNeedExample(example: string) {
    this.form.patchValue({ description: example });
  }

  protected save() {
    if (this.form.invalid || !this.canWrite()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const request = this.mode() === 'edit' && this.selectedId()
      ? this.contextApi.updateNeed(this.selectedId()!, this.form.getRawValue())
      : this.contextApi.createNeed(this.form.getRawValue());
    request.subscribe({
      next: (need) => {
        this.saving.set(false);
        void this.router.navigate(['/context/needs-expectations', need.id, 'edit'], {
          state: {
            notice: this.mode() === 'edit' ? 'Need / expectation updated.' : 'Need / expectation created.',
            sourceNavigation: this.sourceNavigation()
          }
        });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Need / expectation could not be saved.'));
      }
    });
  }

  protected deleteNeed(id: string) {
    if (!this.canDelete() || !window.confirm('Delete this need / expectation?')) {
      return;
    }
    this.contextApi.removeNeed(id).subscribe({
      next: () => {
        this.message.set('Need / expectation deleted.');
        this.reloadNeeds();
      },
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'Need / expectation deletion failed.'))
    });
  }

  private handleRoute(params: ParamMap) {
    if (!this.canRead()) return;
    const id = params.get('id');
    this.selectedId.set(id);
    this.message.set((history.state?.notice as string) || '');
    this.sourceNavigation.set((history.state?.sourceNavigation as SourceNavigation | undefined) ?? null);
    if (this.mode() === 'list') {
      this.reloadNeeds();
      return;
    }
    if (this.mode() === 'create' || !id) {
      const prefillInterestedPartyId = (history.state?.prefillInterestedPartyId as string | undefined) ?? '';
      this.resetForm(prefillInterestedPartyId);
      return;
    }
    this.loading.set(true);
    this.contextApi.getNeed(id).subscribe({
      next: (need) => {
        this.loading.set(false);
        this.form.reset({ interestedPartyId: need.interestedPartyId, description: need.description });
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Need / expectation could not be loaded.'));
      }
    });
  }

  private reloadNeeds() {
    this.loading.set(true);
    this.contextApi.listNeeds().subscribe({
      next: (needs) => {
        this.loading.set(false);
        this.needs.set(needs);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Needs & expectations could not be loaded.'));
      }
    });
  }

  private loadInterestedParties() {
    this.contextApi.listInterestedParties().subscribe({
      next: (parties) => this.interestedParties.set(parties),
      error: () => this.interestedParties.set([])
    });
  }

  private resetForm(prefillInterestedPartyId = '') {
    this.form.reset({ interestedPartyId: prefillInterestedPartyId, description: '' });
  }

  private loadContentLibrary() {
    this.contentLibrary.getLibrary().subscribe({
      next: (library) => this.library.set(library),
      error: () => this.library.set(null)
    });
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}

@Component({ standalone: true, imports: [NeedsExpectationsPageComponent], template: `<iso-needs-expectations-page [forcedMode]="'list'" />` })
export class NeedsExpectationsListPageComponent {}
@Component({ standalone: true, imports: [NeedsExpectationsPageComponent], template: `<iso-needs-expectations-page [forcedMode]="'create'" />` })
export class NeedExpectationCreatePageComponent {}
@Component({ standalone: true, imports: [NeedsExpectationsPageComponent], template: `<iso-needs-expectations-page [forcedMode]="'edit'" />` })
export class NeedExpectationEditPageComponent {}
