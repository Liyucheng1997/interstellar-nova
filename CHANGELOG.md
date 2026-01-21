# Changelog

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
