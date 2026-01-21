# Changelog

## [1.4.0] - 2026-01-21

### Added

- **Automatic Classification Mode**:
  - New toggle switch to enable/disable automatic classification.
  - Customizable delay timer (10 seconds to 1 minute) before triggering auto-classification.
  - Non-intrusive in-page prompt appears after analysis, asking user to confirm or dismiss.
  - Background timer tracks page stay duration and triggers classification automatically.
- **Improved Error Handling**:
  - User-friendly error messages for restricted pages (Chrome internal pages, new tab, etc.).
  - Clear feedback when a page cannot be classified.

### Changed

- UI layout: moved auto-mode toggle switch to the left for better accessibility.
- Added delay slider with visual feedback showing current wait time.

---

## [1.3.0] - 2026-01-21

### Added

- **Smart Duplicate Prevention**:
  - Automatically detects if a page has already been classified.
  - Returns cached results instantly to save AI quota and time.
  - Displays a "Already classified" status in the popup.
- **Domain-based Auto-Grouping**:
  - Learns from your classifications: once a domain is classified (e.g., `bilibili.com` -> `Entertainment`), future pages from that domain are automatically grouped into the same category.
  - Skips AI analysis for known domains, significantly improving speed and consistency.

## [1.2.0] - 2026-01-21

### Changed

- **Color System Overhaul**:
  - Removed custom color selection for tags.
  - Implemented fixed color mapping that matches Chrome's native Tab Group colors.
  - Updated UI to use Google's standard color palette (darker/saturated) instead of pastel colors.
  - Ensured "Confirm and Enter" syncs existing tab groups to the new color scheme.
- **UI Improvements**:
  - Removed color dot indicators from tag selection cards for a cleaner look.
  - Simplified tag selection interface.
- **Bug Fixes**:
  - Fixed "message channel closed" error by correcting message type mismatch between Popup and Content Script.
  - Fixed async response handling in Content Script.
  - Cleaned up unused code in `background.js` (removed `hexToChromeColor` and legacy storage listeners).

## [1.1.0] - Previous Release

- Initial AI classification features.
- Tab group organization.
