import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heart, ArrowLeft, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import { SiteFooter } from '@/components/SiteFooter';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 flex-col items-center justify-center px-4 py-20 outline-none"
      >
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 shadow-2xl shadow-violet-500/30">
            <Heart className="h-10 w-10 fill-white text-white" />
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-violet-700 dark:text-violet-400/90">
            {t('notFound.badge')}
          </p>
          <h1 className="mb-3 text-3xl font-black tracking-tight sm:text-4xl">{t('notFound.title')}</h1>
          <p className="mb-8 text-muted-foreground">{t('notFound.description')}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link to="/">
              <Button className="w-full rounded-2xl border-0 bg-gradient-to-r from-violet-600 to-purple-600 px-8 py-6 font-bold text-white shadow-2xl shadow-violet-500/25 hover:from-violet-500 hover:to-purple-500 sm:w-auto">
                <ArrowLeft className="mr-2 h-5 w-5" />
                {t('notFound.home')}
              </Button>
            </Link>
            <Link to="/explore">
              <Button
                variant="outline"
                className="w-full rounded-2xl border-border bg-transparent px-8 py-6 text-foreground hover:bg-muted sm:w-auto"
              >
                <Compass className="mr-2 h-5 w-5 opacity-80" />
                {t('notFound.explore')}
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
