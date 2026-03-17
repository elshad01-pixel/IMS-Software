import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { startWith, switchMap } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../core/api.service';

type DocumentRow = { id: string; code: string; title: string; version: string; status: string };

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="page-grid">
      <div class="card split">
        <div>
          <span class="pill">Documents</span>
          <h2>Controlled documentation</h2>
        </div>
        <form [formGroup]="form" (ngSubmit)="create()" class="inline-form">
          <input formControlName="code" placeholder="DOC-001">
          <input formControlName="title" placeholder="Quality Manual">
          <input formControlName="version" placeholder="1.0">
          <input formControlName="status" placeholder="Approved">
          <button type="submit">Create</button>
        </form>
      </div>

      <div class="card table-card">
        <table>
          <thead>
            <tr><th>Code</th><th>Title</th><th>Version</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of documents() ?? []">
              <td>{{ item.code }}</td>
              <td>{{ item.title }}</td>
              <td>{{ item.version }}</td>
              <td>{{ item.status }}</td>
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

    .split {
      display: grid;
      gap: 1rem;
    }

    .inline-form {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
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
export class DocumentsPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly reloadTrigger = this.fb.control(0, { nonNullable: true });

  protected readonly form = this.fb.nonNullable.group({
    code: ['DOC-001', Validators.required],
    title: ['Quality Manual', Validators.required],
    version: ['1.0', Validators.required],
    status: ['Approved', Validators.required]
  });

  protected readonly documents = toSignal(
    this.reloadTrigger.valueChanges.pipe(
      startWith(0),
      switchMap(() => this.api.get<DocumentRow[]>('documents'))
    )
  );

  create() {
    if (this.form.invalid) {
      return;
    }

    this.api.post('documents', this.form.getRawValue()).subscribe(() => {
      this.form.patchValue({ code: '', title: '' });
      this.reloadTrigger.setValue(this.reloadTrigger.value + 1);
    });
  }
}
