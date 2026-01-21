# Changelog

## [1.7.0] - 2026-01-21

### Improved

- **智能防打扰优化**:
  - 优化了自动分类的触发逻辑。
  - 在同域名内跳转（如从 `github.com/user` 跳转到 `github.com/repo`）时，不再重复弹出"已分类"提示。
  - 仅在域名发生变更时才重新检测并提示，进一步减少对用户的打扰。

---

## [1.6.0] - 2026-01-21

### Improved

- **AI 分类逻辑优化**:
  - 引入 URL 信息作为分类的重要特征，大幅提高识别准确率。
  - 添加针对性的分类规则：
    - GitHub, GitLab, StackOverflow 等自动识别为 "技术开发"。
    - AI Studio, ChatGPT, Claude 等自动识别为 "AI工具"。
    - Bilibili, YouTube 等自动识别为 "影视娱乐"。
  - 解决了部分技术网站被误判为"其他"的问题。

---

## [1.5.0] - 2026-01-21

### Added

- **域名分类数据库**:
  - 新增可视化的域名分类库，替代原有的历史记录功能。
  - 显示已缓存的域名及其分类，按时间排序。
  - 每条记录支持**删除**和**重新识别**操作。
  - 一次识别，永久缓存：同域名页面自动命中缓存，无需重复调用AI。

- **智能自动分类检测**:
  - 自动分类计时器触发前，检查标签页是否已在标签组中。
  - 如已归类，显示绿色提示"该网站已归类为 XX，无需重复识别"，3秒后自动消失。
  - 避免打扰用户，大幅减少重复提示。

### Changed

- 数据格式升级：域名规则存储新增时间戳，兼容旧格式。
- 优化Token消耗：通过缓存机制最大限度节省API调用。
- 识别速度提升：缓存命中时即时返回结果，无需等待AI响应。

---

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
