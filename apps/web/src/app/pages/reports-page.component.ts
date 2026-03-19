import { CommonModule } from '@angular/common';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { PageHeaderComponent } from '../shared/page-header.component';

type ReportDefinition = {
  type: string;
  module: string;
  title: string;
  description: string;
  supportsDateRange?: boolean;
  supportsStatus?: boolean;
  supportsOwner?: boolean;
  statusOptions?: string[];
};

type UserOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type ReportFilterForm = FormGroup;

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PageHeaderComponent],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="'Reports'"
        [title]="'Report exports'"
        [description]="'Generate tenant-scoped exports for operational records, performance summaries, and compliance follow-up.'"
        [breadcrumbs]="[{ label: 'Reports' }]"
      />

      <section class="page-stack">
        <div class="card panel-card">
          <div class="section-head">
            <div>
              <span class="section-eyebrow">Exports</span>
              <h3>Available reports</h3>
              <p class="subtle">Each export is built from current tenant data and downloaded as CSV.</p>
            </div>
          </div>

          <p class="feedback top-space" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">
            {{ error() || message() }}
          </p>

          <div class="report-grid top-space">
            <article class="card report-card" *ngFor="let report of reports()">
              <div class="report-card__head">
                <div>
                  <span class="pill">{{ report.module }}</span>
                  <h4>{{ report.title }}</h4>
                  <p>{{ report.description }}</p>
                </div>
              </div>

              <form class="page-stack top-space" [formGroup]="formFor(report.type)">
                <div class="filter-grid" *ngIf="report.supportsDateRange || report.supportsStatus || report.supportsOwner">
                  <label class="field" *ngIf="report.supportsDateRange">
                    <span>Start date</span>
                    <input type="date" formControlName="startDate">
                  </label>

                  <label class="field" *ngIf="report.supportsDateRange">
                    <span>End date</span>
                    <input type="date" formControlName="endDate">
                  </label>

                  <label class="field" *ngIf="report.supportsStatus">
                    <span>Status</span>
                    <select formControlName="status">
                      <option value="">All statuses</option>
                      <option *ngFor="let status of report.statusOptions || []" [value]="status">{{ status }}</option>
                    </select>
                  </label>

                  <label class="field" *ngIf="report.supportsOwner">
                    <span>{{ ownerLabel(report.type) }}</span>
                    <select formControlName="ownerId">
                      <option value="">All</option>
                      <option *ngFor="let user of users()" [value]="user.id">{{ user.firstName }} {{ user.lastName }}</option>
                    </select>
                  </label>
                </div>

                <div class="button-row">
                  <button type="button" (click)="exportReport(report)" [disabled]="loadingReport() === report.type">
                    {{ loadingReport() === report.type ? 'Generating...' : 'Export CSV' }}
                  </button>
                </div>
              </form>
            </article>
          </div>
        </div>
      </section>
    </section>
  `,
  styles: [`
    .top-space {
      margin-top: 1rem;
    }

    .report-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }

    .report-card {
      padding: 1.2rem;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(244, 246, 241, 0.96));
    }

    .report-card__head h4 {
      margin: 0.9rem 0 0.35rem;
      font-size: 1.08rem;
      letter-spacing: -0.02em;
    }

    .report-card__head p {
      margin: 0;
      color: var(--muted);
      line-height: 1.5;
    }

    .filter-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.9rem;
    }

    @media (max-width: 1100px) {
      .report-grid,
      .filter-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class ReportsPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly reports = signal<ReportDefinition[]>([]);
  protected readonly users = signal<UserOption[]>([]);
  protected readonly loadingReport = signal<string | null>(null);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly forms = new Map<string, ReportFilterForm>();

  ngOnInit() {
    this.api.get<ReportDefinition[]>('reports').subscribe((reports) => {
      this.reports.set(reports);
      for (const report of reports) {
        if (!this.forms.has(report.type)) {
          this.forms.set(
            report.type,
            this.fb.nonNullable.group({
              startDate: [''],
              endDate: [''],
              status: [''],
              ownerId: ['']
            })
          );
        }
      }
    });

    this.api.get<UserOption[]>('users').subscribe((users) => this.users.set(users));
  }

  protected formFor(reportType: string) {
    return this.forms.get(reportType)!;
  }

  protected ownerLabel(reportType: string) {
    return reportType === 'training-assignments' ? 'Assignee' : 'Owner';
  }

  protected exportReport(report: ReportDefinition) {
    const form = this.formFor(report.type);
    const raw = form.getRawValue() as {
      startDate: string;
      endDate: string;
      status: string;
      ownerId: string;
    };
    const params = new URLSearchParams();
    params.set('format', 'csv');
    if (raw.startDate) params.set('startDate', raw.startDate);
    if (raw.endDate) params.set('endDate', raw.endDate);
    if (raw.status) params.set('status', raw.status);
    if (raw.ownerId) params.set('ownerId', raw.ownerId);

    this.loadingReport.set(report.type);
    this.message.set('');
    this.error.set('');

    this.api.getBlobResponse(`reports/export/${report.type}?${params.toString()}`).subscribe({
      next: (response) => {
        this.loadingReport.set(null);
        this.downloadResponse(response, `${report.type}.csv`);
        this.message.set(`${report.title} exported successfully.`);
      },
      error: (error: HttpErrorResponse) => {
        this.loadingReport.set(null);
        this.error.set(this.readError(error, 'Report export failed.'));
      }
    });
  }

  private downloadResponse(response: HttpResponse<Blob>, fallbackName: string) {
    const blob = response.body;
    if (!blob) return;

    const disposition = response.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="(.+?)"/i);
    const fileName = match?.[1] || fallbackName;
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}
