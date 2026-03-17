import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith, switchMap } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../core/api.service';

type CapaRow = { id: string; title: string; problemStatement: string; status: string; dueDate?: string };

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="page-grid">
      <div class="card split">
        <div>
          <span class="pill">CAPA</span>
          <h2>Corrective and preventive actions</h2>
        </div>
        <form [formGroup]="form" (ngSubmit)="create()" class="inline-form">
          <input formControlName="title" placeholder="Nonconformance closure">
          <input formControlName="problemStatement" placeholder="Late calibration evidence">
          <input formControlName="dueDate" type="date">
          <button type="submit">Open CAPA</button>
        </form>
      </div>

      <div class="card table-card">
        <table>
          <thead>
            <tr><th>Title</th><th>Problem</th><th>Status</th><th>Due</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of capas() ?? []">
              <td>{{ item.title }}</td>
              <td>{{ item.problemStatement }}</td>
              <td>{{ item.status }}</td>
              <td>{{ item.dueDate ? (item.dueDate | date) : 'N/A' }}</td>
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
      grid-template-columns: 1fr 1.4fr 180px auto;
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
export class CapaPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly reloadTrigger = this.fb.control(0, { nonNullable: true });

  protected readonly form = this.fb.nonNullable.group({
    title: ['Nonconformance closure', Validators.required],
    problemStatement: ['Late calibration evidence', Validators.required],
    dueDate: ['']
  });

  protected readonly capas = toSignal(
    this.reloadTrigger.valueChanges.pipe(
      startWith(0),
      switchMap(() => this.api.get<CapaRow[]>('capa'))
    )
  );

  create() {
    if (this.form.invalid) {
      return;
    }

    this.api.post('capa', this.form.getRawValue()).subscribe(() => {
      this.form.patchValue({ title: '', problemStatement: '' });
      this.reloadTrigger.setValue(this.reloadTrigger.value + 1);
    });
  }
}
