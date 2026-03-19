import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AttachmentPanelComponent } from '../shared/attachment-panel.component';
import { PageHeaderComponent } from '../shared/page-header.component';

type RoleConfig = {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  capabilities: {
    createRecords: boolean;
    approveDocuments: boolean;
    closeCapa: boolean;
  };
};

type SettingsConfig = {
  organization: {
    companyName: string;
    industry: string;
    location: string;
    tenantSlug: string;
  };
  usersRoles: RoleConfig[];
  document: {
    types: string[];
    numberingPrefix: string;
    versionFormat: string;
  };
  risk: {
    likelihoodScale: number;
    severityScale: number;
  };
  kpi: {
    greenThreshold: number;
    warningThreshold: number;
    breachThreshold: number;
  };
  notifications: {
    enabled: boolean;
  };
};

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PageHeaderComponent, AttachmentPanelComponent],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="'Settings'"
        [title]="'Tenant configuration'"
        [description]="'Configure organization details, role capabilities, document and risk defaults, KPI thresholds, and notification behavior.'"
        [breadcrumbs]="[{ label: 'Settings' }]"
      />

      <section class="page-columns settings-layout">
        <aside class="card panel-card section-nav">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Sections</span>
              <h3>Configuration areas</h3>
            </div>
          </div>

          <nav class="nav-list top-space">
            <button type="button" class="ghost nav-button" [class.active]="activeSection() === 'organization'" (click)="activeSection.set('organization')">Organization</button>
            <button type="button" class="ghost nav-button" [class.active]="activeSection() === 'roles'" (click)="activeSection.set('roles')">Users & Roles</button>
            <button type="button" class="ghost nav-button" [class.active]="activeSection() === 'document'" (click)="activeSection.set('document')">Document Settings</button>
            <button type="button" class="ghost nav-button" [class.active]="activeSection() === 'risk'" (click)="activeSection.set('risk')">Risk Settings</button>
            <button type="button" class="ghost nav-button" [class.active]="activeSection() === 'kpi'" (click)="activeSection.set('kpi')">KPI Settings</button>
            <button type="button" class="ghost nav-button" [class.active]="activeSection() === 'notifications'" (click)="activeSection.set('notifications')">Notifications</button>
          </nav>
        </aside>

        <div class="page-stack">
          <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <section class="card form-card page-stack" *ngIf="activeSection() === 'organization'">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Organization</span>
                <h3>Organization settings</h3>
                <p class="subtle">Update tenant identity, optional company context, and brand assets.</p>
              </div>
            </div>

            <form [formGroup]="organizationForm" class="page-stack" (ngSubmit)="saveSection('organization')">
              <div class="form-grid-2">
                <label class="field">
                  <span>Company name</span>
                  <input formControlName="companyName" placeholder="Demo Tenant">
                </label>
                <label class="field">
                  <span>Tenant slug</span>
                  <input [value]="config()?.organization?.tenantSlug || ''" disabled>
                </label>
              </div>

              <div class="form-grid-2">
                <label class="field">
                  <span>Industry</span>
                  <input formControlName="industry" placeholder="Manufacturing">
                </label>
                <label class="field">
                  <span>Location</span>
                  <input formControlName="location" placeholder="Baku, Azerbaijan">
                </label>
              </div>

              <div class="button-row">
                <button type="submit" [disabled]="organizationForm.invalid || savingSection() === 'organization'">
                  {{ savingSection() === 'organization' ? 'Saving...' : 'Save organization' }}
                </button>
              </div>
            </form>

            <iso-attachment-panel [sourceType]="'settings'" [sourceId]="'organization-logo'" />
          </section>

          <section class="card form-card page-stack" *ngIf="activeSection() === 'roles'">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Users & Roles</span>
                <h3>Role capabilities</h3>
                <p class="subtle">Keep role control simple: record creation, document approval, and CAPA closure.</p>
              </div>
            </div>

            <div class="role-grid">
              <article class="detail-section" *ngFor="let role of config()?.usersRoles || []">
                <div class="section-head">
                  <div>
                    <h4>{{ role.name }}</h4>
                    <p class="subtle">{{ role.description || 'No description provided.' }}</p>
                  </div>
                </div>

                <div class="role-toggle-grid top-space">
                  <label class="toggle-row">
                    <input type="checkbox" [checked]="role.capabilities.createRecords" (change)="updateRoleCapability(role.id, 'createRecords', readCheckbox($event))">
                    <span>Create records</span>
                  </label>
                  <label class="toggle-row">
                    <input type="checkbox" [checked]="role.capabilities.approveDocuments" (change)="updateRoleCapability(role.id, 'approveDocuments', readCheckbox($event))">
                    <span>Approve documents</span>
                  </label>
                  <label class="toggle-row">
                    <input type="checkbox" [checked]="role.capabilities.closeCapa" (change)="updateRoleCapability(role.id, 'closeCapa', readCheckbox($event))">
                    <span>Close CAPA</span>
                  </label>
                </div>
              </article>
            </div>
          </section>

          <section class="card form-card page-stack" *ngIf="activeSection() === 'document'">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Documents</span>
                <h3>Document settings</h3>
                <p class="subtle">Control document types, numbering prefix, and version display defaults.</p>
              </div>
            </div>

            <form [formGroup]="documentForm" class="page-stack" (ngSubmit)="saveSection('document')">
              <label class="field">
                <span>Default document types</span>
                <textarea rows="4" formControlName="types" placeholder="Procedure, Policy, Work Instruction"></textarea>
              </label>

              <div class="form-grid-2">
                <label class="field">
                  <span>Numbering prefix</span>
                  <input formControlName="numberingPrefix" placeholder="QMS-PRO">
                </label>
                <label class="field">
                  <span>Version format</span>
                  <input formControlName="versionFormat" placeholder="V1.0">
                </label>
              </div>

              <div class="button-row">
                <button type="submit" [disabled]="documentForm.invalid || savingSection() === 'document'">
                  {{ savingSection() === 'document' ? 'Saving...' : 'Save document settings' }}
                </button>
              </div>
            </form>
          </section>

          <section class="card form-card page-stack" *ngIf="activeSection() === 'risk'">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Risks</span>
                <h3>Risk settings</h3>
                <p class="subtle">Set the likelihood and severity scales used by risk assessments.</p>
              </div>
            </div>

            <form [formGroup]="riskForm" class="page-stack" (ngSubmit)="saveSection('risk')">
              <div class="form-grid-2">
                <label class="field">
                  <span>Likelihood scale</span>
                  <select formControlName="likelihoodScale">
                    <option [ngValue]="5">1-5</option>
                    <option [ngValue]="10">1-10</option>
                  </select>
                </label>
                <label class="field">
                  <span>Severity scale</span>
                  <select formControlName="severityScale">
                    <option [ngValue]="5">1-5</option>
                    <option [ngValue]="10">1-10</option>
                  </select>
                </label>
              </div>

              <div class="button-row">
                <button type="submit" [disabled]="riskForm.invalid || savingSection() === 'risk'">
                  {{ savingSection() === 'risk' ? 'Saving...' : 'Save risk settings' }}
                </button>
              </div>
            </form>
          </section>

          <section class="card form-card page-stack" *ngIf="activeSection() === 'kpi'">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">KPIs</span>
                <h3>KPI settings</h3>
                <p class="subtle">Define the default threshold bands used when new KPIs are created.</p>
              </div>
            </div>

            <form [formGroup]="kpiForm" class="page-stack" (ngSubmit)="saveSection('kpi')">
              <div class="form-grid-3">
                <label class="field">
                  <span>Green threshold</span>
                  <input type="number" formControlName="greenThreshold">
                </label>
                <label class="field">
                  <span>Warning threshold</span>
                  <input type="number" formControlName="warningThreshold">
                </label>
                <label class="field">
                  <span>Breach threshold</span>
                  <input type="number" formControlName="breachThreshold">
                </label>
              </div>

              <div class="button-row">
                <button type="submit" [disabled]="kpiForm.invalid || savingSection() === 'kpi'">
                  {{ savingSection() === 'kpi' ? 'Saving...' : 'Save KPI settings' }}
                </button>
              </div>
            </form>
          </section>

          <section class="card form-card page-stack" *ngIf="activeSection() === 'notifications'">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Notifications</span>
                <h3>Notifications</h3>
                <p class="subtle">Enable or disable tenant notifications now, with email delivery reserved for a later phase.</p>
              </div>
            </div>

            <form [formGroup]="notificationsForm" class="page-stack" (ngSubmit)="saveSection('notifications')">
              <label class="toggle-row">
                <input type="checkbox" formControlName="enabled">
                <span>Enable notifications</span>
              </label>

              <div class="button-row">
                <button type="submit" [disabled]="notificationsForm.invalid || savingSection() === 'notifications'">
                  {{ savingSection() === 'notifications' ? 'Saving...' : 'Save notification settings' }}
                </button>
              </div>
            </form>
          </section>
        </div>
      </section>
    </section>
  `,
  styles: [`
    .settings-layout {
      grid-template-columns: minmax(260px, 0.72fr) minmax(0, 1.5fr);
      align-items: start;
    }

    .section-nav {
      position: sticky;
      top: 5.5rem;
    }

    .nav-list {
      display: grid;
      gap: 0.5rem;
    }

    .nav-button {
      justify-content: flex-start;
      width: 100%;
      box-shadow: none;
    }

    .nav-button.active {
      background: rgba(43, 75, 109, 0.12);
      border-color: rgba(43, 75, 109, 0.2);
      color: var(--text-strong);
    }

    .top-space {
      margin-top: 1rem;
    }

    .role-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
    }

    .role-toggle-grid {
      display: grid;
      gap: 0.65rem;
    }

    .toggle-row {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      font-weight: 600;
      color: var(--text-soft);
    }

    .toggle-row input {
      width: auto;
      margin: 0;
    }

    @media (max-width: 1100px) {
      .settings-layout,
      .role-grid {
        grid-template-columns: 1fr;
      }

      .section-nav {
        position: static;
      }
    }
  `]
})
export class SettingsPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly activeSection = signal<'organization' | 'roles' | 'document' | 'risk' | 'kpi' | 'notifications'>('organization');
  protected readonly config = signal<SettingsConfig | null>(null);
  protected readonly savingSection = signal<string | null>(null);
  protected readonly message = signal('');
  protected readonly error = signal('');

  protected readonly organizationForm = this.fb.nonNullable.group({
    companyName: ['', Validators.required],
    industry: [''],
    location: ['']
  });

  protected readonly documentForm = this.fb.nonNullable.group({
    types: [''],
    numberingPrefix: ['', Validators.required],
    versionFormat: ['', Validators.required]
  });

  protected readonly riskForm = this.fb.nonNullable.group({
    likelihoodScale: [5, Validators.required],
    severityScale: [5, Validators.required]
  });

  protected readonly kpiForm = this.fb.nonNullable.group({
    greenThreshold: [100, Validators.required],
    warningThreshold: [90, Validators.required],
    breachThreshold: [80, Validators.required]
  });

  protected readonly notificationsForm = this.fb.nonNullable.group({
    enabled: [true]
  });

  constructor() {
    this.reload();
  }

  protected saveSection(section: 'organization' | 'document' | 'risk' | 'kpi' | 'notifications') {
    const formMap = {
      organization: this.organizationForm,
      document: this.documentForm,
      risk: this.riskForm,
      kpi: this.kpiForm,
      notifications: this.notificationsForm
    };
    const form = formMap[section];
    if (form.invalid) {
      this.error.set('Complete the required settings fields.');
      return;
    }

    this.savingSection.set(section);
    this.message.set('');
    this.error.set('');

    const values =
      section === 'document'
        ? {
            ...form.getRawValue(),
            types: this.parseDocumentTypes()
          }
        : form.getRawValue();

    this.api.put('settings/section/' + section, { values }).subscribe({
      next: (config) => {
        this.savingSection.set(null);
        this.message.set('Settings saved successfully.');
        this.applyConfig(config as SettingsConfig);
      },
      error: (error: HttpErrorResponse) => {
        this.savingSection.set(null);
        this.error.set(this.readError(error, 'Settings could not be saved.'));
      }
    });
  }

  protected updateRoleCapability(roleId: string, capability: 'createRecords' | 'approveDocuments' | 'closeCapa', checked: boolean) {
    const role = this.config()?.usersRoles.find((entry) => entry.id === roleId);
    if (!role) return;

    const payload = {
      ...role.capabilities,
      [capability]: checked
    };

    this.savingSection.set('roles');
    this.message.set('');
    this.error.set('');

    this.api.put(`settings/roles/${roleId}`, payload).subscribe({
      next: (roles) => {
        this.savingSection.set(null);
        this.message.set('Role capabilities updated.');
        this.config.update((current) => current ? { ...current, usersRoles: roles as RoleConfig[] } : current);
      },
      error: (error: HttpErrorResponse) => {
        this.savingSection.set(null);
        this.error.set(this.readError(error, 'Role settings could not be saved.'));
      }
    });
  }

  protected readCheckbox(event: Event) {
    return (event.target as HTMLInputElement).checked;
  }

  private reload() {
    this.api.get<SettingsConfig>('settings/config').subscribe({
      next: (config) => this.applyConfig(config),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'Settings could not be loaded.'))
    });
  }

  private applyConfig(config: SettingsConfig) {
    this.config.set(config);
    this.organizationForm.reset({
      companyName: config.organization.companyName,
      industry: config.organization.industry,
      location: config.organization.location
    });
    this.documentForm.reset({
      types: config.document.types.join(', '),
      numberingPrefix: config.document.numberingPrefix,
      versionFormat: config.document.versionFormat
    });
    this.riskForm.reset({
      likelihoodScale: config.risk.likelihoodScale,
      severityScale: config.risk.severityScale
    });
    this.kpiForm.reset({
      greenThreshold: config.kpi.greenThreshold,
      warningThreshold: config.kpi.warningThreshold,
      breachThreshold: config.kpi.breachThreshold
    });
    this.notificationsForm.reset({
      enabled: config.notifications.enabled
    });
  }

  private parseDocumentTypes() {
    return this.documentForm.getRawValue().types
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}
