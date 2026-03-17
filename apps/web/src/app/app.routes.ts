import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { LoginPageComponent } from './pages/login-page.component';
import { ShellComponent } from './layout/shell.component';
import { DashboardPageComponent } from './pages/dashboard-page.component';
import { DocumentsPageComponent } from './pages/documents-page.component';
import { RisksPageComponent } from './pages/risks-page.component';
import { CapaPageComponent } from './pages/capa-page.component';
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
      { path: 'audits', component: PlaceholderPageComponent, data: { title: 'Audits', description: 'Schedule and track internal audit programs.' } },
      { path: 'management-review', component: PlaceholderPageComponent, data: { title: 'Management Review', description: 'Capture inputs, outcomes, and strategic follow-up.' } },
      { path: 'kpis', component: PlaceholderPageComponent, data: { title: 'KPIs', description: 'Review target performance and trend snapshots.' } },
      { path: 'training', component: PlaceholderPageComponent, data: { title: 'Training', description: 'Track competence, due dates, and completion.' } },
      { path: 'reports', component: PlaceholderPageComponent, data: { title: 'Reports', description: 'Generate cross-module operational reports.' } },
      { path: 'users', component: UsersPageComponent },
      { path: 'settings', component: SettingsPageComponent }
    ]
  },
  { path: '**', redirectTo: '' }
];
