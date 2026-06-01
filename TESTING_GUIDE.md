# Testing Guide for Recurrence Fixes

## Test Scenario 1: Recurrence with Overlapping Activities

1. Create a recurring activity (e.g., "Daily Meeting" 9:00-10:00, repeats daily)
2. On one of the recurrence dates, add another activity (e.g., "Coffee Break" 9:30-10:30)
3. **Expected:** Both activities appear on that day - they don't cancel each other out
4. **Before fix:** The recurring activity would disappear on days with other activities
5. **After fix:** Both activities coexist on the calendar

## Test Scenario 2: Edit Scope Defaults

1. Click on a recurring activity instance to edit it
2. **Expected in Edit form:**
   - "This occurrence only" radio button is CHECKED by default
   - "All occurrences" radio button is unchecked
   - Only one radio button can be selected at a time
   - Changing one automatically unchecks the other
3. **Before fix:** Checkboxes could both be checked
4. **After fix:** Radio buttons ensure mutually exclusive selection

## Test Scenario 3: Delete Single Occurrence

1. Create a recurring activity (e.g., "Gym" Mon-Fri, 7:00-8:00)
2. Run it for 2+ weeks to have multiple instances
3. Click on an occurrence in the middle of the series (e.g., Week 2 Wednesday)
4. Click "Delete this occurrence" button
5. **Expected:**
   - Only that specific instance disappears
   - All other instances (before AND after) still appear
   - Series continues normally
6. **Before fix:** Deleting Wed would remove all instances before it (Mon, Tue) as well
7. **After fix:** Only Wed is removed, Mon, Tue, Thu, Fri of same week + all other weeks remain

## Test Scenario 4: Edit Single Occurrence

1. Create recurring activity "Team Standup" Mon-Fri, 10:00-11:00
2. Click on a specific occurrence to edit it
3. Select "This occurrence only" (should be default)
4. Change the title to "Team Standup - Cancelled" or different time
5. Save
6. **Expected:**
   - That specific day shows the edited activity
   - All other dates still show the original "Team Standup" activity
   - Original recurring series is not modified
7. **Before fix:** Editing would require splitting series, risking data loss
8. **After fix:** Simple override, original series intact

## Test Scenario 5: Edit Full Series

1. Create recurring activity "Yoga" with specific times
2. Click on any instance
3. Select "All occurrences" radio button
4. Change the time (e.g., 6:00-7:00 → 7:00-8:00)
5. Save
6. **Expected:**
   - All instances change to new time
   - Series anchor is updated
   - No new activities created
7. **Note:** This should work the same as before - it's the safest operation

## Test Scenario 6: Multiple Edits to Same Occurrence

1. Create recurring "Meeting" Mon 14:00-15:00
2. First edit: Change only Monday's instance (select "This occurrence only")
3. Second edit: Click on same Monday and edit again (select "This occurrence only" again)
4. **Expected:**
   - Second edit updates the Monday override
   - No duplicate entries
   - Original series unchanged
5. **Before fix:** Could create multiple overlapping overrides
6. **After fix:** Clean single override per date

---

## Verification Checklist

- [ ] Recurrences appear on days with other activities
- [ ] Edit form defaults show "This occurrence only" checked
- [ ] Only one radio button can be selected
- [ ] Deleting occurrence doesn't remove previous occurrences
- [ ] Series remains visible on all other dates
- [ ] Editing one occurrence doesn't affect others
- [ ] Re-editing same occurrence replaces previous override
- [ ] Calendar displays without visual glitches
- [ ] No console errors
- [ ] Database sync completes successfully
