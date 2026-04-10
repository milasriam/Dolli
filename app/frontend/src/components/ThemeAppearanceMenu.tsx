import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme, type ThemePreference } from '@/contexts/ThemeContext';
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

export function ThemeAppearanceMenu({ align = 'end' }: { align?: 'start' | 'end' }) {
  const { t } = useTranslation();
  const { preference, setPreference } = useTheme();

  const Icon = preference === 'dark' ? Moon : preference === 'light' ? Sun : Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={triggerClass} aria-label={t('a11y.colorTheme')}>
          <Icon className="h-4 w-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="w-52 border-border bg-popover text-popover-foreground"
      >
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          {t('theme.appearance')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(v) => setPreference(v as ThemePreference)}
        >
          <DropdownMenuRadioItem value="system" className="gap-2">
            <Monitor className="h-4 w-4 opacity-70" aria-hidden />
            {t('theme.matchSystem')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light" className="gap-2">
            <Sun className="h-4 w-4 opacity-70" aria-hidden />
            {t('theme.light')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className="gap-2">
            <Moon className="h-4 w-4 opacity-70" aria-hidden />
            {t('theme.dark')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
