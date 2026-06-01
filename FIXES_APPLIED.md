# Calendar Recurrence Fixes Applied

## Issues Fixed

### 1. **Recurrence Not Applying When Day Has Other Activities**
**Problem:** When a day had other activities, recurring activities wouldn't apply to that day even though they should coexist.

**Solution:** Removed the suppression logic that was blocking recurring instances when a direct activity existed at the same start time. The system now allows multiple activities to coexist on the same day, regardless of overlap.

**Changes in `load()` function:**
- Removed the `directStartTimes` check that was filtering out recurring instances
- Recurring activities now always display on applicable dates
- Both recurrence instances and direct activities can coexist on the same day

### 2. **Edit Scope Checkboxes Default Behavior**
**Problem:** When editing a recurring activity, the default state wasn't clear and checkboxes weren't mutually exclusive (user could check both).

**Solution:** Changed to radio buttons with proper defaults:
- "This occurrence only" is now checked by default
- "All occurrences" is unchecked by default
- Only one can be selected at a time (radio button behavior)
- The delete button dynamically updates based on the selection

**Changes:**
- Renamed state: `instanceOnly` → `editThisOccurrenceOnly`
- Changed checkboxes to radio buttons (type="radio", name="editScope")
- Updated all references to use the new state variable

### 3. **Deleting/Editing Single Occurrences Deleted All Previous Ones**
**Problem:** When trying to edit or delete a single occurrence of a recurring activity, the code was splitting the series around that date, which effectively deleted all previous occurrences.

**Solution:** Implemented an exclusion/tombstone system instead:
- When deleting a single occurrence, create a special marker record (exclusion entry) on that date
- The exclusion entry prevents that series from appearing on that date
- The original series remains intact and continues normally
- No data loss of previous occurrences

**Key changes:**

#### In `deleteSingleOccurrence()`:
- Instead of truncating and splitting the series, now creates an exclusion record
- Exclusion records have `notes: "__EXCLUSION_FOR:<seriesId>__"` as a marker
- These are lightweight markers stored in the database

#### In `load()`:
- Filters out exclusion entries before displaying
- Collects all exclusion IDs for the current date
- Skips recurring instances that have been excluded
- Exclusion entries are invisible to the user (filter in UI)

#### In `saveActivity()` when `scope === 'instance'`:
- Simplified to NOT split the series anymore
- Just creates a direct override activity for that specific date
- The series continues as if nothing happened
- Direct activity and recurring instance coexist on that day

## Technical Details

### Exclusion Entry Structure
```typescript
{
  id: generateId(),
  title: `[EXCLUSION: ${series.id}]`,
  date: instanceDate,
  startTime: series.startTime,
  endTime: series.endTime,
  color: series.color,
  createdAt: new Date().toISOString(),
  notes: `__EXCLUSION_FOR:${series.id}__`,
  recurrence: undefined,
}
```

### Load Flow
1. Load all activities for the selected date
2. Filter out exclusion entries (by checking notes field)
3. Collect all exclusion IDs
4. Load all recurring activities from database
5. For each recurring activity:
   - Check if it applies to this date
   - Skip if excluded
   - Add to applicable list
6. Combine direct activities + applicable recurring instances
7. Sort by start time

## Benefits

✅ **Recurrences now work correctly with overlapping activities**
- Multiple activities can exist on the same day
- No more mysterious disappearing recurring activities

✅ **Clearer edit flow**
- Radio buttons make intent obvious
- "This occurrence only" is the safe default
- Cannot accidentally select both options

✅ **No data loss**
- Deleting an occurrence doesn't affect the rest of the series
- Previous occurrences remain intact and visible
- Easy to understand what happened

✅ **Better performance**
- Exclusion entries are lightweight
- No complex series splitting logic
- Simpler to reason about and maintain
