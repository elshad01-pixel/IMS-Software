import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
import { PageHeaderComponent } from '../shared/page-header.component';

type PageMode = 'list' | 'create' | 'detail' | 'edit';

type RoleOption = {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
};

type UserRow = {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  role?: RoleOption | null;
};

@Component({
  selector: 'iso-users-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="'Users'"
        [title]="pageTitle()"
        [description]="pageDescription()"
        [breadcrumbs]="breadcrumbs()"
      >
        <a *ngIf="mode() === 'list' && canWrite()" routerLink="/users/new" class="button-link">+ New user</a>
        <a *ngIf="mode() === 'detail' && selectedUser() && canWrite()" [routerLink]="['/users', selectedUser()?.id, 'edit']" class="button-link">Edit user</a>
        <a *ngIf="mode() !== 'list'" routerLink="/users" class="button-link secondary">Back to users</a>
      </iso-page-header>

      <section *ngIf="mode() === 'list'" class="page-stack">
        <div class="card list-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Register</span>
              <h3>Users and roles</h3>
              <p class="subtle">Manage tenant users, role assignment, and activation status in one clear register.</p>
            </div>
          </div>

          <div class="toolbar top-space">
            <div class="toolbar-meta">
              <div>
                <p class="toolbar-title">User filters</p>
                <p class="toolbar-copy">Search by name or email, then open a user to view or edit access details.</p>
              </div>
              <div class="toolbar-stats">
                <article class="toolbar-stat">
                  <span>Total</span>
                  <strong>{{ users().length }}</strong>
                </article>
                <article class="toolbar-stat">
                  <span>Active</span>
                  <strong>{{ activeCount() }}</strong>
                </article>
                <article class="toolbar-stat">
                  <span>Inactive</span>
                  <strong>{{ inactiveCount() }}</strong>
                </article>
              </div>
            </div>

            <div class="filter-row">
              <label class="field">
                <span>Search</span>
                <input [value]="search()" (input)="search.set(readInputValue($event))" placeholder="Name or email">
              </label>
              <label class="field">
                <span>Status</span>
                <select [value]="statusFilter()" (change)="statusFilter.set(readSelectValue($event))">
                  <option value="">All users</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
          </div>

          <div class="empty-state" *ngIf="loading()">
            <strong>Loading users</strong>
            <span>Refreshing tenant users and role assignment.</span>
          </div>

          <div class="empty-state top-space" *ngIf="!loading() && !filteredUsers().length">
            <strong>No users match the current filter</strong>
            <span>Adjust the search or create a new user for this tenant.</span>
          </div>

          <div class="data-table-wrap" *ngIf="!loading() && filteredUsers().length">
            <table class="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of filteredUsers()" [routerLink]="['/users', item.id]">
                  <td>
                    <div class="table-title">
                      <strong>{{ fullName(item) }}</strong>
                      <small>{{ item.email }}</small>
                    </div>
                  </td>
                  <td>{{ item.role?.name || 'Unassigned' }}</td>
                  <td><span class="status-badge" [ngClass]="item.isActive ? 'success' : 'neutral'">{{ item.isActive ? 'Active' : 'Inactive' }}</span></td>
                  <td>{{ item.createdAt | date:'yyyy-MM-dd' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section *ngIf="mode() === 'create' || mode() === 'edit'" class="page-stack">
        <form class="card form-card page-stack" [formGroup]="form" (ngSubmit)="save()">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Access</span>
              <h3>{{ mode() === 'create' ? 'New user' : 'Edit user' }}</h3>
              <p class="subtle">Set identity, account access, and role assignment in one dedicated workflow.</p>
            </div>
          </div>

          <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

          <section class="detail-section">
            <h4>Identity</h4>
            <label class="field top-space">
              <span>Name</span>
              <input formControlName="name" placeholder="Quality Manager">
            </label>

            <label class="field top-space">
              <span>Email</span>
              <input formControlName="email" placeholder="quality.manager@demo.local">
            </label>
          </section>

          <section class="detail-section">
            <h4>Role and status</h4>
            <div class="form-grid-2 top-space">
              <label class="field">
                <span>Role</span>
                <select formControlName="roleId">
                  <option value="">Unassigned</option>
                  <option *ngFor="let role of roles()" [value]="role.id">{{ role.name }}</option>
                </select>
              </label>

              <label class="field">
                <span>Status</span>
                <select formControlName="isActive">
                  <option [ngValue]="true">Active</option>
                  <option [ngValue]="false">Inactive</option>
                </select>
              </label>
            </div>

            <div class="role-copy top-space" *ngIf="selectedRole() as role">
              <strong>{{ role.name }}</strong>
              <small>{{ role.description || 'No role description provided.' }}</small>
            </div>
          </section>

          <section class="detail-section">
            <h4>Password</h4>
            <label class="field top-space">
              <span>{{ mode() === 'create' ? 'Password' : 'New password' }}</span>
              <input type="password" formControlName="password" [placeholder]="mode() === 'create' ? 'Minimum 8 characters' : 'Leave blank to keep current password'">
            </label>
          </section>

          <div class="button-row">
            <button type="submit" [disabled]="form.invalid || saving() || !canWrite()">{{ saving() ? 'Saving...' : 'Save user' }}</button>
            <a [routerLink]="selectedId() ? ['/users', selectedId()] : ['/users']" class="button-link secondary">Cancel</a>
          </div>
        </form>

      </section>

      <section *ngIf="mode() === 'detail' && selectedUser()" class="page-stack">
        <div class="page-stack">
          <section class="card detail-card">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">User detail</span>
                <h3>{{ fullName(selectedUser()!) }}</h3>
                <p class="subtle">{{ selectedUser()?.email }}</p>
              </div>
              <span class="status-badge" [ngClass]="selectedUser()?.isActive ? 'success' : 'neutral'">{{ selectedUser()?.isActive ? 'Active' : 'Inactive' }}</span>
            </div>

            <div class="summary-strip top-space">
              <article class="summary-item">
                <span>Role</span>
                <strong>{{ selectedUser()?.role?.name || 'Unassigned' }}</strong>
              </article>
              <article class="summary-item">
                <span>Created</span>
                <strong>{{ selectedUser()?.createdAt | date:'yyyy-MM-dd' }}</strong>
              </article>
              <article class="summary-item">
                <span>Last updated</span>
                <strong>{{ selectedUser()?.updatedAt | date:'yyyy-MM-dd HH:mm' }}</strong>
              </article>
            </div>

            <dl class="key-value top-space">
              <dt>Name</dt>
              <dd>{{ fullName(selectedUser()!) }}</dd>
              <dt>Email</dt>
              <dd>{{ selectedUser()?.email }}</dd>
              <dt>Role description</dt>
              <dd>{{ selectedUser()?.role?.description || 'No role description provided.' }}</dd>
              <dt>Status</dt>
              <dd>{{ selectedUser()?.isActive ? 'Active' : 'Inactive' }}</dd>
            </dl>
          </section>
        </div>
      </section>
    </section>
  `,
  styles: [`
    .top-space {
      margin-top: 1rem;
    }

    .role-copy {
      display: grid;
      gap: 0.2rem;
      padding: 0.95rem 1rem;
      border-radius: 16px;
      background: rgba(244, 246, 241, 0.88);
      border: 1px solid rgba(23, 50, 37, 0.08);
    }

    .role-copy small {
      color: var(--muted);
    }

    tr[routerLink] {
      cursor: pointer;
    }
  `]
})
export class UsersPageComponent implements OnInit, OnChanges {
  @Input() forcedMode: PageMode | null = null;

  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly mode = signal<PageMode>('list');
  protected readonly users = signal<UserRow[]>([]);
  protected readonly roles = signal<RoleOption[]>([]);
  protected readonly selectedUser = signal<UserRow | null>(null);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal((history.state?.notice as string) || '');
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly statusFilter = signal('');

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.minLength(8)]],
    roleId: [''],
    isActive: [true as boolean]
  });

  ngOnInit() {
    this.loadRoles();

    if (this.forcedMode) {
      this.mode.set(this.forcedMode);
      this.handleRoute(this.route.snapshot.paramMap);
    } else {
      this.route.data.subscribe((data) => {
        this.mode.set((data['mode'] as PageMode) || 'list');
        this.handleRoute(this.route.snapshot.paramMap);
      });
    }

    this.route.paramMap.subscribe((params) => this.handleRoute(params));
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['forcedMode'] && this.forcedMode) {
      this.mode.set(this.forcedMode);
      this.handleRoute(this.route.snapshot.paramMap);
    }
  }

  protected pageTitle() {
    return {
      list: 'Users and roles',
      create: 'Create user',
      detail: this.selectedUser() ? this.fullName(this.selectedUser() as UserRow) : 'User detail',
      edit: this.selectedUser() ? this.fullName(this.selectedUser() as UserRow) : 'Edit user'
    }[this.mode()];
  }

  protected pageDescription() {
    return {
      list: 'A premium register for tenant users, role assignment, and activation status.',
      create: 'Create a tenant user in a dedicated workflow without mixing the user register and editor.',
      detail: 'Review the user account, assigned role, and current activation state.',
      edit: 'Update user access, role assignment, and account status in one focused form.'
    }[this.mode()];
  }

  protected breadcrumbs() {
    if (this.mode() === 'list') return [{ label: 'Users' }];
    const base = [{ label: 'Users', link: '/users' }];
    if (this.mode() === 'create') return [...base, { label: 'New user' }];
    if (this.mode() === 'edit') return [...base, { label: this.selectedUser() ? this.fullName(this.selectedUser() as UserRow) : 'User', link: `/users/${this.selectedId()}` }, { label: 'Edit' }];
    return [...base, { label: this.selectedUser() ? this.fullName(this.selectedUser() as UserRow) : 'User' }];
  }

  protected filteredUsers() {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.users().filter((item) => {
      const matchesTerm =
        !term ||
        this.fullName(item).toLowerCase().includes(term) ||
        item.email.toLowerCase().includes(term);
      const matchesStatus =
        !status ||
        (status === 'active' && item.isActive) ||
        (status === 'inactive' && !item.isActive);
      return matchesTerm && matchesStatus;
    });
  }

  protected activeCount() {
    return this.users().filter((item) => item.isActive).length;
  }

  protected inactiveCount() {
    return this.users().filter((item) => !item.isActive).length;
  }

  protected selectedRole() {
    return this.roles().find((role) => role.id === this.form.getRawValue().roleId) ?? null;
  }

  protected canWrite() {
    return this.authStore.hasPermission('users.write');
  }

  protected fullName(user: UserRow) {
    return `${user.firstName} ${user.lastName}`.trim();
  }

  protected save() {
    if (!this.canWrite()) {
      this.error.set('You do not have permission to update users.');
      return;
    }

    if (this.form.invalid) {
      this.error.set('Complete the required user fields.');
      return;
    }

    const raw = this.form.getRawValue();
    if (this.mode() === 'create' && !raw.password.trim()) {
      this.error.set('Password is required for a new user.');
      return;
    }

    const parsedName = this.parseName(raw.name);
    if (!parsedName.firstName || !parsedName.lastName) {
      this.error.set('Enter a full name with first and last name.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');

    const payload = {
      firstName: parsedName.firstName,
      lastName: parsedName.lastName,
      email: raw.email.trim(),
      password: raw.password.trim() || undefined,
      roleId: raw.roleId || undefined,
      isActive: raw.isActive
    };

    const request = this.selectedId()
      ? this.api.patch<UserRow>(`users/${this.selectedId()}`, payload)
      : this.api.post<UserRow>('users', payload);

    request.subscribe({
      next: (user) => {
        this.saving.set(false);
        this.router.navigate(['/users', user.id], { state: { notice: 'User saved successfully.' } });
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'User save failed.'));
      }
    });
  }

  protected readInputValue(event: Event) {
    return (event.target as HTMLInputElement).value;
  }

  protected readSelectValue(event: Event) {
    return (event.target as HTMLSelectElement).value;
  }

  private handleRoute(params: ParamMap) {
    const id = params.get('id');
    this.selectedId.set(id);
    this.message.set((history.state?.notice as string) || '');
    this.error.set('');

    if (this.mode() === 'list') {
      this.selectedUser.set(null);
      this.resetForm();
      this.reloadUsers();
      return;
    }

    if (this.mode() === 'create') {
      this.selectedUser.set(null);
      this.resetForm();
      return;
    }

    if (id) {
      this.fetchUser(id);
    }
  }

  private resetForm() {
    this.form.reset({
      name: '',
      email: '',
      password: '',
      roleId: '',
      isActive: true
    });
  }

  private reloadUsers() {
    this.loading.set(true);
    this.api.get<UserRow[]>('users').subscribe({
      next: (items) => {
        this.loading.set(false);
        this.users.set(items);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'User register could not be loaded.'));
      }
    });
  }

  private fetchUser(id: string) {
    this.loading.set(true);
    this.api.get<UserRow>(`users/${id}`).subscribe({
      next: (user) => {
        this.loading.set(false);
        this.selectedUser.set(user);
        this.form.reset({
          name: this.fullName(user),
          email: user.email,
          password: '',
          roleId: user.role?.id ?? '',
          isActive: user.isActive
        });
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'User details could not be loaded.'));
      }
    });
  }

  private loadRoles() {
    this.api.get<RoleOption[]>('users/roles').subscribe({
      next: (roles) => this.roles.set(roles),
      error: (error: HttpErrorResponse) => this.error.set(this.readError(error, 'User roles could not be loaded.'))
    });
  }

  private parseName(name: string) {
    const cleaned = name.trim().replace(/\s+/g, ' ');
    const [firstName, ...rest] = cleaned.split(' ');
    return {
      firstName: firstName ?? '',
      lastName: rest.join(' ')
    };
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}

@Component({
  standalone: true,
  imports: [UsersPageComponent],
  template: `<iso-users-page [forcedMode]="'list'" />`
})
export class UsersRegisterPageComponent {}

@Component({
  standalone: true,
  imports: [UsersPageComponent],
  template: `<iso-users-page [forcedMode]="'create'" />`
})
export class UserCreatePageComponent {}

@Component({
  standalone: true,
  imports: [UsersPageComponent],
  template: `<iso-users-page [forcedMode]="'detail'" />`
})
export class UserDetailPageComponent {}

@Component({
  standalone: true,
  imports: [UsersPageComponent],
  template: `<iso-users-page [forcedMode]="'edit'" />`
})
export class UserEditPageComponent {}
