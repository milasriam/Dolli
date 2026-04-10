import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
const triggerClass =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/30 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50';

export function LanguageMenu({ align = 'end' }: { align?: 'start' | 'end' }) {
  const { t, i18n } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={triggerClass} aria-label={t('language.choose')}>
          <Languages className="h-4 w-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="w-52 border-border bg-popover text-popover-foreground"
      >
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          {t('language.label')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuRadioGroup
          value={i18n.language.startsWith('ru') ? 'ru' : 'en'}
          onValueChange={(v) => void i18n.changeLanguage(v as 'en' | 'ru')}
        >
          <DropdownMenuRadioItem value="en" className="gap-2">
            {t('language.en')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="ru" className="gap-2">
            {t('language.ru')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
