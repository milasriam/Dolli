import { useTranslation } from 'react-i18next';
import { DolliLogoLink } from '@/components/DolliLogoLink';
import { LanguageMenu } from '@/components/LanguageMenu';
import { ThemeAppearanceMenu } from '@/components/ThemeAppearanceMenu';

/** Minimal top bar for auth flows — full Header would duplicate “Sign in” on /login. */
export function AuthChrome() {
  const { t } = useTranslation();
  return (
    <header className="shrink-0 border-b border-border bg-background/95 backdrop-blur-xl">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-violet-600 focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-background"
      >
        {t('a11y.skipToMain')}
      </a>
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <DolliLogoLink variant="header" />
        <div className="flex items-center gap-2">
          <LanguageMenu />
          <ThemeAppearanceMenu />
        </div>
      </div>
    </header>
  );
}
