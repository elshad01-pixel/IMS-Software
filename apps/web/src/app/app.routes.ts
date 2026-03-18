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
      { path: 'documents', component: DocumentsPageComponent },
      { path: 'risks', component: RisksPageComponent },
      { path: 'capa', component: CapaPageComponent },
      { path: 'audits', component: AuditsPageComponent },
      { path: 'management-review', component: ManagementReviewPageComponent },
      { path: 'kpis', component: KpisPageComponent },
      { path: 'training', component: TrainingPageComponent },
      { path: 'reports', component: PlaceholderPageComponent, data: { title: 'Reports', description: 'Generate cross-module operational reports.' } },
      { path: 'users', component: UsersPageComponent },
      { path: 'settings', component: SettingsPageComponent }
    ]
  },
  { path: '**', redirectTo: '' }
];
