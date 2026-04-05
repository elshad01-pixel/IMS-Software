import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

type ActionIcon = 'view' | 'edit' | 'archive' | 'delete';

@Component({
  selector: 'iso-icon-action-button',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <a
      *ngIf="routerLink; else actionButton"
      class="icon-action"
      [class.danger]="variant === 'danger'"
      [class.disabled]="disabled"
      [routerLink]="routerLink"
      [queryParams]="queryParams"
      [state]="state"
      [attr.aria-label]="label"
      [attr.title]="label"
      (click)="handleDisabledLink($event)"
    >
      <span class="sr-only">{{ label }}</span>
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <ng-container [ngSwitch]="icon">
          <path *ngSwitchCase="'view'" d="M10 4.5c4.2 0 7.46 3.08 8.7 5.5-1.24 2.42-4.5 5.5-8.7 5.5S2.54 12.42 1.3 10C2.54 7.58 5.8 4.5 10 4.5Zm0 2A3.5 3.5 0 1 0 10 13.5 3.5 3.5 0 0 0 10 6.5Zm0 1.8A1.7 1.7 0 1 1 10 11.7 1.7 1.7 0 0 1 10 8.3Z"/>
          <path *ngSwitchCase="'edit'" d="m14.9 2.9 2.2 2.2a1.5 1.5 0 0 1 0 2.12l-8.4 8.4-3.7.8.8-3.7 8.4-8.4a1.5 1.5 0 0 1 2.12 0ZM7 13l-.3 1.3L8 14l6.9-6.9-1-1L7 13Z"/>
          <path *ngSwitchCase="'archive'" d="M3 4.5h14l-1 2v8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 14.5v-8l-1-2Zm2.4 2v7.8h9.2V6.5H5.4Zm1.1-3h7l.3.6H6.1l.4-.6Zm1.5 4.3h4v1.4H8V7.8Z"/>
          <path *ngSwitchCase="'delete'" d="M7.4 3.5h5.2l.5 1.3H16v1.4h-1v8.1A1.7 1.7 0 0 1 13.3 16H6.7A1.7 1.7 0 0 1 5 14.3V6.2H4V4.8h2.9l.5-1.3Zm-.9 2.7v8.1c0 .14.06.27.17.38s.24.17.38.17h6.6c.14 0 .27-.06.38-.17s.17-.24.17-.38V6.2H6.5Zm1.8 1.6h1.4v5.2H8.3V7.8Zm2 0h1.4v5.2h-1.4V7.8Z"/>
        </ng-container>
      </svg>
    </a>

    <ng-template #actionButton>
      <button
        type="button"
        class="icon-action"
        [class.danger]="variant === 'danger'"
        [disabled]="disabled"
        [attr.aria-label]="label"
        [attr.title]="label"
        (click)="pressed.emit()"
      >
        <span class="sr-only">{{ label }}</span>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <ng-container [ngSwitch]="icon">
            <path *ngSwitchCase="'view'" d="M10 4.5c4.2 0 7.46 3.08 8.7 5.5-1.24 2.42-4.5 5.5-8.7 5.5S2.54 12.42 1.3 10C2.54 7.58 5.8 4.5 10 4.5Zm0 2A3.5 3.5 0 1 0 10 13.5 3.5 3.5 0 0 0 10 6.5Zm0 1.8A1.7 1.7 0 1 1 10 11.7 1.7 1.7 0 0 1 10 8.3Z"/>
            <path *ngSwitchCase="'edit'" d="m14.9 2.9 2.2 2.2a1.5 1.5 0 0 1 0 2.12l-8.4 8.4-3.7.8.8-3.7 8.4-8.4a1.5 1.5 0 0 1 2.12 0ZM7 13l-.3 1.3L8 14l6.9-6.9-1-1L7 13Z"/>
            <path *ngSwitchCase="'archive'" d="M3 4.5h14l-1 2v8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 14.5v-8l-1-2Zm2.4 2v7.8h9.2V6.5H5.4Zm1.1-3h7l.3.6H6.1l.4-.6Zm1.5 4.3h4v1.4H8V7.8Z"/>
            <path *ngSwitchCase="'delete'" d="M7.4 3.5h5.2l.5 1.3H16v1.4h-1v8.1A1.7 1.7 0 0 1 13.3 16H6.7A1.7 1.7 0 0 1 5 14.3V6.2H4V4.8h2.9l.5-1.3Zm-.9 2.7v8.1c0 .14.06.27.17.38s.24.17.38.17h6.6c.14 0 .27-.06.38-.17s.17-.24.17-.38V6.2H6.5Zm1.8 1.6h1.4v5.2H8.3V7.8Zm2 0h1.4v5.2h-1.4V7.8Z"/>
          </ng-container>
        </svg>
      </button>
    </ng-template>
  `,
  styles: [`
    .icon-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.4rem;
      height: 2.4rem;
      border-radius: 999px;
      border: 1px solid rgba(23, 50, 37, 0.08);
      background: rgba(244, 247, 242, 0.92);
      color: var(--text-soft);
      box-shadow: none;
      text-decoration: none;
      padding: 0;
      cursor: pointer;
      transition: background-color 140ms ease, border-color 140ms ease, transform 140ms ease;
    }

    .icon-action:hover {
      background: rgba(255, 255, 255, 0.98);
      border-color: rgba(36, 79, 61, 0.14);
      transform: translateY(-1px);
    }

    .icon-action svg {
      width: 1rem;
      height: 1rem;
      fill: currentColor;
    }

    .icon-action.danger {
      background: rgba(195, 82, 55, 0.08);
      border-color: rgba(195, 82, 55, 0.12);
      color: #b24b2f;
    }

    .icon-action.danger:hover {
      background: rgba(195, 82, 55, 0.12);
      border-color: rgba(195, 82, 55, 0.18);
    }

    .icon-action.disabled,
    .icon-action:disabled {
      opacity: 0.48;
      cursor: not-allowed;
      pointer-events: none;
      transform: none;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `]
})
export class IconActionButtonComponent {
  @Input() icon: ActionIcon = 'view';
  @Input() label = '';
  @Input() disabled = false;
  @Input() variant: 'default' | 'danger' = 'default';
  @Input() routerLink: string | readonly unknown[] | null = null;
  @Input() queryParams: Record<string, unknown> | null = null;
  @Input() state: { [key: string]: any } | undefined;
  @Output() pressed = new EventEmitter<void>();

  protected handleDisabledLink(event: Event) {
    if (!this.disabled) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }
}
