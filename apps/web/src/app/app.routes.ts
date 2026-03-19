import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { LoginPageComponent } from './pages/login-page.component';
import { ShellComponent } from './layout/shell.component';
import { DashboardPageComponent } from './pages/dashboard-page.component';
import { DocumentsPageComponent } from './pages/documents-page.component';
import { RisksPageComponent } from './pages/risks-page.component';
import { CapaPageComponent } from './pages/capa-page.component';
import { AuditsPageComponent } from './pages/audits-page.component';
import { ManagementReviewPageComponent } from './pages/management-review-page.component';
import { KpisPageComponent } from './pages/kpis-page.component';
import { TrainingPageComponent } from './pages/training-page.component';
import { UsersPageComponent } from './pages/users-page.component';
import { SettingsPageComponent } from './pages/settings-page.component';
import { PlaceholderPageComponent } from './pages/placeholder-page.component';

export const appRoutes: Routes = [
  { path: 'login', component: LoginPageComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardPageComponent },
      { path: 'documents', component: DocumentsPageComponent, data: { mode: 'list' } },
      { path: 'documents/new', component: DocumentsPageComponent, data: { mode: 'create' } },
      { path: 'documents/:id', component: DocumentsPageComponent, data: { mode: 'detail' } },
      { path: 'documents/:id/edit', component: DocumentsPageComponent, data: { mode: 'edit' } },
      { path: 'risks', component: RisksPageComponent, data: { mode: 'list' } },
      { path: 'risks/new', component: RisksPageComponent, data: { mode: 'create' } },
      { path: 'risks/:id', component: RisksPageComponent, data: { mode: 'detail' } },
      { path: 'risks/:id/edit', component: RisksPageComponent, data: { mode: 'edit' } },
      { path: 'capa', component: CapaPageComponent, data: { mode: 'list' } },
      { path: 'capa/new', component: CapaPageComponent, data: { mode: 'create' } },
      { path: 'capa/:id', component: CapaPageComponent, data: { mode: 'detail' } },
      { path: 'capa/:id/edit', component: CapaPageComponent, data: { mode: 'edit' } },
      { path: 'audits', component: AuditsPageComponent, data: { mode: 'list' } },
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
      { path: 'reports', component: PlaceholderPageComponent, data: { title: 'Reports', description: 'Generate cross-module operational reports.' } },
      { path: 'users', component: UsersPageComponent },
      { path: 'settings', component: SettingsPageComponent }
    ]
  },
  { path: '**', redirectTo: '' }
];
