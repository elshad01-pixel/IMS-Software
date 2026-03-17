import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { RecordWorkItemsComponent } from '../shared/record-work-items.component';

type CapaRow = {
  id: string;
  title: string;
  problemStatement: string;
  rootCause?: string;
  correctiveAction?: string;
  preventiveAction?: string;
  dueDate?: string;
  status: string;
};

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RecordWorkItemsComponent],
  template: `
    <section class="page-grid">
      <div class="card header">
        <div>
          <span class="pill">CAPA</span>
          <h2>Corrective and preventive action records</h2>
          <p>Track issue statements, root cause, action planning, due dates, and attached evidence.</p>
        </div>
      </div>

      <div class="workspace">
        <div class="card table-card">
          <div class="toolbar">
            <strong>{{ capas().length }} CAPAs</strong>
            <button type="button" class="ghost" (click)="resetForm()">New CAPA</button>
          </div>

          <table>
            <thead>
              <tr><th>Title</th><th>Status</th><th>Due date</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of capas()" (click)="select(item)" [class.selected]="item.id === selectedId()">
                <td>{{ item.title }}</td>
                <td>{{ item.status }}</td>
                <td>{{ item.dueDate ? (item.dueDate | date:'yyyy-MM-dd') : 'N/A' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="side">
          <form class="card form-card" [formGroup]="form" (ngSubmit)="save()">
            <div class="toolbar">
              <strong>{{ selectedId() ? 'Edit CAPA' : 'Create CAPA' }}</strong>
              <span class="message">{{ message() }}</span>
            </div>

            <label><span>Title</span><input formControlName="title"></label>
            <label><span>Problem statement</span><textarea rows="3" formControlName="problemStatement"></textarea></label>
            <label><span>Root cause</span><textarea rows="3" formControlName="rootCause"></textarea></label>
            <label><span>Corrective action</span><textarea rows="3" formControlName="correctiveAction"></textarea></label>
            <label><span>Preventive action</span><textarea rows="3" formControlName="preventiveAction"></textarea></label>
            <div class="inline">
              <label><span>Due date</span><input type="date" formControlName="dueDate"></label>
              <label>
                <span>Status</span>
                <select formControlName="status">
                  <option>OPEN</option>
                  <option>IN_PROGRESS</option>
                  <option>VERIFIED</option>
                  <option>CLOSED</option>
                </select>
              </label>
            </div>
            <button type="submit" [disabled]="form.invalid || saving()">
              {{ saving() ? 'Saving...' : (selectedId() ? 'Update CAPA' : 'Create CAPA') }}
            </button>
          </form>

          <iso-record-work-items [sourceType]="'capa'" [sourceId]="selectedId()" />
        </div>
      </div>
    </section>
  `,
  styles: [`
    .header,
    .table-card,
    .form-card { padding: 1.2rem 1.3rem; }
    .header h2 { margin: 0.8rem 0 0.3rem; }
    .header p, .message, label span { color: var(--muted); }
    .workspace { display: grid; grid-template-columns: 1.2fr 1fr; gap: 1rem; align-items: start; }
    .side { display: grid; gap: 1rem; }
    .toolbar { display: flex; justify-content: space-between; gap: 1rem; align-items: center; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { padding: 0.95rem 0.4rem; text-align: left; border-bottom: 1px solid rgba(0,0,0,0.08); }
    tbody tr { cursor: pointer; }
    tbody tr.selected { background: rgba(40, 89, 67, 0.08); }
    form { display: grid; gap: 0.9rem; }
    label { display: grid; gap: 0.45rem; }
    .inline { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    input, select, textarea, button { border-radius: 14px; border: 1px solid var(--panel-border); padding: 0.8rem 0.9rem; }
    button { border: 0; background: var(--brand); color: white; font-weight: 700; }
    .ghost { background: rgba(40, 89, 67, 0.1); color: var(--brand-strong); }
    @media (max-width: 1100px) { .workspace { grid-template-columns: 1fr; } }
  `]
})
export class CapaPageComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly capas = signal<CapaRow[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly message = signal('');

  protected readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    problemStatement: ['', Validators.required],
    rootCause: [''],
    correctiveAction: [''],
    preventiveAction: [''],
    dueDate: [''],
    status: ['OPEN', Validators.required]
  });

  constructor() {
    this.reload();
  }

  select(item: CapaRow) {
    this.selectedId.set(item.id);
    this.form.setValue({
      title: item.title,
      problemStatement: item.problemStatement,
      rootCause: item.rootCause || '',
      correctiveAction: item.correctiveAction || '',
      preventiveAction: item.preventiveAction || '',
      dueDate: item.dueDate ? item.dueDate.slice(0, 10) : '',
      status: item.status
    });
    this.message.set('');
  }

  resetForm() {
    this.selectedId.set(null);
    this.form.reset({
      title: '',
      problemStatement: '',
      rootCause: '',
      correctiveAction: '',
      preventiveAction: '',
      dueDate: '',
      status: 'OPEN'
    });
    this.message.set('');
  }

  save() {
    if (this.form.invalid) {
      return;
    }

    this.saving.set(true);
    const request = this.selectedId()
      ? this.api.patch(`capa/${this.selectedId()}`, this.form.getRawValue())
      : this.api.post<CapaRow>('capa', this.form.getRawValue());

    request.subscribe({
      next: (response: unknown) => {
        this.saving.set(false);
        this.message.set(this.selectedId() ? 'CAPA updated.' : 'CAPA created.');
        this.reload(() => {
          const created = response as CapaRow;
          if (!this.selectedId() && created?.id) {
            this.select(created);
          }
        });
      },
      error: () => {
        this.saving.set(false);
        this.message.set('Save failed.');
      }
    });
  }

  private reload(after?: () => void) {
    this.api.get<CapaRow[]>('capa').subscribe((items) => {
      this.capas.set(items);
      if (this.selectedId()) {
        const match = items.find((item) => item.id === this.selectedId());
        if (match) {
          this.select(match);
        }
      }
      after?.();
    });
  }
}
