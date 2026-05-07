- [ ] 0. Get understanding the user task by analyzing it!
- [ ] 1. search_files: search relevant files in case repo is large
- [ ] 2. read_file: inspect candidate files
- [ ] 3. brainstorm_plan: comprehensive plan (calendar + dots + templates)

- [x] Implement JournalPage mini calendar with journal “dots”

  - [ ] Add mini month calendar UI to `src/pages/JournalPage.tsx`
  - [ ] Load journal entries for selected `period` and compute dot availability per day
  - [ ] Dot logic:
    - [ ] daily: dot if entry exists for that exact day
    - [ ] weekly/monthly/quarterly/yearly/decadely: expand each journal `dateKey` into a covered day range and dot if day is inside range
  - [ ] Clicking a calendar day should map to correct journal key:
    - [ ] daily: set `dateKey` to clicked day
    - [ ] non-daily: set `dateKey` to `dateKeyForPeriod(period, clickedDay)`
  - [ ] Verify performance (only compute dots for visible month)
  - [ ] Smoke test in dev server

