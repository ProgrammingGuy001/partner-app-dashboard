// Centralized presentational scale — keep radii, spacing, and type consistent
// across every screen. Cards: rounded-2xl. Controls: rounded-xl. Pills: rounded-full.
export const themeClasses = {
  // Layout
  screen: 'flex-1 bg-background',
  screenPadded: 'flex-1 bg-background px-5',
  scrollContent: 'px-5 pb-10',
  // Content bottom inset that clears the floating tab bar
  tabScrollContent: 'px-5 pb-28',

  // Typography scale
  screenTitle: 'text-2xl font-extrabold text-foreground',
  screenSubtitle: 'mt-1 text-[13px] font-medium text-muted-foreground',
  eyebrow:
    'text-[13px] font-semibold text-muted-foreground uppercase',
  title: 'text-3xl font-bold text-foreground font-heading',
  subtitle: 'mt-1.5 text-sm text-muted-foreground',
  sectionTitle: 'text-base font-bold text-foreground font-heading',
  cardTitle: 'text-[15px] font-bold text-foreground',
  muted: 'text-sm text-muted-foreground',
  label: 'mb-1.5 text-xs font-medium text-muted-foreground',

  // Surfaces — single radius (rounded-2xl) for every card
  sectionCard: 'rounded-2xl border border-border bg-card shadow-card',
  cardPadded: 'rounded-2xl border border-border bg-card p-5 shadow-card',

  // Controls
  input:
    'h-12 rounded-xl border border-input bg-card px-3.5 text-foreground placeholder:text-muted-foreground',
  iconButton:
    'w-10 h-10 rounded-xl bg-surface items-center justify-center border border-border',

  // States
  emptyWrap:
    'items-center justify-center rounded-2xl border border-border bg-card p-8',
};
