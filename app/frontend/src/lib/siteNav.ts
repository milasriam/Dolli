/**
 * Single source for marketing / footer IA — keep in sync with Header “browse” routes.
 */
export const SITE_DISCOVER_LINKS = [
  { to: '/explore', label: 'Explore' },
  { to: '/search/users', label: 'Find people' },
  { to: '/friends', label: 'Friends' },
  { to: '/create', label: 'Create fundraiser' },
] as const;

export const SITE_ACCOUNT_LINKS_GUEST = [
  { to: '/login', label: 'Sign in' },
  { to: '/register', label: 'Create account' },
] as const;

export const SITE_ACCOUNT_LINKS_USER = [
  { to: '/profile', label: 'Profile' },
  { to: '/notifications', label: 'Notifications' },
] as const;
