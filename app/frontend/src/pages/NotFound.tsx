import { Link } from 'react-router-dom';
import { Heart, ArrowLeft, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/Header';
import { SiteFooter } from '@/components/SiteFooter';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-[#0A0A0F] text-white">
      <Header />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-20">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 shadow-2xl shadow-violet-500/30">
            <Heart className="h-10 w-10 fill-white text-white" />
          </div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-violet-400/90">404</p>
          <h1 className="mb-3 text-3xl font-black tracking-tight sm:text-4xl">Page not found</h1>
          <p className="mb-8 text-slate-400">
            This URL isn’t on Dolli yet. Head back home or browse live fundraisers.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link to="/">
              <Button className="w-full rounded-2xl border-0 bg-gradient-to-r from-violet-600 to-purple-600 px-8 py-6 font-bold text-white shadow-2xl shadow-violet-500/25 hover:from-violet-500 hover:to-purple-500 sm:w-auto">
                <ArrowLeft className="mr-2 h-5 w-5" />
                Home
              </Button>
            </Link>
            <Link to="/explore">
              <Button
                variant="outline"
                className="w-full rounded-2xl border-white/15 bg-transparent px-8 py-6 text-white hover:bg-white/5 sm:w-auto"
              >
                <Compass className="mr-2 h-5 w-5 opacity-80" />
                Explore
              </Button>
            </Link>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
