import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ApiService } from '../core/api.service';
import { I18nService } from '../core/i18n.service';
import { PageHeaderComponent } from '../shared/page-header.component';

type AuditActor = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type AuditLogRecord = {
  id: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: unknown;
  createdAt: string;
  actor?: AuditActor | null;
};

type ModuleOption = {
  value: string;
  labelKey: string;
};

@Component({
  standalone: true,
  imports: [CommonModule, PageHeaderComponent],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="t('activityLog.page.label')"
        [title]="t('activityLog.page.title')"
        [description]="t('activityLog.page.description')"
        [breadcrumbs]="[{ label: t('activityLog.page.breadcrumb') }]"
      >
        <button type="button" class="button-link secondary" (click)="reload()">{{ t('activityLog.actions.refresh') }}</button>
      </iso-page-header>

      <section class="page-stack">
        <div class="toolbar-card">
          <div class="toolbar-card__copy">
            <span class="eyebrow">{{ t('activityLog.filters.label') }}</span>
            <strong>{{ t('activityLog.filters.title') }}</strong>
            <p>{{ t('activityLog.filters.copy') }}</p>
          </div>

          <div class="filters-grid">
            <label class="field">
              <span>{{ t('activityLog.filters.module') }}</span>
              <select [value]="selectedModule()" (change)="onModuleChange($event)">
                <option value="">{{ t('activityLog.filters.allModules') }}</option>
                <option *ngFor="let option of moduleOptions" [value]="option.value">{{ t(option.labelKey) }}</option>
              </select>
            </label>

            <label class="field field--wide">
              <span>{{ t('activityLog.filters.search') }}</span>
              <input
                [value]="searchTerm()"
                (input)="searchTerm.set(readInputValue($event))"
                [placeholder]="t('activityLog.filters.searchPlaceholder')"
              >
            </label>
          </div>
        </div>

        <div class="toolbar-stats">
          <article class="toolbar-stat">
            <span>{{ t('activityLog.summary.totalLoaded') }}</span>
            <strong>{{ logs().length }}</strong>
          </article>
          <article class="toolbar-stat">
            <span>{{ t('activityLog.summary.visible') }}</span>
            <strong>{{ filteredLogs().length }}</strong>
          </article>
          <article class="toolbar-stat">
            <span>{{ t('activityLog.summary.users') }}</span>
            <strong>{{ uniqueUserCount() }}</strong>
          </article>
          <article class="toolbar-stat">
            <span>{{ t('activityLog.summary.modules') }}</span>
            <strong>{{ uniqueModuleCount() }}</strong>
          </article>
        </div>

        <div class="card">
          <div class="section-head">
            <div>
              <h3>{{ t('activityLog.list.title') }}</h3>
              <p class="subtle">{{ t('activityLog.list.copy') }}</p>
            </div>
          </div>

          <p class="feedback" *ngIf="error()">{{ error() }}</p>
          <div class="empty-state" *ngIf="loading()">{{ t('activityLog.states.loading') }}</div>
          <div class="empty-state top-space" *ngIf="!loading() && !filteredLogs().length">
            <strong>{{ t('activityLog.states.emptyTitle') }}</strong>
            <span>{{ t('activityLog.states.emptyCopy') }}</span>
          </div>

          <div class="data-table-wrap" *ngIf="!loading() && filteredLogs().length">
            <table class="data-table">
              <thead>
                <tr>
                  <th>{{ t('activityLog.table.time') }}</th>
                  <th>{{ t('activityLog.table.user') }}</th>
                  <th>{{ t('activityLog.table.action') }}</th>
                  <th>{{ t('activityLog.table.module') }}</th>
                  <th>{{ t('activityLog.table.record') }}</th>
                  <th>{{ t('activityLog.table.details') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of filteredLogs()">
                  <td>
                    <strong>{{ formatDate(item.createdAt) }}</strong>
                    <small>{{ formatTime(item.createdAt) }}</small>
                  </td>
                  <td>
                    <strong>{{ actorLabel(item) }}</strong>
                    <small>{{ item.actor?.email || t('activityLog.common.systemActor') }}</small>
                  </td>
                  <td>{{ actionLabel(item.action) }}</td>
                  <td>{{ moduleLabel(item.entityType) }}</td>
                  <td><code>{{ item.entityId }}</code></td>
                  <td><span class="metadata-text">{{ metadataLabel(item.metadata) }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </section>
  `,
  styles: [`
    .toolbar-card {
      display: grid;
      gap: 1rem;
      padding: 1rem 1.1rem;
      border: 1px solid var(--panel-border);
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.82);
    }

    .toolbar-card__copy {
      display: grid;
      gap: 0.22rem;
    }

    .toolbar-card__copy strong {
      font-size: 1rem;
      letter-spacing: -0.02em;
      color: var(--text);
    }

    .toolbar-card__copy p {
      margin: 0;
      color: var(--muted);
      max-width: 56rem;
    }

    .filters-grid {
      display: grid;
      grid-template-columns: minmax(14rem, 18rem) minmax(16rem, 1fr);
      gap: 1rem;
      align-items: end;
    }

    .field {
      display: grid;
      gap: 0.4rem;
    }

    .field--wide {
      min-width: 0;
    }

    .field span {
      color: var(--muted-strong);
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .field input,
    .field select {
      min-height: 3rem;
    }

    .toolbar-stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.8rem;
    }

    .toolbar-stat {
      display: grid;
      gap: 0.3rem;
      padding: 0.9rem 1rem;
      border-radius: 18px;
      border: 1px solid rgba(23, 50, 37, 0.08);
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(244, 248, 244, 0.92));
    }

    .toolbar-stat span {
      color: var(--muted);
      font-size: 0.76rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .toolbar-stat strong {
      color: var(--text);
      font-size: 1.5rem;
      letter-spacing: -0.03em;
      line-height: 1;
    }

    td strong,
    td small {
      display: block;
    }

    td small {
      margin-top: 0.18rem;
      color: var(--muted);
      font-size: 0.8rem;
    }

    .metadata-text {
      color: var(--muted-strong);
      line-height: 1.5;
      display: block;
      max-width: 32rem;
      word-break: break-word;
    }

    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.8rem;
      color: var(--text-soft);
      background: rgba(23, 50, 37, 0.04);
      padding: 0.18rem 0.35rem;
      border-radius: 8px;
    }

    @media (max-width: 960px) {
      .filters-grid,
      .toolbar-stats {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class AuditLogPageComponent {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);

  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly logs = signal<AuditLogRecord[]>([]);
  protected readonly selectedModule = signal('');
  protected readonly searchTerm = signal('');

  protected readonly moduleOptions: ModuleOption[] = [
    { value: 'document', labelKey: 'activityLog.modules.document' },
    { value: 'risk', labelKey: 'activityLog.modules.risk' },
    { value: 'audit', labelKey: 'activityLog.modules.audit' },
    { value: 'ncr', labelKey: 'activityLog.modules.ncr' },
    { value: 'capa', labelKey: 'activityLog.modules.capa' },
    { value: 'action-item', labelKey: 'activityLog.modules.actionItem' },
    { value: 'user', labelKey: 'activityLog.modules.user' },
    { value: 'training', labelKey: 'activityLog.modules.training' },
    { value: 'process', labelKey: 'activityLog.modules.process' },
    { value: 'context', labelKey: 'activityLog.modules.context' },
    { value: 'compliance-obligation', labelKey: 'activityLog.modules.complianceObligation' },
    { value: 'incident', labelKey: 'activityLog.modules.incident' },
    { value: 'environmental-aspect', labelKey: 'activityLog.modules.environmentalAspect' },
    { value: 'hazard', labelKey: 'activityLog.modules.hazard' },
    { value: 'external-provider', labelKey: 'activityLog.modules.externalProvider' },
    { value: 'change-request', labelKey: 'activityLog.modules.changeRequest' },
    { value: 'kpi', labelKey: 'activityLog.modules.kpi' },
    { value: 'management-review', labelKey: 'activityLog.modules.managementReview' },
    { value: 'attachment', labelKey: 'activityLog.modules.attachment' },
    { value: 'report', labelKey: 'activityLog.modules.report' }
  ];

  protected readonly filteredLogs = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    return this.logs().filter((item) => {
      if (!term) {
        return true;
      }

      const haystack = [
        this.actorLabel(item),
        item.actor?.email ?? '',
        item.action,
        this.actionLabel(item.action),
        item.entityType,
        this.moduleLabel(item.entityType),
        item.entityId,
        this.metadataLabel(item.metadata)
      ].join(' ').toLowerCase();

      return haystack.includes(term);
    });
  });

  protected readonly uniqueUserCount = computed(() => new Set(this.logs().map((item) => this.actorLabel(item))).size);
  protected readonly uniqueModuleCount = computed(() => new Set(this.logs().map((item) => item.entityType)).size);

  constructor() {
    this.reload();
  }

  protected t(key: string, params?: Record<string, unknown>) {
    return this.i18n.t(key, params);
  }

  protected reload() {
    this.loading.set(true);
    this.error.set('');
    const query = this.selectedModule() ? `?entityType=${encodeURIComponent(this.selectedModule())}` : '';

    this.api.get<AuditLogRecord[]>(`audit-logs${query}`).subscribe({
      next: (items) => {
        this.logs.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.t('activityLog.states.loadError'));
        this.loading.set(false);
      }
    });
  }

  protected onModuleChange(event: Event) {
    this.selectedModule.set((event.target as HTMLSelectElement).value);
    this.reload();
  }

  protected readInputValue(event: Event) {
    return (event.target as HTMLInputElement).value;
  }

  protected actorLabel(item: AuditLogRecord) {
    const actor = item.actor;
    if (!actor) {
      return this.t('activityLog.common.systemActor');
    }

    const fullName = `${actor.firstName} ${actor.lastName}`.trim();
    return fullName || actor.email || this.t('activityLog.common.systemActor');
  }

  protected actionLabel(action: string) {
    return action
      .split('.')
      .map((part) =>
        part
          .split('-')
          .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
          .join(' ')
      )
      .join(' · ');
  }

  protected moduleLabel(entityType: string) {
    const option = this.moduleOptions.find((entry) => entry.value === entityType);
    return option ? this.t(option.labelKey) : this.labelize(entityType);
  }

  protected metadataLabel(metadata: unknown) {
    if (!metadata || typeof metadata !== 'object') {
      return this.t('activityLog.common.noDetails');
    }

    const entries = Object.entries(metadata as Record<string, unknown>)
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .slice(0, 3)
      .map(([key, value]) => `${this.labelize(key)}: ${this.stringifyValue(value)}`);

    return entries.length ? entries.join(' · ') : this.t('activityLog.common.noDetails');
  }

  protected formatDate(value: string) {
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' }).format(new Date(value));
  }

  protected formatTime(value: string) {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  }

  private stringifyValue(value: unknown) {
    if (Array.isArray(value)) {
      return value.join(', ');
    }

    if (typeof value === 'object') {
      return this.t('activityLog.common.detailsAvailable');
    }

    return String(value);
  }

  private labelize(value: string) {
    return value
      .replace(/[._-]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
