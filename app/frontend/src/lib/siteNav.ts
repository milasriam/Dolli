/**
 * Single source for marketing / footer IA — labels are i18n keys (`nav.*`).
 */
export const SITE_DISCOVER_LINKS = [
  { to: '/explore', labelKey: 'nav.explore' as const },
  { to: '/search/users', labelKey: 'nav.findPeople' as const },
  { to: '/friends', labelKey: 'nav.friends' as const },
  { to: '/create', labelKey: 'nav.createFundraiser' as const },
] as const;

export const SITE_ACCOUNT_LINKS_GUEST = [
  { to: '/login', labelKey: 'nav.signIn' as const },
  { to: '/register', labelKey: 'nav.createAccount' as const },
] as const;

export const SITE_ACCOUNT_LINKS_USER = [
  { to: '/profile', labelKey: 'nav.profile' as const },
  { to: '/notifications', labelKey: 'nav.notifications' as const },
] as const;
