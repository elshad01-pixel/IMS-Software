import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
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

export const appRoutes: Routes = [
  { path: 'login', component: LoginPageComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardPageComponent },
      { path: 'documents', component: DocumentsRegisterPageComponent },
      { path: 'documents/new', component: DocumentCreatePageComponent },
      { path: 'documents/:id', component: DocumentDetailPageComponent },
      { path: 'documents/:id/edit', component: DocumentEditPageComponent },
      { path: 'risks', component: RisksRegisterPageComponent },
      { path: 'risks/new', component: RiskCreatePageComponent },
      { path: 'risks/:id', component: RiskDetailPageComponent },
      { path: 'risks/:id/edit', component: RiskEditPageComponent },
      { path: 'capa', component: CapaRegisterPageComponent },
      { path: 'capa/new', component: CapaCreatePageComponent },
      { path: 'capa/:id', component: CapaDetailPageComponent },
      { path: 'capa/:id/edit', component: CapaEditPageComponent },
      { path: 'audits', component: AuditsPageComponent, data: { mode: 'list' } },
      { path: 'audits/checklist-question-bank', component: AuditChecklistQuestionBankPageComponent },
      { path: 'audits/new', component: AuditsPageComponent, data: { mode: 'create' } },
      { path: 'audits/:id', component: AuditsPageComponent, data: { mode: 'detail' } },
      { path: 'audits/:id/edit', component: AuditsPageComponent, data: { mode: 'edit' } },
      { path: 'management-review', component: ManagementReviewPageComponent, data: { mode: 'list' } },
      { path: 'management-review/new', component: ManagementReviewPageComponent, data: { mode: 'create' } },
      { path: 'management-review/:id', component: ManagementReviewPageComponent, data: { mode: 'detail' } },
      { path: 'management-review/:id/edit', component: ManagementReviewPageComponent, data: { mode: 'edit' } },
      { path: 'kpis', component: KpisPageComponent, data: { mode: 'list' } },
      { path: 'kpis/new', component: KpisPageComponent, data: { mode: 'create' } },
      { path: 'kpis/:id', component: KpisPageComponent, data: { mode: 'detail' } },
      { path: 'kpis/:id/edit', component: KpisPageComponent, data: { mode: 'edit' } },
      { path: 'training', component: TrainingPageComponent, data: { mode: 'list' } },
      { path: 'training/new', component: TrainingPageComponent, data: { mode: 'create' } },
      { path: 'training/:id', component: TrainingPageComponent, data: { mode: 'detail' } },
      { path: 'training/:id/edit', component: TrainingPageComponent, data: { mode: 'edit' } },
      { path: 'actions', component: ActionsPageComponent },
      { path: 'ncr', component: NcrRegisterPageComponent },
      { path: 'ncr/new', component: NcrCreatePageComponent },
      { path: 'ncr/:id', component: NcrDetailPageComponent },
      { path: 'ncr/:id/edit', component: NcrEditPageComponent },
      { path: 'context', component: ContextDashboardPageComponent },
      { path: 'context/internal-issues', component: InternalIssuesListPageComponent },
      { path: 'context/internal-issues/new', component: InternalIssueCreatePageComponent },
      { path: 'context/internal-issues/:id/edit', component: InternalIssueEditPageComponent },
      { path: 'context/external-issues', component: ExternalIssuesListPageComponent },
      { path: 'context/external-issues/new', component: ExternalIssueCreatePageComponent },
      { path: 'context/external-issues/:id/edit', component: ExternalIssueEditPageComponent },
      { path: 'context/interested-parties', component: InterestedPartiesListPageComponent },
      { path: 'context/interested-parties/new', component: InterestedPartyCreatePageComponent },
      { path: 'context/interested-parties/:id/edit', component: InterestedPartyEditPageComponent },
      { path: 'context/needs-expectations', component: NeedsExpectationsListPageComponent },
      { path: 'context/needs-expectations/new', component: NeedExpectationCreatePageComponent },
      { path: 'context/needs-expectations/:id/edit', component: NeedExpectationEditPageComponent },
      { path: 'process-register', component: ProcessRegisterListPageComponent },
      { path: 'process-register/new', component: ProcessRegisterCreatePageComponent },
      { path: 'process-register/:id', component: ProcessRegisterDetailPageComponent },
      { path: 'process-register/:id/edit', component: ProcessRegisterEditPageComponent },
      { path: 'reports', component: ReportsPageComponent },
      { path: 'users', component: UsersRegisterPageComponent },
      { path: 'users/new', component: UserCreatePageComponent },
      { path: 'users/:id', component: UserDetailPageComponent },
      { path: 'users/:id/edit', component: UserEditPageComponent },
      { path: 'settings', component: SettingsPageComponent }
    ]
  },
  { path: '**', redirectTo: '' }
];
