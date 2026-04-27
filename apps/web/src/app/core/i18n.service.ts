import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type AppLanguage = 'en' | 'az' | 'ru';

type LanguageOption = {
  code: AppLanguage;
  label: string;
};

const LANGUAGE_STORAGE_KEY = 'ims.language';
const SUPPORTED_LANGUAGES: readonly AppLanguage[] = ['en', 'az', 'ru'] as const;
const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'az', label: 'Azərbaycan dili' },
  { code: 'ru', label: 'Русский' }
] as const;

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly translate = inject(TranslateService);
  private readonly activeLanguage = signal<AppLanguage>('en');

  readonly language = computed(() => this.activeLanguage());
  readonly languageOptions = LANGUAGE_OPTIONS;

  constructor() {
    this.translate.addLangs([...SUPPORTED_LANGUAGES]);
    this.translate.setFallbackLang('en').subscribe();
    this.useLanguage(this.resolveInitialLanguage());
  }

  t(key: string, params?: Record<string, unknown>) {
    this.activeLanguage();
    return this.translate.instant(key, params) as string;
  }

  setLanguage(language: AppLanguage) {
    this.useLanguage(language);
  }

  private useLanguage(language: AppLanguage) {
    this.translate.use(language).subscribe(() => {
      this.activeLanguage.set(language);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
        document.documentElement.lang = language;
      }
    });
  }

  private resolveInitialLanguage(): AppLanguage {
    if (typeof window === 'undefined') {
      return 'en';
    }

    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    const browserLanguage = this.translate.getBrowserLang();
    return this.normalizeLanguage(stored) ?? this.normalizeLanguage(browserLanguage) ?? 'en';
  }

  private normalizeLanguage(value?: string | null): AppLanguage | null {
    if (!value) {
      return null;
    }

    const candidate = value.toLowerCase().split('-')[0] as AppLanguage;
    return SUPPORTED_LANGUAGES.includes(candidate) ? candidate : null;
  }
}
