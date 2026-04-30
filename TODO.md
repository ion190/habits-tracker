# Fix Work Session Start Button + Add to RightSidebar/Dashboard

## Steps:
- [x] 1. Update src/pages/WorkSessions.tsx: Add showStartModal state, change "Start session" button to open StartWorkSessionModal instead of ActiveWorkSession directly. Wire onStarted to set localStorage + showActive. Remove localStorage hack modal. Add 'workSessionStatusChange' listener.

Current: Step 2 Dashboard.tsx.
- [ ] 2. Update src/pages/Dashboard.tsx: Use existing showStartSession state + add "Start Work Session" button (stats section or header). Add active banner if localStorage has active session. Add event listener.
- [ ] 3. Update src/components/RightSidebar.tsx: Add activeWorkSession check (mirror workout logic). Show "🧠 Active work session" banner or "🧠 Start work session" button. Trigger modal via localStorage flag.
- [ ] 4. Minor: App.tsx - Add global listener in DashboardPage for consistent active state (optional).
- [ ] 5. Test: Run dev server, verify buttons open modal → start session → timer runs → saves to DB. Check RightSidebar/Dashboard banners.
- [ ] 6. attempt_completion

Current: Starting step 1.
