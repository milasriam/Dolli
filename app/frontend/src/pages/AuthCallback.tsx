import { useEffect } from 'react';
import { authApi } from '../lib/auth';

export default function AuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const errorMessage = params.get('msg');

    if (errorMessage) {
      window.location.assign(`/auth/error?msg=${encodeURIComponent(errorMessage)}`);
      return;
    }

    if (!token) {
      window.location.assign('/auth/error?msg=Missing authentication token');
      return;
    }

    authApi.setStoredToken(token);
    window.location.assign('/profile');
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Processing authentication...</p>
      </div>
    </div>
  );
}
