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
        <div>
          <span class="pill">{{ label }}</span>
          <h2>{{ title }}</h2>
          <p>{{ description }}</p>
        </div>

        <div class="page-hero__actions">
          <ng-content />
        </div>
      </div>
    </section>
  `
})
export class PageHeaderComponent {
  @Input() label = '';
  @Input() title = '';
  @Input() description = '';
  @Input() breadcrumbs: Breadcrumb[] = [];
}
