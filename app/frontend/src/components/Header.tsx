import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Heart, Menu, X, Plus, User, BarChart3, Compass, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Header() {
  const { user, login, logout, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0F]/90 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/25 group-hover:shadow-violet-500/40 transition-shadow">
              <Heart className="w-5 h-5 text-white fill-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">
              Dolli
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/"
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white rounded-lg hover:bg-white/5 transition-all"
            >
              Home
            </Link>
            <Link
              to="/explore"
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white rounded-lg hover:bg-white/5 transition-all flex items-center gap-1.5"
            >
              <Compass className="w-4 h-4" />
              Explore
            </Link>
            {user && (
              <>
                <Link
                  to="/create"
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white rounded-lg hover:bg-white/5 transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Create
                </Link>
                <Link
                  to="/profile"
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white rounded-lg hover:bg-white/5 transition-all flex items-center gap-1.5"
                >
                  <User className="w-4 h-4" />
                  Profile
                </Link>
                <Link
                  to="/admin"
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white rounded-lg hover:bg-white/5 transition-all flex items-center gap-1.5"
                >
                  <BarChart3 className="w-4 h-4" />
                  Analytics
                </Link>
              </>
            )}
          </nav>

          {/* Auth */}
          <div className="hidden md:flex items-center gap-3">
            {loading ? (
              <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <button
                  onClick={logout}
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Button
                onClick={login}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold px-5 py-2 rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-all border-0"
              >
                Sign In
              </Button>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden text-white p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[#0A0A0F] border-t border-white/5 px-4 py-4 space-y-2">
          <Link to="/" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-white rounded-lg hover:bg-white/5">Home</Link>
          <Link to="/explore" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-white rounded-lg hover:bg-white/5">Explore</Link>
          {user && (
            <>
              <Link to="/create" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-white rounded-lg hover:bg-white/5">Create Campaign</Link>
              <Link to="/profile" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-white rounded-lg hover:bg-white/5">Profile</Link>
              <Link to="/admin" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-white rounded-lg hover:bg-white/5">Analytics</Link>
              <button onClick={() => { logout(); setMobileOpen(false); }} className="block w-full text-left px-4 py-3 text-red-400 rounded-lg hover:bg-white/5">Sign Out</button>
            </>
          )}
          {!user && !loading && (
            <button onClick={() => { login(); setMobileOpen(false); }} className="block w-full text-left px-4 py-3 text-violet-400 font-semibold rounded-lg hover:bg-white/5">Sign In</button>
          )}
        </div>
      )}
    </header>
  );
}