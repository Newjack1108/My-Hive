# Icon Usage Report

## Overview
This report documents which icon and image files from `apps/web/public` are actually used in the codebase versus which are currently unused.

## Used Icons (3 files)

### 1. favicon.png
**Status:** ✅ **IN USE**

**References:**
- `apps/web/index.html` (line 5)
  ```html
  <link rel="icon" type="image/png" href="/favicon.png" />
  ```
  Used as the browser favicon.

---

### 2. icon.png
**Status:** ✅ **IN USE**

**References:**
- `apps/web/index.html` (line 6)
  ```html
  <link rel="apple-touch-icon" href="/icon.png" />
  ```
  Used as the Apple touch icon for iOS devices.

- `apps/web/vite.config.ts` (lines 35-37)
  ```typescript
  {
    src: '/icon.png',
    sizes: '192x192',
    type: 'image/png',
  },
  ```
  Used in the PWA manifest as the 192x192 icon.

---

### 3. adaptive-icon.png
**Status:** ✅ **IN USE**

**References:**
- `apps/web/vite.config.ts` (lines 40-42)
  ```typescript
  {
    src: '/adaptive-icon.png',
    sizes: '512x512',
    type: 'image/png',
  },
  ```
  Used in the PWA manifest as the 512x512 icon.

---

## Unused Icons (26 files)

The following icon files exist in `apps/web/public` but are **NOT** referenced anywhere in the codebase:

### Action Icons
- `add-apiary-icon.png` - Intended for adding new apiaries
- `add-hive-icon.png` - Intended for adding new hives
- `add-inspection-icon.png` - Intended for adding new inspections
- `delete-icon.png` - Intended for delete actions
- `edit-icon.png` - Intended for edit actions

### Feature Icons
- `ai-icon.png` - Possibly for AI features
- `apiary-icon.png` - Intended for apiary-related UI
- `bee-icon.png` - Possibly for general bee/hive branding
- `camera-icon.png` - Intended for photo capture functionality
- `hive-icon.png` - Intended for hive-related UI
- `inspection-icon.png` - Intended for inspection-related UI
- `map-icon.png` - Possibly for location/mapping features
- `nfc-icon.png` - Possibly for NFC tag scanning
- `profile-icon.png` - Intended for user profile
- `queen-icon.png` - Intended for queen-related inspection sections
- `resources-icon.png` - Possibly for resources section
- `weather-icon.png` - Possibly for weather information

### Logo/Branding
- `logo-horizontal.png` - Horizontal logo variant
- `logo-icon-only.png` - Icon-only logo variant
- `logo.png` - Main logo file

### UI Elements
- `header-background.png` - Possibly for header background image
- `splash.png` - Possibly for splash screen (PWA launch screen)

### Temperament Icons
- `temperament-angry-icon.png` - For aggressive temperament rating
- `temperament-happy-icon.png` - For calm temperament rating
- `temperament-neutral-icon.png` - For moderate temperament rating

---

## Summary Statistics

- **Total icon files:** 29
- **Used icons:** 3 (10.3%)
- **Unused icons:** 26 (89.7%)

## Recommendations

### Option 1: Keep for Future Use
If these icons are planned for upcoming features, keep them in the repository. Consider adding comments or documentation about their intended use.

### Option 2: Remove Unused Assets
If these icons are not planned for use, consider removing them to:
- Reduce repository size
- Avoid confusion about which assets are active
- Simplify maintenance

### Option 3: Implement Missing Features
Many of these icons suggest planned features that aren't yet implemented:
- Photo capture (camera-icon.png)
- Location/mapping (map-icon.png)
- NFC tag scanning (nfc-icon.png)
- Logo branding throughout the UI
- Icon-based action buttons (add, edit, delete)
- Temperament rating visualization
- Weather integration

## Search Methodology

The following search methods were used to verify icon usage:

1. **Pattern Matching:** Searched for icon filenames across all code files
2. **HTML/CSS:** Checked for references in HTML tags, CSS background-image properties, and inline styles
3. **JavaScript/TypeScript:** Searched for import statements, require calls, and string references
4. **Configuration Files:** Checked vite.config.ts, package.json, and other config files
5. **PWA Manifest:** Verified PWA manifest entries in vite.config.ts

## Files Searched

- All `.ts`, `.tsx`, `.js`, `.jsx` files in `apps/web/src`
- All `.css` files in `apps/web/src`
- `apps/web/index.html`
- `apps/web/vite.config.ts`
- `apps/web/package.json`
- Configuration and manifest files

---

**Report Generated:** Based on comprehensive codebase analysis
**Analysis Date:** Current session
