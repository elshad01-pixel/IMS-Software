import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { permissionGuard } from './core/permission.guard';
import { LoginPageComponent } from './pages/login-page.component';
import { ShellComponent } from './layout/shell.component';
import { DashboardPageComponent } from './pages/dashboard-page.component';
import { CapaCreatePageComponent, CapaDetailPageComponent, CapaEditPageComponent, CapaRegisterPageComponent } from './pages/capa-page.component';
import { DocumentCreatePageComponent, DocumentDetailPageComponent, DocumentEditPageComponent, DocumentsRegisterPageComponent } from './pages/documents-page.component';
import { RiskCreatePageComponent, RiskDetailPageComponent, RiskEditPageComponent, RisksRegisterPageComponent } from './pages/risks-page.component';
import { AuditsPageComponent } from './pages/audits-page.component';
import { ManagementReviewPageComponent } from './pages/management-review-page.component';
import { KpisPageComponent } from './pages/kpis-page.component';
import { TrainingPageComponent } from './pages/training-page.component';
import { UserCreatePageComponent, UserDetailPageComponent, UserEditPageComponent, UsersRegisterPageComponent } from './pages/users-page.component';
import { ReportsPageComponent } from './pages/reports-page.component';
import { SettingsPageComponent } from './pages/settings-page.component';
import { ActionsPageComponent } from './pages/actions-page.component';
import { NcrCreatePageComponent, NcrDetailPageComponent, NcrEditPageComponent, NcrRegisterPageComponent } from './pages/ncr-page.component';
import { AuditChecklistQuestionBankPageComponent } from './pages/audit-checklist-question-bank-page.component';
import { ProcessRegisterCreatePageComponent, ProcessRegisterDetailPageComponent, ProcessRegisterEditPageComponent, ProcessRegisterListPageComponent } from './pages/process-register-page.component';
import { ContextDashboardPageComponent } from './pages/context-dashboard-page.component';
import { ExternalIssueCreatePageComponent, ExternalIssueEditPageComponent, ExternalIssuesListPageComponent, InternalIssueCreatePageComponent, InternalIssueEditPageComponent, InternalIssuesListPageComponent } from './pages/context-issues-page.component';
import { InterestedPartiesListPageComponent, InterestedPartyCreatePageComponent, InterestedPartyEditPageComponent } from './pages/interested-parties-page.component';
import { NeedExpectationCreatePageComponent, NeedExpectationEditPageComponent, NeedsExpectationsListPageComponent } from './pages/needs-expectations-page.component';
import {
  ComplianceObligationsCreatePageComponent,
  ComplianceObligationsDetailPageComponent,
  ComplianceObligationsEditPageComponent,
  ComplianceObligationsListPageComponent
} from './pages/compliance-obligations-page.component';
import {
  IncidentsCreatePageComponent,
  IncidentsDetailPageComponent,
  IncidentsEditPageComponent,
  IncidentsListPageComponent
} from './pages/incidents-page.component';
import {
  EnvironmentalAspectsCreatePageComponent,
  EnvironmentalAspectsDetailPageComponent,
  EnvironmentalAspectsEditPageComponent,
  EnvironmentalAspectsListPageComponent
} from './pages/environmental-aspects-page.component';
import {
  HazardsCreatePageComponent,
  HazardsDetailPageComponent,
  HazardsEditPageComponent,
  HazardsListPageComponent
} from './pages/hazards-page.component';
import {
  ExternalProvidersCreatePageComponent,
  ExternalProvidersDetailPageComponent,
  ExternalProvidersEditPageComponent,
  ExternalProvidersListPageComponent
} from './pages/external-providers-page.component';
import {
  ChangeManagementCreatePageComponent,
  ChangeManagementDetailPageComponent,
  ChangeManagementEditPageComponent,
  ChangeManagementListPageComponent
} from './pages/change-management-page.component';
import { ImplementationPageComponent } from './pages/implementation-page.component';

export const appRoutes: Routes = [
  { path: 'login', component: LoginPageComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    canActivateChild: [permissionGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardPageComponent, data: { permission: 'dashboard.read' } },
      { path: 'implementation', component: ImplementationPageComponent, data: { permission: 'dashboard.read' } },
      { path: 'documents', component: DocumentsRegisterPageComponent, data: { permission: 'documents.read' } },
      { path: 'documents/new', component: DocumentCreatePageComponent, data: { permission: 'documents.write' } },
      { path: 'documents/:id', component: DocumentDetailPageComponent, data: { permission: 'documents.read' } },
      { path: 'documents/:id/edit', component: DocumentEditPageComponent, data: { permission: 'documents.write' } },
      { path: 'risks', component: RisksRegisterPageComponent, data: { permission: 'risks.read' } },
      { path: 'risks/new', component: RiskCreatePageComponent, data: { permission: 'risks.write' } },
      { path: 'risks/:id', component: RiskDetailPageComponent, data: { permission: 'risks.read' } },
      { path: 'risks/:id/edit', component: RiskEditPageComponent, data: { permission: 'risks.write' } },
      { path: 'capa', component: CapaRegisterPageComponent, data: { permission: 'capa.read' } },
      { path: 'capa/new', component: CapaCreatePageComponent, data: { permission: 'capa.write' } },
      { path: 'capa/:id', component: CapaDetailPageComponent, data: { permission: 'capa.read' } },
      { path: 'capa/:id/edit', component: CapaEditPageComponent, data: { permission: 'capa.write' } },
      { path: 'audits', component: AuditsPageComponent, data: { mode: 'list', permission: 'audits.read' } },
      { path: 'audits/checklist-question-bank', component: AuditChecklistQuestionBankPageComponent, data: { permission: 'audits.write' } },
      { path: 'audits/new', component: AuditsPageComponent, data: { mode: 'create', permission: 'audits.write' } },
      { path: 'audits/:id', component: AuditsPageComponent, data: { mode: 'detail', permission: 'audits.read' } },
      { path: 'audits/:id/edit', component: AuditsPageComponent, data: { mode: 'edit', permission: 'audits.write' } },
      { path: 'management-review', component: ManagementReviewPageComponent, data: { mode: 'list', permission: 'management-review.read' } },
      { path: 'management-review/new', component: ManagementReviewPageComponent, data: { mode: 'create', permission: 'management-review.write' } },
      { path: 'management-review/:id', component: ManagementReviewPageComponent, data: { mode: 'detail', permission: 'management-review.read' } },
      { path: 'management-review/:id/edit', component: ManagementReviewPageComponent, data: { mode: 'edit', permission: 'management-review.write' } },
      { path: 'kpis', component: KpisPageComponent, data: { mode: 'list', permission: 'kpis.read' } },
      { path: 'kpis/new', component: KpisPageComponent, data: { mode: 'create', permission: 'kpis.write' } },
      { path: 'kpis/:id', component: KpisPageComponent, data: { mode: 'detail', permission: 'kpis.read' } },
      { path: 'kpis/:id/edit', component: KpisPageComponent, data: { mode: 'edit', permission: 'kpis.write' } },
      { path: 'training', component: TrainingPageComponent, data: { mode: 'list', permission: 'training.read' } },
      { path: 'training/new', component: TrainingPageComponent, data: { mode: 'create', permission: 'training.write' } },
      { path: 'training/:id', component: TrainingPageComponent, data: { mode: 'detail', permission: 'training.read' } },
      { path: 'training/:id/edit', component: TrainingPageComponent, data: { mode: 'edit', permission: 'training.write' } },
      { path: 'actions', component: ActionsPageComponent, data: { permission: 'dashboard.read' } },
      { path: 'ncr', component: NcrRegisterPageComponent, data: { permission: 'ncr.read' } },
      { path: 'ncr/new', component: NcrCreatePageComponent, data: { permission: 'ncr.write' } },
      { path: 'ncr/:id', component: NcrDetailPageComponent, data: { permission: 'ncr.read' } },
      { path: 'ncr/:id/edit', component: NcrEditPageComponent, data: { permission: 'ncr.write' } },
      { path: 'context', component: ContextDashboardPageComponent, data: { permission: 'context.read' } },
      { path: 'context/internal-issues', component: InternalIssuesListPageComponent, data: { permission: 'context.read' } },
      { path: 'context/internal-issues/new', component: InternalIssueCreatePageComponent, data: { permission: 'context.write' } },
      { path: 'context/internal-issues/:id/edit', component: InternalIssueEditPageComponent, data: { permission: 'context.write' } },
      { path: 'context/external-issues', component: ExternalIssuesListPageComponent, data: { permission: 'context.read' } },
      { path: 'context/external-issues/new', component: ExternalIssueCreatePageComponent, data: { permission: 'context.write' } },
      { path: 'context/external-issues/:id/edit', component: ExternalIssueEditPageComponent, data: { permission: 'context.write' } },
      { path: 'context/interested-parties', component: InterestedPartiesListPageComponent, data: { permission: 'context.read' } },
      { path: 'context/interested-parties/new', component: InterestedPartyCreatePageComponent, data: { permission: 'context.write' } },
      { path: 'context/interested-parties/:id/edit', component: InterestedPartyEditPageComponent, data: { permission: 'context.write' } },
      { path: 'context/needs-expectations', component: NeedsExpectationsListPageComponent, data: { permission: 'context.read' } },
      { path: 'context/needs-expectations/new', component: NeedExpectationCreatePageComponent, data: { permission: 'context.write' } },
      { path: 'context/needs-expectations/:id/edit', component: NeedExpectationEditPageComponent, data: { permission: 'context.write' } },
      { path: 'compliance-obligations', component: ComplianceObligationsListPageComponent, data: { permission: 'obligations.read' } },
      { path: 'compliance-obligations/new', component: ComplianceObligationsCreatePageComponent, data: { permission: 'obligations.write' } },
      { path: 'compliance-obligations/:id', component: ComplianceObligationsDetailPageComponent, data: { permission: 'obligations.read' } },
      { path: 'compliance-obligations/:id/edit', component: ComplianceObligationsEditPageComponent, data: { permission: 'obligations.write' } },
      { path: 'incidents', component: IncidentsListPageComponent, data: { permission: 'incidents.read' } },
      { path: 'incidents/new', component: IncidentsCreatePageComponent, data: { permission: 'incidents.write' } },
      { path: 'incidents/:id', component: IncidentsDetailPageComponent, data: { permission: 'incidents.read' } },
      { path: 'incidents/:id/edit', component: IncidentsEditPageComponent, data: { permission: 'incidents.write' } },
      { path: 'environmental-aspects', component: EnvironmentalAspectsListPageComponent, data: { permission: 'aspects.read' } },
      { path: 'environmental-aspects/new', component: EnvironmentalAspectsCreatePageComponent, data: { permission: 'aspects.write' } },
      { path: 'environmental-aspects/:id', component: EnvironmentalAspectsDetailPageComponent, data: { permission: 'aspects.read' } },
      { path: 'environmental-aspects/:id/edit', component: EnvironmentalAspectsEditPageComponent, data: { permission: 'aspects.write' } },
      { path: 'hazards', component: HazardsListPageComponent, data: { permission: 'hazards.read' } },
      { path: 'hazards/new', component: HazardsCreatePageComponent, data: { permission: 'hazards.write' } },
      { path: 'hazards/:id', component: HazardsDetailPageComponent, data: { permission: 'hazards.read' } },
      { path: 'hazards/:id/edit', component: HazardsEditPageComponent, data: { permission: 'hazards.write' } },
      { path: 'external-providers', component: ExternalProvidersListPageComponent, data: { permission: 'providers.read' } },
      { path: 'external-providers/new', component: ExternalProvidersCreatePageComponent, data: { permission: 'providers.write' } },
      { path: 'external-providers/:id', component: ExternalProvidersDetailPageComponent, data: { permission: 'providers.read' } },
      { path: 'external-providers/:id/edit', component: ExternalProvidersEditPageComponent, data: { permission: 'providers.write' } },
      { path: 'change-management', component: ChangeManagementListPageComponent, data: { permission: 'change.read' } },
      { path: 'change-management/new', component: ChangeManagementCreatePageComponent, data: { permission: 'change.write' } },
      { path: 'change-management/:id', component: ChangeManagementDetailPageComponent, data: { permission: 'change.read' } },
      { path: 'change-management/:id/edit', component: ChangeManagementEditPageComponent, data: { permission: 'change.write' } },
      { path: 'process-register', component: ProcessRegisterListPageComponent, data: { permission: 'processes.read' } },
      { path: 'process-register/new', component: ProcessRegisterCreatePageComponent, data: { permission: 'processes.write' } },
      { path: 'process-register/:id', component: ProcessRegisterDetailPageComponent, data: { permission: 'processes.read' } },
      { path: 'process-register/:id/edit', component: ProcessRegisterEditPageComponent, data: { permission: 'processes.write' } },
      { path: 'reports', component: ReportsPageComponent, data: { permission: 'reports.read' } },
      { path: 'users', component: UsersRegisterPageComponent, data: { permission: 'users.read' } },
      { path: 'users/new', component: UserCreatePageComponent, data: { permission: 'users.write' } },
      { path: 'users/:id', component: UserDetailPageComponent, data: { permission: 'users.read' } },
      { path: 'users/:id/edit', component: UserEditPageComponent, data: { permission: 'users.write' } },
      { path: 'settings', component: SettingsPageComponent, data: { permission: 'settings.read' } }
    ]
  },
  { path: '**', redirectTo: '' }
];
