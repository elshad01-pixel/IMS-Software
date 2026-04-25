import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ContextApiService } from '../core/context-api.service';

type PublicSurveyRecord = {
  id: string;
  token: string;
  title: string;
  intro?: string | null;
  scaleMax: number;
  categoryLabels: string[];
  status: 'OPEN' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
  expiresAt?: string | null;
  completedAt?: string | null;
  partyName: string;
};

type SurveyQuestion = {
  key: string;
  label: string;
};

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="survey-shell">
      <section class="survey-card">
        <div class="survey-head">
          <span class="eyebrow">Customer survey</span>
          <h1>{{ survey()?.title || 'Customer feedback survey' }}</h1>
          <p>{{ survey()?.intro || 'Please rate the experience honestly so the team can see what is working well and what needs improvement.' }}</p>
          <small *ngIf="survey()?.partyName">For {{ survey()?.partyName }}</small>
        </div>

        <section class="survey-guide" *ngIf="!loading() && survey()?.status === 'OPEN' && !submitted()">
          <article class="guide-card">
            <strong>How scoring works</strong>
            <small>Use the full 0-10 scale so the result is meaningful in management review and dashboards.</small>
          </article>
          <article class="guide-card">
            <strong>0-6</strong>
            <small>Needs attention</small>
          </article>
          <article class="guide-card">
            <strong>7-8</strong>
            <small>Acceptable</small>
          </article>
          <article class="guide-card">
            <strong>9-10</strong>
            <small>Strong</small>
          </article>
        </section>

        <div class="empty-state" *ngIf="loading()">
          <strong>Loading survey</strong>
          <span>Preparing the questions and response form.</span>
        </div>

        <section class="status-panel success" *ngIf="submitted()">
          <strong>Thank you. Your feedback has been submitted.</strong>
          <span>Your response is now recorded in the IMS for review, trend tracking, and management review input.</span>
        </section>

        <section class="status-panel warning" *ngIf="!loading() && survey()?.status === 'COMPLETED' && !submitted()">
          <strong>This survey has already been completed.</strong>
          <span>The link cannot be used again.</span>
        </section>

        <section class="status-panel warning" *ngIf="!loading() && (survey()?.status === 'EXPIRED' || survey()?.status === 'CANCELLED')">
          <strong>This survey link is no longer active.</strong>
          <span>Please contact your IMS contact if a new survey should be issued.</span>
        </section>

        <p class="feedback" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

        <form
          *ngIf="!loading() && survey()?.status === 'OPEN' && !submitted()"
          class="page-stack"
          [formGroup]="form"
          (ngSubmit)="submit()"
        >
          <div class="form-grid-2">
            <label class="field"><span>Your name</span><input formControlName="respondentName" placeholder="Optional"></label>
            <label class="field"><span>Email</span><input formControlName="respondentEmail" placeholder="Optional"></label>
          </div>
          <div class="form-grid-2">
            <label class="field"><span>Company</span><input formControlName="respondentCompany" placeholder="Optional"></label>
            <label class="field"><span>Reference</span><input formControlName="respondentReference" placeholder="Order, project, site, or service reference"></label>
          </div>

          <section class="rating-grid">
            <article class="rating-card" *ngFor="let question of surveyQuestions()">
              <div class="rating-card__head">
                <strong>{{ question.label }}</strong>
                <small>{{ scoreMeaning(ratingControl(question.key).value) }}</small>
              </div>
              <label class="field compact-field">
                <span>Score</span>
                <select [formControl]="ratingControl(question.key)">
                  <option *ngFor="let option of scoreOptions()" [value]="option">{{ option }}</option>
                </select>
              </label>
            </article>
          </section>

          <div class="form-grid-2">
            <label class="field">
              <span>What worked well?</span>
              <textarea
                rows="4"
                formControlName="whatWorkedWell"
                placeholder="Optional positive feedback, strong points, or what should continue."
              ></textarea>
            </label>
            <label class="field">
              <span>What should improve first?</span>
              <textarea
                rows="4"
                formControlName="improvementPriority"
                placeholder="Tell us the most important improvement area."
              ></textarea>
            </label>
          </div>

          <label class="field">
            <span>Additional comments</span>
            <textarea
              rows="5"
              formControlName="comments"
              placeholder="Share any context that helps explain the scores."
            ></textarea>
          </label>

          <div class="button-row">
            <button type="submit" [disabled]="form.invalid || ratingsForm.invalid || saving()">{{ saving() ? 'Submitting...' : 'Submit feedback' }}</button>
          </div>
        </form>
      </section>
    </section>
  `,
  styles: [`
    .survey-shell {
      min-height: 100vh;
      padding: 2rem 1rem;
      background:
        radial-gradient(circle at top right, rgba(194, 173, 73, 0.18), transparent 26%),
        linear-gradient(180deg, #f4f6f1 0%, #edf2ea 100%);
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    .survey-card {
      width: min(980px, 100%);
      background: rgba(255, 255, 255, 0.97);
      border: 1px solid rgba(42, 63, 52, 0.08);
      border-radius: 1.5rem;
      padding: 1.5rem;
      box-shadow: 0 18px 40px rgba(42, 63, 52, 0.08);
      display: grid;
      gap: 1rem;
    }
    .survey-head {
      display: grid;
      gap: 0.45rem;
    }
    .survey-head h1 {
      margin: 0;
      font-size: clamp(2rem, 4vw, 2.6rem);
      line-height: 1.05;
    }
    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.14em;
      font-size: 0.76rem;
      font-weight: 700;
      color: var(--text-muted);
    }
    .survey-guide {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 0.75rem;
    }
    .guide-card {
      border: 1px solid var(--border-subtle);
      border-radius: 1rem;
      padding: 0.9rem 1rem;
      background: color-mix(in srgb, var(--surface-strong) 92%, white);
      display: grid;
      gap: 0.2rem;
    }
    .guide-card strong {
      font-size: 1rem;
    }
    .rating-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
    }
    .rating-card {
      border: 1px solid var(--border-subtle);
      border-radius: 1rem;
      padding: 1rem;
      background: color-mix(in srgb, var(--surface-strong) 88%, white);
      display: grid;
      gap: 0.65rem;
    }
    .rating-card__head {
      display: grid;
      gap: 0.2rem;
    }
    .status-panel {
      border-radius: 1rem;
      padding: 1rem 1.1rem;
      border: 1px solid rgba(42, 63, 52, 0.1);
    }
    .status-panel.success {
      background: rgba(47, 107, 69, 0.08);
      border-color: rgba(47, 107, 69, 0.16);
    }
    .status-panel.warning {
      background: rgba(179, 115, 42, 0.1);
      border-color: rgba(179, 115, 42, 0.18);
    }
    @media (max-width: 640px) {
      .survey-shell {
        padding: 1rem 0.75rem;
      }
      .survey-card {
        padding: 1rem;
      }
    }
  `]
})
export class PublicCustomerSurveyPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly contextApi = inject(ContextApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly submitted = signal(false);
  protected readonly survey = signal<PublicSurveyRecord | null>(null);
  protected readonly questions = signal<SurveyQuestion[]>([]);

  protected readonly form = this.fb.nonNullable.group({
    respondentName: [''],
    respondentEmail: ['', Validators.email],
    respondentCompany: [''],
    respondentReference: [''],
    whatWorkedWell: ['', [Validators.maxLength(2000)]],
    improvementPriority: ['', [Validators.maxLength(2000)]],
    comments: ['', [Validators.maxLength(4000)]]
  });

  protected readonly ratingsForm = new FormGroup({});

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const token = params.get('token');
      if (!token) {
        this.loading.set(false);
        this.error.set('Survey link is missing.');
        return;
      }
      this.load(token);
    });
  }

  protected surveyQuestions() {
    return this.questions();
  }

  protected scoreOptions() {
    const max = this.survey()?.scaleMax ?? 10;
    return Array.from({ length: max + 1 }, (_, index) => index);
  }

  protected ratingControl(key: string) {
    return this.ratingsForm.get(key) as FormControl<number>;
  }

  protected scoreMeaning(score: number | null | undefined) {
    if (score == null) {
      return 'Select a score';
    }
    if (score <= 6) {
      return 'Needs attention';
    }
    if (score <= 8) {
      return 'Acceptable';
    }
    return 'Strong';
  }

  protected submit() {
    if (this.form.invalid || this.ratingsForm.invalid || this.saving() || !this.survey()) {
      this.form.markAllAsTouched();
      this.ratingsForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.contextApi.submitPublicCustomerSurvey(this.survey()!.token, {
      ...this.form.getRawValue(),
      ratings: this.ratingsPayload()
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.submitted.set(true);
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Feedback could not be submitted.'));
      }
    });
  }

  private load(token: string) {
    this.loading.set(true);
    this.submitted.set(false);
    this.contextApi.getPublicCustomerSurvey(token).subscribe({
      next: (survey) => {
        this.loading.set(false);
        this.survey.set(survey);
        this.rebuildRatingControls(survey);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Survey could not be loaded.'));
      }
    });
  }

  private rebuildRatingControls(survey: PublicSurveyRecord) {
    Object.keys(this.ratingsForm.controls).forEach((key) => this.ratingsForm.removeControl(key));
    const questions = this.normalizeQuestions(survey.categoryLabels);
    const defaultScore = Math.min(survey.scaleMax, 8);
    questions.forEach((question) => {
      this.ratingsForm.addControl(
        question.key,
        new FormControl(defaultScore, { nonNullable: true, validators: [Validators.required] })
      );
    });
    this.questions.set(questions);
  }

  private normalizeQuestions(labels: string[]) {
    return (labels || []).map((label, index) => ({
      label,
      key: this.surveyLabelKey(label, index)
    }));
  }

  private ratingsPayload() {
    return this.questions().reduce<Record<string, number>>((result, question) => {
      result[question.key] = Number(this.ratingControl(question.key).value);
      return result;
    }, {});
  }

  private surveyLabelKey(label: string, index: number) {
    const slug = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || `question-${index + 1}`;
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}
