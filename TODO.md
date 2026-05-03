# Habits Tracker - UI Reorganization: Right Sidebar Habits + Activities to Dashboard Main

## Plan Steps (Approved)
1. [ ] Create TODO.md with steps (DONE)
2. [x] Edit src/components/RightSidebar.tsx: Remove "Today's activities" rs-card completely
3. [x] Edit src/components/RightSidebar.tsx: Add new "Habits" rs-card with quick-toggle list (colored dot, habit name, ✓/✗ toggle button; use toggleHabit, support quota modal)
4. [x] Edit src/pages/Dashboard.tsx: Replace dynamic card with dedicated "Today's Activities" section (always show list, even empty; include tomorrow if no today)
5. [x] Test changes: Run `npm run dev`, verify Dashboard main has prominent activities, RightSidebar has habits toggles (no activities), toggles work/sync
6. [ ] Update TODO.md with completion (mark done)
7. [ ] Attempt completion

**Current Progress:** Starting edits...

**Notes:** 
- Habits section mirrors Dashboard's toggleHabit logic (dot color from habit.color, quota modal).
- Activities always visible in main, prioritized over tasks fallback.

