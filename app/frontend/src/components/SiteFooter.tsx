import { DolliLogoLink } from '@/components/DolliLogoLink';

export function SiteFooter() {
  return (
    <footer className="border-t border-white/5 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <DolliLogoLink variant="footer" />
        <p className="text-sm text-slate-500 text-center sm:text-left">
          © 2026 Dolli. Social-native micro-donations for everyone.
        </p>
      </div>
    </footer>
  );
}
