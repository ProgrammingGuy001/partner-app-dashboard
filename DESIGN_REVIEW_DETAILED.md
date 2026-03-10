# React Native Expo App - UI/UX & Design Review
**Scope:** `/Users/ayena/Documents/partner-app-dashboard/expo-mobile/src`
**Date:** Comprehensive Analysis

---

## EXECUTIVE SUMMARY

The app demonstrates good structural organization with a design system foundation (theme tokens, responsive utilities), but suffers from **significant inconsistency in implementation**. There are three major patterns:
1. **Legacy inline styles** (screens using hardcoded values)
2. **Theme system** (screens using `useTheme()` and `BRAND_COLORS`)
3. **Tailwind/NativeWind** (UI components with className)

This mixed approach creates maintenance burden and inconsistent user experience.

---

## 1. CRITICAL ISSUES (High Severity)

### 1.1 Inconsistent Color System Usage

**Issue:** Screens inconsistently use hardcoded colors vs. theme system

#### Files using HARDCODED colors:
- **LoginScreen.tsx** (Line 51, 65, 96, 130, etc.)
  - `backgroundColor: BRAND_COLORS.background` ✓
  - BUT also: `color: "#fff"` (hardcoded white), `color: "#3a1a1a"` (hardcoded text)
  - Line 96: `color: "#fff"` should be `colors.foreground`
  - Line 172: `...BRAND_COLORS.shadowSm` (using static light theme shadows)

- **OTPScreen.js** (Multiple hardcoded hex colors)
  - Line 79: `backgroundColor: '#fbfaf8'` (hardcoded) instead of `colors.background`
  - Line 92: `color: '#3a1a1a'` hardcoded instead of `colors.text`
  - Line 95: `color: '#7c685f'` hardcoded instead of `colors.textSecondary`
  - Line 123: `borderColor: '#ddd8d2'` hardcoded
  - Line 125: `backgroundColor: '#f0e8e5'` hardcoded
  - Line 129: `color: '#3a1a1a'` hardcoded
  - **Dark mode will break** - colors don't adapt

- **RegisterScreen.js**
  - Line 55: `backgroundColor: '#fbfaf8'` hardcoded
  - Line 77: `color: '#fff'` hardcoded
  - Line 89: `backgroundColor: '#fbfaf8'` hardcoded
  - Line 153: `color: '#7c685f'` hardcoded
  - **Dark mode broken**

- **HistoryScreen.js**
  - Line 78: `backgroundColor: BRAND_COLORS.background` ✓ but uses legacy static colors
  - This is the only one properly using theme (though BRAND_COLORS is static light theme)

#### Files properly using theme system:
- **DashboardScreen.js** - Uses `useTheme()` and `colors.*`
- **JobDetailScreen.js** - Uses `useTheme()` and `colors.*`
- **AccountScreen.js** - Uses `useTheme()` and `colors.*`
- **ChecklistScreen.js** - Uses `useTheme()` and `colors.*`
- **SiteRequisiteScreen.js** - Mixes both (colors from theme + hardcoded "#fff")
- **VerificationScreen.js** - Uses `useTheme()` and `colors.*`

**Fix:** All screens must use `useTheme()` hook. Auth screens (Login, OTP, Register) need refactoring.

---

### 1.2 Font Weight Inconsistency (String vs Number)

**Issue:** Mixed font weight notation prevents token standardization

#### String font weights found:
- `fontWeight: "600"`, `fontWeight: "700"`, `fontWeight: "800"` (strings)
- `fontWeight: '500'`, `fontWeight: '700'`, `fontWeight: '800'` (strings)

#### Number font weights found:
- `fontWeight: 700` (number in some components)
- `fontWeight: 800` (number)

**Files affected:**
- **LoginScreen.tsx**: Lines 95, 129, 152, 178, 198, 222, 237 (all strings "800", "600", "700")
- **OTPScreen.js**: Lines 92, 97, 128, 155, 165 (all strings)
- **button.tsx**: Line 58 (font-medium via CVA)
- **text.tsx**: Lines 19-33 (CVA with string classes: 'font-semibold', 'font-extrabold')
- **AccountScreen.js**: Mix of strings throughout

**Problem:** 
- No single source of truth for font weights
- Can't create a design token system
- Dark mode font rendering inconsistency

**Fix:** Standardize to CSS class tokens via Tailwind: `font-medium` (500), `font-semibold` (600), `font-bold` (700), `font-extrabold` (800)

---

### 1.3 Border Radius Chaos

**Issue:** 18+ different border radius values with no system

```
borderRadius: 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 22, 24, 30, 32, 36, 40, 100
```

**Actual scale needed:**
- `sm: 6` (small controls)
- `md: 12` (most cards/inputs)  
- `lg: 20` (large cards)
- `xl: 24` (premium cards)
- `full: 999` (avatars)

**Files with excessive radius:**
- LoginScreen.tsx Line 74: `borderRadius: 30` (avatar)
- DashboardScreen.js Line 210: `borderRadius: 22` (for 44px button - should be `full`)
- All screens: Multiple `borderRadius: 16`, `borderRadius: 20`, `borderRadius: 24`

**Fix:** Create a radius system in constants:
```javascript
export const RADIUS = {
  sm: 6,
  md: 12,
  lg: 20,
  xl: 24,
  full: 999,
};
```

---

### 1.4 Font Size Inconsistency (Hardcoded vs CSS)

**Issue:** Font sizes hardcoded in inline styles, no design tokens

#### Hardcoded font sizes across app:
- `fontSize: 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 28, 32` (all hardcoded)

#### Only UI components use design tokens:
- **text.tsx** defines variants: h1 (4xl), h2 (3xl), h3 (2xl), h4 (xl), p (base), large (lg), small (sm), muted (sm)
- But these are not used by screens - screens use inline `fontSize: N`

**Example violations:**
- LoginScreen.tsx Line 94: `fontSize: 32` (should be h1 variant)
- LoginScreen.tsx Line 128: `fontSize: 28` (should be h2 variant)
- DashboardScreen.js Line 182: `fontSize: 13` (should be `text-muted`)
- DashboardScreen.js Line 193: `fontSize: 22` (should be h3 variant)

**Fix:** Screens must use `<Text variant="h1" />` instead of `fontSize: 32`

---

## 2. MAJOR ISSUES (Medium-High Severity)

### 2.1 Dark Mode Completely Broken in Auth Screens

**Files:** LoginScreen.tsx, OTPScreen.js, RegisterScreen.js

These screens use `BRAND_COLORS` (which is static light theme defined in constants.js line 131):
```javascript
export const BRAND_COLORS = getThemedColors(false); // ALWAYS light!
```

**Issues:**
- OTPScreen.js Line 79: `backgroundColor: '#fbfaf8'` will be light cream in dark mode (unreadable)
- OTPScreen.js Line 123: `borderColor: '#ddd8d2'` - light border, invisible on light background in dark mode
- LoginScreen.tsx Line 51: Uses `BRAND_COLORS.background` which is always light

**Fix:** Must import and use `useTheme()` hook:
```javascript
const { colors, isDark } = useTheme();
// Then use colors.background, colors.text, etc.
```

---

### 2.2 Tap Target Inconsistency

**Issue:** Button sizes vary wildly, some below 44x44pt minimum

#### Proper 44x44 buttons:
- DashboardScreen.js Line 208-209: `width: 44, height: 44` ✓
- SiteRequisiteScreen.js Line 60: `width: 40, height: 40` ✗ (too small by 4pt)
- HistoryScreen.js Line 112: `width: 40, height: 40` ✗ (too small)
- BucketScreen.js Line 45: `width: 40, height: 40` ✗ (too small)

#### Inconsistent input heights:
- Input.tsx: `h-10` (Tailwind = 40px) ✗ Should be 44+
- BucketScreen.js Line 113: `height: 44` ✓
- LoginScreen.tsx Line 171: `height: 60` (large, good)
- OTPScreen.js Line 115: `height: 60` (large, good)

**Missing min sizes:**
- No `minHeight: 44` safety net on any touchables
- No `minWidth: 44` on icon buttons

**Fix:** 
```javascript
const MINIMUM_TAP_TARGET = 44;
// Apply to all Pressable/TouchableOpacity
```

---

### 2.3 Inconsistent Shadow Implementation

**Issue:** Three different shadow approaches

#### Approach 1: Theme shadow tokens (correct)
- DashboardScreen.js Line 214: `...colors.shadowSm` ✓
- AccountScreen.js Line 100: `...colors.shadowSm` ✓
- Uses proper `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`

#### Approach 2: Inline shadow objects (inconsistent)
- Input.tsx Line 13: `shadow-sm` (Tailwind class)
- button.tsx Line 19: `shadow-sm shadow-black/5` (Tailwind)
- card.tsx Line 16: `shadow-sm shadow-black/5` (Tailwind)

#### Approach 3: Hardcoded shadows (legacy)
- LoginScreen.tsx Line 172: `...BRAND_COLORS.shadowSm` (uses light theme static shadows)

**Problem:** Mix of native RN shadows and Tailwind shadows = inconsistent rendering

**Example:** LoginScreen vs DashboardScreen
- LoginScreen uses `...BRAND_COLORS.shadowSm` (always light)
- DashboardScreen uses `...colors.shadowSm` (adaptive to theme)

**Fix:** Centralize to `colors.shadowSm/Md/Lg` only (remove Tailwind shadow classes)

---

### 2.4 Missing Empty States

**Files with empty state BUT no proper component:**
- HistoryScreen.js Line 272-288: Has EmptyState component ✓
- BucketScreen.js Line 74-86: Has empty state UI ✓
- SiteRequisiteScreen.js Line 149-154: Has empty state BUT just text + icon (inconsistent)
- ChecklistScreen.js Line 131-135: Just text, no icon or proper styling

**Missing empty states:**
- DashboardScreen.js: No empty state if jobs are empty
- JobDetailScreen.js Line 84-89: Shows "Job not found" but no proper empty state component
- AccountScreen.js: Assumes user always exists

**Fix:** Create consistent `EmptyState` component with icon, title, subtitle, action button

---

### 2.5 Loading State Inconsistency

**Issue:** Loading states implemented differently across app

#### Proper loading states:
- LoginScreen.tsx Line 231-241: Button with `loading` prop ✓
- HistoryScreen.js Line 75-84: Shows skeleton list ✓
- DashboardScreen.js Line 91-151: Shows skeleton shimmer ✓

#### Missing loading states:
- SiteRequisiteScreen.js: Has `loading` on button (Line 128) but no loading feedback while fetching BOM
- BucketScreen.js: No loading state for edit operation
- JobDetailScreen.js Line 25: Has `loading` state but only shows full-screen Loader, no streaming data

#### Inconsistent loading UI:
- DashboardScreen.js Line 98: `backgroundColor: isDark ? "#241c1a" : "#ede7e3"` (hardcoded skeleton colors)
- HistoryScreen.js uses proper `SkeletonList` component
- VerificationScreen.js uses `SkeletonBlock` component
- But Loader.js (Line 7) uses `"flex-1 bg-background"` (Tailwind)

**Fix:** 
1. Standardize skeleton placeholder colors: use `colors.surfaceAlt` not hardcoded
2. Show loading state during BOM fetch in SiteRequisiteScreen
3. All loaders use same component or consistent styling

---

### 2.6 Keyboard Handling Incomplete

**Issue:** KeyboardAvoidingView only on auth screens, missing elsewhere

#### Present:
- LoginScreen.tsx Line 52-54 ✓
- OTPScreen.js Line 80 ✓  
- RegisterScreen.js Line 56 ✓

#### Missing (forms with text input):
- BucketScreen.js: Edit form at Line 105-151 - NO KeyboardAvoidingView
- SubmitScreen.js: Input form at Line 153 - NO KeyboardAvoidingView
- SiteRequisiteScreen.js: Search form at Line 91-114 - NO KeyboardAvoidingView

**Problem:** User can't see form fields when keyboard opens

**Fix:** Wrap all form sections with `<KeyboardAvoidingView behavior="padding" />`

---

## 3. MODERATE ISSUES (Medium Severity)

### 3.1 Typography Inconsistency

**Label inconsistency:**
- Some use `<Label />` component (RegisterScreen.js Line 103) ✓
- Some use raw `<Text>` (OTPScreen.js Line 92)
- Some use inline styled Text (LoginScreen.tsx Line 149)

**Example:** Input labels
- RegisterScreen.js: `<Label>Phone Number</Label>` (proper)
- OTPScreen.js: `<Text style={{fontSize: 12, fontWeight: '800'...}}>{label}</Text>` (inline)

**Fix:** All inputs must use `<Label>` component consistently

---

### 3.2 Spacing/Gap Inconsistency

**Found 10+ different gap values:**
- `gap: 4, 5, 6, 7, 8, 10, 12, 16, 20, 24`

**Should be:**
- `xs: 4` (tiny gaps)
- `sm: 8` (small)
- `md: 12` (medium)
- `lg: 16` (large)
- `xl: 24` (extra large)

**Examples of bad spacing:**
- DashboardScreen.js Line 94: `gap: 12` then Line 202: `gap: 12` (inconsistent with Line 214 `gap: 12`)
- Multiple files use `marginBottom: 8, 12, 16, 20, 24, 32` (no system)

**Fix:** Replace all gaps with design tokens:
```javascript
const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};
```

---

### 3.3 Hardcoded Padding Issues

**Issue:** Padding hardcoded in inline styles, breaks responsiveness

#### Examples:
- DashboardScreen.js Line 157: `paddingHorizontal: px` (uses responsive hook, good)
- LoginScreen.tsx Line 121: `padding: 32` (hardcoded)
- OTPScreen.js Line 82: `paddingHorizontal: px` (good)
- BucketScreen.js Line 41: `paddingHorizontal: 20` (hardcoded)
- SubmitScreen.js Line 100: `paddingHorizontal: 20` (hardcoded)

**Fix:** Use `useResponsive()` hook and define padding tokens, not hardcoded values

---

### 3.4 Haptic Feedback Incomplete

**Present (good):**
- LoginScreen.tsx Line 31: `Haptics.impactAsync()`
- DashboardScreen.js Line 76, 83, 204: Multiple haptics ✓
- JobCard.js Line 25: `Haptics.selectionAsync()` ✓

**Missing:**
- OTPScreen.js: No haptic on successful OTP entry
- RegisterScreen.js: No haptic feedback on form submission
- BucketScreen.js: No haptic on item edit/delete
- AccountScreen.js: No haptic on logout/theme toggle
- ChecklistScreen.js: No haptic on checklist item toggle

**Fix:** Add `Haptics.selectionAsync()` to all interactive elements

---

### 3.5 No Disabled State Styling

**Issue:** Disabled buttons/inputs don't have clear visual feedback

#### Example - BucketScreen.js Line 63-68:
```javascript
disabled={!bucket.length}
...
opacity: bucket.length ? 1 : 0.5
```
This uses opacity but no color change - unclear if it's disabled

#### Button component - button.tsx Line 119:
```javascript
(disabled || loading) && 'opacity-50'
```
Only opacity, should also change color or add strikethrough

**Fix:** Disabled states need:
1. Opacity reduction (50%)
2. Color desaturation (e.g., `colors.textMuted`)
3. Cursor change (web only)

---

## 4. MINOR ISSUES (Low-Medium Severity)

### 4.1 Inconsistent Border Widths

**Found:**
- `borderWidth: 1` (most)
- `borderWidth: 1.5` (JobFilters.js Line 37)
- `borderWidth: 2` (OTPScreen.js Line 116)

**Should be:**
- `thin: 1`
- `medium: 1.5`
- `thick: 2`

---

### 4.2 Missing Accessibility Labels

**Files missing accessible labels:**
- DashboardScreen.js Line 203-237: Icon buttons have no label
- JobCard.js Line 32-35: Has accessibility props ✓ (good example)
- BucketScreen.js: Edit/Delete buttons missing accessibility labels
- AccountScreen.js Line 410-444: Support buttons missing accessibility role

**Fix:** Add `accessible`, `accessibilityRole`, `accessibilityLabel`, `accessibilityHint` to all interactive elements

---

### 4.3 Inline Style Sprawl

**Issue:** Too many inline styles make components unreadable

#### Example - LoginScreen.tsx Line 62-91:
```javascript
<View style={{
  height: 320,
  backgroundColor: BRAND_COLORS.primary,
  justifyContent: "center",
  alignItems: "center",
}}>
  <View style={{
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.15)",
    // ... more styles
  }}>
```

This should be in a `StyleSheet.create()` or extracted component

**Fix:** Create `styles.js` or use NativeWind classes

---

### 4.4 Navigation Inconsistency

**Back button handling:**
- HistoryScreen.js Line 109-124: Custom back button ✓
- BucketScreen.js Line 44-53: Custom back button ✓
- LoginScreen.tsx: No back button (correct - entry point)
- DashboardScreen.js: No back button (correct - tab root)
- JobDetailScreen.js: No back button (should have one at top)

**Fix:** JobDetailScreen needs consistent header with back button

---

### 4.5 Animation Patterns

**Proper animations found:**
- DashboardScreen.js Line 169-296: Uses `Animated.View` with `FadeInUp` from reanimated ✓
- ToastContext.js: Uses `Animated` for toast show/hide ✓

**Poor animations:**
- JobCard.js Line 37-39: Uses opacity scale in onPress - good but no animation timing
- OTPScreen.js Line 163: Uses `opacity: pressed ? 0.6 : 1` - no timing, instant

**Fix:** All interactions should have `Animated.timing()` with 200-300ms duration

---

## 5. INCONSISTENT PATTERNS BY COMPONENT TYPE

### 5.1 Cards

#### Good pattern (AccountScreen.js):
```javascript
backgroundColor: colors.surface,
borderRadius: 24,
borderWidth: 1,
borderColor: colors.border,
...colors.shadowMd,
```

#### Bad pattern (SiteRequisiteScreen.js Line 82-85):
```javascript
backgroundColor: colors.surface, 
borderRadius: 24, 
padding: 24, 
marginBottom: 24,
borderWidth: 1, 
borderColor: colors.border, 
...colors.shadowMd
```
(padding: 24 is hardcoded, should be spacing token)

---

### 5.2 Buttons

#### UI Component (button.tsx):
- Uses CVA (class variance authority)
- Supports variants: default, destructive, outline, secondary, ghost, link
- Has loading state ✓
- Has disabled state ✓

#### But screens don't always use it:
- LoginScreen.tsx Line 231: Uses `<Button>` ✓
- BucketScreen.js Line 83: Uses `<Button>` ✓
- But TouchableOpacity used for other buttons instead

---

## 6. DETAILED VIOLATIONS BY FILE

### LoginScreen.tsx - 18 ISSUES
**Line 96:** `color: "#fff"` → use `colors.foreground` or `"#fcfbf9"`
**Line 130:** `color: BRAND_COLORS.text` → use `colors.text` from useTheme()
**Line 172:** `...BRAND_COLORS.shadowSm` → use `...colors.shadowSm`
**Line 196-199:** Font styling hardcoded, should use variant="small"
**Line 237:** `color: "#fff"` hardcoded

### OTPScreen.js - 24 ISSUES  
**Line 79:** `backgroundColor: '#fbfaf8'` → colors.background
**Line 92:** `color: '#3a1a1a'` → colors.text
**Line 95:** `color: '#7c685f'` → colors.textSecondary
**Line 113-131:** Multiple hardcoded colors in TextInput styling
**Line 154-158:** Timer badge has hardcoded colors '#fef3c7', '#92400e'

### RegisterScreen.js - 20 ISSUES
**Line 55:** `backgroundColor: '#fbfaf8'` → colors.background
**Line 77:** `color: '#fff'` → colors.foreground
**Line 89:** `backgroundColor: '#fbfaf8'` → colors.background

---

## 7. DESIGN TOKENS TO CREATE

### Required system:

```javascript
// colors.js
export const COLORS = {
  primary: { light: '#5a3d35', dark: '#a8867e' },
  text: { light: '#1a0d0a', dark: '#f7f3f1' },
  // ... etc
};

// typography.js
export const TYPOGRAPHY = {
  h1: { fontSize: 32, fontWeight: '800', lineHeight: 40 },
  h2: { fontSize: 28, fontWeight: '800', lineHeight: 36 },
  h3: { fontSize: 24, fontWeight: '700', lineHeight: 32 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  label: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
  // ... etc
};

// spacing.js
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

// radius.js
export const RADIUS = {
  sm: 6,
  md: 12,
  lg: 20,
  xl: 24,
  full: 999,
};

// shadows.js - dynamic based on theme
export const getShadows = (isDark, colors) => ({
  sm: { 
    shadowColor: colors.shadowColor, 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: isDark ? 0.2 : 0.04, 
    shadowRadius: 2, 
    elevation: 2 
  },
  // ... md, lg
});
```

---

## 8. RECOMMENDATIONS (Priority Order)

### P0 - CRITICAL (Fix immediately)
1. ✅ **Dark mode** - Migrate LoginScreen, OTPScreen, RegisterScreen to use `useTheme()`
2. ✅ **Hardcoded colors** - Replace all hex color strings with theme tokens
3. ✅ **Font weights** - Standardize to CSS classes or numeric system

### P1 - HIGH (Fix in next sprint)
4. ✅ **Tap targets** - Ensure all interactive elements are 44x44pt minimum
5. ✅ **Border radius** - Create design token scale, replace hardcoded values
6. ✅ **Keyboard handling** - Add KeyboardAvoidingView to all form screens
7. ✅ **Shadow consistency** - Use theme shadows everywhere, remove Tailwind shadows

### P2 - MEDIUM (Fix before shipping)
8. ✅ **Typography** - All screens use Text variants, not inline fontSize
9. ✅ **Empty states** - Create consistent empty state component
10. ✅ **Loading states** - Standardize skeleton colors and styles
11. ✅ **Spacing** - Use spacing token system, remove hardcoded margins/padding

### P3 - LOW (Nice to have)
12. ✅ **Haptic feedback** - Complete coverage on all interactive elements
13. ✅ **Accessibility** - Add labels to all buttons and interactive elements
14. ✅ **Animations** - Add timing to all state changes

---

## 9. MIGRATION PATH

### Phase 1 (Week 1): Foundation
- Create `/theme/tokens.js` with COLORS, TYPOGRAPHY, SPACING, RADIUS
- Update useTheme() to return all tokens
- Create utility function for merged styles

### Phase 2 (Week 2): Auth screens
- Refactor LoginScreen, OTPScreen, RegisterScreen to use useTheme()
- Replace all hardcoded colors with theme colors
- Add KeyboardAvoidingView

### Phase 3 (Week 3): Consistency
- Audit all fontSize → use Text variants
- Audit all gap/margin/padding → use spacing tokens
- Audit all borderRadius → use RADIUS tokens
- Audit all shadows → use colors.shadow*

### Phase 4 (Week 4): Polish
- Add haptic feedback
- Add accessibility labels
- Refactor inline styles to StyleSheet or components

---

## APPENDIX A: Color Audit

### Hardcoded colors found (to be replaced):
- `#fbfaf8` (appears in 5 files) → colors.background
- `#3a1a1a` (appears in 4 files) → colors.text
- `#7c685f` (appears in 3 files) → colors.textSecondary
- `#fff`, `#ffffff` (appears 8+ files) → colors.foreground or color by context
- `#f0e8e5` (OTPScreen) → colors.surfaceAlt
- `#ddd8d2` (OTPScreen) → colors.border
- `#fef3c7` (OTPScreen) → colors.warning + '15'
- `#92400e` (OTPScreen) → colors.warning

---

## APPENDIX B: Typography Audit

### Current sizes found:
Small text: 11, 12, 13, 14, 15
Body text: 16
Large text: 17, 18, 20, 22, 24
Heading text: 28, 32

### Should map to:
- 11-12 → `caption` / `muted`
- 13-14 → `small`
- 15-16 → `body`
- 17-18 → `large`
- 20-22 → `h4`
- 24 → `h3`
- 28 → `h2`
- 32 → `h1`

