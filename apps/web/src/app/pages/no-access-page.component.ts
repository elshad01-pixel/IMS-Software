import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthStore } from '../core/auth.store';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="page-grid">
      <section class="card no-access-card">
        <div class="no-access-copy">
          <span class="section-eyebrow">Access</span>
          <h1>No access to this area</h1>
          <p class="subtle">
            {{ explanation() }}
          </p>
        </div>

        <div class="no-access-grid">
          <article class="detail-card">
            <span>Area</span>
            <strong>{{ areaLabel() }}</strong>
          </article>
          <article class="detail-card">
            <span>Required permission</span>
            <strong>{{ requiredPermission() || 'Not applicable' }}</strong>
          </article>
          <article class="detail-card">
            <span>Required package area</span>
            <strong>{{ requiredPackageModuleLabel() }}</strong>
          </article>
          <article class="detail-card">
            <span>Current role</span>
            <strong>{{ authStore.roleLabel() }}</strong>
          </article>
          <article class="detail-card">
            <span>Current package</span>
            <strong>{{ packageTier() }}</strong>
          </article>
        </div>

        <div class="guidance-card no-access-guidance" *ngIf="attemptedUrl() as attempted">
          <strong>Attempted path</strong>
          <p>{{ attempted }}</p>
        </div>

        <div class="button-row">
          <a class="button-link" [routerLink]="['/dashboard']">Open dashboard</a>
          <a class="button-link secondary" [routerLink]="['/implementation']">Go to Start Here</a>
        </div>
      </section>
    </section>
  `,
  styles: [`
    .no-access-card {
      display: grid;
      gap: 1.25rem;
      padding: 1.4rem 1.5rem;
    }

    .no-access-copy {
      display: grid;
      gap: 0.55rem;
    }

    .no-access-copy h1 {
      margin: 0;
      font-size: clamp(1.8rem, 3.4vw, 2.5rem);
      line-height: 1.05;
      letter-spacing: -0.03em;
    }

    .no-access-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.9rem;
    }

    .detail-card {
      display: grid;
      gap: 0.35rem;
      padding: 1rem;
      border-radius: 1rem;
      border: 1px solid rgba(46, 67, 56, 0.08);
      background: rgba(252, 253, 250, 0.86);
    }

    .detail-card span {
      color: var(--muted);
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .detail-card strong {
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .no-access-guidance p {
      margin: 0.45rem 0 0;
      color: var(--muted);
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    @media (max-width: 900px) {
      .no-access-card {
        padding: 1.1rem;
      }

      .no-access-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class NoAccessPageComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly authStore = inject(AuthStore);

  protected readonly areaLabel = computed(() => this.route.snapshot.queryParamMap.get('area') || 'This area');
  protected readonly requiredPermission = computed(() => this.route.snapshot.queryParamMap.get('permission') || '');
  protected readonly requiredPackageModule = computed(() => this.route.snapshot.queryParamMap.get('packageModule') || '');
  protected readonly packageTier = computed(() => this.route.snapshot.queryParamMap.get('packageTier') || this.authStore.packageTier());
  protected readonly attemptedUrl = computed(() => this.route.snapshot.queryParamMap.get('attempted') || '');
  protected readonly requiredPackageModuleLabel = computed(() =>
    ({
      dashboard: 'Dashboard',
      implementation: 'Start Here',
      documents: 'Documents',
      risks: 'Risks',
      capa: 'CAPA',
      audits: 'Audits',
      'management-review': 'Management Review',
      kpis: 'KPIs',
      training: 'Training',
      actions: 'Actions',
      ncr: 'NCR',
      context: 'Context',
      'compliance-obligations': 'Compliance Obligations',
      incidents: 'Incidents',
      'environmental-aspects': 'Environmental Aspects',
      hazards: 'Hazards',
      'external-providers': 'External Providers',
      'change-management': 'Change Management',
      'process-register': 'Process Register',
      reports: 'Reports',
      users: 'Users',
      'activity-log': 'Activity Log',
      settings: 'Settings'
    } as Record<string, string>)[this.requiredPackageModule()] || 'Included module'
  );
  protected readonly explanation = computed(() => {
    if (this.requiredPackageModule()) {
      return `Your current package does not include this area. Ask your system administrator to review the tenant package if you need access.`;
    }

    return `You do not have access to this area. Your current role does not include the required permission. Contact your system administrator if you believe this is incorrect.`;
  });
}
