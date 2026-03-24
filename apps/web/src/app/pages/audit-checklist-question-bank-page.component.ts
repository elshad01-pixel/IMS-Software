import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthStore } from '../core/auth.store';
import { PageHeaderComponent } from '../shared/page-header.component';

type AuditStandard = 'ISO 9001' | 'ISO 14001' | 'ISO 45001' | 'IMS';
type ClauseKey = '4' | '5' | '6' | '7' | '8' | '9' | '10';

type ChecklistQuestion = {
  id: string;
  standard: AuditStandard;
  clause: ClauseKey;
  subclause?: string | null;
  title: string;
  sortOrder: number;
  isActive: boolean;
  isTemplateDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

const STANDARDS: AuditStandard[] = ['ISO 9001', 'ISO 14001', 'ISO 45001', 'IMS'];
const CLAUSES: ClauseKey[] = ['4', '5', '6', '7', '8', '9', '10'];

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PageHeaderComponent],
  template: `
    <section class="page-grid">
      <iso-page-header
        [label]="'Audits'"
        [title]="'Checklist Question Bank'"
        [description]="'Manage clause-based audit questions for internal audit templates without touching live audit records.'"
        [breadcrumbs]="[
          { label: 'Audits', link: '/audits' },
          { label: 'Checklist Question Bank' }
        ]"
      >
        <a routerLink="/audits" class="button-link secondary">Back to audits</a>
      </iso-page-header>

      <div class="card list-card page-stack">
        <div class="section-head">
          <div>
            <span class="section-eyebrow">Question library</span>
            <h3>Clause-based question bank</h3>
            <p class="subtle">Choose a standard, manage the questions clause by clause, and new internal audits will use the active question bank automatically.</p>
          </div>
        </div>

        <p class="feedback" [class.is-empty]="!error() && !message()" [class.error]="!!error()" [class.success]="!!message() && !error()">{{ error() || message() }}</p>

        <div class="toolbar">
          <div class="toolbar-meta">
            <div>
              <p class="toolbar-title">Standards</p>
              <p class="toolbar-copy">Switch between standards, then manage the questions under each clause.</p>
            </div>
            <div class="toolbar-stats">
              <article class="toolbar-stat">
                <span>Active</span>
                <strong>{{ activeQuestionCount() }}</strong>
              </article>
              <article class="toolbar-stat">
                <span>Archived</span>
                <strong>{{ archivedQuestionCount() }}</strong>
              </article>
            </div>
          </div>

          <div class="standard-tabs">
            <button
              type="button"
              class="standard-tab"
              *ngFor="let standard of standards"
              [class.active]="selectedStandard() === standard"
              (click)="selectedStandard.set(standard)"
            >
              <span>{{ standard }}</span>
              <small>{{ countForStandard(standard) }} questions</small>
            </button>
          </div>
        </div>

        <div class="empty-state" *ngIf="loading()">
          <strong>Loading question bank</strong>
          <span>Refreshing clause questions and starter templates.</span>
        </div>

        <div class="page-stack" *ngIf="!loading()">
          <section class="card clause-card" *ngFor="let group of clauseGroups()">
            <div class="section-head">
              <div>
                <span class="section-eyebrow">Clause {{ group.clause }}</span>
                <h4>{{ clauseHeading(group.clause) }}</h4>
                <p class="subtle">{{ group.questions.length }} question{{ group.questions.length === 1 ? '' : 's' }} in {{ selectedStandard() }}</p>
              </div>
              <button
                *ngIf="canWrite()"
                type="button"
                class="button-link secondary"
                (click)="openCreate(group.clause)"
              >
                + Add Question
              </button>
            </div>

            <div class="empty-state top-space" *ngIf="!group.questions.length">
              <strong>No questions in this clause yet</strong>
              <span>Add the first practical audit question for Clause {{ group.clause }}.</span>
            </div>

            <div class="question-bank-list top-space" *ngIf="group.questions.length">
              <article
                class="question-bank-item"
                *ngFor="let question of group.questions; let index = index"
                [class.is-inactive]="!question.isActive"
              >
                <div class="question-bank-item__body">
                  <div class="question-bank-item__meta">
                    <span class="pill">{{ question.subclause || ('Clause ' + question.clause) }}</span>
                    <span class="status-badge neutral" *ngIf="!question.isActive">Archived</span>
                    <span class="status-badge success" *ngIf="question.isTemplateDefault">Starter</span>
                  </div>
                  <strong>{{ question.title }}</strong>
                  <small>Order {{ question.sortOrder }}</small>
                </div>

                <div class="question-bank-item__actions" *ngIf="canWrite()">
                  <button
                    type="button"
                    class="button-link tertiary icon-button"
                    [disabled]="index === 0"
                    (click)="moveQuestion(group.clause, index, -1)"
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    class="button-link tertiary icon-button"
                    [disabled]="index === group.questions.length - 1"
                    (click)="moveQuestion(group.clause, index, 1)"
                  >
                    Down
                  </button>
                  <button type="button" class="button-link tertiary icon-button" (click)="openEdit(question)">
                    Edit
                  </button>
                  <button
                    type="button"
                    class="button-link danger icon-button"
                    [disabled]="!question.isActive"
                    (click)="archiveQuestion(question)"
                  >
                    Archive
                  </button>
                </div>
              </article>
            </div>
          </section>
        </div>
      </div>
    </section>

    <div class="modal-backdrop" *ngIf="modalOpen()" (click)="closeModal()"></div>
    <section class="modal-card card" *ngIf="modalOpen()">
      <div class="section-head">
        <div>
          <span class="section-eyebrow">Question</span>
          <h3>{{ editingQuestionId() ? 'Edit checklist question' : 'Add checklist question' }}</h3>
          <p class="subtle">Keep the wording practical and audit-friendly. New questions will be available the next time an internal audit is created.</p>
        </div>
      </div>

      <form class="page-stack top-space" [formGroup]="questionForm" (ngSubmit)="saveQuestion()">
        <div class="form-grid-2">
          <label class="field">
            <span>Standard</span>
            <select formControlName="standard">
              <option *ngFor="let standard of standards" [value]="standard">{{ standard }}</option>
            </select>
          </label>

          <label class="field">
            <span>Clause</span>
            <select formControlName="clause">
              <option *ngFor="let clause of clauses" [value]="clause">Clause {{ clause }}</option>
            </select>
          </label>
        </div>

        <div class="form-grid-2">
          <label class="field">
            <span>Subclause</span>
            <input formControlName="subclause" placeholder="4.1">
          </label>

          <label class="field">
            <span>Sort order</span>
            <input type="number" min="1" formControlName="sortOrder" placeholder="1">
          </label>
        </div>

        <label class="field">
          <span>Question text</span>
          <textarea rows="4" formControlName="title" placeholder="Are process owners reviewing key business issues and interested-party requirements?"></textarea>
        </label>

        <div class="button-row">
          <button type="submit" [disabled]="questionForm.invalid || saving()">{{ saving() ? 'Saving...' : 'Save question' }}</button>
          <button type="button" class="secondary" (click)="closeModal()">Cancel</button>
        </div>
      </form>
    </section>
  `,
  styles: [`
    .clause-card {
      padding: 1.2rem 1.25rem;
      box-shadow: var(--shadow-soft);
    }

    .standard-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .standard-tab {
      min-width: 11rem;
      padding: 0.95rem 1rem;
      border-radius: var(--radius-md);
      border: 1px solid rgba(23, 50, 37, 0.08);
      background: rgba(255, 255, 255, 0.82);
      color: var(--text-soft);
      box-shadow: none;
      display: grid;
      justify-items: start;
      gap: 0.15rem;
    }

    .standard-tab span {
      font-weight: 800;
    }

    .standard-tab small {
      color: var(--muted);
    }

    .standard-tab.active {
      background: rgba(36, 79, 61, 0.1);
      border-color: rgba(36, 79, 61, 0.18);
    }

    .question-bank-list {
      display: grid;
      gap: 0.75rem;
    }

    .question-bank-item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 1rem;
      padding: 1rem;
      border-radius: var(--radius-md);
      border: 1px solid rgba(23, 50, 37, 0.08);
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(244, 246, 241, 0.9));
    }

    .question-bank-item.is-inactive {
      opacity: 0.72;
    }

    .question-bank-item__body {
      display: grid;
      gap: 0.35rem;
    }

    .question-bank-item__meta {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
    }

    .question-bank-item__body strong {
      font-size: 1rem;
      line-height: 1.45;
    }

    .question-bank-item__body small {
      color: var(--muted);
    }

    .question-bank-item__actions {
      display: flex;
      gap: 0.5rem;
      align-items: start;
      flex-wrap: wrap;
      justify-content: end;
    }

    .icon-button {
      min-width: 4.8rem;
      padding-inline: 0.9rem;
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(18, 29, 22, 0.4);
      z-index: 70;
    }

    .modal-card {
      position: fixed;
      top: 50%;
      left: 50%;
      width: min(44rem, calc(100vw - 2rem));
      transform: translate(-50%, -50%);
      z-index: 71;
      padding: 1.35rem;
      background: rgba(255, 255, 255, 0.98);
    }

    @media (max-width: 760px) {
      .question-bank-item {
        grid-template-columns: 1fr;
      }

      .question-bank-item__actions {
        justify-content: start;
      }
    }
  `]
})
export class AuditChecklistQuestionBankPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);

  protected readonly standards = STANDARDS;
  protected readonly clauses = CLAUSES;
  protected readonly selectedStandard = signal<AuditStandard>('ISO 9001');
  protected readonly questions = signal<ChecklistQuestion[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly modalOpen = signal(false);
  protected readonly editingQuestionId = signal<string | null>(null);

  protected readonly questionForm = this.fb.nonNullable.group({
    standard: ['ISO 9001' as AuditStandard, Validators.required],
    clause: ['4' as ClauseKey, Validators.required],
    subclause: [''],
    title: ['', [Validators.required, Validators.maxLength(300)]],
    sortOrder: [1, [Validators.required, Validators.min(1)]]
  });

  protected readonly clauseGroups = computed(() =>
    CLAUSES.map((clause) => ({
      clause,
      questions: this.questionsForClause(clause)
    }))
  );

  ngOnInit() {
    this.loadQuestions();
  }

  protected canWrite() {
    return this.authStore.hasPermission('audits.write');
  }

  protected countForStandard(standard: AuditStandard) {
    return this.questions().filter((question) => question.standard === standard).length;
  }

  protected activeQuestionCount() {
    return this.questions()
      .filter((question) => question.standard === this.selectedStandard() && question.isActive)
      .length;
  }

  protected archivedQuestionCount() {
    return this.questions()
      .filter((question) => question.standard === this.selectedStandard() && !question.isActive)
      .length;
  }

  protected clauseHeading(clause: ClauseKey) {
    return {
      '4': 'Context of the organization',
      '5': 'Leadership',
      '6': 'Planning',
      '7': 'Support',
      '8': 'Operation',
      '9': 'Performance evaluation',
      '10': 'Improvement'
    }[clause];
  }

  protected openCreate(clause: ClauseKey) {
    const nextOrder = this.questionsForClause(clause).length + 1;
    this.editingQuestionId.set(null);
    this.questionForm.reset({
      standard: this.selectedStandard(),
      clause,
      subclause: '',
      title: '',
      sortOrder: nextOrder
    });
    this.modalOpen.set(true);
    this.error.set('');
    this.message.set('');
  }

  protected openEdit(question: ChecklistQuestion) {
    this.editingQuestionId.set(question.id);
    this.questionForm.reset({
      standard: question.standard,
      clause: question.clause,
      subclause: question.subclause ?? '',
      title: question.title,
      sortOrder: question.sortOrder
    });
    this.modalOpen.set(true);
    this.error.set('');
  }

  protected closeModal() {
    this.modalOpen.set(false);
    this.editingQuestionId.set(null);
  }

  protected saveQuestion() {
    if (!this.canWrite() || this.questionForm.invalid) {
      return;
    }

    const isEditing = !!this.editingQuestionId();
    const raw = this.questionForm.getRawValue();
    const payload = {
      standard: raw.standard,
      clause: raw.clause,
      subclause: raw.subclause.trim() || undefined,
      title: raw.title.trim(),
      sortOrder: Number(raw.sortOrder)
    };

    this.saving.set(true);
    this.error.set('');
    this.message.set('');

    const request = this.editingQuestionId()
      ? this.api.patch<ChecklistQuestion>(`audits/checklist-questions/${this.editingQuestionId()}`, payload)
      : this.api.post<ChecklistQuestion>('audits/checklist-questions', payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.editingQuestionId.set(null);
        this.message.set(isEditing ? 'Question updated.' : 'Question added.');
        this.loadQuestions();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Question save failed.'));
      }
    });
  }

  protected archiveQuestion(question: ChecklistQuestion) {
    if (!this.canWrite() || !question.isActive) {
      return;
    }

    if (!window.confirm('Archive this checklist question? It will no longer be used for new audits.')) {
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.api.patch(`audits/checklist-questions/${question.id}/archive`, {}).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('Question archived.');
        this.loadQuestions();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Question archive failed.'));
      }
    });
  }

  protected moveQuestion(clause: ClauseKey, currentIndex: number, direction: -1 | 1) {
    if (!this.canWrite()) {
      return;
    }

    const groupQuestions = this.questionsForClause(clause);
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= groupQuestions.length) {
      return;
    }

    const nextOrder = [...groupQuestions];
    const [moved] = nextOrder.splice(currentIndex, 1);
    nextOrder.splice(targetIndex, 0, moved);

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.api.patch<ChecklistQuestion[]>('audits/checklist-questions/reorder', {
      standard: this.selectedStandard(),
      clause,
      questionIds: nextOrder.map((question) => question.id)
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.set('Question order updated.');
        this.loadQuestions();
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(this.readError(error, 'Question reorder failed.'));
      }
    });
  }

  private loadQuestions() {
    this.loading.set(true);
    this.api.get<ChecklistQuestion[]>('audits/checklist-questions?includeInactive=true').subscribe({
      next: (questions) => {
        this.loading.set(false);
        this.questions.set(questions);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(this.readError(error, 'Question bank could not be loaded.'));
      }
    });
  }

  private questionsForClause(clause: ClauseKey) {
    return this.questions()
      .filter((question) => question.standard === this.selectedStandard() && question.clause === clause)
      .sort((left, right) => left.sortOrder - right.sortOrder);
  }

  private readError(error: HttpErrorResponse, fallback: string) {
    const message = error.error?.message;
    return Array.isArray(message) ? message.join(', ') : (message as string) || fallback;
  }
}
