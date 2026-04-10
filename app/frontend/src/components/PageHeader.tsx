import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type PageHeaderProps = {
  title: ReactNode;
  /** One line or short paragraph under the title. */
  description?: ReactNode;
  /** Right side of the title row (links, buttons). */
  actions?: ReactNode;
  /** Optional leading tile (icon) — e.g. Friends. */
  icon?: ReactNode;
  /** Content between description and the rest of the page (tabs, segmented controls). */
  children?: ReactNode;
  /** Extra block after description, before `children` (e.g. inline link). */
  auxiliary?: ReactNode;
  /** `lg` for primary listing pages (Explore). */
  size?: 'default' | 'lg';
  /** Align title row baseline — `end` pairs a large title with a trailing text link. */
  titleRowAlign?: 'start' | 'end';
  className?: string;
};

const defaultIconFrame =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/30';

export function PageHeaderIconFrame({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn(defaultIconFrame, className)}>{children}</div>;
}

/**
 * Shared page title pattern: consistent type scale, spacing, and title / actions row.
 */
export function PageHeader({
  title,
  description,
  actions,
  icon,
  children,
  auxiliary,
  size = 'default',
  titleRowAlign = 'start',
  className,
}: PageHeaderProps) {
  const titleClass =
    size === 'lg'
      ? 'text-3xl font-bold tracking-tight text-foreground sm:text-4xl'
      : 'text-2xl font-bold tracking-tight text-foreground sm:text-3xl';

  return (
    <header className={cn('mb-8', className)}>
      <div
        className={cn(
          'flex flex-wrap gap-x-4 gap-y-3',
          titleRowAlign === 'end' ? 'items-end justify-between' : 'items-start justify-between',
        )}
      >
        <div className={cn('flex min-w-0 flex-1 gap-3', icon ? 'items-start' : '')}>
          {icon ? <div className="shrink-0 pt-0.5">{icon}</div> : null}
          <div className="min-w-0 flex-1">
            <h1 className={titleClass}>{title}</h1>
            {description != null && description !== '' ? (
              <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</div>
            ) : null}
          </div>
        </div>
        {actions != null ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      {auxiliary != null ? <div className="mt-4">{auxiliary}</div> : null}
      {children != null ? <div className="mt-4">{children}</div> : null}
    </header>
  );
}
