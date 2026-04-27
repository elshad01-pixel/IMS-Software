import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

type Breadcrumb = {
  label: string;
  link?: string;
};

@Component({
  selector: 'iso-page-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="card page-hero">
      <nav class="breadcrumbs" *ngIf="breadcrumbs.length">
        <ng-container *ngFor="let crumb of breadcrumbs; let last = last">
          <a *ngIf="crumb.link && !last" [routerLink]="crumb.link">{{ crumb.label }}</a>
          <span *ngIf="!crumb.link || last">{{ crumb.label }}</span>
          <span *ngIf="!last">/</span>
        </ng-container>
      </nav>

      <div class="page-hero__body">
        <div class="hero-copy">
          <span class="pill">{{ label }}</span>
          <h2>{{ title }}</h2>
          <p>{{ description }}</p>
          <small class="hero-supporting-line" *ngIf="supportingLine">{{ supportingLine }}</small>
        </div>

        <div class="page-hero__actions">
          <ng-content />
        </div>
      </div>
    </section>
  `,
  styles: [`
    .hero-copy {
      display: grid;
      gap: 0.15rem;
      max-width: 52rem;
    }

    .page-hero__body {
      display: flex;
      justify-content: space-between;
      align-items: start;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .page-hero__actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-inline-start: auto;
      max-width: 100%;
    }

    .hero-copy h2 {
      letter-spacing: -0.05em;
      font-weight: 800;
      color: var(--text);
    }

    .hero-copy p {
      max-width: 44rem;
      color: var(--muted);
    }

    .hero-supporting-line {
      margin-top: 0.7rem;
      padding-inline-start: 0.8rem;
      color: var(--muted-strong);
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      position: relative;
    }

    .hero-supporting-line::before {
      content: '';
      position: absolute;
      inset: 0 auto 0 0;
      width: 3px;
      border-radius: 999px;
      background: linear-gradient(180deg, var(--brand-strong), var(--accent));
    }

    @media (max-width: 960px) {
      .page-hero__actions {
        width: 100%;
        justify-content: flex-start;
        margin-inline-start: 0;
      }
    }
  `]
})
export class PageHeaderComponent {
  @Input() label = '';
  @Input() title = '';
  @Input() description = '';
  @Input() supportingLine = '';
  @Input() breadcrumbs: Breadcrumb[] = [];
}
