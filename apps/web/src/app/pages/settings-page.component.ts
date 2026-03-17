import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { startWith, switchMap } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="page-grid">
      <div class="card split">
        <div>
          <span class="pill">Settings</span>
          <h2>Tenant configuration</h2>
        </div>
        <form class="inline-form" [formGroup]="form" (ngSubmit)="save()">
          <input formControlName="key" placeholder="companyName">
          <input formControlName="value" placeholder="Demo Tenant">
          <button type="submit">Save</button>
        </form>
      </div>

      <div class="card table-card">
        <table>
          <thead>
            <tr><th>Key</th><th>Value</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of settings() ?? []">
              <td>{{ item.key }}</td>
              <td>{{ item.value }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: [`
    .split,
    .table-card {
      padding: 1.2rem 1.3rem;
    }

    .inline-form {
      display: grid;
      grid-template-columns: 220px 1fr auto;
      gap: 0.75rem;
    }

    input, button {
      border-radius: 14px;
      padding: 0.8rem 0.9rem;
      border: 1px solid var(--panel-border);
    }

    button {
      background: var(--brand);
      color: white;
      border: 0;
      font-weight: 700;
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
export class SettingsPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly reloadTrigger = this.fb.control(0, { nonNullable: true });

  protected readonly form = this.fb.nonNullable.group({
    key: 'companyName',
    value: 'Demo Tenant'
  });

  protected readonly settings = toSignal(
    this.reloadTrigger.valueChanges.pipe(
      startWith(0),
      switchMap(() => this.api.get<Array<{ key: string; value: string }>>('settings'))
    )
  );

  save() {
    const { key, value } = this.form.getRawValue();
    this.api.put(`settings/${key}`, { value }).subscribe(() => {
      this.reloadTrigger.setValue(this.reloadTrigger.value + 1);
    });
  }
}
