export type CampaignCategoryDef = {
  value: string;
  label: string;
  emoji: string;
  gradient: string;
};

/** Canonical list for create flow, filters, and AI prompts. Backend stores category as a free-form string. */
export const CAMPAIGN_CATEGORIES: CampaignCategoryDef[] = [
  { value: 'environment', label: 'Environment', emoji: '🌱', gradient: 'from-emerald-500 to-green-600' },
  { value: 'health', label: 'Health', emoji: '❤️', gradient: 'from-rose-500 to-pink-600' },
  { value: 'education', label: 'Education', emoji: '📚', gradient: 'from-blue-500 to-indigo-600' },
  { value: 'food', label: 'Food & hunger', emoji: '🍲', gradient: 'from-amber-500 to-orange-600' },
  { value: 'animals', label: 'Animals', emoji: '🐾', gradient: 'from-purple-500 to-violet-600' },
  { value: 'community', label: 'Community', emoji: '🤝', gradient: 'from-teal-500 to-cyan-600' },
  { value: 'arts', label: 'Arts & culture', emoji: '🎭', gradient: 'from-fuchsia-500 to-pink-600' },
  { value: 'sports', label: 'Sports', emoji: '⚽', gradient: 'from-lime-500 to-green-500' },
  { value: 'disaster', label: 'Disaster relief', emoji: '🆘', gradient: 'from-red-600 to-orange-600' },
  { value: 'housing', label: 'Housing', emoji: '🏠', gradient: 'from-sky-500 to-blue-600' },
  { value: 'justice', label: 'Justice & rights', emoji: '⚖️', gradient: 'from-slate-600 to-slate-800' },
  { value: 'innovation', label: 'Tech & innovation', emoji: '💡', gradient: 'from-cyan-500 to-blue-500' },
  { value: 'children', label: 'Children & youth', emoji: '👧', gradient: 'from-pink-400 to-rose-500' },
  { value: 'memorial', label: 'Memorial', emoji: '🕯️', gradient: 'from-stone-500 to-neutral-600' },
  { value: 'faith', label: 'Faith communities', emoji: '🙏', gradient: 'from-violet-400 to-indigo-500' },
  { value: 'veterans', label: 'Veterans', emoji: '🎖️', gradient: 'from-amber-700 to-yellow-600' },
  { value: 'women', label: "Women's causes", emoji: '💜', gradient: 'from-purple-400 to-fuchsia-500' },
];

export const CAMPAIGN_CATEGORY_SLUGS = CAMPAIGN_CATEGORIES.map((c) => c.value).join(', ');

export const CAMPAIGN_CATEGORY_GRADIENTS: Record<string, string> = Object.fromEntries(
  CAMPAIGN_CATEGORIES.map((c) => [c.value, c.gradient])
);
