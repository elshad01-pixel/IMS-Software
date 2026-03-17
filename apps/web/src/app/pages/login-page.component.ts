import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthStore } from '../core/auth.store';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="login-wrap">
      <div class="hero">
        <span class="pill">Production Scaffold</span>
        <h1>Integrated ISO management with clean tenant boundaries.</h1>
        <p>Angular 21, NestJS 11, PostgreSQL, Prisma, Docker, Nginx, and MinIO.</p>
      </div>

      <form class="card login-card" [formGroup]="form" (ngSubmit)="submit()">
        <h2>Sign in</h2>
        <label>
          <span>Tenant slug</span>
          <input formControlName="tenantSlug" placeholder="demo-tenant">
        </label>
        <label>
          <span>Email</span>
          <input formControlName="email" placeholder="admin@demo.local">
        </label>
        <label>
          <span>Password</span>
          <input type="password" formControlName="password" placeholder="ChangeMe123!">
        </label>
        <button type="submit" [disabled]="form.invalid || loading()">Access Platform</button>
        <p class="hint">{{ error() || 'Seed credentials: demo-tenant / admin@demo.local / ChangeMe123!' }}</p>
      </form>
    </section>
  `,
  styles: [`
    .login-wrap {
      display: grid;
      grid-template-columns: 1.2fr 420px;
      gap: 2rem;
      min-height: 100vh;
      padding: 2rem;
      align-items: center;
    }

    .hero h1 {
      max-width: 10ch;
      font-size: clamp(3rem, 7vw, 5.5rem);
      line-height: 0.95;
      margin: 1rem 0;
    }

    .hero p {
      max-width: 38rem;
      font-size: 1.1rem;
      color: var(--muted);
    }

    .login-card {
      padding: 1.75rem;
      display: grid;
      gap: 1rem;
    }

    .login-card h2 {
      margin: 0;
    }

    label {
      display: grid;
      gap: 0.45rem;
    }

    input {
      border: 1px solid var(--panel-border);
      border-radius: 14px;
      padding: 0.9rem 1rem;
      background: rgba(255, 255, 255, 0.7);
    }

    button {
      border: 0;
      border-radius: 14px;
      padding: 0.95rem 1rem;
      background: linear-gradient(135deg, var(--brand), var(--brand-strong));
      color: white;
      font-weight: 700;
      cursor: pointer;
    }

    .hint {
      margin: 0;
      color: var(--muted);
      font-size: 0.92rem;
    }

    @media (max-width: 960px) {
      .login-wrap {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authStore = inject(AuthStore);

  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly form = this.fb.nonNullable.group({
    tenantSlug: ['demo-tenant', Validators.required],
    email: ['admin@demo.local', [Validators.required, Validators.email]],
    password: ['ChangeMe123!', [Validators.required, Validators.minLength(8)]]
  });

  submit() {
    if (this.form.invalid) {
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.authStore.login(this.form.getRawValue()).subscribe({
      next: () => this.loading.set(false),
      error: () => {
        this.loading.set(false);
        this.error.set('Login failed. Confirm the API is up and the database is seeded.');
      }
    });
  }
}
