import { Link } from 'react-router-dom';
import markUrl from '@/assets/dolli-mark.svg?url';

type Props = {
  variant?: 'header' | 'footer';
};

export function DolliLogoLink({ variant = 'header' }: Props) {
  const isHeader = variant === 'header';
  return (
    <Link
      to="/"
      className={isHeader ? 'flex items-center gap-3 group' : 'flex items-center gap-2 group'}
      aria-label="Dolli home"
    >
      <img
        src={markUrl}
        alt=""
        width={isHeader ? 36 : 28}
        height={isHeader ? 36 : 28}
        className={
          isHeader
            ? 'h-9 w-9 shrink-0 drop-shadow-[0_0_14px_rgba(139,92,246,0.45)] group-hover:opacity-90 transition-opacity'
            : 'h-7 w-7 shrink-0 drop-shadow-[0_0_12px_rgba(139,92,246,0.4)] group-hover:opacity-90 transition-opacity'
        }
      />
      <span
        className={
          isHeader
            ? 'text-xl font-bold text-foreground tracking-tight'
            : 'font-bold text-foreground'
        }
      >
        Dolli
      </span>
    </Link>
  );
}
