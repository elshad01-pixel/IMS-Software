import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
import { I18nService } from '../core/i18n.service';
import { IconActionButtonComponent } from '../shared/icon-action-button.component';
import { PageHeaderComponent } from '../shared/page-header.component';

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type ActionStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
type ActionSortOption = 'attention' | 'dueDate' | 'updated' | 'source';
type AttentionReason = 'OVERDUE' | 'DUE_SOON' | 'OWNER_NEEDED';

type ActionRecord = {
  id: string;
  title: string;
  description?: string | null;
  ownerId?: string | null;
  dueDate?: string | null;
  status: ActionStatus;
  sourceType: string;
  sourceId: string;
  sourceLabel: string;
  sourceTitle: string;
  createdAt?: string;
  updatedAt?: string;
  owner?: UserOption | null;
};

type ReturnNavigation = {
  route: string[];
  label: string;
};

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PageHeaderComponent, RouterLink, IconActionButtonComponent],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="t('actionTracker.page.label')"
        [title]="t('actionTracker.page.title')"
        [description]="t('actionTracker.page.description')"
        [breadcrumbs]="[{ label: t('actionTracker.page.breadcrumb') }]"
      >
        <a *ngIf="showStartHereBackLink()" [routerLink]="['/implementation']" class="button-link secondary">{{ t('actionTracker.actions.backToStartHere') }}</a>
        <a *ngIf="returnNavigation()" [routerLink]="returnNavigation()!.route" class="button-link secondary">{{ t('actionTracker.actions.backTo', { label: returnNavigation()!.label }) }}</a>
      </iso-page-header>

      <section class="page-stack">
        <section class="card detail-card" *ngIf="focusedAction() as focused" #focusedActionPanel>
          <div class="section-head">
            <div>
              <span class="section-eyebrow">{{ t('actionTracker.focused.eyebrow') }}</span>
              <h3>{{ focused.title }}</h3>
              <p class="subtle">{{ t('actionTracker.focused.copy') }}</p>
            </div>
            <div class="button-row">
              <a *ngIf="returnNavigation()" [routerLink]="returnNavigation()!.route" class="button-link secondary">{{ t('actionTracker.actions.backTo', { label: returnNavigation()!.label }) }}</a>
              <button type="button" class="secondary" (click)="clearFocusedAction()">{{ t('actionTracker.actions.backToAll') }}</button>
            </div>
          </div>

          <div class="summary-strip top-space">
            <article class="summary-item">
              <span>{{ t('actionTracker.common.status') }}</span>
              <strong>{{ statusLabel(focused.status) }}</strong>
            </article>
            <article class="summary-item">
              <span>{{ t('actionTracker.common.owner') }}</span>
              <strong>{{ focused.owner ? focused.owner.firstName + ' ' + focused.owner.lastName : t('actionTracker.common.unassigned') }}</strong>
            </article>
            <article class="summary-item">
              <span>{{ t('actionTracker.common.dueDate') }}</span>
              <strong>{{ focused.dueDate ? (focused.dueDate | date:'yyyy-MM-dd') : t('actionTracker.common.notSet') }}</strong>
            </article>
          </div>

          <section class="guidance-card top-space">
            <strong>{{ attentionHeadline(focused) }}</strong>
            <p>{{ attentionNarrative(focused) }}</p>
          </section>

          <div class="section-grid-2 top-space">
            <section class="detail-section">
              <h4>{{ t('actionTracker.focused.description') }}</h4>
              <p>{{ focused.description || t('actionTracker.focused.noDescription') }}</p>
            </section>
            <section class="detail-section">
              <h4>{{ t('actionTracker.focused.source') }}</h4>
              <p>{{ sourceTypeLabel(focused.sourceType) }} | {{ focused.sourceTitle }}</p>
              <div class="button-row top-space" *ngIf="sourceRoute(focused) as route">
                <a [routerLink]="route" class="button-link secondary">{{ t('actionTracker.actions.openSource') }}</a>
              </div>
            </section>
          </div>

          <div class="detail-section top-space">
            <h4>{{ t('actionTracker.focused.updateStatus') }}</h4>
            <div class="button-row top-space">
              <select [value]="focused.status" [disabled]="!canWriteActions()" (change)="updateStatus(focused, readStatus($event))">
                <option value="OPEN">{{ t('actionTracker.status.OPEN') }}</option>
                <option value="IN_PROGRESS">{{ t('actionTracker.status.IN_PROGRESS') }}</option>
                <option value="DONE">{{ t('actionTracker.status.DONE') }}</option>
                <option value="CANCELLED">{{ t('actionTracker.status.CANCELLED') }}</option>
              </select>
            </div>
          </div>
        </section>

        <div class="card list-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">{{ t('actionTracker.register.eyebrow') }}</span>
              <h3>{{ t('actionTracker.register.title') }}</h3>
              <p class="subtle">{{ t('actionTracker.register.copy') }}</p>
            </div>
          </div>

          <section class="summary-strip top-space actions-summary-strip">
            <article class="summary-item">
              <span>{{ t('actionTracker.status.OPEN') }}</span>
              <strong>{{ countByStatus('OPEN') }}</strong>
            </article>
            <article class="summary-item">
              <span>{{ t('actionTracker.status.IN_PROGRESS') }}</span>
              <strong>{{ countByStatus('IN_PROGRESS') }}</strong>
            </article>
            <article class="summary-item">
              <span>{{ t('actionTracker.summary.overdue') }}</span>
              <strong>{{ overdueCount() }}</strong>
            </article>
            <article class="summary-item">
              <span>{{ t('actionTracker.status.DONE') }}</span>
              <strong>{{ countByStatus('DONE') }}</strong>
            </article>
          </section>

          <section class="guidance-card top-space">
            <strong>{{ followUpHeadline() }}</strong>
            <p>{{ followUpNarrative() }}</p>
          </section>

          <form class="toolbar top-space" [formGroup]="filtersForm" (ngSubmit)="reload()">
            <div class="filter-row standard-filter-grid">
              <label class="field compact-field">
                <span>{{ t('actionTracker.filters.source') }}</span>
                <select formControlName="sourceType">
                  <option value="">{{ t('actionTracker.filters.allSources') }}</option>
                  <option value="risk">{{ t('actionTracker.sources.risk') }}</option>
                  <option value="capa">{{ t('actionTracker.sources.capa') }}</option>
                  <option value="audit">{{ t('actionTracker.sources.audit') }}</option>
                  <option value="management-review">{{ t('actionTracker.sources.managementReview') }}</option>
                  <option value="incident">{{ t('actionTracker.sources.incident') }}</option>
                  <option value="hazard">{{ t('actionTracker.sources.hazard') }}</option>
                  <option value="aspect">{{ t('actionTracker.sources.aspect') }}</option>
                  <option value="obligation">{{ t('actionTracker.sources.obligation') }}</option>
                  <option value="provider">{{ t('actionTracker.sources.provider') }}</option>
                  <option value="change-management">{{ t('actionTracker.sources.changeManagement') }}</option>
                </select>
              </label>
              <label class="field compact-field">
                <span>{{ t('actionTracker.common.status') }}</span>
                <select formControlName="status">
                  <option value="">{{ t('actionTracker.filters.allStatuses') }}</option>
                  <option value="OPEN">{{ t('actionTracker.status.OPEN') }}</option>
                  <option value="IN_PROGRESS">{{ t('actionTracker.status.IN_PROGRESS') }}</option>
                  <option value="DONE">{{ t('actionTracker.status.DONE') }}</option>
                  <option value="CANCELLED">{{ t('actionTracker.status.CANCELLED') }}</option>
                </select>
              </label>
              <label class="field compact-field">
                <span>{{ t('actionTracker.common.owner') }}</span>
                <select formControlName="ownerId">
                  <option value="">{{ t('actionTracker.filters.allOwners') }}</option>
                  <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
                </select>
              </label>
              <label class="field">
                <span>{{ t('actionTracker.common.dueDate') }}</span>
                <select formControlName="dueState">
                  <option value="">{{ t('actionTracker.filters.allDueDates') }}</option>
                  <option value="overdue">{{ t('actionTracker.summary.overdue') }}</option>
                  <option value="upcoming">{{ t('actionTracker.filters.upcoming') }}</option>
                </select>
              </label>
              <label class="field compact-field">
                <span>{{ t('actionTracker.filters.sortBy') }}</span>
                <select [value]="sortBy()" (change)="sortBy.set(readSortValue($event))">
                  <option value="attention">{{ t('actionTracker.filters.sortOptions.attention') }}</option>
                  <option value="dueDate">{{ t('actionTracker.filters.sortOptions.dueDate') }}</option>
                  <option value="updated">{{ t('actionTracker.filters.sortOptions.updated') }}</option>
                  <option value="source">{{ t('actionTracker.filters.sortOptions.source') }}</option>
                </select>
              </label>
            </div>

            <div class="button-row">
              <button type="submit" [disabled]="loading()">{{ t('actionTracker.filters.apply') }}</button>
            </div>
          </form>

          <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <div class="empty-state" *ngIf="loading()">
            <strong>{{ t('actionTracker.empty.loadingTitle') }}</strong>
            <span>{{ t('actionTracker.empty.loadingCopy') }}</span>
          </div>

          <div class="empty-state top-space" *ngIf="!loading() && !sortedActions().length">
            <strong>{{ t('actionTracker.empty.noneTitle') }}</strong>
            <span>{{ t('actionTracker.empty.noneCopy') }}</span>
          </div>

          <div class="data-table-wrap" *ngIf="!loading() && sortedActions().length">
            <table class="data-table">
              <thead>
                <tr>
                  <th>{{ t('actionTracker.table.action') }}</th>
                  <th>{{ t('actionTracker.table.source') }}</th>
                  <th>{{ t('actionTracker.table.owner') }}</th>
                  <th>{{ t('actionTracker.table.dueDate') }}</th>
                  <th>{{ t('actionTracker.table.status') }}</th>
                  <th *ngIf="canDeleteActions()">{{ t('actionTracker.table.admin') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  *ngFor="let action of sortedActions()"
                  [class.focused-row]="focusedActionId() === action.id"
                  class="action-row"
                  tabindex="0"
                  (click)="focusAction(action)"
                  (keydown.enter)="focusAction(action)"
                  (keydown.space)="focusAction(action); $event.preventDefault()"
                >
                  <td>
                    <div class="table-title">
                      <strong>{{ action.title }}</strong>
                      <small>{{ action.description || t('actionTracker.table.noDescription') }}</small>
                      <small class="opened-indicator" *ngIf="focusedActionId() === action.id">{{ t('actionTracker.table.openedAbove') }}</small>
                    </div>
                  </td>
                  <td>
                    <div class="table-title">
                      <strong>{{ sourceTypeLabel(action.sourceType) }}</strong>
                      <small>{{ action.sourceTitle }}</small>
                      <small *ngIf="sourceRoute(action) as route">
                        <a [routerLink]="route" class="table-link" (click)="$event.stopPropagation()">{{ t('actionTracker.actions.openSource') }}</a>
                      </small>
                    </div>
                  </td>
                  <td>{{ action.owner ? action.owner.firstName + ' ' + action.owner.lastName : t('actionTracker.common.unassigned') }}</td>
                  <td>{{ action.dueDate ? (action.dueDate | date:'yyyy-MM-dd') : t('actionTracker.common.notSet') }}</td>
                  <td>
                    <select [value]="action.status" [disabled]="!canWriteActions()" (click)="$event.stopPropagation()" (change)="updateStatus(action, readStatus($event))">
                      <option value="OPEN">{{ t('actionTracker.status.OPEN') }}</option>
                      <option value="IN_PROGRESS">{{ t('actionTracker.status.IN_PROGRESS') }}</option>
                      <option value="DONE">{{ t('actionTracker.status.DONE') }}</option>
                      <option value="CANCELLED">{{ t('actionTracker.status.CANCELLED') }}</option>
                    </select>
                  </td>
                  <td *ngIf="canDeleteActions()">
                    <span (click)="$event.stopPropagation()">
                      <iso-icon-action-button
                        [icon]="'delete'"
                        [label]="t('actionTracker.actions.delete')"
                        [variant]="'danger'"
                        [disabled]="action.status === 'DONE'"
                        (pressed)="deleteAction(action)"
                      />
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </section>
  `,
  styles: [`
    .actions-summary-strip {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1rem;
      align-items: stretch;
    }

    .actions-summary-strip .summary-item {
      min-width: 0;
      min-height: auto;
      padding: 1rem 1.1rem;
    }

    .actions-summary-strip .summary-item strong {
      display: block;
      margin-top: 0.35rem;
      line-height: 1;
    }

    .guidance-card {
      padding: 1rem 1.1rem;
      border: 1px solid rgba(46, 67, 56, 0.1);
      border-radius: 1rem;
      background: rgba(252, 253, 250, 0.82);
    }

    .guidance-card strong,
    .guidance-card p {
      display: block;
    }

    .guidance-card p {
      margin-top: 0.4rem;
      color: var(--muted);
      line-height: 1.45;
    }

    .table-link {
      color: var(--brand-strong);
      font-weight: 700;
      text-decoration: none;
    }

    .table-link:hover {
      text-decoration: underline;
    }

    .focused-row {
      outline: 2px solid rgba(36, 79, 61, 0.22);
      outline-offset: -2px;
      background: rgba(36, 79, 61, 0.05);
    }

    .action-row {
      cursor: pointer;
    }

    .action-row:focus-visible {
      outline: 2px solid rgba(36, 79, 61, 0.35);
      outline-offset: -2px;
    }

    .top-space {
      margin-top: 1rem;
    }

    .attention-copy {
      color: var(--brand-strong);
      font-weight: 700;
    }

    .opened-indicator {
      color: var(--brand-strong);
      font-weight: 800;
    }

    @media (max-width: 1100px) {
      .actions-summary-strip {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 720px) {
      .actions-summary-strip {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class ActionsPageComponent {
  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  @ViewChild('focusedActionPanel') private focusedActionPanel?: ElementRef<HTMLElement>;

  protected readonly users = signal<UserOption[]>([]);
  protected readonly actions = signal<ActionRecord[]>([]);
  protected readonly loading = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly focusedActionId = signal<string | null>(null);
  protected readonly sortBy = signal<ActionSortOption>('attention');
  protected readonly focusedAction = computed(() => this.actions().find((action) => action.id === this.focusedActionId()) ?? null);
  protected readonly returnNavigation = signal<ReturnNavigation | null>(null);

  protected showStartHereBackLink() {
    return this.route.snapshot.queryParamMap.get('from') === 'start-here';
  }

  protected readonly filtersForm = this.fb.nonNullable.group({
    sourceType: [''],
    status: [''],
    ownerId: [''],
    dueState: ['']
  });

  constructor() {
    this.api.get<UserOption[]>('users').subscribe((users) => this.users.set(users));
    this.route.queryParamMap.subscribe((params) => {
      const nextFocusedActionId = params.get('focusActionId');
      const focusChanged = nextFocusedActionId !== this.focusedActionId();
      this.focusedActionId.set(nextFocusedActionId);
      this.returnNavigation.set((history.state?.returnNavigation as ReturnNavigation | undefined) ?? null);
      if (nextFocusedActionId && focusChanged) {
        this.message.set(this.t('actionTracker.messages.selectedOpenedAbove'));
        setTimeout(() => this.scrollToFocusedAction(), 0);
      }
    });
    this.reload();
  }

  protected t(key: string, params?: Record<string, unknown>) {
    return this.i18n.t(key, params);
  }

  protected reload() {
    this.loading.set(true);
    this.error.set('');
    const raw = this.filtersForm.getRawValue();
    const query = new URLSearchParams();
    if (raw.sourceType) query.set('sourceType', raw.sourceType);
    if (raw.status) query.set('status', raw.status);
    if (raw.ownerId) query.set('ownerId', raw.ownerId);
    if (raw.dueState) query.set('dueState', raw.dueState);

    this.api.get<ActionRecord[]>(`action-items${query.size ? `?${query.toString()}` : ''}`).subscribe({
      next: (actions) => {
        this.loading.set(false);
        this.actions.set(actions);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, this.t('actionTracker.messages.loadFailed')));
      }
    });
  }

  protected updateStatus(action: ActionRecord, status: ActionStatus) {
    if (!this.canWriteActions()) {
      this.error.set(this.t('actionTracker.messages.noPermissionUpdate'));
      return;
    }

    if (status === action.status) {
      return;
    }

    this.api.patch<ActionRecord>(`action-items/${action.id}`, { status }).subscribe({
      next: () => {
        this.message.set(this.t('actionTracker.messages.statusUpdated'));
        this.reload();
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(this.readError(error, this.t('actionTracker.messages.statusUpdateFailed')));
      }
    });
  }

  protected countByStatus(status: ActionStatus) {
    return this.actions().filter((action) => action.status === status).length;
  }

  protected sortedActions() {
    return [...this.actions()].sort((left, right) => this.compareActions(left, right));
  }

  protected overdueCount() {
    return this.actions().filter((action) => this.isOverdueRecord(action)).length;
  }

  protected ownerNeededCount() {
    return this.actions().filter((action) => this.isActiveAction(action) && !action.ownerId).length;
  }

  protected attentionCount() {
    return this.actions().filter((action) => this.actionAttentionReasons(action).length > 0).length;
  }

  protected statusLabel(status?: ActionStatus | string | null) {
    if (!status) {
      return this.t('actionTracker.common.notSet');
    }
    return this.t(`actionTracker.status.${status}`);
  }

  protected sourceTypeLabel(sourceType?: string | null) {
    if (!sourceType) {
      return this.t('actionTracker.common.notSet');
    }
    const sourceKeyMap: Record<string, string> = {
      risk: 'risk',
      capa: 'capa',
      audit: 'audit',
      'management-review': 'managementReview',
      ncr: 'ncr',
      incident: 'incident',
      hazard: 'hazard',
      aspect: 'aspect',
      obligation: 'obligation',
      provider: 'provider',
      'change-management': 'changeManagement',
      document: 'document',
      context: 'context'
    };
    const key = sourceKeyMap[sourceType];
    return key ? this.t(`actionTracker.sources.${key}`) : sourceType;
  }

  protected followUpHeadline() {
    if (this.overdueCount() > 0) {
      return this.t('actionTracker.guidance.headlines.overdue');
    }
    if (this.ownerNeededCount() > 0) {
      return this.t('actionTracker.guidance.headlines.ownerNeeded');
    }
    if (this.countByStatus('OPEN') > 0 || this.countByStatus('IN_PROGRESS') > 0) {
      return this.t('actionTracker.guidance.headlines.active');
    }
    return this.t('actionTracker.guidance.headlines.underControl');
  }

  protected followUpNarrative() {
    if (this.overdueCount() > 0) {
      return this.t('actionTracker.guidance.narratives.overdue');
    }
    if (this.ownerNeededCount() > 0) {
      return this.t('actionTracker.guidance.narratives.ownerNeeded');
    }
    if (this.countByStatus('OPEN') > 0 || this.countByStatus('IN_PROGRESS') > 0) {
      return this.t('actionTracker.guidance.narratives.active');
    }
    return this.t('actionTracker.guidance.narratives.underControl');
  }

  protected attentionHeadline(action: ActionRecord) {
    return this.actionAttentionReasons(action).length
      ? this.t('actionTracker.attention.headlines.needsAttention')
      : this.t('actionTracker.attention.headlines.underControl');
  }

  protected attentionNarrative(action: ActionRecord) {
    const reasons = this.actionAttentionReasons(action);
    if (!reasons.length) {
      return this.t('actionTracker.attention.narratives.underControl');
    }
    return this.t('actionTracker.attention.narratives.needsAttention', {
      reasons: reasons.map((reason) => this.attentionReasonLabel(reason, true).toLowerCase()).join(', ')
    });
  }

  protected actionAttentionSummary(action: ActionRecord) {
    const reasons = this.actionAttentionReasons(action);
    return reasons.length ? reasons.map((reason) => this.attentionReasonLabel(reason)).join(' | ') : '';
  }

  protected attentionLabel(action: ActionRecord) {
    const reasons = this.actionAttentionReasons(action);
    if (!reasons.length) {
      return this.t('actionTracker.attention.short.ok');
    }
    const short = reasons.map((reason) => this.attentionReasonLabel(reason, false, true));
    return short.length > 1 ? `${short[0]} +${short.length - 1}` : short[0];
  }

  protected attentionClass(action: ActionRecord) {
    const reasons = this.actionAttentionReasons(action);
    if (!reasons.length) {
      return 'success';
    }
    if (reasons.includes('OVERDUE')) {
      return 'danger';
    }
    return 'warn';
  }

  protected canDeleteActions() {
    return this.authStore.hasPermission('admin.delete');
  }

  protected canWriteActions() {
    return this.authStore.hasPermission('action-items.write');
  }

  protected deleteAction(action: ActionRecord) {
    if (!this.canDeleteActions() || action.status === 'DONE') {
      return;
    }

    if (!window.confirm(this.t('actionTracker.messages.deleteConfirm', { title: action.title }))) {
      return;
    }

    this.api.delete(`action-items/${action.id}`).subscribe({
      next: () => {
        this.message.set(this.t('actionTracker.messages.deleteSuccess'));
        this.reload();
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(this.readError(error, this.t('actionTracker.messages.deleteFailed')));
      }
    });
  }

  protected readStatus(event: Event) {
    return (event.target as HTMLSelectElement).value as ActionStatus;
  }

  protected readSortValue(event: Event) {
    return (event.target as HTMLSelectElement).value as ActionSortOption;
  }

  protected sourceRoute(action: ActionRecord) {
    switch (action.sourceType) {
      case 'risk':
        return ['/risks', action.sourceId];
      case 'capa':
        return ['/capa', action.sourceId];
      case 'audit':
        return ['/audits', action.sourceId];
      case 'management-review':
        return ['/management-review', action.sourceId];
      case 'ncr':
        return ['/ncr', action.sourceId];
      case 'incident':
        return ['/incidents', action.sourceId];
      case 'hazard':
        return ['/hazards', action.sourceId];
      case 'aspect':
        return ['/environmental-aspects', action.sourceId];
      case 'obligation':
        return ['/compliance-obligations', action.sourceId];
      case 'provider':
        return ['/external-providers', action.sourceId];
      case 'change-management':
        return ['/change-management', action.sourceId];
      case 'document':
        return ['/documents', action.sourceId];
      default:
        return null;
    }
  }

  protected clearFocusedAction() {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { focusActionId: null },
      queryParamsHandling: 'merge'
    });
  }

  protected focusAction(action: ActionRecord) {
    if (this.focusedActionId() === action.id) {
      this.scrollToFocusedAction();
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { focusActionId: action.id },
      queryParamsHandling: 'merge'
    });
  }

  private scrollToFocusedAction() {
    this.focusedActionPanel?.nativeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  private isOverdueRecord(action: ActionRecord) {
    if (!action.dueDate || action.status === 'DONE' || action.status === 'CANCELLED') {
      return false;
    }
    return new Date(action.dueDate) < new Date();
  }

  private isActiveAction(action: ActionRecord) {
    return action.status !== 'DONE' && action.status !== 'CANCELLED';
  }

  private isDueSoon(action: ActionRecord) {
    if (!action.dueDate || !this.isActiveAction(action) || this.isOverdueRecord(action)) {
      return false;
    }
    const due = new Date(action.dueDate);
    const today = new Date();
    const days = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 7;
  }

  private actionAttentionReasons(action: ActionRecord): AttentionReason[] {
    if (!this.isActiveAction(action)) {
      return [];
    }
    const reasons: AttentionReason[] = [];
    if (this.isOverdueRecord(action)) {
      reasons.push('OVERDUE');
    } else if (this.isDueSoon(action)) {
      reasons.push('DUE_SOON');
    }
    if (!action.ownerId) {
      reasons.push('OWNER_NEEDED');
    }
    return reasons;
  }

  private attentionReasonLabel(reason: AttentionReason, lowercase = false, short = false) {
    const reasonKeyMap: Record<AttentionReason, string> = {
      OVERDUE: short ? 'overdue' : 'overdue',
      DUE_SOON: short ? 'dueSoon' : 'dueSoon',
      OWNER_NEEDED: short ? 'owner' : 'ownerNeeded'
    };
    const label = this.t(`actionTracker.attention.${short ? 'short' : 'reasons'}.${reasonKeyMap[reason]}`);
    return lowercase ? label.toLowerCase() : label;
  }

  private compareActions(left: ActionRecord, right: ActionRecord) {
    switch (this.sortBy()) {
      case 'dueDate':
        return this.compareActionDueDate(left, right);
      case 'updated':
        return this.compareDateDesc(left.updatedAt, right.updatedAt) || this.compareActionDueDate(left, right);
      case 'source':
        return (
          left.sourceLabel.localeCompare(right.sourceLabel) ||
          left.sourceTitle.localeCompare(right.sourceTitle) ||
          this.compareActionDueDate(left, right)
        );
      case 'attention':
      default:
        return (
          this.actionAttentionRank(left) - this.actionAttentionRank(right) ||
          this.compareActionDueDate(left, right) ||
          this.compareDateDesc(left.updatedAt, right.updatedAt)
        );
    }
  }

  private compareActionDueDate(left: ActionRecord, right: ActionRecord) {
    return this.compareOptionalDateAsc(left.dueDate, right.dueDate) || this.compareDateDesc(left.updatedAt, right.updatedAt);
  }

  private actionAttentionRank(action: ActionRecord) {
    const reasons = this.actionAttentionReasons(action);
    if (reasons.includes('OVERDUE')) return 0;
    if (reasons.includes('OWNER_NEEDED')) return 1;
    if (reasons.includes('DUE_SOON')) return 2;
    if (action.status === 'OPEN' || action.status === 'IN_PROGRESS') return 3;
    if (action.status === 'DONE') return 4;
    return 5;
  }

  private compareOptionalDateAsc(left?: string | null, right?: string | null) {
    const leftTime = left ? new Date(left).getTime() : Number.POSITIVE_INFINITY;
    const rightTime = right ? new Date(right).getTime() : Number.POSITIVE_INFINITY;
    return leftTime - rightTime;
  }

  private compareDateDesc(left?: string | null, right?: string | null) {
    const leftTime = left ? new Date(left).getTime() : 0;
    const rightTime = right ? new Date(right).getTime() : 0;
    return rightTime - leftTime;
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}
