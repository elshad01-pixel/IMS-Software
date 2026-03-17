import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  standalone: true,
  template: `
    <section class="card placeholder">
      <span class="pill">{{ title }}</span>
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
    </section>
  `,
  styles: [`
    .placeholder {
      padding: 1.5rem;
    }

    h2 {
      margin: 0.8rem 0 0.3rem;
    }

    p {
      margin: 0;
      color: var(--muted);
      max-width: 42rem;
    }
  `]
})
export class PlaceholderPageComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly title = this.route.snapshot.data['title'] as string;
  protected readonly description = this.route.snapshot.data['description'] as string;
}
