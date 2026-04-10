import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/lib/auth';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.localLogin(email.trim(), password);
      navigate('/profile');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const code = err?.code;
      if (code === 'ERR_NETWORK' || err?.message === 'Network Error') {
        setError(
          'Network error: browser could not reach the API (check CORS, HTTPS, or API URL). Open DevTools → Network for the failing request.',
        );
      } else {
        setError(
          typeof detail === 'string'
            ? detail
            : err?.message || 'Login failed',
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070710] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6">
        <h1 className="text-2xl font-bold mb-2">Sign In</h1>
        <p className="text-slate-400 mb-6">Enter your credentials to continue.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-violet-500"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-violet-500"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error ? <p className="text-red-400 text-sm">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 py-3 font-semibold disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
