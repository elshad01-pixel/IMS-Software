import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
import { TenantPackageTier } from '../core/package-entitlements';
import { TenantAddOns } from '../core/tenant-addons';
import { AttachmentPanelComponent } from '../shared/attachment-panel.component';
import { PageHeaderComponent } from '../shared/page-header.component';

type RoleConfig = {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  capabilities: {
    manageUsersAndSettings: boolean;
    createOperationalRecords: boolean;
    manageActions: boolean;
    manageAssuranceWorkflows: boolean;
    leadManagementReview: boolean;
    approveDocuments: boolean;
    closeCapa: boolean;
    exportReports: boolean;
  };
};

type RoleCapabilityKey = keyof RoleConfig['capabilities'];

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
  subscription: {
    packageTier: TenantPackageTier;
    addOns: TenantAddOns;
  };
  notifications: {
    enabled: boolean;
  };
  ai: {
    enabled: boolean;
    provider: string;
    features: {
      auditFindingAssistant: boolean;
      documentDraftAssistant: boolean;
      managementReviewAssistant: boolean;
      riskSuggestionAssistant: boolean;
    };
  };
  implementation: {
    enabled: boolean;
    startingPoint: string;
    targetStandards: string[];
    rolloutOwner: string;
    certificationGoal: string;
  };
};

type AiRuntimeConfig = {
  enabled: boolean;
  provider: string;
  model: string;
  status: 'ready' | 'not_configured' | 'disabled';
  features: {
    auditFindingAssistant: boolean;
    documentDraftAssistant: boolean;
    managementReviewAssistant: boolean;
    riskSuggestionAssistant: boolean;
  };
};

const roleCapabilityGroups: Array<{
  id: string;
  title: string;
  description: string;
  capabilities: Array<{
    key: RoleCapabilityKey;
    label: string;
    description: string;
  }>;
}> = [
  {
    id: 'administration',
    title: 'Administration',
    description: 'Use these controls for tenant administration, settings ownership, and sensitive system changes.',
    capabilities: [
      {
        key: 'manageUsersAndSettings',
        label: 'Manage users and settings',
        description: 'Allows user administration, tenant settings changes, and sensitive delete controls.'
      },
      {
        key: 'exportReports',
        label: 'Export data',
        description: 'Allows report and export access for offline review, evidence packs, and management reporting.'
      }
    ]
  },
  {
    id: 'operations',
    title: 'Operational editing',
    description: 'Use these controls for daily record keeping, improvement actions, and operational follow-up.',
    capabilities: [
      {
        key: 'createOperationalRecords',
        label: 'Create operational records',
        description: 'Allows teams to create and update documents, risks, context, training, incidents, obligations, process links, and other live IMS records.'
      },
      {
        key: 'manageActions',
        label: 'Manage actions',
        description: 'Allows action owners to update follow-up items created from audits, risks, incidents, reviews, and other modules.'
      }
    ]
  },
  {
    id: 'assurance',
    title: 'Assurance workflows',
    description: 'Use these controls for audits, NCR/CAPA follow-up, approval decisions, and formal close-out.',
    capabilities: [
      {
        key: 'manageAssuranceWorkflows',
        label: 'Manage audits, NCR, and CAPA',
        description: 'Allows the role to run audits, record nonconformances, and manage corrective-action workflows.'
      },
      {
        key: 'approveDocuments',
        label: 'Approve documents',
        description: 'Allows controlled documents to be formally approved and moved into active use.'
      },
      {
        key: 'closeCapa',
        label: 'Close CAPA',
        description: 'Allows corrective actions to be closed after effectiveness has been reviewed.'
      }
    ]
  },
  {
    id: 'leadership',
    title: 'Leadership review',
    description: 'Use these controls for KPI ownership and management-review coordination.',
    capabilities: [
      {
        key: 'leadManagementReview',
        label: 'Manage KPIs and management review',
        description: 'Allows the role to maintain KPIs, lead management-review records, and coordinate leadership follow-up.'
      }
    ]
  }
];

const rolePositionGuidance: Array<{
  title: string;
  recommendedRole: string;
  summary: string;
}> = [
  {
    title: 'System Administrator',
    recommendedRole: 'Admin',
    summary: 'Owns tenant setup, user access, system settings, and sensitive exports.'
  },
  {
    title: 'QHSE Manager',
    recommendedRole: 'Manager',
    summary: 'Leads audits, NCR/CAPA, KPIs, management review, and operational records.'
  },
  {
    title: 'Operations Manager',
    recommendedRole: 'Manager',
    summary: 'Maintains operational records, owns actions, and contributes to review workflows without full system control.'
  },
  {
    title: 'Internal Auditor',
    recommendedRole: 'Manager',
    summary: 'Runs audit and NCR follow-up work, then routes actions and CAPA for closure.'
  },
  {
    title: 'Document Controller',
    recommendedRole: 'Manager',
    summary: 'Maintains controlled documents and approvals, with limited need for wider admin rights.'
  },
  {
    title: 'Employee / Action Owner',
    recommendedRole: 'User',
    summary: 'Reads the system, updates assigned actions, and contributes evidence without broad edit rights.'
  }
];

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent, AttachmentPanelComponent],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="'Settings'"
        [title]="'Tenant configuration'"
        [description]="'Manage the live defaults that shape documents, risk assessment, KPIs, and role capabilities for this tenant.'"
        [breadcrumbs]="[{ label: 'Settings' }]"
      >
        <a *ngIf="showStartHereBackLink()" [routerLink]="['/implementation']" class="button-link secondary">Back to Start Here</a>
      </iso-page-header>

      <section class="summary-strip settings-summary-strip" *ngIf="config() as current">
        <article class="summary-item">
          <span>Organization</span>
          <strong>{{ current.organization.companyName }}</strong>
          <small>{{ current.organization.tenantSlug }}</small>
        </article>
        <article class="summary-item">
          <span>Document prefix</span>
          <strong>{{ current.document.numberingPrefix }}</strong>
          <small>{{ current.document.types.length }} default type{{ current.document.types.length === 1 ? '' : 's' }}</small>
        </article>
        <article class="summary-item">
          <span>Risk scale</span>
          <strong>{{ current.risk.likelihoodScale }} x {{ current.risk.severityScale }}</strong>
          <small>Used in new risk assessments</small>
        </article>
        <article class="summary-item">
          <span>KPI thresholds</span>
          <strong>{{ current.kpi.greenThreshold }} / {{ current.kpi.warningThreshold }} / {{ current.kpi.breachThreshold }}</strong>
          <small>Green, warning, breach</small>
        </article>
        <article class="summary-item">
          <span>Package</span>
          <strong>{{ packageTierLabel(current.subscription.packageTier) }}</strong>
          <small>{{ enabledAddOnCount(current.subscription.addOns) }} add-on{{ enabledAddOnCount(current.subscription.addOns) === 1 ? '' : 's' }} enabled</small>
        </article>
      </section>

      <section class="page-columns settings-layout">
        <aside class="card panel-card section-nav">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Sections</span>
              <h3>Configuration areas</h3>
              <p class="subtle">Review the defaults that already affect live records, then update only what your tenant really needs.</p>
            </div>
          </div>

          <nav class="nav-list top-space">
            <button type="button" class="ghost nav-button nav-card" [class.active]="activeSection() === 'organization'" (click)="activeSection.set('organization')">
              <span>Organization</span>
              <small>Tenant identity and company details</small>
            </button>
            <button type="button" class="ghost nav-button nav-card" [class.active]="activeSection() === 'roles'" (click)="activeSection.set('roles')">
              <span>Users & Roles</span>
              <small>Capability groups and role guidance</small>
            </button>
            <button type="button" class="ghost nav-button nav-card" [class.active]="activeSection() === 'document'" (click)="activeSection.set('document')">
              <span>Documents</span>
              <small>Numbering and default document types</small>
            </button>
            <button type="button" class="ghost nav-button nav-card" [class.active]="activeSection() === 'risk'" (click)="activeSection.set('risk')">
              <span>Risks</span>
              <small>Assessment scale used in the risk module</small>
            </button>
            <button type="button" class="ghost nav-button nav-card" [class.active]="activeSection() === 'kpi'" (click)="activeSection.set('kpi')">
              <span>KPIs</span>
              <small>Default threshold bands for new KPIs</small>
            </button>
            <button type="button" class="ghost nav-button nav-card" [class.active]="activeSection() === 'subscription'" (click)="activeSection.set('subscription')">
              <span>Package</span>
              <small>Choose which module bundle is active for this tenant</small>
            </button>
            <button type="button" class="ghost nav-button nav-card" [class.active]="activeSection() === 'notifications'" (click)="activeSection.set('notifications')">
              <span>Notifications</span>
              <small>Tenant preference reserved for later rollout</small>
            </button>
            <button type="button" class="ghost nav-button nav-card" [class.active]="activeSection() === 'ai'" (click)="activeSection.set('ai')">
              <span>AI assistance</span>
              <small>Optional draft and summary helpers with tenant-level control</small>
            </button>
            <button type="button" class="ghost nav-button nav-card" [class.active]="activeSection() === 'implementation'" (click)="activeSection.set('implementation')">
              <span>Implementation</span>
              <small>Optional PDCA setup and rollout workspace</small>
            </button>
          </nav>
        </aside>

        <div class="page-stack">
          <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <section class="card form-card page-stack" *ngIf="activeSection() === 'organization'">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Organization</span>
                <h3>Organization settings</h3>
                <p class="subtle">Update the company identity shown in reports and across the tenant.</p>
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
                <button type="submit" [disabled]="organizationForm.invalid || savingSection() === 'organization' || !canWrite()">
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
                <p class="subtle">Keep the core system roles simple, then use grouped capabilities to reflect how QHSE, operations, audit, and leadership work is actually assigned.</p>
              </div>
            </div>

            <div class="capability-group-grid">
              <article class="detail-section capability-group-card" *ngFor="let group of capabilityGroups">
                <div class="section-head">
                  <div>
                    <span class="section-eyebrow">{{ group.title }}</span>
                    <h4>{{ group.title }}</h4>
                    <p class="subtle">{{ group.description }}</p>
                  </div>
                </div>

                <div class="entity-list compact-entity-list top-space">
                  <div class="entity-item" *ngFor="let capability of group.capabilities">
                    <strong>{{ capability.label }}</strong>
                    <small>{{ capability.description }}</small>
                  </div>
                </div>
              </article>
            </div>

            <section class="detail-section role-guidance-card">
              <div class="section-head">
                <div>
                  <span class="section-eyebrow">Typical positions</span>
                  <h4>Recommended role templates</h4>
                  <p class="subtle">These are business-facing position guides. They help customers pick the right starting role without exposing the full permission model.</p>
                </div>
              </div>

              <div class="position-grid top-space">
                <article class="position-card" *ngFor="let position of rolePositionGuidance">
                  <div class="position-card__head">
                    <strong>{{ position.title }}</strong>
                    <span>{{ position.recommendedRole }}</span>
                  </div>
                  <p>{{ position.summary }}</p>
                </article>
              </div>
            </section>

            <div class="role-grid">
              <article class="detail-section" *ngFor="let role of config()?.usersRoles || []">
                <div class="section-head">
                  <div>
                    <h4>{{ role.name }}</h4>
                    <p class="subtle">{{ role.description || 'No description provided.' }}</p>
                  </div>
                  <span class="summary-chip">{{ enabledCapabilityCount(role) }} enabled</span>
                </div>

                <div class="role-capability-groups top-space">
                  <section class="role-capability-group" *ngFor="let group of capabilityGroups">
                    <div class="role-capability-group__head">
                      <span class="section-eyebrow">{{ group.title }}</span>
                    </div>

                    <div class="role-toggle-grid">
                      <label class="toggle-row role-toggle-card" *ngFor="let capability of group.capabilities">
                        <input
                          type="checkbox"
                          [checked]="role.capabilities[capability.key]"
                          [disabled]="!canWrite() || isProtectedAdminCapability(role, capability.key)"
                          (change)="updateRoleCapability(role.id, capability.key, readCheckbox($event))"
                        >
                        <span>{{ capability.label }}</span>
                      </label>
                    </div>
                  </section>
                </div>

                <p class="subtle top-space" *ngIf="role.isSystem && role.name === 'Admin'">
                  The system Admin role always keeps user and settings management enabled.
                </p>
              </article>
            </div>
          </section>

          <section class="card form-card page-stack" *ngIf="activeSection() === 'document'">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Documents</span>
                <h3>Document settings</h3>
                <p class="subtle">These defaults are used when new controlled documents are created.</p>
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
                <button type="submit" [disabled]="documentForm.invalid || savingSection() === 'document' || !canWrite()">
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
                <p class="subtle">Choose the assessment scale your tenant uses. The current risk module supports 5x5 and 10x10 scoring.</p>
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
                <button type="submit" [disabled]="riskForm.invalid || savingSection() === 'risk' || !canWrite()">
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
                <p class="subtle">Set the default threshold bands applied when a new KPI is first created.</p>
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
                <button type="submit" [disabled]="kpiForm.invalid || savingSection() === 'kpi' || !canWrite()">
                  {{ savingSection() === 'kpi' ? 'Saving...' : 'Save KPI settings' }}
                </button>
              </div>
            </form>
          </section>

          <section class="card form-card page-stack" *ngIf="activeSection() === 'subscription'">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Package</span>
                <h3>Tenant package</h3>
                <p class="subtle">Select the commercial package for this tenant. The app will hide and block modules that are outside the selected bundle.</p>
              </div>
            </div>

            <div class="position-grid">
              <article class="position-card">
                <div class="position-card__head">
                  <strong>Assurance</strong>
                  <span>Audit loop</span>
                </div>
                <p>Audits, NCR, CAPA, Actions, and Activity Log for a self-contained assurance workflow.</p>
              </article>
              <article class="position-card">
                <div class="position-card__head">
                  <strong>Core IMS</strong>
                  <span>Integrated system</span>
                </div>
                <p>Everything in Assurance, plus Documents, Risks, Context, Processes, Training, Obligations, KPIs, Management Review, and Reports.</p>
              </article>
              <article class="position-card">
                <div class="position-card__head">
                  <strong>QHSE Pro</strong>
                  <span>Extended operations</span>
                </div>
                <p>Everything in Core IMS, plus Incidents, Hazards, Environmental Aspects, External Providers, and Change Management.</p>
              </article>
            </div>

            <form [formGroup]="subscriptionForm" class="page-stack" (ngSubmit)="saveSection('subscription')">
              <label class="field">
                <span>Package tier</span>
                <select formControlName="packageTier">
                  <option value="ASSURANCE">Assurance</option>
                  <option value="CORE_IMS">Core IMS</option>
                  <option value="QHSE_PRO">QHSE Pro</option>
                </select>
              </label>

              <section class="detail-section">
                <div class="section-head">
                  <div>
                    <span class="section-eyebrow">Add-ons</span>
                    <h4>Tenant add-ons</h4>
                    <p class="subtle">Use add-ons for optional capabilities that sit inside owned modules, rather than changing the base package tier.</p>
                  </div>
                </div>

                <div class="role-toggle-grid top-space">
                  <label class="toggle-row role-toggle-card">
                    <input type="checkbox" formControlName="aiAssistant" [disabled]="!canWrite()">
                    <span>AI assistant add-on</span>
                  </label>
                  <label class="toggle-row role-toggle-card">
                    <input type="checkbox" formControlName="customerFeedback" [disabled]="!canWrite()">
                    <span>Customer feedback add-on</span>
                  </label>
                </div>
              </section>

              <div class="button-row">
                <button type="submit" [disabled]="subscriptionForm.invalid || savingSection() === 'subscription' || !canWrite()">
                  {{ savingSection() === 'subscription' ? 'Saving...' : 'Save package' }}
                </button>
              </div>
            </form>
          </section>

          <section class="card form-card page-stack" *ngIf="activeSection() === 'notifications'">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Notifications</span>
                <h3>Notifications</h3>
                <p class="subtle">Store the tenant notification preference now. Live email delivery is reserved for a later phase.</p>
              </div>
            </div>

            <form [formGroup]="notificationsForm" class="page-stack" (ngSubmit)="saveSection('notifications')">
              <label class="toggle-row">
                <input type="checkbox" formControlName="enabled" [disabled]="!canWrite()">
                <span>Enable notifications</span>
              </label>

              <div class="button-row">
                <button type="submit" [disabled]="notificationsForm.invalid || savingSection() === 'notifications' || !canWrite()">
                  {{ savingSection() === 'notifications' ? 'Saving...' : 'Save notification settings' }}
                </button>
              </div>
            </form>
          </section>

          <section class="card form-card page-stack" *ngIf="activeSection() === 'ai'">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">AI assistance</span>
                <h3>Tenant AI settings</h3>
                <p class="subtle">Keep AI optional and narrow at first. The app should still work fully without it, and every AI result stays editable before save.</p>
              </div>
            </div>

            <section class="detail-section compact-runtime-panel" *ngIf="aiRuntime() as runtime">
              <div class="compact-runtime-grid">
                <article>
                  <span class="section-eyebrow">Runtime</span>
                  <strong>{{ runtime.status === 'ready' ? 'Ready' : runtime.status === 'not_configured' ? 'Provider not configured' : 'Disabled' }}</strong>
                </article>
                <article>
                  <span class="section-eyebrow">Provider</span>
                  <strong>{{ runtime.provider | titlecase }}</strong>
                </article>
                <article>
                  <span class="section-eyebrow">Model</span>
                  <strong>{{ runtime.model }}</strong>
                </article>
              </div>
              <p class="subtle">
                {{ runtime.status === 'ready'
                  ? 'Live provider credentials are available. Drafting can use the configured model.'
                  : runtime.status === 'not_configured'
                    ? 'The tenant can still use built-in fallback guidance until provider credentials are added.'
                    : 'AI assistance is currently turned off for this tenant.' }}
              </p>
            </section>

            <form [formGroup]="aiForm" class="page-stack" (ngSubmit)="saveSection('ai')">
              <label class="toggle-row">
                <input type="checkbox" formControlName="enabled" [disabled]="!canWrite()">
                <span>Enable AI assistance for this tenant</span>
              </label>

              <div class="form-grid-2">
                <label class="field">
                  <span>Provider</span>
                  <select formControlName="provider">
                    <option value="openai">OpenAI</option>
                  </select>
                </label>
                <label class="field">
                  <span>Model in use</span>
                  <input [value]="aiRuntime()?.model || 'gpt-5-mini'" disabled>
                </label>
              </div>

              <div class="entity-list compact-entity-list">
                <div class="entity-item">
                  <strong>Feature rollout</strong>
                  <small>Start with one assistant only, keep the rest disabled until the workflow and prompting are proven.</small>
                </div>
              </div>

              <div class="role-toggle-grid ai-feature-grid">
                <label class="toggle-row">
                  <input type="checkbox" formControlName="auditFindingAssistant" [disabled]="!canWrite()">
                  <span>Audit finding assistant</span>
                </label>
                <label class="toggle-row">
                  <input type="checkbox" formControlName="documentDraftAssistant" [disabled]="!canWrite()">
                  <span>Document draft assistant</span>
                </label>
                <label class="toggle-row">
                  <input type="checkbox" formControlName="managementReviewAssistant" [disabled]="!canWrite()">
                  <span>Management review assistant</span>
                </label>
                <label class="toggle-row">
                  <input type="checkbox" formControlName="riskSuggestionAssistant" [disabled]="!canWrite()">
                  <span>Risk suggestion assistant</span>
                </label>
              </div>

              <div class="button-row">
                <button type="submit" [disabled]="aiForm.invalid || savingSection() === 'ai' || !canWrite()">
                  {{ savingSection() === 'ai' ? 'Saving...' : 'Save AI settings' }}
                </button>
              </div>
            </form>
          </section>

          <section class="card form-card page-stack" *ngIf="activeSection() === 'implementation'">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Implementation</span>
                <h3>Implementation workspace</h3>
                <p class="subtle">Use this optional section for companies that need guided rollout, PDCA structure, and objective-establishment support. Mature companies can keep it hidden.</p>
              </div>
            </div>

            <form [formGroup]="implementationForm" class="page-stack" (ngSubmit)="saveSection('implementation')">
              <label class="toggle-row">
                <input type="checkbox" formControlName="enabled" [disabled]="!canWrite()">
                <span>Enable implementation workspace in the sidebar</span>
              </label>

              <div class="form-grid-2">
                <label class="field">
                  <span>Starting point</span>
                  <select formControlName="startingPoint">
                    <option value="NEW_IMPLEMENTATION">New implementation</option>
                    <option value="DIGITISING_EXISTING">Digitising an existing system</option>
                    <option value="MATURING_EXISTING">Maturing an already digital system</option>
                  </select>
                </label>
                <label class="field">
                  <span>Rollout owner</span>
                  <input formControlName="rolloutOwner" placeholder="Quality Manager">
                </label>
              </div>

              <div class="form-grid-2">
                <label class="field">
                  <span>Target standards</span>
                  <input formControlName="targetStandards" placeholder="ISO 9001, ISO 14001, ISO 45001">
                </label>
                <label class="field">
                  <span>Rollout goal</span>
                  <input formControlName="certificationGoal" placeholder="External certification in Q4 2026">
                </label>
              </div>

              <div class="button-row">
                <button type="submit" [disabled]="implementationForm.invalid || savingSection() === 'implementation' || !canWrite()">
                  {{ savingSection() === 'implementation' ? 'Saving...' : 'Save implementation settings' }}
                </button>
              </div>
            </form>
          </section>
        </div>
      </section>
    </section>
  `,
  styles: [`
    .settings-summary-strip {
      grid-template-columns: repeat(5, minmax(0, 1fr));
      margin-bottom: 0.25rem;
    }

    .settings-summary-strip small {
      color: var(--muted);
      font-size: 0.85rem;
    }

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

    .nav-card {
      display: grid;
      justify-items: start;
      gap: 0.2rem;
      padding: 0.85rem 0.95rem;
      border-radius: 1rem;
      text-align: left;
    }

    .nav-card span {
      font-weight: 800;
    }

    .nav-card small {
      color: var(--muted);
      font-size: 0.84rem;
      line-height: 1.35;
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

    .capability-group-grid,
    .position-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }

    .capability-group-card,
    .role-guidance-card {
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(243, 247, 243, 0.92));
    }

    .compact-entity-list {
      margin-bottom: 1rem;
    }

    .role-toggle-grid {
      display: grid;
      gap: 0.65rem;
    }

    .role-capability-groups {
      display: grid;
      gap: 1rem;
    }

    .role-capability-group {
      display: grid;
      gap: 0.7rem;
      padding-top: 0.25rem;
      border-top: 1px solid rgba(95, 107, 99, 0.14);
    }

    .role-capability-group:first-child {
      border-top: 0;
      padding-top: 0;
    }

    .role-capability-group__head {
      display: flex;
      justify-content: flex-start;
    }

    .role-toggle-card {
      padding: 0.7rem 0.8rem;
      border: 1px solid rgba(95, 107, 99, 0.14);
      border-radius: 0.95rem;
      background: rgba(255, 255, 255, 0.86);
    }

    .summary-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.35rem 0.65rem;
      border-radius: 999px;
      background: rgba(20, 61, 43, 0.09);
      border: 1px solid rgba(20, 61, 43, 0.14);
      color: var(--text-soft);
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .position-card {
      display: grid;
      gap: 0.55rem;
      padding: 0.95rem 1rem;
      border: 1px solid rgba(95, 107, 99, 0.14);
      border-radius: 1rem;
      background: rgba(255, 255, 255, 0.86);
    }

    .position-card__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .position-card__head strong {
      color: var(--text-strong);
    }

    .position-card__head span {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.25rem 0.55rem;
      border-radius: 999px;
      background: rgba(43, 75, 109, 0.1);
      color: var(--text-soft);
      font-size: 0.74rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .position-card p {
      margin: 0;
      color: var(--muted);
      line-height: 1.5;
      font-size: 0.92rem;
    }

    .compact-runtime-panel {
      gap: 0.75rem;
    }

    .compact-runtime-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
    }

    .compact-runtime-grid article {
      display: grid;
      gap: 0.25rem;
    }

    .ai-feature-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
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
      .settings-summary-strip,
      .settings-layout,
      .capability-group-grid,
      .position-grid,
      .role-grid,
      .compact-runtime-grid,
      .ai-feature-grid {
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
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  protected readonly activeSection = signal<'organization' | 'roles' | 'document' | 'risk' | 'kpi' | 'subscription' | 'notifications' | 'ai' | 'implementation'>('organization');
  protected readonly config = signal<SettingsConfig | null>(null);
  protected readonly aiRuntime = signal<AiRuntimeConfig | null>(null);
  protected readonly savingSection = signal<string | null>(null);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly capabilityGroups = roleCapabilityGroups;
  protected readonly rolePositionGuidance = rolePositionGuidance;

  protected showStartHereBackLink() {
    return this.route.snapshot.queryParamMap.get('from') === 'start-here';
  }

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

  protected readonly subscriptionForm = this.fb.nonNullable.group({
    packageTier: ['QHSE_PRO' as TenantPackageTier, Validators.required],
    aiAssistant: [true],
    customerFeedback: [true]
  });

  protected readonly notificationsForm = this.fb.nonNullable.group({
    enabled: [true]
  });

  protected readonly aiForm = this.fb.nonNullable.group({
    enabled: [false],
    provider: ['openai', Validators.required],
    auditFindingAssistant: [true],
    documentDraftAssistant: [false],
    managementReviewAssistant: [false],
    riskSuggestionAssistant: [false]
  });

  protected readonly implementationForm = this.fb.nonNullable.group({
    enabled: [true],
    startingPoint: ['DIGITISING_EXISTING', Validators.required],
    targetStandards: ['ISO 9001, ISO 14001, ISO 45001', Validators.required],
    rolloutOwner: ['Quality Manager'],
    certificationGoal: ['']
  });

  constructor() {
    this.authStore.refreshSession();
    this.reload();
  }

  protected canWrite() {
    return this.authStore.hasPermission('settings.write');
  }

  protected saveSection(section: 'organization' | 'document' | 'risk' | 'kpi' | 'subscription' | 'notifications' | 'ai' | 'implementation') {
    if (!this.canWrite()) {
      this.error.set('You do not have permission to update settings.');
      return;
    }

    const formMap = {
      organization: this.organizationForm,
      document: this.documentForm,
      risk: this.riskForm,
      kpi: this.kpiForm,
      subscription: this.subscriptionForm,
      notifications: this.notificationsForm,
      ai: this.aiForm,
      implementation: this.implementationForm
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
        : section === 'ai'
          ? {
              enabled: this.aiForm.getRawValue().enabled,
              provider: this.aiForm.getRawValue().provider,
              features: {
                auditFindingAssistant: this.aiForm.getRawValue().auditFindingAssistant,
                documentDraftAssistant: this.aiForm.getRawValue().documentDraftAssistant,
                managementReviewAssistant: this.aiForm.getRawValue().managementReviewAssistant,
                riskSuggestionAssistant: this.aiForm.getRawValue().riskSuggestionAssistant
              }
            }
        : section === 'implementation'
          ? {
              ...form.getRawValue(),
              targetStandards: this.parseImplementationStandards()
            }
        : section === 'subscription'
          ? {
              packageTier: this.subscriptionForm.getRawValue().packageTier,
              addOns: {
                aiAssistant: this.subscriptionForm.getRawValue().aiAssistant,
                customerFeedback: this.subscriptionForm.getRawValue().customerFeedback
              }
            }
        : form.getRawValue();

    this.api.put('settings/section/' + section, { values }).subscribe({
      next: (config) => {
        this.savingSection.set(null);
        this.message.set('Settings saved successfully.');
        this.applyConfig(config as SettingsConfig);
        if (section === 'subscription') {
          this.authStore.refreshSession();
        }
        if (section === 'ai') {
          this.reloadAiRuntime();
        }
      },
      error: (error: HttpErrorResponse) => {
        this.savingSection.set(null);
        this.error.set(this.readError(error, 'Settings could not be saved.'));
      }
    });
  }

  protected updateRoleCapability(roleId: string, capability: RoleCapabilityKey, checked: boolean) {
    if (!this.canWrite()) {
      this.error.set('You do not have permission to update settings.');
      return;
    }

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
        this.authStore.refreshSession();
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

  protected enabledCapabilityCount(role: RoleConfig) {
    return Object.values(role.capabilities).filter(Boolean).length;
  }

  protected packageTierLabel(packageTier: TenantPackageTier) {
    return {
      ASSURANCE: 'Assurance',
      CORE_IMS: 'Core IMS',
      QHSE_PRO: 'QHSE Pro'
    }[packageTier];
  }

  protected enabledAddOnCount(addOns: TenantAddOns) {
    return Object.values(addOns).filter(Boolean).length;
  }

  protected hasAiAddOn() {
    return this.subscriptionForm.getRawValue().aiAssistant;
  }

  protected isProtectedAdminCapability(role: RoleConfig, capability: RoleCapabilityKey) {
    return role.isSystem && role.name === 'Admin' && capability === 'manageUsersAndSettings';
  }

  private reload() {
    forkJoin({
      config: this.api.get<SettingsConfig>('settings/config'),
      aiRuntime: this.api.get<AiRuntimeConfig>('ai/config')
    }).subscribe({
      next: ({ config, aiRuntime }) => {
        this.applyConfig(config);
        this.aiRuntime.set(aiRuntime);
      },
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
    this.subscriptionForm.reset({
      packageTier: config.subscription.packageTier,
      aiAssistant: config.subscription.addOns.aiAssistant,
      customerFeedback: config.subscription.addOns.customerFeedback
    });
    this.notificationsForm.reset({
      enabled: config.notifications.enabled
    });
    this.aiForm.reset({
      enabled: config.ai.enabled,
      provider: config.ai.provider,
      auditFindingAssistant: config.ai.features.auditFindingAssistant,
      documentDraftAssistant: config.ai.features.documentDraftAssistant,
      managementReviewAssistant: config.ai.features.managementReviewAssistant,
      riskSuggestionAssistant: config.ai.features.riskSuggestionAssistant
    });
    this.implementationForm.reset({
      enabled: config.implementation.enabled,
      startingPoint: config.implementation.startingPoint,
      targetStandards: config.implementation.targetStandards.join(', '),
      rolloutOwner: config.implementation.rolloutOwner,
      certificationGoal: config.implementation.certificationGoal
    });
  }

  private parseDocumentTypes() {
    return this.documentForm.getRawValue().types
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private parseImplementationStandards() {
    return this.implementationForm.getRawValue().targetStandards
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private reloadAiRuntime() {
    this.api.get<AiRuntimeConfig>('ai/config').subscribe({
      next: (config) => this.aiRuntime.set(config),
      error: () => this.aiRuntime.set(null)
    });
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}
