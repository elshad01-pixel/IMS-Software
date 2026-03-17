import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="card table-card">
      <span class="pill">Users</span>
      <h2>Tenant users and roles</h2>
      <table>
        <thead>
          <tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th></tr>
        </thead>
        <tbody>
          <tr *ngFor="let item of users() ?? []">
            <td>{{ item.firstName }} {{ item.lastName }}</td>
            <td>{{ item.email }}</td>
            <td>{{ item.role?.name || 'Unassigned' }}</td>
            <td>{{ item.isActive ? 'Yes' : 'No' }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  `,
  styles: [`
    .table-card {
      padding: 1.2rem 1.3rem;
    }

    h2 {
      margin: 0.7rem 0 1rem;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th, td {
      padding: 0.9rem 0.4rem;
      text-align: left;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }
  `]
})
export class UsersPageComponent {
  private readonly api = inject(ApiService);
  protected readonly users = toSignal(
    this.api.get<Array<{ firstName: string; lastName: string; email: string; isActive: boolean; role?: { name: string } }>>('users')
  );
}
