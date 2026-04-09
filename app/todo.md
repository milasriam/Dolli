# Dolli — Social-Native Micro-Donation Engine

## Design Guidelines

### Design References
- **GoFundMe**: Clean campaign cards, progress bars, social proof
- **Cash App**: Bold dark UI, simple one-tap actions
- **TikTok**: Vertical-first, vibrant gradients, engaging animations
- **Style**: Dark Mode + Vibrant Gradients + Social-Native

### Color Palette
- Background: #0A0A0F (Deep Dark)
- Surface: #13131A (Card Dark)
- Surface Hover: #1A1A25 (Card Hover)
- Primary: #8B5CF6 (Violet - main brand)
- Primary Light: #A78BFA
- Accent: #06D6A0 (Emerald Green - success/money)
- Accent Secondary: #F472B6 (Pink - hearts/love)
- Warning: #FBBF24 (Amber - urgency)
- Danger: #EF4444 (Red - critical)
- Text Primary: #FFFFFF
- Text Secondary: #94A3B8
- Text Muted: #64748B
- Border: #1E1E2E

### Typography
- Font: Inter (clean, modern, highly readable)
- H1: 48px bold
- H2: 32px semibold
- H3: 24px semibold
- Body: 16px regular
- Small: 14px regular
- Caption: 12px medium

### Key Component Styles
- Cards: Dark surface with subtle border, 16px rounded, hover lift effect
- Buttons: Gradient backgrounds (violet to purple), 12px rounded, bold text
- Progress bars: Gradient fill with glow effect, rounded
- Badges: Pill-shaped with emoji icons, gradient borders
- Share buttons: Platform-colored, icon + text

### Images (CDN URLs)
1. hero-banner-dolli.jpg - https://mgx-backend-cdn.metadl.com/generate/images/996472/2026-03-01/7ca7266f-afd2-4e00-8277-3b67d9410f95.png
2. campaign-community-garden.jpg - https://mgx-backend-cdn.metadl.com/generate/images/996472/2026-03-01/0b6c29d2-e271-492e-b03e-e5c8fdbc5a6e.png
3. campaign-clean-water.jpg - https://mgx-backend-cdn.metadl.com/generate/images/996472/2026-03-01/808f1321-a6a6-4fb0-967e-d6b60b826aaa.png
4. campaign-education.jpg - https://mgx-backend-cdn.metadl.com/generate/images/996472/2026-03-01/0c006672-94d1-4acc-9a8d-b4ba32101acc.png
5. campaign-food-bank.jpg - https://mgx-backend-cdn.metadl.com/generate/images/996472/2026-03-01/7d275d0d-25d2-4d9c-bdb9-89a2921215b0.png
6. campaign-animal-rescue.jpg - https://mgx-backend-cdn.metadl.com/generate/images/996472/2026-03-01/fc04c220-992f-499e-935f-9aff885d3cd8.png

---

## Development Tasks & Files

### Files to Create/Modify:
1. `src/App.tsx` - Main router with all pages
2. `src/pages/Index.tsx` - Home page with hero + AI campaign feed
3. `src/pages/CampaignDetail.tsx` - Campaign detail + donate + share
4. `src/pages/DonationSuccess.tsx` - Post-donation celebration + share CTA
5. `src/pages/Profile.tsx` - User profile, badges, donation history, referral stats
6. `src/pages/AdminDashboard.tsx` - Admin analytics dashboard
7. `src/pages/CreateCampaign.tsx` - Campaign creation form
8. `src/pages/Explore.tsx` - Browse/filter all campaigns
9. `src/components/Header.tsx` - Navigation header
10. `src/lib/api.ts` - API client (already exists)
11. `index.html` - Update title

### Database Tables:
- campaigns (public, create_only=false)
- donations (user-scoped, create_only=true)
- referrals (user-scoped, create_only=true)
- user_profiles (user-scoped, create_only=true)
- badges (public, create_only=false)

### Backend Routes:
- /api/v1/payment/create_payment_session - Stripe checkout
- /api/v1/payment/verify_payment - Verify payment
- /api/v1/analytics/campaign-stats - Overall stats
- /api/v1/analytics/referral-funnel - Referral funnel
- /api/v1/analytics/platform-metrics - Platform breakdown
- /api/v1/analytics/create-referral - Create referral token
- /api/v1/analytics/track-click - Track referral click