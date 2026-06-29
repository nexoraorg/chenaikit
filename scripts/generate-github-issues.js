#!/usr/bin/env node

/**
 * ChenAIKit GitHub Issues Generator
 * 
 * This script generates 50 detailed GitHub issues for contributors to work on.
 * It covers both frontend and backend tasks based on the current state of the repository.
 * 
 * Usage:
 *   node scripts/generate-github-issues.js
 * 
 * To create issues on GitHub:
 *   1. Install GitHub CLI: https://cli.github.com/
 *   2. Authenticate: gh auth login
 *   3. Run: node scripts/generate-github-issues.js --create
 */

const issues = [
  // FRONTEND ISSUES (25 issues)
  
  {
    title: "[Frontend] Implement User Authentication UI",
    labels: ["frontend", "authentication", "good first issue"],
    body: `## Overview
We need to implement a complete user authentication UI in the frontend application.

## Current State
- Backend authentication endpoints exist in \`backend/src/routes/auth.ts\`
- Frontend has placeholder components for auth but no complete implementation
- No login/signup forms are currently functional

## Requirements
1. **Login Page**
   - Email/password login form
   - Social login buttons (Google, GitHub)
   - Remember me functionality
   - Forgot password link
   - Form validation with error handling
   - Loading states during authentication

2. **Signup Page**
   - Registration form with email, password, confirm password
   - Password strength indicator
   - Terms of service checkbox
   - Email verification flow
   - Form validation

3. **Authentication State Management**
   - Use React Context or Redux for auth state
   - Store JWT tokens securely
   - Auto-refresh token logic
   - Protected route wrapper component

4. **UI Components**
   - Consistent with existing Material-UI design
   - Responsive design for mobile
   - Accessible (ARIA labels, keyboard navigation)
   - Error message display

## Technical Details
- Use existing backend API endpoints: \`/api/auth/login\`, \`/api/auth/register\`
- Store tokens in httpOnly cookies or localStorage (with security considerations)
- Implement token refresh logic
- Handle authentication errors gracefully

## Files to Modify/Create
- \`frontend/src/components/auth/LoginForm.tsx\` (create)
- \`frontend/src/components/auth/SignupForm.tsx\` (create)
- \`frontend/src/components/auth/AuthContext.tsx\` (create)
- \`frontend/src/components/auth/ProtectedRoute.tsx\` (create)
- \`frontend/src/pages/Login.tsx\` (create)
- \`frontend/src/pages/Signup.tsx\` (create)
- Update \`frontend/src/App.tsx\` to include auth routes

## Acceptance Criteria
- [ ] Users can successfully login with valid credentials
- [ ] Users can register new accounts
- [ ] Form validation works correctly
- [ ] Error messages are user-friendly
- [ ] Authentication state persists across page refreshes
- [ ] Protected routes redirect to login if not authenticated
- [ ] Mobile responsive design
- [ ] All forms are accessible

## References
- Backend auth routes: \`backend/src/routes/auth.ts\`
- Material-UI components: https://mui.com/
- Existing form components: \`frontend/src/components/FormField.tsx\``,
    priority: "high"
  },

  {
    title: "[Frontend] Add Real-time WebSocket Integration for Dashboard",
    labels: ["frontend", "websocket", "real-time"],
    body: `## Overview
Implement WebSocket integration to receive real-time updates for the analytics dashboard.

## Current State
- Backend has WebSocket support for transaction monitoring
- Frontend has \`WebSocketProvider.tsx\` but it's not fully integrated
- Dashboard components don't receive real-time updates

## Requirements
1. **WebSocket Connection Management**
   - Auto-reconnection logic with exponential backoff
   - Connection status indicator in UI
   - Graceful handling of connection failures
   - Connection health monitoring

2. **Real-time Data Updates**
   - Live transaction updates in AnalyticsDashboard
   - Real-time credit score changes
   - Live fraud detection alerts
   - Performance metrics updates

3. **Event Handling**
   - Subscribe to relevant WebSocket events
   - Update React state efficiently
   - Debounce rapid updates to prevent re-render issues
   - Handle event filtering based on user preferences

4. **UI Components**
   - Connection status badge (connected/disconnected/connecting)
   - Real-time notification toasts for important events
   - Live data indicators (flashing dots, pulsing icons)
   - Pause/resume real-time updates button

## Technical Details
- Use existing \`WebSocketProvider.tsx\` as base
- Integrate with backend WebSocket endpoints
- Use React hooks for state management
- Implement efficient re-render strategies (useMemo, useCallback)

## Files to Modify
- \`frontend/src/components/WebSocketProvider.tsx\` (enhance)
- \`frontend/src/components/AnalyticsDashboard.tsx\` (add real-time updates)
- \`frontend/src/components/CreditScoreDashboard.tsx\` (add real-time updates)
- \`frontend/src/components/PerformanceDashboard.tsx\` (add real-time updates)
- \`frontend/src/hooks/useWebSocket.ts\` (create if needed)

## Acceptance Criteria
- [ ] WebSocket connects automatically on app load
- [ ] Connection status is visible to users
- [ ] Dashboard updates in real-time when new data arrives
- [ ] Reconnection works automatically after disconnection
- [ ] Users can pause/resume real-time updates
- [ ] No performance degradation with frequent updates
- [ ] Error handling for connection failures

## References
- Existing WebSocket provider: \`frontend/src/components/WebSocketProvider.tsx\`
- Backend WebSocket endpoints: Check backend documentation
- React WebSocket patterns: https://www.npmjs.com/package/react-use-websocket`,
    priority: "high"
  },

  {
    title: "[Frontend] Implement Data Export Functionality",
    labels: ["frontend", "feature", "good first issue"],
    body: `## Overview
Add functionality to export dashboard data in various formats (CSV, JSON, PDF).

## Current State
- Dashboard components display data but have no export options
- No way for users to download reports or share data

## Requirements
1. **Export Formats**
   - CSV export for spreadsheet compatibility
   - JSON export for developers
   - PDF export for reports (with charts)
   - Excel export with formatting

2. **Export Features**
   - Export current dashboard view
   - Export custom date ranges
   - Export filtered data
   - Batch export multiple datasets
   - Scheduled exports (email reports)

3. **UI Components**
   - Export button in dashboard toolbar
   - Export format dropdown
   - Date range picker for custom exports
   - Export progress indicator
   - Export history/download list

4. **Data Preparation**
   - Format data appropriately for each export type
   - Include metadata (export date, filters applied)
   - Handle large datasets with pagination/progress
   - Generate charts for PDF exports

## Technical Details
- Use libraries like \`csv-writer\`, \`jspdf\`, \`xlsx\`
- Implement client-side generation to reduce server load
- Add loading states and progress indicators
- Handle memory constraints for large exports

## Files to Create/Modify
- \`frontend/src/utils/exportUtils.ts\` (create)
- \`frontend/src/components/ExportButton.tsx\` (create)
- \`frontend/src/components/ExportModal.tsx\` (create)
- \`frontend/src/components/AnalyticsDashboard.tsx\` (add export button)
- \`frontend/src/components/PerformanceDashboard.tsx\` (add export button)

## Acceptance Criteria
- [ ] CSV export works with proper formatting
- [ ] JSON export includes all relevant data
- [ ] PDF export includes charts and tables
- [ ] Excel export has proper formatting
- [ ] Export progress is shown to users
- [ ] Large exports don't block the UI
- [ ] Exported files are named appropriately
- [ ] Export functionality works across all dashboards

## References
- CSV library: https://www.npmjs.com/package/csv-writer
- PDF library: https://www.npmjs.com/package/jspdf
- Excel library: https://www.npmjs.com/package/xlsx`,
    priority: "medium"
  },

  {
    title: "[Frontend] Add Dark Mode Theme Support",
    labels: ["frontend", "ui/ux", "enhancement"],
    body: `## Overview
Implement dark mode theme support throughout the frontend application.

## Current State
- Application uses a fixed light theme
- No theme switching capability
- Some components may not support theming

## Requirements
1. **Theme System**
   - Implement Material-UI theme provider
   - Create light and dark theme configurations
   - Persist theme preference in localStorage
   - Smooth theme transitions

2. **Theme Toggle**
   - Add theme toggle button in header
   - Show current theme icon (sun/moon)
   - Keyboard shortcut (Ctrl/Cmd + D)
   - System preference detection (respect OS theme)

3. **Component Theming**
   - Ensure all components support both themes
   - Test contrast ratios for accessibility
   - Adjust chart colors for dark mode
   - Update icons and images for visibility

4. **Theme Customization**
   - Allow users to customize accent colors
   - Preset color themes
   - Custom theme creation (advanced)

## Technical Details
- Use Material-UI's \`ThemeProvider\`
- Create theme files in \`frontend/src/themes/\`
- Use CSS variables for custom components
- Implement theme context for global access

## Files to Create/Modify
- \`frontend/src/themes/lightTheme.ts\` (create)
- \`frontend/src/themes/darkTheme.ts\` (create)
- \`frontend/src/contexts/ThemeContext.tsx\` (create)
- \`frontend/src/components/ThemeToggle.tsx\` (create)
- \`frontend/src/App.tsx\` (add ThemeProvider)
- All component files (update for dark mode support)

## Acceptance Criteria
- [ ] Theme toggle works smoothly
- [ ] Theme preference persists across sessions
- [ ] All components look good in both themes
- [ ] Charts and visualizations adapt to theme
- [ ] Accessibility standards met (contrast ratios)
- [ ] Theme transition animations are smooth
- [ ] System theme preference is respected
- [ ] No visual bugs when switching themes

## References
- Material-UI theming: https://mui.com/material-ui/customization/theming/
- Dark mode best practices: https://mui.com/material-ui/customization/dark-mode/`,
    priority: "medium"
  },

  {
    title: "[Frontend] Implement Advanced Search and Filtering",
    labels: ["frontend", "feature", "search"],
    body: `## Overview
Add advanced search and filtering capabilities across all dashboard components.

## Current State
- Basic filtering exists in some components
- No global search functionality
- No saved search/filter presets

## Requirements
1. **Global Search**
   - Search bar in header
   - Search across transactions, accounts, scores
   - Search suggestions/autocomplete
   - Recent searches history

2. **Advanced Filters**
   - Multi-criteria filtering (date ranges, amounts, types)
   - Filter combinations with AND/OR logic
   - Custom filter builder UI
   - Quick filter presets

3. **Saved Filters**
   - Save frequently used filter combinations
   - Name and organize saved filters
   - Share filters with other users
   - Filter templates for common use cases

4. **Filter UI**
   - Collapsible filter panel
   - Visual representation of active filters
   - Filter count badges
   - Clear all filters button

## Technical Details
- Use React Query for cache management
- Implement debounced search to reduce API calls
- Use URL query params for shareable filter URLs
- Local storage for saved filters

## Files to Create/Modify
- \`frontend/src/components/SearchBar.tsx\` (create)
- \`frontend/src/components/FilterPanel.tsx\` (create)
- \`frontend/src/components/FilterBuilder.tsx\` (create)
- \`frontend/src/components/SavedFilters.tsx\` (create)
- \`frontend/src/hooks/useFilters.ts\` (create)
- \`frontend/src/hooks/useSearch.ts\` (create)
- Update dashboard components to use filters

## Acceptance Criteria
- [ ] Global search returns relevant results
- [ ] Advanced filters work correctly
- [ ] Saved filters can be created and loaded
- [ ] Filter combinations work as expected
- [ ] Search is performant with debouncing
- [ ] Filter state is reflected in URL
- [ ] Filter UI is intuitive and responsive
- [ ] Clear all filters works correctly

## References
- React Query: https://tanstack.com/query/latest
- Search UI patterns: https://www.patternfly.org/components/search`,
    priority: "medium"
  },

  {
    title: "[Frontend] Add Notification Center",
    labels: ["frontend", "feature", "notifications"],
    body: `## Overview
Implement a comprehensive notification center for alerts, updates, and system messages.

## Current State
- No centralized notification system
- Toast notifications exist but are limited
- No notification history or preferences

## Requirements
1. **Notification Types**
   - System alerts (errors, warnings)
   - Transaction alerts (high-value, suspicious)
   - Credit score updates
   - Fraud detection alerts
   - Account notifications (login, settings changes)
   - Feature announcements

2. **Notification Center UI**
   - Notification bell icon with unread count
   - Notification dropdown/panel
   - Mark as read/unread functionality
   - Notification categories/filters
   - Notification history

3. **Notification Preferences**
   - User-configurable notification settings
   - Per-type enable/disable
   - Email notification preferences
   - Quiet hours/do not disturb
   - Mobile push notification settings

4. **Real-time Updates**
   - WebSocket integration for real-time notifications
   - Sound alerts for urgent notifications
   - Browser push notifications (with permission)
   - In-app toast notifications

## Technical Details
- Use existing WebSocket infrastructure
- Implement notification queue system
- Store notification history in local storage
- Use browser Notification API for push notifications

## Files to Create/Modify
- \`frontend/src/components/NotificationCenter.tsx\` (create)
- \`frontend/src/components/NotificationItem.tsx\` (create)
- \`frontend/src/components/NotificationPreferences.tsx\` (create)
- \`frontend/src/contexts/NotificationContext.tsx\` (create)
- \`frontend/src/hooks/useNotifications.ts\` (create)
- \`frontend/src/utils/notificationUtils.ts\` (create)

## Acceptance Criteria
- [ ] Notifications appear in real-time
- [ ] Unread count is accurate
- [ ] Notifications can be marked as read
- [ ] Notification preferences work correctly
- [ ] Browser push notifications work (with permission)
- [ ] Notification history is maintained
- [ ] Quiet hours are respected
- [ ] Performance is good with many notifications

## References
- Browser Notification API: https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API
- React notification libraries: https://www.npmjs.com/package/react-hot-toast`,
    priority: "medium"
  },

  {
    title: "[Frontend] Implement User Profile and Settings Page",
    labels: ["frontend", "feature", "user-experience"],
    body: `## Overview
Create a comprehensive user profile and settings page for account management.

## Current State
- No user profile page exists
- Settings are not configurable in UI
- Account management is limited

## Requirements
1. **Profile Page**
   - User information display (name, email, avatar)
   - Profile editing capabilities
   - Avatar upload/change
   - Account statistics (transactions, scores, etc.)
   - Activity timeline

2. **Settings Sections**
   - Account settings (email, password, 2FA)
   - Notification preferences
   - Privacy settings
   - API key management
   - Connected accounts/wallets
   - Theme preferences
   - Language settings

3. **Security Features**
   - Password change form
   - Two-factor authentication setup
   - Active sessions management
   - Login history
   - Account deletion option

4. **UI Components**
   - Tabbed interface for different settings sections
   - Form validation for all settings
   - Confirmation dialogs for destructive actions
   - Success/error feedback

## Technical Details
- Integrate with backend user API endpoints
- Use existing form components
- Implement secure file upload for avatars
- Add proper error handling

## Files to Create/Modify
- \`frontend/src/pages/Profile.tsx\` (create)
- \`frontend/src/pages/Settings.tsx\` (create)
- \`frontend/src/components/profile/ProfileHeader.tsx\` (create)
- \`frontend/src/components/settings/AccountSettings.tsx\` (create)
- \`frontend/src/components/settings/NotificationSettings.tsx\` (create)
- \`frontend/src/components/settings/SecuritySettings.tsx\` (create)
- \`frontend/src/components/settings/ApiKeysSettings.tsx\` (create)
- Update routing in \`frontend/src/App.tsx\`

## Acceptance Criteria
- [ ] Profile information displays correctly
- [ ] Profile can be edited and saved
- [ ] Avatar upload works
- [ ] All settings sections are functional
- [ ] Form validation works correctly
- [ ] Security features (2FA, password change) work
- [ ] API keys can be managed
- [ ] Settings persist correctly

## References
- Backend user API: Check backend documentation
- Material-UI settings patterns: https://mui.com/material-ui/react-tabs/`,
    priority: "high"
  },

  {
    title: "[Frontend] Add Mobile Responsive Design Improvements",
    labels: ["frontend", "mobile", "ui/ux"],
    body: `## Overview
Improve mobile responsiveness across all frontend components and pages.

## Current State
- Some components have basic responsiveness
- Inconsistent mobile experience across pages
- Some features don't work well on mobile

## Requirements
1. **Layout Improvements**
   - Responsive grid layouts
   - Mobile navigation (hamburger menu, bottom nav)
   - Touch-friendly button sizes
   - Proper spacing and padding on mobile

2. **Component Adaptations**
   - Collapsible sidebars/panels
   - Horizontal scrolling for tables
   - Stacked layouts instead of side-by-side
   - Touch-optimized charts and graphs

3. **Mobile-Specific Features**
   - Pull-to-refresh functionality
   - Swipe gestures for navigation
   - Mobile-specific shortcuts
   - Optimized touch targets

4. **Performance**
   - Lazy loading for mobile
   - Optimized images for mobile
   - Reduced animations on mobile
   - Faster initial load on mobile networks

## Technical Details
- Use Material-UI's breakpoint system
- Implement responsive components
- Test on various screen sizes
- Use mobile-first CSS approaches

## Files to Modify
- All component files in \`frontend/src/components/\`
- \`frontend/src/App.tsx\` (layout)
- \`frontend/src/components/Dashboard.tsx\` (navigation)
- Create mobile-specific components if needed

## Acceptance Criteria
- [ ] All pages work on mobile (320px+)
- [ ] Navigation is mobile-friendly
- [ ] Tables scroll horizontally on mobile
- [ ] Charts are readable on mobile
- [ ] Touch targets are appropriately sized
- [ ] Performance is good on mobile
- [ ] No horizontal scrolling on body
- [ ] Tested on iOS and Android

## References
- Material-UI breakpoints: https://mui.com/material-ui/customization/breakpoints/
- Mobile-first design: https://www.smashingmagazine.com/2016/12/an-introduction-to-mobile-first-design/`,
    priority: "medium"
  },

  {
    title: "[Frontend] Implement Error Boundary and Error Handling",
    labels: ["frontend", "reliability", "error-handling"],
    body: `## Overview
Implement comprehensive error boundaries and error handling throughout the frontend.

## Current State
- Basic error handling exists
- No error boundaries for React components
- Limited error reporting to users

## Requirements
1. **Error Boundaries**
   - Root-level error boundary
   - Component-level error boundaries for critical sections
   - Graceful error UI with recovery options
   - Error logging and reporting

2. **Error Types**
   - Network errors (API failures)
   - Rendering errors (component crashes)
   - Validation errors (form submissions)
   - Authentication errors
   - WebSocket errors

3. **Error UI Components**
   - Friendly error messages
   - Retry buttons where appropriate
   - Error details (expandable for debugging)
   - Support contact information
   - Error code references

4. **Error Reporting**
   - Log errors to backend
   - Send error reports to monitoring service
   - Include user context (browser, OS, etc.)
   - Stack traces for debugging

## Technical Details
- Use React Error Boundary component
- Implement error logging service
- Add error context for global error handling
- Use existing error types from backend

## Files to Create/Modify
- \`frontend/src/components/ErrorBoundary.tsx\` (create)
- \`frontend/src/components/ErrorFallback.tsx\` (create)
- \`frontend/src/contexts/ErrorContext.tsx\` (create)
- \`frontend/src/utils/errorLogger.ts\` (create)
- \`frontend/src/App.tsx\` (add error boundary)
- Update components to handle errors gracefully

## Acceptance Criteria
- [ ] Error boundaries catch component errors
- [ ] Error UI is user-friendly
- [ ] Retry functionality works where appropriate
- [ ] Errors are logged to backend
- [ ] App doesn't crash on errors
- [ ] Error context is included in logs
- [ ] Users can recover from errors
- [ ] Development vs production error handling

## References
- React Error Boundaries: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
- Error monitoring: https://sentry.io/for/react/`,
    priority: "high"
  },

  {
    title: "[Frontend] Add Unit and Integration Tests",
    labels: ["frontend", "testing", "quality"],
    body: `## Overview
Add comprehensive unit and integration tests for frontend components.

## Current State
- Limited test coverage exists
- Some components have no tests
- No integration tests

## Requirements
1. **Unit Tests**
   - Test all utility functions
   - Test custom hooks
   - Test individual components
   - Test form validation logic
   - Test data transformation functions

2. **Integration Tests**
   - Test component interactions
   - Test routing
   - Test API integration
   - Test WebSocket integration
   - Test authentication flow

3. **Test Coverage**
   - Aim for 80%+ code coverage
   - Cover critical paths (auth, data fetching)
   - Cover error scenarios
   - Cover edge cases

4. **Testing Infrastructure**
   - Set up test environment
   - Mock external dependencies
   - Test data fixtures
   - CI/CD integration

## Technical Details
- Use Jest and React Testing Library
- Use MSW (Mock Service Worker) for API mocking
- Use existing test setup
- Follow testing best practices

## Files to Create/Modify
- Test files for all components in \`frontend/src/components/__tests__/\`
- Test files for hooks in \`frontend/src/hooks/__tests__/\`
- Test files for utils in \`frontend/src/utils/__tests__/\`
- \`frontend/src/setupTests.ts\` (enhance)
- \`frontend/jest.config.js\` (configure)

## Acceptance Criteria
- [ ] All components have unit tests
- [ ] All hooks have tests
- [ ] All utilities have tests
- [ ] Integration tests cover major flows
- [ ] Test coverage is 80%+
- [ ] Tests run reliably in CI
- [ ] Mocks are properly set up
- [ ] Tests are maintainable

## References
- React Testing Library: https://testing-library.com/react
- Jest: https://jestjs.io/
- MSW: https://mswjs.io/`,
    priority: "medium"
  },

  {
    title: "[Frontend] Implement Loading States and Skeleton Screens",
    labels: ["frontend", "ui/ux", "performance"],
    body: `## Overview
Add loading states and skeleton screens throughout the application for better UX.

## Current State
- Some loading states exist but are inconsistent
- No skeleton screens
- Loading indicators are basic

## Requirements
1. **Loading States**
   - Spinners for async operations
   - Progress bars for long-running operations
   - Loading overlays for full-page loads
   - Button loading states

2. **Skeleton Screens**
   - Skeleton loaders for data cards
   - Skeleton loaders for tables
   - Skeleton loaders for charts
   - Skeleton loaders for lists

3. **Loading Patterns**
   - Optimistic UI updates where appropriate
   - Progressive loading for large datasets
   - Lazy loading with placeholders
   - Loading state management

4. **Performance**
   - Skeleton screens should appear immediately
- Loading states should not block interactions
- Cancel loading on component unmount
- Debounce rapid loading states

## Technical Details
- Use Material-UI skeleton components
- Create custom skeleton components for complex layouts
- Implement loading context for global loading state
- Use React Suspense for code splitting

## Files to Create/Modify
- \`frontend/src/components/LoadingSpinner.tsx\` (create)
- \`frontend/src/components/SkeletonCard.tsx\` (create)
- \`frontend/src/components/SkeletonTable.tsx\` (create)
- \`frontend/src/components/SkeletonChart.tsx\` (create)
- \`frontend/src/contexts/LoadingContext.tsx\` (create)
- Update all data-fetching components to use loading states

## Acceptance Criteria
- [ ] Loading states appear immediately
- [ ] Skeleton screens match actual content layout
- [ ] Loading states are consistent across app
- [ ] Performance is not degraded
- [ ] Loading states can be cancelled
- [ ] Optimistic updates work where appropriate
- [ ] Progressive loading works for large datasets
- [ ] Skeleton screens are accessible

## References
- Material-UI Skeleton: https://mui.com/material-ui/react-skeleton/
- React Suspense: https://react.dev/reference/react/Suspense`,
    priority: "medium"
  },

  {
    title: "[Frontend] Add Accessibility Improvements",
    labels: ["frontend", "accessibility", "quality"],
    body: `## Overview
Improve accessibility throughout the frontend application to meet WCAG standards.

## Current State
- Basic accessibility exists
- Not fully WCAG compliant
- Missing ARIA labels and keyboard navigation

## Requirements
1. **Keyboard Navigation**
   - All interactive elements keyboard accessible
   - Logical tab order
   - Focus indicators visible
   - Keyboard shortcuts for common actions

2. **Screen Reader Support**
   - ARIA labels for all interactive elements
   - Semantic HTML elements
   - Alt text for images
   - Live regions for dynamic content

3. **Visual Accessibility**
   - Sufficient color contrast (4.5:1 for text)
   - Text resizable up to 200%
   - No reliance on color alone
   - Focus indicators visible

4. **Testing**
   - Automated accessibility testing
   - Screen reader testing
   - Keyboard-only navigation testing
   - Color contrast checking

## Technical Details
- Use axe-core for automated testing
- Follow WAI-ARIA authoring practices
- Use semantic HTML elements
- Implement focus management

## Files to Modify
- All component files in \`frontend/src/components/\`
- \`frontend/src/App.tsx\`
- Add accessibility tests
- Update CSS for focus indicators

## Acceptance Criteria
- [ ] All interactive elements keyboard accessible
- [ ] ARIA labels are present and correct
- [ ] Color contrast meets WCAG AA standards
- [ ] Screen reader announces changes correctly
- [ ] Focus order is logical
- [ ] Text can be resized to 200%
- [ ] Automated accessibility tests pass
- [ ] Manual testing with screen readers successful

## References
- WCAG Guidelines: https://www.w3.org/WAI/WCAG21/quickref/
- axe-core: https://www.deque.com/axe/
- WAI-ARIA: https://www.w3.org/WAI/ARIA/apg/`,
    priority: "medium"
  },

  {
    title: "[Frontend] Implement Performance Optimization",
    labels: ["frontend", "performance", "optimization"],
    body: `## Overview
Optimize frontend performance for faster load times and better user experience.

## Current State
- Basic performance is acceptable
- No performance monitoring
- Some components may be slow

## Requirements
1. **Code Splitting**
   - Route-based code splitting
   - Component lazy loading
   - Dynamic imports for heavy libraries
   - Prefetching for likely routes

2. **Bundle Optimization**
   - Analyze bundle size
   - Remove unused dependencies
   - Tree shaking
   - Minification

3. **Rendering Optimization**
   - React.memo for expensive components
   - useMemo/useCallback for expensive computations
   - Virtual scrolling for long lists
   - Debouncing/throttling

4. **Asset Optimization**
   - Image optimization and lazy loading
   - Font optimization
   - CSS optimization
   - CDN for static assets

## Technical Details
- Use React.lazy for code splitting
- Use webpack bundle analyzer
- Implement virtual scrolling (react-window)
- Add performance monitoring

## Files to Create/Modify
- \`frontend/src/App.tsx\` (add code splitting)
- Update heavy components with React.memo
- \`frontend/webpack.config.js\` (optimize)
- Add performance monitoring
- Update package.json with optimization scripts

## Acceptance Criteria
- [ ] Initial load time under 3 seconds
- [ ] Bundle size reduced by 30%
- [ ] Code splitting implemented
- [ ] Virtual scrolling for long lists
- [ ] Images are lazy loaded
- [ ] Performance monitoring in place
- [ ] Lighthouse score 90+
- [ ] No memory leaks

## References
- React Performance: https://react.dev/learn/render-and-commit
- Webpack Bundle Analyzer: https://www.npmjs.com/package/webpack-bundle-analyzer
- react-window: https://www.npmjs.com/package/react-window`,
    priority: "high"
  },

  {
    title: "[Frontend] Add Internationalization (i18n) for Missing Languages",
    labels: ["frontend", "i18n", "localization"],
    body: `## Overview
Complete internationalization support by adding translations for all supported languages.

## Current State
- i18n infrastructure exists (i18next)
- English, Spanish, Chinese, Arabic partially implemented
- Many strings are not translated
- Some components have hardcoded text

## Requirements
1. **Translation Coverage**
   - Translate all user-facing strings
   - Translate error messages
   - Translate validation messages
   - Translate dates, numbers, currencies

2. **Language Support**
   - Complete English translations
   - Complete Spanish translations
   - Complete Chinese translations
   - Complete Arabic translations
   - Add RTL support for Arabic

3. **Translation Management**
   - Extract all translatable strings
   - Organize translation files by namespace
   - Add translation context for ambiguous strings
   - Implement translation missing fallback

4. **Testing**
   - Test all languages in UI
   - Test RTL layout for Arabic
   - Test date/number formatting
   - Test language switching

## Technical Details
- Use existing i18next setup
- Use i18next-scanner to extract strings
- Organize translations by feature/namespace
- Implement proper pluralization

## Files to Modify
- \`frontend/src/locales/en.json\` (complete)
- \`frontend/src/locales/es.json\` (complete)
- \`frontend/src/locales/zh.json\` (complete)
- \`frontend/src/locales/ar.json\` (complete)
- All component files (use translation hooks)
- \`frontend/src/i18n/config.ts\` (enhance)

## Acceptance Criteria
- [ ] All strings are translatable
- [ ] All 4 languages have complete translations
- [ ] Arabic RTL layout works correctly
- [ ] Date/number formatting is locale-aware
- [ ] Language switching works smoothly
- [ ] No hardcoded strings in components
- [ ] Translation keys are organized
- [ ] Pluralization works correctly

## References
- i18next: https://www.i18next.com/
- i18next-scanner: https://github.com/i18next/i18next-scanner
- RTL best practices: https://rtlcss.com/`,
    priority: "medium"
  },

  {
    title: "[Frontend] Implement Chart Enhancements and Customizations",
    labels: ["frontend", "charts", "visualization"],
    body: `## Overview
Enhance existing chart components with more features and customizations.

## Current State
- Basic charts exist (PerformanceMetricsChart, ScoreHistoryChart, etc.)
- Limited interactivity
- No custom chart options
- Fixed styling

## Requirements
1. **Chart Interactivity**
   - Zoom and pan capabilities
   - Tooltips with detailed information
   - Click events on data points
   - Crosshair for precise readings
   - Legend toggling

2. **Customization Options**
   - Chart type switching (line, bar, area, etc.)
   - Color theme customization
   - Axis configuration
   - Data series toggling
   - Export chart as image

3. **Advanced Features**
   - Real-time data updates
   - Annotations and markers
   - Multiple chart types in one view
   - Comparative charts
   - Forecast/trend lines

4. **Performance**
   - Handle large datasets efficiently
   - Virtual rendering for many points
   - Lazy loading for chart data
   - Debounced updates

## Technical Details
- Use Recharts (already in dependencies)
- Implement chart wrapper components
- Add chart configuration context
- Optimize for performance

## Files to Modify
- \`frontend/src/components/PerformanceMetricsChart.tsx\` (enhance)
- \`frontend/src/components/ScoreHistoryChart.tsx\` (enhance)
- \`frontend/src/components/TransactionFlowChart.tsx\` (enhance)
- \`frontend/src/components/charts/\` (add new components)
- \`frontend/src/contexts/ChartContext.tsx\` (create)

## Acceptance Criteria
- [ ] Charts support zoom and pan
- [ ] Tooltips show detailed information
- [ ] Chart types can be switched
- [ ] Colors can be customized
- [ ] Charts can be exported as images
- [ ] Real-time updates work smoothly
- [ ] Large datasets don't cause lag
- [ ] Charts are accessible

## References
- Recharts: https://recharts.org/
- Chart customization patterns: https://www.chartjs.org/docs/latest/configuration/`,
    priority: "medium"
  },

  {
    title: "[Frontend] Add Form Validation Library Integration",
    labels: ["frontend", "forms", "validation"],
    body: `## Overview
Integrate a comprehensive form validation library for better form handling.

## Current State
- Basic form validation exists
- Manual validation logic in components
- No centralized validation rules
- Limited error handling

## Requirements
1. **Validation Library**
   - Integrate Formik or React Hook Form
   - Add Yup or Zod for schema validation
   - Create reusable validation schemas
   - Implement async validation

2. **Form Components**
   - Reusable form field components
   - Error message components
   - Form submission handling
   - Form reset functionality

3. **Validation Features**
   - Real-time validation
   - Field-level validation
   - Form-level validation
   - Conditional validation
   - Custom validation rules

4. **User Experience**
   - Clear error messages
   - Validation on blur/change
   - Disable submit until valid
   - Show validation progress

## Technical Details
- Choose between Formik or React Hook Form
- Use Yup or Zod for schemas
- Create form component library
- Integrate with existing form components

## Files to Create/Modify
- \`frontend/src/components/forms/FormField.tsx\` (enhance)
- \`frontend/src/components/forms/FormError.tsx\` (enhance)
- \`frontend/src/components/forms/FormSubmit.tsx\` (create)
- \`frontend/src/validation/schemas.ts\` (create)
- \`frontend/src/validation/rules.ts\` (create)
- Update all forms to use new library

## Acceptance Criteria
- [ ] Validation library integrated
- [ ] All forms use new validation
- [ ] Error messages are clear
- [ ] Real-time validation works
- [ ] Async validation works
- [ ] Forms are accessible
- [ ] Validation is performant
- [ ] Code is maintainable

## References
- React Hook Form: https://react-hook-form.com/
- Formik: https://formik.org/
- Yup: https://github.com/jquense/yup
- Zod: https://zod.dev/`,
    priority: "medium"
  },

  {
    title: "[Frontend] Implement File Upload Component",
    labels: ["frontend", "feature", "forms"],
    body: `## Overview
Create a reusable file upload component with drag-and-drop support.

## Current State
- No file upload functionality
- No way to upload documents, images, etc.
- Missing file management features

## Requirements
1. **Upload Features**
   - Drag and drop support
   - Click to browse files
   - Multiple file upload
   - File type restrictions
   - File size limits
   - Progress indicators

2. **File Preview**
   - Image preview for images
   - File type icons
   - File information display
   - Thumbnail generation

3. **File Management**
   - Remove files before upload
   - Reorder files
   - File validation
   - Error handling for invalid files

4. **UI Components**
   - Drop zone component
   - File list component
   - Progress bar component
   - Upload button component

## Technical Details
- Use react-dropzone for drag-and-drop
- Implement file validation logic
- Add progress tracking
- Handle large files with chunking

## Files to Create/Modify
- \`frontend/src/components/FileUpload.tsx\` (create)
- \`frontend/src/components/DropZone.tsx\` (create)
- \`frontend/src/components/FileList.tsx\` (create)
- \`frontend/src/components/FilePreview.tsx\` (create)
- \`frontend/src/hooks/useFileUpload.ts\` (create)
- \`frontend/src/utils/fileValidation.ts\` (create)

## Acceptance Criteria
- [ ] Drag and drop works
- [ ] Multiple files can be uploaded
- [ ] File type restrictions work
- [ ] File size limits are enforced
- [ ] Progress indicators are accurate
- [ ] Files can be removed
- [ ] Image previews work
- [ ] Error handling is comprehensive

## References
- react-dropzone: https://react-dropzone.js.org/
- File upload patterns: https://www.patternfly.org/components/file-upload`,
    priority: "medium"
  },

  {
    title: "[Frontend] Add Pagination and Infinite Scroll",
    labels: ["frontend", "feature", "performance"],
    body: `## Overview
Implement pagination and infinite scroll for data-heavy components.

## Current State
- Some components load all data at once
- No pagination implementation
- No infinite scroll
- Performance issues with large datasets

## Requirements
1. **Pagination**
   - Numbered pagination controls
   - Page size selection
   - Jump to page functionality
   - Previous/next navigation
   - Page info display

2. **Infinite Scroll**
   - Automatic loading on scroll
   - Loading indicators
   - Scroll to top functionality
   - Manual "load more" button
   - Performance optimization

3. **Data Management**
   - Cache management for paginated data
   - URL state for pagination
   - Preserve scroll position
   - Handle data changes

4. **UI Components**
   - Pagination component
   - Infinite scroll wrapper
   - Loading skeletons
   - Empty state handling

## Technical Details
- Use React Query for data fetching
- Implement virtual scrolling for performance
- Use URL query params for state
- Add proper caching strategies

## Files to Create/Modify
- \`frontend/src/components/Pagination.tsx\` (create)
- \`frontend/src/components/InfiniteScroll.tsx\` (create)
- \`frontend/src/hooks/usePagination.ts\` (create)
- \`frontend/src/hooks/useInfiniteScroll.ts\` (create)
- Update data-heavy components to use pagination

## Acceptance Criteria
- [ ] Pagination controls work correctly
- [ ] Page size can be changed
- [ ] Infinite scroll loads data smoothly
- [ ] URL state is maintained
- [ ] Performance is good with large datasets
- [ ] Loading states are shown
- [ ] Empty states are handled
- [ ] Scroll position is preserved

## References
- React Query pagination: https://tanstack.com/query/latest/docs/react/guides/pagination
- react-window: https://www.npmjs.com/package/react-window`,
    priority: "medium"
  },

  {
    title: "[Frontend] Implement Undo/Redo Functionality",
    labels: ["frontend", "feature", "user-experience"],
    body: `## Overview
Add undo/redo functionality for user actions throughout the application.

## Current State
- No undo/redo capability
- User mistakes cannot be easily corrected
- No action history

## Requirements
1. **Undo/Redo System**
   - Track user actions
   - Implement undo stack
   - Implement redo stack
   - Keyboard shortcuts (Ctrl+Z, Ctrl+Y)
   - Action history UI

2. **Action Types**
   - Form field changes
   - Filter changes
   - Settings changes
   - Data modifications
   - Layout changes

3. **UI Components**
   - Undo/redo buttons in toolbar
   - Action history panel
   - Keyboard shortcut indicators
   - Disabled state when no history

4. **Performance**
   - Limit history size
   - Efficient state management
   - Memory optimization
   - Debounce rapid actions

## Technical Details
- Use Redux or context for state management
- Implement command pattern for actions
- Add action serialization for persistence
- Optimize for performance

## Files to Create/Modify
- \`frontend/src/contexts/UndoRedoContext.tsx\` (create)
- \`frontend/src/hooks/useUndoRedo.ts\` (create)
- \`frontend/src/components/UndoRedoButtons.tsx\` (create)
- \`frontend/src/components/ActionHistory.tsx\` (create)
- Update components to track actions

## Acceptance Criteria
- [ ] Undo works for all supported actions
- [ ] Redo works after undo
- [ ] Keyboard shortcuts work
- [ ] Action history is displayed
- [ ] History size is limited
- [ ] Performance is good
- [ ] Actions can be persisted
- [ ] Complex actions are handled correctly

## References
- Undo/Redo patterns: https://reactpatterns.com/
- Command pattern: https://refactoring.guru/design-patterns/command-pattern`,
    priority: "low"
  },

  {
    title: "[Frontend] Add Toast Notification System",
    labels: ["frontend", "feature", "notifications"],
    body: `## Overview
Implement a comprehensive toast notification system for user feedback.

## Current State
- Limited notification system
- No toast notifications
- Basic alert dialogs

## Requirements
1. **Toast Types**
   - Success toasts
   - Error toasts
   - Warning toasts
   - Info toasts
   - Custom toasts

2. **Toast Features**
   - Auto-dismiss after timeout
   - Manual dismiss button
   - Progress bar for auto-dismiss
   - Stack multiple toasts
   - Position options (top, bottom, corners)

3. **Customization**
   - Custom content support
   - Action buttons in toasts
   - Icons for different types
   - Sound effects (optional)
   - Animation options

4. **API**
   - Simple programmatic API
   - Hook-based API
   - Promise-based API for async operations
   - Global configuration

## Technical Details
- Use existing toast library or build custom
- Implement toast queue management
- Add animation support
- Use React Context for global access

## Files to Create/Modify
- \`frontend/src/components/Toast.tsx\` (create)
- \`frontend/src/components/ToastContainer.tsx\` (create)
- \`frontend/src/contexts/ToastContext.tsx\` (create)
- \`frontend/src/hooks/useToast.ts\` (create)
- \`frontend/src/utils/toastUtils.ts\` (create)

## Acceptance Criteria
- [ ] All toast types work correctly
- [ ] Auto-dismiss works
- [ ] Multiple toasts stack properly
- [ ] Positioning options work
- [ ] Custom content is supported
- [ ] API is easy to use
- [ ] Animations are smooth
- [ ] Performance is good

## References
- react-hot-toast: https://react-hot-toast.com/
- react-toastify: https://fkhadra.github.io/react-toastify/
- Toast patterns: https://www.patternfly.org/components/toast`,
    priority: "low"
  },

  {
    title: "[Frontend] Implement Date/Time Picker Component",
    labels: ["frontend", "components", "forms"],
    body: `## Overview
Create a comprehensive date/time picker component for forms and filters.

## Current State
- Basic date inputs exist
- No dedicated date/time picker
- Limited date functionality

## Requirements
1. **Date Picker Features**
   - Calendar view
   - Date range selection
   - Quick date presets (today, yesterday, etc.)
   - Min/max date constraints
   - Disabled dates

2. **Time Picker Features**
   - Time selection
   - Time zones
   - Time intervals
   - 12/24 hour format
   - Quick time presets

3. **Combined Date/Time**
   - Single component for date and time
   - Separate date and time modes
   - Relative date selection (e.g., "7 days ago")
   - Business day calculations

4. **UI/UX**
   - Material-UI styled
   - Keyboard navigation
   - Accessible
   - Mobile-friendly
   - Internationalized

## Technical Details
- Use Material-UI DatePicker or similar
- Integrate with existing form validation
- Support i18n for different locales
- Handle time zones correctly

## Files to Create/Modify
- \`frontend/src/components/DateTimePicker.tsx\` (create)
- \`frontend/src/components/DatePicker.tsx\` (create)
- \`frontend/src/components/TimePicker.tsx\` (create)
- \`frontend/src/components/DateRangePicker.tsx\` (create)
- Update forms to use new components

## Acceptance Criteria
- [ ] Date picker works correctly
- [ ] Time picker works correctly
- [ ] Date range selection works
- [ ] Quick presets work
- [ ] Constraints are enforced
- [ ] Component is accessible
- [ ] Mobile-friendly
- [ ] Internationalized

## References
- Material-UI DatePicker: https://mui.com/x/react-date-pickers/
- date-fns: https://date-fns.org/
- Day.js: https://day.js.org/`,
    priority: "low"
  },

  {
    title: "[Frontend] Add Table Component with Sorting and Filtering",
    labels: ["frontend", "components", "data-display"],
    body: `## Overview
Create a comprehensive table component with sorting, filtering, and other features.

## Current State
- Basic tables exist
- No sorting functionality
- No inline filtering
- Limited table features

## Requirements
1. **Sorting**
   - Column sorting (asc/desc)
   - Multi-column sorting
   - Sort indicators
   - Custom sort functions
   - Sort persistence

2. **Filtering**
   - Column filtering
   - Text search filters
   - Date range filters
   - Dropdown filters
   - Filter persistence

3. **Table Features**
   - Column resizing
   - Column hiding/showing
   - Row selection
   - Expandable rows
   - Sticky headers

4. **Performance**
   - Virtual scrolling for large datasets
   - Lazy loading
   - Efficient re-renders
   - Pagination support

## Technical Details
- Use Material-UI Table or react-table
- Implement virtual scrolling
- Add proper TypeScript types
- Optimize for performance

## Files to Create/Modify
- \`frontend/src/components/DataTable.tsx\` (create)
- \`frontend/src/components/TableSortLabel.tsx\` (create)
- \`frontend/src/components/TableFilter.tsx\` (create)
- \`frontend/src/components/TablePagination.tsx\` (create)
- Update existing tables to use new component

## Acceptance Criteria
- [ ] Sorting works for all columns
- [ ] Multi-column sorting works
- [ ] Filtering works correctly
- [ ] Column resizing works
- [ ] Row selection works
- [ ] Performance is good with large datasets
- [ ] Accessibility is maintained
- [ ] Mobile-friendly

## References
- Material-UI Table: https://mui.com/material-ui/react-table/
- react-table: https://tanstack.com/table/latest
- react-window: https://www.npmjs.com/package/react-window`,
    priority: "medium"
  },

  {
    title: "[Frontend] Implement Modal and Dialog System",
    labels: ["frontend", "components", "ui"],
    body: `## Overview
Create a comprehensive modal and dialog system for the application.

## Current State
- Basic modals exist
- No consistent modal system
- Limited dialog functionality

## Requirements
1. **Modal Types**
   - Alert dialogs
   - Confirmation dialogs
   - Form modals
   - Full-screen modals
   - Drawer/side panel modals

2. **Modal Features**
   - Backdrop click to close
   - Escape key to close
   - Animation on open/close
   - Focus trapping
   - Size variants (small, medium, large, full)

3. **Dialog Features**
   - Action buttons (confirm, cancel)
   - Custom content
   - Icon support
   - Progress indicators
   - Step-by-step wizards

4. **Accessibility**
   - ARIA attributes
   - Focus management
   - Keyboard navigation
   - Screen reader support

## Technical Details
- Use Material-UI Dialog components
- Create modal context for global management
- Implement focus trapping
- Add proper animations

## Files to Create/Modify
- \`frontend/src/components/Modal.tsx\` (create)
- \`frontend/src/components/Dialog.tsx\` (create)
- \`frontend/src/components/ConfirmDialog.tsx\` (create)
- \`frontend/src/components/FormModal.tsx\` (create)
- \`frontend/src/contexts/ModalContext.tsx\` (create)

## Acceptance Criteria
- [ ] All modal types work correctly
- [ ] Backdrop click closes modal
- [ ] Escape key closes modal
- [ ] Animations are smooth
- [ ] Focus is trapped in modal
- [ ] Accessibility standards met
- [ ] Modal context works globally
- [ ] Performance is good

## References
- Material-UI Dialog: https://mui.com/material-ui/react-dialog/
- Focus trapping: https://github.com/focus-trap/focus-trap-react`,
    priority: "low"
  },

  {
    title: "[Frontend] Add Tooltip and Help System",
    labels: ["frontend", "components", "help"],
    body: `## Overview
Implement a comprehensive tooltip and help system for user guidance.

## Current State
- Basic tooltips exist
- No help documentation
- Limited user guidance

## Requirements
1. **Tooltip Types**
   - Simple text tooltips
   - Rich content tooltips
   - Icon tooltips
   - Follow cursor tooltips
   - Persistent tooltips

2. **Help System**
   - Help buttons throughout UI
   - Context-sensitive help
   - Help modal/panel
   - Searchable help documentation
   - Video tutorials (optional)

3. **Tour/Guide**
   - Feature tour for new users
   - Step-by-step guidance
   - Highlight elements
   - Progress indicators
   - Skip tour option

4. **Documentation**
   - Help content for all features
   - Screenshots and diagrams
   - Code examples where applicable
   - FAQ section

## Technical Details
- Use Material-UI Tooltip or react-tooltip
- Implement tour library (react-joyride)
- Create help content management
- Add search functionality

## Files to Create/Modify
- \`frontend/src/components/Tooltip.tsx\` (enhance)
- \`frontend/src/components/HelpButton.tsx\` (create)
- \`frontend/src/components/HelpPanel.tsx\` (create)
- \`frontend/src/components/FeatureTour.tsx\` (create)
- \`frontend/src/help/\` (create help content)

## Acceptance Criteria
- [ ] Tooltips display correctly
- [ ] Help buttons are present
- [ ] Help content is comprehensive
- [ ] Feature tour works smoothly
- [ ] Search in help works
- [ ] Help is context-sensitive
- [ ] Tour can be skipped
- [ ] Content is maintainable

## References
- Material-UI Tooltip: https://mui.com/material-ui/react-tooltip/
- react-joyride: https://docs.react-joyride.com/
- Help authoring patterns: https://www.nngroup.com/articles/help-users/`,
    priority: "low"
  },

  {
    title: "[Frontend] Implement State Persistence",
    labels: ["frontend", "feature", "persistence"],
    body: `## Overview
Implement state persistence to save user preferences and application state.

## Current State
- No state persistence
- User preferences lost on refresh
- No way to save dashboard configurations

## Requirements
1. **Persistence Types**
   - Local storage for user preferences
   - Session storage for temporary state
   - IndexedDB for large datasets
   - Server-side persistence for critical data

2. **Persisted Data**
   - User preferences (theme, language, etc.)
   - Dashboard configurations
   - Filter states
   - Column layouts
   - Recent searches

3. **Synchronization**
   - Sync with server when online
   - Conflict resolution
   - Offline support
   - Data validation

4. **Security**
   - Sensitive data encryption
   - Secure storage options
   - Data expiration
   - Clear data on logout

## Technical Details
- Use localStorage/sessionStorage APIs
- Implement IndexedDB for large data
- Add encryption for sensitive data
- Create persistence abstraction layer

## Files to Create/Modify
- \`frontend/src/utils/storage.ts\` (create)
- \`frontend/src/utils/persistence.ts\` (create)
- \`frontend/src/contexts/PersistenceContext.tsx\` (create)
- \`frontend/src/hooks/usePersistence.ts\` (create)
- Update components to use persistence

## Acceptance Criteria
- [ ] Preferences persist across sessions
- [ ] Dashboard configurations are saved
- [ ] Filter states are preserved
- [ ] Data syncs with server
- [ ] Offline support works
- [ ] Sensitive data is encrypted
- [ ] Data can be cleared
- [ ] Performance is good

## References
- Web Storage API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API
- IndexedDB: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- LocalForage: https://localforage.github.io/localForage/`,
    priority: "low"
  },

  {
    title: "[Frontend] Add Keyboard Shortcuts",
    labels: ["frontend", "feature", "accessibility"],
    body: `## Overview
Implement keyboard shortcuts throughout the application for power users.

## Current State
- No keyboard shortcuts
- All interactions require mouse
- Not accessible to keyboard-only users

## Requirements
1. **Shortcut Categories**
   - Navigation shortcuts
   - Action shortcuts
   - Search shortcuts
   - Settings shortcuts
   - Help shortcuts

2. **Shortcut Features**
   - Global shortcuts (work anywhere)
   - Context-specific shortcuts
   - Shortcut conflict resolution
   - Customizable shortcuts
   - Shortcut cheat sheet

3. **UI Indicators**
   - Show shortcuts in tooltips
   - Show shortcuts in menus
   - Shortcut help modal
   - Visual feedback on press

4. **Accessibility**
   - Don't interfere with browser shortcuts
   - Don't interfere with screen readers
   - Provide alternative methods
   - Document all shortcuts

## Technical Details
- Use react-hotkeys-hook or similar
- Implement shortcut context
- Add shortcut registration system
- Handle key conflicts

## Files to Create/Modify
- \`frontend/src/hooks/useKeyboardShortcuts.ts\` (create)
- \`frontend/src/components/ShortcutHelp.tsx\` (create)
- \`frontend/src/contexts/ShortcutContext.tsx\` (create)
- \`frontend/src/shortcuts/index.ts\` (create)
- Update components with shortcuts

## Acceptance Criteria
- [ ] All major actions have shortcuts
- [ ] Shortcuts work correctly
- [ ] Shortcuts are shown in UI
- [ ] Cheat sheet is available
- [ ] Shortcuts can be customized
- [ ] No conflicts with browser
- [ ] Accessibility is maintained
- [ ] Performance is good

## References
- react-hotkeys-hook: https://react-hotkeys-hook.vercel.app/
- Keyboard shortcut patterns: https://www.w3.org/WAI/ARIA/apg/patterns/keyboard-interface/`,
    priority: "low"
  },

  // BACKEND ISSUES (25 issues)

  {
    title: "[Backend] Implement API Rate Limiting",
    labels: ["backend", "security", "performance"],
    body: `## Overview
Implement comprehensive API rate limiting to prevent abuse and ensure fair usage.

## Current State
- Basic rate limiting exists in middleware
- Not fully configured
- No per-user rate limiting
- No rate limit headers

## Requirements
1. **Rate Limiting Strategies**
   - IP-based rate limiting
   - User-based rate limiting
   - API key-based rate limiting
   - Endpoint-specific limits
   - Tier-based limits (free, pro, enterprise)

2. **Rate Limit Features**
   - Configurable time windows (minute, hour, day)
   - Sliding window algorithm
   - Distributed rate limiting (Redis)
   - Rate limit headers in responses
   - Rate limit exceeded responses

3. **Configuration**
   - Environment-based configuration
   - Dynamic limit adjustment
   - Whitelist for trusted IPs
   - Admin bypass capability
   - Monitoring and alerting

4. **Integration**
   - Express middleware
   - GraphQL rate limiting (if applicable)
   - WebSocket rate limiting
   - Admin panel for monitoring

## Technical Details
- Use express-rate-limit or similar
- Use Redis for distributed limiting
- Implement sliding window algorithm
- Add proper error responses

## Files to Create/Modify
- \`backend/src/middleware/rateLimiter.ts\` (enhance)
- \`backend/src/middleware/distributedRateLimiter.ts\` (create)
- \`backend/src/config/rateLimit.ts\` (create)
- \`backend/src/utils/rateLimitUtils.ts\` (create)
- Update \`backend/src/index.ts\` to use middleware

## Acceptance Criteria
- [ ] Rate limiting works for all endpoints
- [ ] Rate limit headers are present
- [ ] Distributed limiting works with Redis
- [ ] Different limits for different tiers
- [ ] Whitelist works correctly
- [ ] Monitoring is in place
- [ ] Performance is not degraded
- [ ] Documentation is complete

## References
- express-rate-limit: https://www.npmjs.com/package/express-rate-limit
- Rate limiting best practices: https://cloud.google.com/architecture/rate-limiting-strategies-techniques`,
    priority: "high"
  },

  {
    title: "[Backend] Implement Caching Layer",
    labels: ["backend", "performance", "optimization"],
    body: `## Overview
Implement a comprehensive caching layer to improve API performance and reduce database load.

## Current State
- No caching layer
- All requests hit database
- No response caching
- Performance issues with frequent requests

## Requirements
1. **Caching Strategies**
   - Response caching
   - Database query caching
   - Computed data caching
   - Session caching
   - CDN integration

2. **Cache Features**
   - TTL (time-to-live) configuration
   - Cache invalidation
   - Cache warming
   - Cache statistics
   - Cache fallback

3. **Cache Storage**
   - In-memory caching (Node-cache)
   - Redis caching
   - Multi-level caching
   - Cache persistence
   - Cache replication

4. **Integration**
   - Express middleware for response caching
   - Prisma middleware for query caching
   - Manual cache control
   - Cache tags for group invalidation

## Technical Details
- Use Redis for distributed caching
- Use node-cache for in-memory caching
- Implement cache invalidation strategies
- Add cache monitoring

## Files to Create/Modify
- \`backend/src/middleware/cache.ts\` (create)
- \`backend/src/services/cacheService.ts\` (create)
- \`backend/src/config/cache.ts\` (create)
- \`backend/src/utils/cacheUtils.ts\` (create)
- Update database queries to use caching

## Acceptance Criteria
- [ ] Response caching works
- [ ] Database queries are cached
- [ ] Cache invalidation works correctly
- [ ] Cache statistics are available
- [ ] Performance is improved
- [ ] Cache fallback works
- [ ] Multi-level caching works
- [ ] Monitoring is in place

## References
- Redis: https://redis.io/
- node-cache: https://www.npmjs.com/package/node-cache
- Caching strategies: https://aws.amazon.com/caching/`,
    priority: "high"
  },

  {
    title: "[Backend] Add Comprehensive Logging System",
    labels: ["backend", "monitoring", "logging"],
    body: `## Overview
Implement a comprehensive logging system for debugging, monitoring, and auditing.

## Current State
- Basic logging exists (Winston)
- Not fully configured
- No structured logging
- No log aggregation

## Requirements
1. **Log Types**
   - Application logs
   - Access logs
   - Error logs
   - Performance logs
   - Audit logs

2. **Log Features**
   - Structured logging (JSON)
   - Log levels (debug, info, warn, error)
   - Log correlation (request IDs)
   - Log sampling
   - Sensitive data redaction

3. **Log Destinations**
   - Console (development)
   - Files (production)
   - External services (Loggly, Datadog, etc.)
   - SIEM integration
   - Real-time streaming

4. **Log Management**
   - Log rotation
   - Log retention policies
   - Log search and filtering
   - Log alerts
   - Log dashboards

## Technical Details
- Enhance existing Winston configuration
- Add log correlation middleware
- Implement log redaction
- Add external log service integration

## Files to Create/Modify
- \`backend/src/utils/logger.ts\` (enhance)
- \`backend/src/middleware/logging.ts\` (enhance)
- \`backend/src/middleware/requestId.ts\` (create)
- \`backend/src/config/logging.ts\` (create)
- \`backend/src/utils/logRedaction.ts\` (create)

## Acceptance Criteria
- [ ] All log types are captured
- [ ] Logs are structured (JSON)
- [ ] Request IDs are present
- [ ] Sensitive data is redacted
- [ ] Logs are sent to external services
- [ ] Log rotation works
- [ ] Log search works
- [ ] Performance is not degraded

## References
- Winston: https://github.com/winstonjs/winston
- Pino: https://getpino.io/
- Log aggregation: https://www.elastic.co/what-is/log-aggregation`,
    priority: "high"
  },

  {
    title: "[Backend] Implement Database Migration System",
    labels: ["backend", "database", "infrastructure"],
    body: `## Overview
Implement a comprehensive database migration system for schema changes.

## Current State
- Prisma is used but migrations are manual
- No automated migration system
- No rollback capability
- No migration history tracking

## Requirements
1. **Migration Features**
   - Automated migration generation
   - Up and down migrations
   - Migration rollback
   - Migration status tracking
   - Dry-run mode

2. **Migration Management**
   - Version control for migrations
   - Migration dependencies
   - Environment-specific migrations
   - Data seeding
   - Migration validation

3. **Safety Features**
   - Migration backups
   - Pre-migration validation
   - Post-migration verification
   - Rollback on failure
   - Migration locking

4. **Integration**
   - CI/CD integration
   - Database per environment
   - Migration testing
   - Migration documentation
   - Migration alerts

## Technical Details
- Use Prisma Migrate
- Implement custom migration scripts
- Add migration validation
- Create migration backup system

## Files to Create/Modify
- \`backend/prisma/migrations/\` (organize)
- \`backend/src/scripts/migrate.ts\` (create)
- \`backend/src/scripts/rollback.ts\` (create)
- \`backend/src/utils/migrationUtils.ts\` (create)
- \`backend/src/config/database.ts\` (enhance)

## Acceptance Criteria
- [ ] Migrations can be generated automatically
- [ ] Up and down migrations work
- [ ] Rollback works correctly
- [ ] Migration status is tracked
- [ ] Backups are created
- [ ] Validation works
- [ ] CI/CD integration works
- [ ] Documentation is complete

## References
- Prisma Migrate: https://www.prisma.io/docs/concepts/components/prisma-migrate
- Database migration best practices: https://www.redgate.com/simple-talk/sql/database-administration/sql-server-best-practices-for-database-migration/`,
    priority: "high"
  },

  {
    title: "[Backend] Add API Documentation with OpenAPI/Swagger",
    labels: ["backend", "documentation", "api"],
    body: `## Overview
Implement comprehensive API documentation using OpenAPI/Swagger specification.

## Current State
- No API documentation
- No OpenAPI specification
- No interactive API explorer
- Limited documentation for developers

## Requirements
1. **OpenAPI Specification**
   - Complete API specification
   - Request/response schemas
   - Authentication documentation
   - Error response documentation
   - Example requests/responses

2. **Interactive Documentation**
   - Swagger UI integration
   - Try-it-out functionality
   - Request builder
   - Response visualization
   - Authentication support

3. **Documentation Features**
   - Auto-generate from code
   - Keep in sync with code
   - Versioning support
   - Multiple environments
   - Export as JSON/YAML

4. **Integration**
   - Express middleware
   - TypeScript types generation
   - Client SDK generation
   - API testing integration
   - CI/CD validation

## Technical Details
- Use swagger-ui-express
- Use swagger-jsdoc for annotations
- Generate TypeScript types from OpenAPI
- Add validation against spec

## Files to Create/Modify
- \`backend/src/config/swagger.ts\` (create)
- \`backend/src/swagger/\` (create spec files)
- Add JSDoc comments to all routes
- \`backend/src/index.ts\` (add Swagger middleware)
- \`backend/scripts/generate-types.ts\` (create)

## Acceptance Criteria
- [ ] OpenAPI spec is complete
- [ ] Swagger UI is accessible
- [ ] Try-it-out works
- [ ] Documentation is auto-generated
- [ ] TypeScript types are generated
- [ ] Spec validates correctly
- [ ] Authentication works in UI
- [ ] Examples are comprehensive

## References
- Swagger UI: https://swagger.io/tools/swagger-ui/
- swagger-jsdoc: https://www.npmjs.com/package/swagger-jsdoc
- OpenAPI Specification: https://swagger.io/specification/`,
    priority: "high"
  },

  {
    title: "[Backend] Implement Background Job Processing",
    labels: ["backend", "performance", "jobs"],
    body: `## Overview
Implement a background job processing system for async tasks.

## Current State
- No background job system
- All tasks are synchronous
- No job queue
- No job retry logic

## Requirements
1. **Job Types**
   - Email sending
   - Report generation
   - Data processing
   - Cache warming
   - Cleanup tasks

2. **Job Features**
   - Job queue (Bull, Agenda, etc.)
   - Job priority
   - Job retry with backoff
   - Job concurrency control
   - Job scheduling (cron)

3. **Job Management**
   - Job monitoring UI
   - Job logs
   - Job statistics
   - Job cancellation
   - Job retry manual trigger

4. **Integration**
   - Redis for queue storage
   - Database for job persistence
   - Worker processes
   - Job events
   - Admin panel

## Technical Details
- Use Bull or Agenda for job queue
- Use Redis for queue storage
- Implement job workers
- Add job monitoring

## Files to Create/Modify
- \`backend/src/jobs/\` (create job definitions)
- \`backend/src/workers/\` (create worker processes)
- \`backend/src/services/jobService.ts\` (create)
- \`backend/src/config/jobs.ts\` (create)
- \`backend/src/middleware/jobAuth.ts\` (create)

## Acceptance Criteria
- [ ] Jobs can be queued
- [ ] Jobs are processed asynchronously
- [ ] Retry logic works
- [ ] Job monitoring works
- [ ] Scheduled jobs work
- [ ] Job cancellation works
- [ ] Performance is good
- [ ] Error handling is comprehensive

## References
- Bull: https://github.com/OptimalBits/bull
- Agenda: https://github.com/agenda/agenda
- Job queue patterns: https://www.cloudbees.com/blog/java-job-scheduling`,
    priority: "medium"
  },

  {
    title: "[Backend] Add File Storage System",
    labels: ["backend", "storage", "infrastructure"],
    body: `## Overview
Implement a file storage system for user uploads, documents, and assets.

## Current State
- No file storage system
- No way to store user files
- No document management
- No asset management

## Requirements
1. **Storage Options**
   - Local file system
   - AWS S3
   - Google Cloud Storage
   - Azure Blob Storage
   - Multi-cloud support

2. **File Features**
   - File upload
   - File download
   - File deletion
   - File metadata
   - File versioning

3. **Security**
   - File type validation
   - File size limits
   - Virus scanning
   - Access control
   - Signed URLs

4. **Optimization**
   - Image optimization
   - Thumbnail generation
   - CDN integration
   - Compression
   - Caching

## Technical Details
- Use Multer for uploads
- Use AWS SDK for S3
- Implement file validation
- Add CDN support

## Files to Create/Modify
- \`backend/src/services/storageService.ts\` (create)
- \`backend/src/services/s3Service.ts\` (create)
- \`backend/src/middleware/upload.ts\` (create)
- \`backend/src/utils/fileUtils.ts\` (create)
- \`backend/src/config/storage.ts\` (create)

## Acceptance Criteria
- [ ] File upload works
- [ ] File download works
- [ ] File deletion works
- [ ] S3 integration works
- [ ] File validation works
- [ ] Image optimization works
- [ ] CDN integration works
- [ ] Access control works

## References
- Multer: https://www.npmjs.com/package/multer
- AWS SDK: https://docs.aws.amazon.com/AWSJavaScriptSDK/
- Sharp (image processing): https://sharp.pixelplumbing.com/`,
    priority: "medium"
  },

  {
    title: "[Backend] Implement Webhook System",
    labels: ["backend", "feature", "integration"],
    body: `## Overview
Implement a webhook system for external integrations and notifications.

## Current State
- No webhook system
- No way to notify external systems
- No event publishing
- Limited integration capabilities

## Requirements
1. **Webhook Features**
   - Webhook registration
   - Webhook triggering
   - Webhook retry logic
   - Webhook authentication
   - Webhook logging

2. **Event Types**
   - Transaction events
   - Account events
   - Score events
   - Fraud events
   - System events

3. **Webhook Management**
   - Webhook CRUD operations
   - Webhook testing
   - Webhook status monitoring
   - Webhook statistics
   - Webhook pause/resume

4. **Security**
   - HMAC signature verification
   - IP whitelisting
   - Rate limiting
   - Payload encryption
   - TLS enforcement

## Technical Details
- Implement webhook storage
- Add webhook delivery service
- Implement retry logic with exponential backoff
- Add signature verification

## Files to Create/Modify
- \`backend/src/services/webhookService.ts\` (create)
- \`backend/src/models/Webhook.ts\` (create)
- \`backend/src/routes/webhooks.ts\` (create)
- \`backend/src/utils/webhookUtils.ts\` (create)
- \`backend/src/middleware/webhookAuth.ts\` (create)

## Acceptance Criteria
- [ ] Webhooks can be registered
- [ ] Webhooks are triggered on events
- [ ] Retry logic works
- [ ] Signature verification works
- [ ] Webhook monitoring works
- [ ] Webhook testing works
- [ ] Security features work
- [ ] Performance is good

## References
- Webhook best practices: https://sendgrid.com/blog/what-are-webhooks/
- HMAC verification: https://www.npmjs.com/package/crypto`,
    priority: "medium"
  },

  {
    title: "[Backend] Add Email Notification System",
    labels: ["backend", "notifications", "feature"],
    body: `## Overview
Implement an email notification system for user communications.

## Current State
- No email system
- No way to send emails
- No email templates
- No email tracking

## Requirements
1. **Email Features**
   - Transactional emails
   - Marketing emails (optional)
   - Email templates
   - Email scheduling
   - Email tracking

2. **Email Types**
   - Welcome emails
   - Password reset
   - Account verification
   - Alerts and notifications
   - Reports

3. **Email Management**
   - Template management
   - Email queue
   - Bounce handling
   - Unsubscribe management
   - Email analytics

4. **Integration**
   - SendGrid
   - AWS SES
   - Mailgun
   - SMTP support
   - Multi-provider support

## Technical Details
- Use Nodemailer or SendGrid SDK
- Implement email templates (Handlebars, EJS)
- Add email queue
- Implement tracking

## Files to Create/Modify
- \`backend/src/services/emailService.ts\` (create)
- \`backend/src/templates/\` (create email templates)
- \`backend/src/jobs/sendEmail.ts\` (create)
- \`backend/src/config/email.ts\` (create)
- \`backend/src/utils/emailUtils.ts\` (create)

## Acceptance Criteria
- [ ] Emails can be sent
- [ ] Templates work correctly
- [ ] Email queue works
- [ ] Bounce handling works
- [ ] Tracking works
- [ ] Unsubscribe works
- [ ] Multiple providers work
- [ ] Performance is good

## References
- Nodemailer: https://nodemailer.com/
- SendGrid: https://sendgrid.com/
- Handlebars: https://handlebarsjs.com/`,
    priority: "medium"
  },

  {
    title: "[Backend] Implement API Versioning",
    labels: ["backend", "api", "architecture"],
    body: `## Overview
Implement API versioning to support backward compatibility and evolution.

## Current State
- No API versioning
- All endpoints are unversioned
- Breaking changes affect all clients
- No version management

## Requirements
1. **Versioning Strategy**
   - URL path versioning (/v1/, /v2/)
   - Header versioning (Accept-Version)
   - Query parameter versioning
   - Semantic versioning
   - Deprecation policy

2. **Version Features**
   - Multiple active versions
   - Version routing
   - Version-specific middleware
   - Version deprecation warnings
   - Version sunset policy

3. **Migration Support**
   - Migration guides
   - Compatibility layers
   - Data transformation
   - Graceful migration period
   - Client notifications

4. **Documentation**
   - Version-specific docs
   - Changelog
   - Migration timeline
   - Breaking change documentation
   - Version comparison

## Technical Details
- Implement version routing middleware
- Create version-specific route files
- Add version headers
- Implement deprecation warnings

## Files to Create/Modify
- \`backend/src/middleware/versioning.ts\` (create)
- \`backend/src/routes/v1/\` (create)
- \`backend/src/routes/v2/\` (create)
- \`backend/src/utils/versionUtils.ts\` (create)
- Update existing routes to use versioning

## Acceptance Criteria
- [ ] Version routing works
- [ ] Multiple versions coexist
- [ ] Deprecation warnings are sent
- [ ] Documentation is versioned
- [ ] Migration guides exist
- [ ] Breaking changes are documented
- [ ] Version sunset policy is enforced
- [ ] Performance is not degraded

## References
- API versioning best practices: https://apisyouwonthate.com/
- REST API versioning: https://www.vinaysahni.com/best-way-to-version-rest-api/`,
    priority: "medium"
  },

  {
    title: "[Backend] Add Request Validation Middleware",
    labels: ["backend", "validation", "security"],
    body: `## Overview
Implement comprehensive request validation middleware for all API endpoints.

## Current State
- Basic validation exists
- Not consistent across endpoints
- Manual validation in controllers
- Limited validation error messages

## Requirements
1. **Validation Library**
   - Integrate Zod or Joi
   - Create validation schemas
   - Reusable validation rules
   - Custom validators
   - Async validation

2. **Validation Features**
   - Request body validation
   - Query parameter validation
   - Header validation
   - Path parameter validation
   - File validation

3. **Error Handling**
   - Consistent error responses
   - Detailed error messages
   - Field-level errors
   - Error localization
   - Error logging

4. **Integration**
   - Express middleware
   - Schema organization
   - Validation middleware composition
   - Type generation from schemas
   - OpenAPI integration

## Technical Details
- Use Zod or Joi for validation
- Create validation middleware
- Organize schemas by feature
- Generate TypeScript types

## Files to Create/Modify
- \`backend/src/middleware/validation.ts\` (create)
- \`backend/src/schemas/\` (create validation schemas)
- \`backend/src/utils/validationUtils.ts\` (create)
- \`backend/src/config/validation.ts\` (create)
- Update all routes to use validation

## Acceptance Criteria
- [ ] All endpoints have validation
- [ ] Error messages are clear
- [ ] Validation is consistent
- [ ] TypeScript types are generated
- [ ] Performance is good
- [ ] Custom validators work
- [ ] Async validation works
- [ ] OpenAPI integration works

## References
- Zod: https://zod.dev/
- Joi: https://joi.dev/
- Express validation middleware: https://express-validator.github.io/`,
    priority: "high"
  },

  {
    title: "[Backend] Implement Database Connection Pooling",
    labels: ["backend", "database", "performance"],
    body: `## Overview
Implement database connection pooling for better performance and resource management.

## Current State
- Basic Prisma connection
- No connection pooling configuration
- Potential connection leaks
- No connection monitoring

## Requirements
1. **Connection Pool Features**
   - Configurable pool size
   - Connection timeout
   - Connection idle timeout
   - Connection validation
   - Pool statistics

2. **Pool Management**
   - Dynamic pool sizing
   - Pool monitoring
   - Pool health checks
   - Pool draining
   - Pool recreation

3. **Integration**
   - Prisma connection pool
   - Redis connection pool
   - Multiple database pools
   - Pool configuration per environment
   - Pool alerting

4. **Monitoring**
   - Pool usage metrics
   - Connection wait times
   - Pool efficiency
   - Connection leak detection
   - Performance dashboards

## Technical Details
- Configure Prisma connection pool
- Add pool monitoring
- Implement pool health checks
- Add pool alerting

## Files to Create/Modify
- \`backend/src/config/database.ts\` (enhance)
- \`backend/src/utils/poolUtils.ts\` (create)
- \`backend/src/services/poolMonitor.ts\` (create)
- \`backend/src/middleware/poolHealth.ts\` (create)

## Acceptance Criteria
- [ ] Connection pool is configured
- [ ] Pool size is appropriate
- [ ] Pool monitoring works
- [ ] Connection leaks are detected
- [ ] Performance is improved
- [ ] Pool health checks work
- [ ] Alerting works
- [ ] Documentation is complete

## References
- Prisma connection pool: https://www.prisma.io/docs/concepts/components/prisma-client/connection-pool
- Connection pooling best practices: https://www.postgresql.org/docs/current/pgpool.html`,
    priority: "medium"
  },

  {
    title: "[Backend] Add Comprehensive Error Handling",
    labels: ["backend", "error-handling", "reliability"],
    body: `## Overview
Implement comprehensive error handling throughout the backend application.

## Current State
- Basic error handling exists
- Not consistent across the application
- Limited error logging
- No error tracking

## Requirements
1. **Error Types**
   - Custom error classes
   - HTTP errors
   - Validation errors
   - Database errors
   - External service errors

2. **Error Handling**
   - Global error handler
   - Error middleware
   - Error logging
   - Error tracking (Sentry)
   - Error notifications

3. **Error Responses**
   - Consistent error format
   - Error codes
   - Error messages
   - Error details (development)
   - Error stack traces (development)

4. **Error Recovery**
   - Retry logic
   - Fallback mechanisms
   - Graceful degradation
   - Circuit breakers
   - Bulkhead patterns

## Technical Details
- Create custom error classes
- Implement error middleware
- Add Sentry integration
- Implement circuit breakers

## Files to Create/Modify
- \`backend/src/errors/\` (create error classes)
- \`backend/src/middleware/errorHandler.ts\` (enhance)
- \`backend/src/middleware/sentry.ts\` (create)
- \`backend/src/utils/errorUtils.ts\` (create)
- \`backend/src/config/errors.ts\` (create)

## Acceptance Criteria
- [ ] All errors are caught
- [ ] Error responses are consistent
- [ ] Errors are logged
- [ ] Sentry integration works
- [ ] Retry logic works
- [ ] Circuit breakers work
- [ ] Error codes are documented
- [ ] Performance is not degraded

## References
- Sentry: https://sentry.io/
- Circuit breaker pattern: https://martinfowler.com/bliki/CircuitBreaker.html
- Error handling best practices: https://www.twilio.com/blog/how-to-handle-node-js-errors`,
    priority: "high"
  },

  {
    title: "[Backend] Implement Database Seeding and Test Data",
    labels: ["backend", "database", "testing"],
    body: `## Overview
Implement database seeding and test data generation for development and testing.

## Current State
- No seeding system
- Manual test data creation
- No consistent test data
- No seed data management

## Requirements
1. **Seeding Features**
   - Seed data scripts
   - Environment-specific seeds
   - Seed data versioning
   - Seed data dependencies
   - Seed data validation

2. **Test Data**
   - Realistic test data
   - Test data factories
   - Random data generation
   - Relationship handling
   - Data consistency

3. **Seed Management**
   - Seed CLI commands
   - Seed reset functionality
   - Seed data documentation
   - Seed data updates
   - Seed data backup

4. **Integration**
   - Prisma seed
   - Faker for data generation
   - Test database setup
   - CI/CD integration
   - Development workflow

## Technical Details
- Use Prisma seed functionality
- Use Faker for realistic data
- Create seed data factories
- Add seed CLI commands

## Files to Create/Modify
- \`backend/prisma/seed.ts\` (enhance)
- \`backend/src/seeds/\` (create seed files)
- \`backend/src/factories/\` (create data factories)
- \`backend/src/scripts/seed.ts\` (create)
- \`backend/src/utils/seedUtils.ts\` (create)

## Acceptance Criteria
- [ ] Seed scripts work
- [ ] Test data is realistic
- [ ] Relationships are handled
- [ ] Seeds are versioned
- [ ] CLI commands work
- [ ] Documentation is complete
- [ ] CI/CD integration works
- [ ] Data is consistent

## References
- Prisma seed: https://www.prisma.io/docs/guides/database/seed-database
- Faker: https://fakerjs.dev/
- Seed data best practices: https://www.laraveldaily.com/seed-database-in-laravel/`,
    priority: "medium"
  },

  {
    title: "[Backend] Add API Key Management System",
    labels: ["backend", "security", "feature"],
    body: `## Overview
Implement a comprehensive API key management system for external access.

## Current State
- Basic API key service exists
- Limited key management
- No key rotation
- No key analytics

## Requirements
1. **API Key Features**
   - Key generation
   - Key validation
   - Key rotation
   - Key revocation
   - Key expiration

2. **Key Types**
   - Read-only keys
   - Read-write keys
   - Admin keys
   - Scoped keys
   - Temporary keys

3. **Key Management**
   - Key CRUD operations
   - Key permissions
   - Key usage tracking
   - Key analytics
   - Key audit logs

4. **Security**
   - Key hashing
   - Key encryption
   - Key scopes
   - IP restrictions
   - Rate limiting per key

## Technical Details
- Enhance existing ApiKeyService
- Add key rotation logic
- Implement key analytics
- Add key encryption

## Files to Create/Modify
- \`backend/src/services/apiKeyService.ts\` (enhance)
- \`backend/src/models/ApiKey.ts\` (enhance)
- \`backend/src/routes/apiKeys.ts\` (create)
- \`backend/src/utils/keyUtils.ts\` (create)
- \`backend/src/middleware/apiKeyAuth.ts\` (enhance)

## Acceptance Criteria
- [ ] Keys can be generated
- [ ] Key validation works
- [ ] Key rotation works
- [ ] Key revocation works
- [ ] Key permissions work
- [ ] Usage tracking works
- [ ] Analytics work
- [ ] Security features work

## References
- API key best practices: https://cloud.google.com/apigee/docs/api-platform/security/api-keys
- Key management patterns: https://auth0.com/docs/manage-users/access-control/api-key-management`,
    priority: "high"
  },

  {
    title: "[Backend] Implement GraphQL API",
    labels: ["backend", "api", "graphql"],
    body: `## Overview
Implement a GraphQL API alongside the REST API for flexible data fetching.

## Current State
- Only REST API exists
- No GraphQL support
- Over-fetching/under-fetching issues
- Limited query flexibility

## Requirements
1. **GraphQL Features**
   - Schema definition
   - Query resolvers
   - Mutation resolvers
   - Subscriptions (WebSocket)
   - Schema stitching

2. **GraphQL Tools**
   - Apollo Server
   - GraphQL Playground
   - Schema documentation
   - Query validation
   - Query complexity analysis

3. **Integration**
   - Coexist with REST API
   - Share business logic
   - Authentication integration
   - Authorization integration
   - Rate limiting integration

4. **Performance**
   - Query batching
   - Data loader (N+1 problem)
   - Query caching
   - Response compression
   - Query depth limiting

## Technical Details
- Use Apollo Server
- Define GraphQL schema
- Implement resolvers
- Add DataLoader for performance
- Integrate with existing services

## Files to Create/Modify
- \`backend/src/graphql/\` (create)
- \`backend/src/graphql/schema.ts\` (create)
- \`backend/src/graphql/resolvers/\` (create)
- \`backend/src/graphql/dataloaders.ts\` (create)
- \`backend/src/index.ts\` (add GraphQL server)

## Acceptance Criteria
- [ ] GraphQL server runs
- [ ] Queries work correctly
- [ ] Mutations work correctly
- [ ] Subscriptions work
- [ ] Authentication works
- [ ] Authorization works
- [ ] Performance is good
- [ ] Documentation is complete

## References
- Apollo Server: https://www.apollographql.com/docs/apollo-server/
- GraphQL best practices: https://graphql.org/learn/best-practices/
- DataLoader: https://github.com/graphql/dataloader`,
    priority: "medium"
  },

  {
    title: "[Backend] Add Database Backup and Restore",
    labels: ["backend", "database", "infrastructure"],
    body: `## Overview
Implement database backup and restore functionality for data protection.

## Current State
- No backup system
- No restore capability
- Risk of data loss
- No disaster recovery

## Requirements
1. **Backup Features**
   - Automated backups
   - Manual backups
   - Incremental backups
   - Backup compression
   - Backup encryption

2. **Backup Management**
   - Backup scheduling
   - Backup retention
   - Backup verification
   - Backup monitoring
   - Backup alerts

3. **Restore Features**
   - Point-in-time restore
   - Selective restore
   - Restore validation
   - Restore testing
   - Rollback capability

4. **Storage**
   - Local storage
   - Cloud storage (S3, GCS)
   - Multi-region storage
   - Storage redundancy
   - Cost optimization

## Technical Details
- Use pg_dump for PostgreSQL
- Implement backup scheduling
- Add cloud storage integration
- Implement restore logic

## Files to Create/Modify
- \`backend/src/scripts/backup.ts\` (create)
- \`backend/src/scripts/restore.ts\` (create)
- \`backend/src/services/backupService.ts\` (create)
- \`backend/src/config/backup.ts\` (create)
- \`backend/src/utils/backupUtils.ts\` (create)

## Acceptance Criteria
- [ ] Automated backups work
- [ ] Manual backups work
- [ ] Restore works correctly
- [ ] Backups are encrypted
- [ ] Cloud storage works
- [ ] Scheduling works
- [ ] Monitoring works
- [ ] Documentation is complete

## References
- PostgreSQL backup: https://www.postgresql.org/docs/current/backup-dump.html
- AWS RDS backup: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html`,
    priority: "high"
  },

  {
    title: "[Backend] Implement Health Check Enhancements",
    labels: ["backend", "monitoring", "reliability"],
    body: `## Overview
Enhance the health check system with more comprehensive checks and monitoring.

## Current State
- Basic health check exists
- Limited checks
- No health history
- No alerting

## Requirements
1. **Health Check Types**
   - Database connectivity
   - Redis connectivity
   - External service health
   - Disk space
   - Memory usage
   - CPU usage

2. **Health Features**
   - Health history
   - Health trends
   - Health degradation detection
   - Health score calculation
   - Health alerts

3. **Monitoring**
   - Real-time health monitoring
   - Health dashboards
   - Health metrics
   - Health reports
   - Health notifications

4. **Integration**
   - Load balancer health checks
   - Kubernetes readiness/liveness probes
   - Monitoring service integration
   - Alerting integration
   - CI/CD health checks

## Technical Details
- Enhance existing health check
- Add more health checks
- Implement health history
- Add alerting

## Files to Create/Modify
- \`backend/src/routes/health.ts\` (enhance)
- \`backend/src/services/healthService.ts\` (create)
- \`backend/src/models/HealthCheck.ts\` (create)
- \`backend/src/config/health.ts\` (create)
- \`backend/src/utils/healthUtils.ts\` (create)

## Acceptance Criteria
- [ ] All health checks work
- [ ] Health history is tracked
- [ ] Health trends are calculated
- [ ] Alerts work correctly
- [ ] Dashboards display health
- [ ] Load balancer checks work
- [ ] Kubernetes probes work
- [ ] Performance is good

## References
- Health check best practices: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
- Monitoring patterns: https://www.datadoghq.com/blog/monitoring-101/`,
    priority: "medium"
  },

  {
    title: "[Backend] Add Request/Response Compression",
    labels: ["backend", "performance", "optimization"],
    body: `## Overview
Implement request and response compression to improve performance and reduce bandwidth.

## Current State
- No compression
- Large response sizes
- Slow API responses
- High bandwidth usage

## Requirements
1. **Compression Features**
   - Gzip compression
   - Brotli compression
   - Compression level configuration
   - Compression threshold
   - Compression statistics

2. **Request Compression**
   - Accept compressed requests
   - Decompress request bodies
   - Validate compressed requests
   - Compression error handling
   - Compression logging

3. **Response Compression**
   - Compress responses
   - Compression based on content type
   - Compression based on size
   - ETag support
   - Cache control

4. **Configuration**
   - Compression level
   - Compression threshold
   - Excluded content types
   - Per-route configuration
   - Environment-specific settings

## Technical Details
- Use compression middleware
- Configure compression levels
- Add compression statistics
- Monitor compression effectiveness

## Files to Create/Modify
- \`backend/src/middleware/compression.ts\` (create)
- \`backend/src/config/compression.ts\` (create)
- \`backend/src/utils/compressionUtils.ts\` (create)
- Update \`backend/src/index.ts\` to use middleware

## Acceptance Criteria
- [ ] Compression works for responses
- [ ] Compression works for requests
- [ ] Compression levels are configurable
- [ ] Statistics are tracked
- [ ] Performance is improved
- [ ] Bandwidth is reduced
- [ ] Error handling works
- [ ] Documentation is complete

## References
- Express compression: https://github.com/expressjs/compression
- Brotli compression: https://github.com/cnpm-server/brotli`,
    priority: "low"
  },

  {
    title: "[Backend] Implement CORS and Security Headers",
    labels: ["backend", "security", "middleware"],
    body: `## Overview
Implement comprehensive CORS and security headers for enhanced security.

## Current State
- Basic CORS exists
- Limited security headers
- Helmet is used but not fully configured
- Security gaps exist

## Requirements
1. **CORS Configuration**
   - Configurable origins
   - Origin whitelisting
   - Preflight handling
   - Credentials support
   - Max age configuration

2. **Security Headers**
   - Content Security Policy (CSP)
   - X-Frame-Options
   - X-Content-Type-Options
   - X-XSS-Protection
   - Strict-Transport-Security (HSTS)
   - Referrer-Policy
   - Permissions-Policy

3. **Additional Security**
   - Rate limiting headers
   - API version headers
   - Request ID headers
   - Security headers validation
   - Header monitoring

4. **Configuration**
   - Environment-specific settings
   - Per-route configuration
   - Header overrides
   - Header validation
   - Header documentation

## Technical Details
- Enhance CORS middleware
- Configure Helmet completely
- Add custom security headers
- Implement header validation

## Files to Create/Modify
- \`backend/src/middleware/cors.ts\` (enhance)
- \`backend/src/middleware/securityHeaders.ts\` (create)
- \`backend/src/config/security.ts\` (create)
- \`backend/src/utils/headerUtils.ts\` (create)
- Update \`backend/src/index.ts\` to use middleware

## Acceptance Criteria
- [ ] CORS is properly configured
- [ ] All security headers are present
- [ ] CSP is configured
- [ ] HSTS is enabled
- [ ] Headers are validated
- [ ] Configuration is flexible
- [ ] Documentation is complete
- [ ] Security audit passes

## References
- Helmet: https://helmetjs.github.io/
- CORS: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
- Security headers: https://securityheaders.com/`,
    priority: "high"
  },

  {
    title: "[Backend] Add Database Query Optimization",
    labels: ["backend", "database", "performance"],
    body: `## Overview
Optimize database queries to improve performance and reduce load.

## Current State
- Basic Prisma queries
- No query optimization
- N+1 query problems
- Slow queries exist

## Requirements
1. **Query Optimization**
   - Add database indexes
   - Optimize Prisma queries
   - Use query batching
   - Implement query caching
   - Add query analysis

2. **N+1 Problem**
   - Identify N+1 queries
   - Implement data loading
   - Use include/select efficiently
   - Batch queries
   - Query deduplication

3. **Performance Monitoring**
   - Query logging
   - Slow query detection
   - Query performance metrics
   - Query optimization suggestions
   - Performance dashboards

4. **Database Optimization**
   - Index optimization
   - Query plan analysis
   - Database statistics
   - Connection optimization
   - Schema optimization

## Technical Details
- Use Prisma query optimization
- Add database indexes
- Implement query logging
- Use DataLoader for N+1

## Files to Create/Modify
- \`backend/src/prisma/schema.prisma\` (add indexes)
- \`backend/src/utils/queryUtils.ts\` (create)
- \`backend/src/middleware/queryLogger.ts\` (create)
- \`backend/src/services/queryOptimizer.ts\` (create)
- Optimize existing queries

## Acceptance Criteria
- [ ] Indexes are added
- [ ] Queries are optimized
- [ ] N+1 problems are solved
- [ ] Query logging works
- [ ] Performance is improved
- [ ] Slow queries are detected
- [ ] Dashboards display metrics
- [ ] Documentation is complete

## References
- Prisma optimization: https://www.prisma.io/docs/guides/performance-and-optimization
- Database indexing: https://www.postgresql.org/docs/current/indexes.html
- Query optimization: https://www.postgresql.org/docs/current/performance-tips.html`,
    priority: "medium"
  },

  {
    title: "[Backend] Implement Feature Flags",
    labels: ["backend", "feature", "configuration"],
    body: `## Overview
Implement a feature flag system for controlled feature rollouts.

## Current State
- No feature flag system
- Features are always on/off
- No A/B testing capability
- No gradual rollouts

## Requirements
1. **Feature Flag Features**
   - Feature flag CRUD
   - Flag targeting (users, segments)
   - Flag rollouts (percentage)
   - Flag scheduling
   - Flag dependencies

2. **Flag Types**
   - Boolean flags
   - Multivariate flags
   - Remote config
   - A/B testing flags
   - Kill switches

3. **Integration**
   - Express middleware
   - Flag evaluation
   - Flag overrides
   - Flag analytics
   - Flag monitoring

4. **Management**
   - Admin UI for flags
   - Flag history
   - Flag audit logs
   - Flag permissions
   - Flag documentation

## Technical Details
- Use feature flag library (LaunchDarkly, Unleash, or custom)
- Implement flag evaluation
- Add flag middleware
- Create flag admin interface

## Files to Create/Modify
- \`backend/src/services/featureFlagService.ts\` (create)
- \`backend/src/models/FeatureFlag.ts\` (create)
- \`backend/src/middleware/featureFlags.ts\` (create)
- \`backend/src/routes/featureFlags.ts\` (create)
- \`backend/src/config/featureFlags.ts\` (create)

## Acceptance Criteria
- [ ] Flags can be created
- [ ] Flag evaluation works
- [ ] Targeting works
- [ ] Rollouts work
- [ ] Admin UI works
- [ ] Analytics work
- [ ] Performance is good
- [ ] Documentation is complete

## References
- LaunchDarkly: https://launchdarkly.com/
- Unleash: https://github.com/Unleash/unleash
- Feature flag best practices: https://martinfowler.com/articles/feature-toggles.html`,
    priority: "low"
  },

  {
    title: "[Backend] Add Integration Tests",
    labels: ["backend", "testing", "quality"],
    body: `## Overview
Add comprehensive integration tests for the backend API.

## Current State
- Limited test coverage
- Some unit tests exist
- No integration tests
- No end-to-end tests

## Requirements
1. **Integration Test Types**
   - API endpoint tests
   - Database integration tests
   - External service integration tests
   - Authentication flow tests
   - WebSocket integration tests

2. **Test Coverage**
   - All API endpoints
   - All database operations
   - All middleware
   - All services
   - Error scenarios

3. **Test Infrastructure**
   - Test database setup
   - Test data seeding
   - Mock external services
   - Test environment configuration
   - CI/CD integration

4. **Test Tools**
   - Supertest for API testing
   - Jest for test framework
   - Test containers for dependencies
   - Coverage reporting
   - Test reporting

## Technical Details
- Use Supertest for API testing
- Use test containers for dependencies
- Implement test database
- Add coverage reporting

## Files to Create/Modify
- \`backend/src/__tests__/integration/\` (create)
- \`backend/src/__tests__/api/\` (create)
- \`backend/src/__tests__/setup.ts\` (create)
- \`backend/jest.integration.config.js\` (create)
- Update existing tests

## Acceptance Criteria
- [ ] All endpoints have tests
- [ ] Database operations are tested
- [ ] Middleware is tested
- [ ] Error scenarios are tested
- [ ] Coverage is 80%+
- [ ] Tests run in CI
- [ ] Test data is managed
- [ ] Tests are maintainable

## References
- Supertest: https://github.com/visionmedia/supertest
- Jest: https://jestjs.io/
- Test containers: https://www.testcontainers.org/`,
    priority: "medium"
  },

  {
    title: "[Backend] Implement Docker Containerization",
    labels: ["backend", "devops", "infrastructure"],
    body: `## Overview
Implement Docker containerization for the backend application.

## Current State
- No Docker support
- Manual deployment
- Environment inconsistencies
- No containerization

## Requirements
1. **Docker Features**
   - Dockerfile for backend
   - Docker Compose for local development
   - Multi-stage builds
   - Image optimization
   - Security scanning

2. **Container Configuration**
   - Environment variables
   - Volume mounts
   - Network configuration
   - Health checks
   - Resource limits

3. **Development Workflow**
   - Local development with Docker
   - Hot reload in containers
   - Database in container
   - Redis in container
   - Easy setup

4. **Production Ready**
   - Production Dockerfile
   - Image registry
   - Image tagging
   - Security best practices
   - Documentation

## Technical Details
- Create Dockerfile
- Create docker-compose.yml
- Optimize image size
- Add health checks

## Files to Create/Modify
- \`backend/Dockerfile\` (create)
- \`backend/Dockerfile.dev\` (create)
- \`backend/docker-compose.yml\` (create)
- \`backend/.dockerignore\` (create)
- \`backend/docker-compose.prod.yml\` (create)

## Acceptance Criteria
- [ ] Docker image builds successfully
- [ ] Docker Compose works locally
- [ ] Hot reload works
- [ ] Production image is optimized
- [ ] Health checks work
- [ ] Security scanning passes
- [ ] Documentation is complete
- [ ] Image size is optimized

## References
- Docker best practices: https://docs.docker.com/develop/dev-best-practices/
- Docker Compose: https://docs.docker.com/compose/
- Multi-stage builds: https://docs.docker.com/develop/develop-images/multistage-build/`,
    priority: "medium"
  },

  {
    title: "[Backend] Add CI/CD Pipeline",
    labels: ["backend", "devops", "automation"],
    body: `## Overview
Implement a comprehensive CI/CD pipeline for automated testing and deployment.

## Current State
- No CI/CD pipeline
- Manual testing
- Manual deployment
- No automation

## Requirements
1. **CI Pipeline**
   - Automated testing
   - Code linting
   - Security scanning
   - Build verification
   - Coverage reporting

2. **CD Pipeline**
   - Automated deployment
   - Environment promotion
   - Rollback capability
   - Deployment notifications
   - Deployment monitoring

3. **Pipeline Features**
   - Multiple environments (dev, staging, prod)
   - Parallel job execution
   - Caching for speed
   - Pipeline visualization
   - Pipeline analytics

4. **Integration**
   - GitHub Actions
   - Docker integration
   - Kubernetes deployment (optional)
   - Monitoring integration
   - Alerting integration

## Technical Details
- Use GitHub Actions
- Create workflow files
- Add deployment scripts
- Implement monitoring

## Files to Create/Modify
- \`.github/workflows/ci.yml\` (create)
- \`.github/workflows/cd.yml\` (create)
- \`backend/scripts/deploy.sh\` (create)
- \`backend/scripts/rollback.sh\` (create)
- \`backend/.github/workflows/\` (create)

## Acceptance Criteria
- [ ] CI pipeline runs on push
- [ ] Tests pass in CI
- [ ] Deployment is automated
- [ ] Rollback works
- [ ] Notifications work
- [ ] Monitoring works
- [ ] Pipeline is fast
- [ ] Documentation is complete

## References
- GitHub Actions: https://docs.github.com/en/actions
- CI/CD best practices: https://www.atlassian.com/continuous-delivery/principles/continuous-integration-vs-delivery-vs-deployment`,
    priority: "high"
  }
];

// Function to generate GitHub issues
function generateIssues() {
  console.log(`Generated ${issues.length} GitHub issues for ChenAIKit`);
  console.log('\n=== ISSUE SUMMARY ===');
  console.log(`Frontend Issues: ${issues.filter(i => i.labels.includes('frontend')).length}`);
  console.log(`Backend Issues: ${issues.filter(i => i.labels.includes('backend')).length}`);
  console.log(`High Priority: ${issues.filter(i => i.priority === 'high').length}`);
  console.log(`Medium Priority: ${issues.filter(i => i.priority === 'medium').length}`);
  console.log(`Low Priority: ${issues.filter(i => i.priority === 'low').length}`);
  console.log('\n=== ISSUES ===\n');
  
  issues.forEach((issue, index) => {
    console.log(`Issue #${index + 1}: ${issue.title}`);
    console.log(`Labels: ${issue.labels.join(', ')}`);
    console.log(`Priority: ${issue.priority}`);
    console.log('---');
  });
}

// Function to create issues on GitHub using GitHub API with token
async function createIssuesOnGitHub() {
  const https = require('https');
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  
  if (!token) {
    console.error('Error: GITHUB_TOKEN or GH_TOKEN environment variable is required');
    console.error('Set it with: export GITHUB_TOKEN=your_token');
    process.exit(1);
  }

  // Get repository info from git or command line args
  const { execSync } = require('child_process');
  let repoOwner, repoName;
  
  // Check if repo owner and name are provided as command line args
  const repoArgIndex = args.indexOf('--repo');
  if (repoArgIndex !== -1 && args[repoArgIndex + 1]) {
    const repoArg = args[repoArgIndex + 1];
    const parts = repoArg.split('/');
    if (parts.length === 2) {
      repoOwner = parts[0];
      repoName = parts[1];
    }
  }
  
  // If not provided, try to get from git remote
  if (!repoOwner || !repoName) {
    try {
      const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf-8' }).trim();
      // Handle various git remote formats including custom hostnames
      const match = remoteUrl.match(/github[-\w]*[:/](.+)\/(.+?)(\.git)?$/);
      if (match) {
        repoOwner = match[1];
        repoName = match[2].replace('.git', '');
      } else {
        throw new Error('Could not parse GitHub repository URL');
      }
    } catch (error) {
      console.error('Error: Could not determine GitHub repository from git remote');
      console.error('Please specify repository with: --repo owner/repo-name');
      console.error('Example: node scripts/generate-github-issues.js --create --repo nexoraorg/chenaikit');
      process.exit(1);
    }
  }

  console.log(`Creating issues on GitHub for ${repoOwner}/${repoName}...`);
  
  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];
    const labels = issue.labels.join(',');
    
    const postData = JSON.stringify({
      title: issue.title,
      body: issue.body,
      labels: issue.labels
    });

    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: `/repos/${repoOwner}/${repoName}/issues`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `token ${token}`,
        'User-Agent': 'ChenAIKit-Issue-Generator'
      }
    };

    try {
      await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log(`✓ Created issue #${i + 1}: ${issue.title}`);
              resolve();
            } else {
              console.error(`✗ Failed to create issue #${i + 1}: ${issue.title}`);
              console.error(`  Status: ${res.statusCode}`);
              console.error(`  Response: ${data}`);
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          });
        });
        
        req.on('error', (error) => {
          console.error(`✗ Failed to create issue #${i + 1}: ${issue.title}`);
          console.error(`  Error: ${error.message}`);
          reject(error);
        });
        
        req.write(postData);
        req.end();
      });
    } catch (error) {
      console.error(`Failed to create issue #${i + 1}: ${issue.title}`);
    }
    
    // Rate limiting - wait between requests
    if (i < issues.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('\n✓ All issues created successfully!');
  console.log(`Visit https://github.com/${repoOwner}/${repoName}/issues to view them`);
}

// Main execution
const args = process.argv.slice(2);
const shouldCreate = args.includes('--create');

if (shouldCreate) {
  createIssuesOnGitHub().catch(console.error);
} else {
  generateIssues();
  
  console.log('\n=== TO CREATE ISSUES ON GITHUB ===');
  console.log('Run: GITHUB_TOKEN=your_token node scripts/generate-github-issues.js --create');
  console.log('Or: export GITHUB_TOKEN=your_token && node scripts/generate-github-issues.js --create');
  console.log('Optionally specify repo: --repo owner/repo-name');
  console.log('\nGet a GitHub token: https://github.com/settings/tokens');
  console.log('Required scopes: repo (for private repos) or public_repo (for public repos)');
}
