import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import Index from './pages/Index';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import AuthError from './pages/AuthError';
import LogoutCallbackPage from './pages/LogoutCallbackPage';
import MagicLinkLogin from './pages/MagicLinkLogin';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import CampaignDetail from './pages/CampaignDetail';
import DonationSuccess from './pages/DonationSuccess';
import Explore from './pages/Explore';
import Profile from './pages/Profile';
import CreateCampaign from './pages/CreateCampaign';
import AdminDashboard from './pages/AdminDashboard';
import Notifications from './pages/Notifications';
import UserSearch from './pages/UserSearch';
import Friends from './pages/Friends';
import NotFound from './pages/NotFound';
import { PwaInstallBanner } from './components/PwaInstallBanner';

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <PwaInstallBanner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/auth/magic-login" element={<MagicLinkLogin />} />
              <Route path="/auth/forgot-password" element={<ForgotPassword />} />
              <Route path="/auth/reset-password" element={<ResetPassword />} />
              <Route path="/auth/error" element={<AuthError />} />
              <Route path="/logout-callback" element={<LogoutCallbackPage />} />
              <Route path="/campaign/:id/edit" element={<CreateCampaign />} />
              <Route path="/campaign/:id" element={<CampaignDetail />} />
              <Route path="/donation-success" element={<DonationSuccess />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/search/users" element={<UserSearch />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/create" element={<CreateCampaign />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
