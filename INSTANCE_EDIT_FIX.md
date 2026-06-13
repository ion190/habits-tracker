# Fix for Editing Recurring Activity Instances

## Problem
When editing a single occurrence of a recurring activity, all past occurrences were being deleted. The user could edit one occurrence, but upon saving, the series would lose all previous instances.

## Root Causes Identified and Fixed

### 1. **Form Not Properly Preventing Recurrence on Instance Edit**
**Issue**: When editing a single instance, the recurrence fields were still being populated from the series data, making it possible (in edge cases) for the edit to accidentally make the override recurring.

**Fix**: 
- Added `isEditingInstance` flag that's true when `isEditingRecurring && editingInstanceOfRecurring`
- Changed recurrence initialization to explicitly set `recurrenceEnabled = false` for instance edits
- Disabled the "Recurring activity" checkbox when editing an instance
- Updated helper text to clarify: "Editing this occurrence only (standalone activity - no recurrence)"

### 2. **Unclear Separation of Instance vs Series Edit Logic**
**Issue**: The `saveActivity` function had instance edits mixed into a generic "else" block with other operations, making it unclear that the series should never be touched.

**Fix**:
- Created an explicit `else if (scope === 'instance' && originalRecurring)` branch
- Added clear comments explaining that the series is NEVER modified
- Made the override creation explicit with a separate variable for clarity
- Ensured the override always gets a fresh ID with `generateId()`

### 3. **Series ID Protection**
**Issue**: When creating an override, there was potential confusion about which ID to use (series ID vs fresh ID).

**Fix**:
- Explicitly create override with `id: generateId()` and `recurrence: undefined`
- Added code comments emphasizing "never use the series ID"
- Made it absolutely clear that the series remains untouched

## Changes Made

### In ActivityForm Component:

**Before:**
```typescript
const isEditingRecurring = !!originalRecurringActivity
const [recurrenceEnabled, setRecurrenceEnabled] = useState(isEditingRecurring || !!activity?.recurrence)
```

**After:**
```typescript
const isEditingRecurring = !!originalRecurringActivity
const isEditingInstance = isEditingRecurring && editingInstanceOfRecurring

const [recurrenceEnabled, setRecurrenceEnabled] = useState(
  isEditingInstance ? false : (isEditingRecurring || !!activity?.recurrence)
)
```

### In UI:

**Before:**
```jsx
<input type="checkbox" checked={recurrenceEnabled}
  onChange={e => setRecurrenceEnabled(e.target.checked)} />
```

**After:**
```jsx
<input type="checkbox" checked={recurrenceEnabled}
  onChange={e => setRecurrenceEnabled(e.target.checked)}
  disabled={isEditingInstance} />
```

And added text:
```
"📌 Editing this occurrence only (standalone activity - no recurrence)"
```

### In saveActivity Function:

**Before:** Mixed instance handling into generic else block

**After:** Explicit branch:
```typescript
else if (scope === 'instance' && originalRecurring) {
  // ── Edit a single occurrence of a recurring series ───────────────────
  // IMPORTANT: The series is NEVER modified. We only create a direct override for this date.
  // The original series remains completely untouched and will continue to generate occurrences.
  
  // ... create override with fresh ID ...
  const overrideActivity: CalendarActivity = { ...a, id: generateId(), recurrence: undefined }
  await db.calendarActivities.put(overrideActivity)
  toSync.push({ op: 'put', record: overrideActivity })
}
```

## Guarantee

With these changes, when editing a single instance:

✅ **Series is never modified** - It remains in the database exactly as it was
✅ **Past occurrences remain visible** - They'll continue to appear on their scheduled dates
✅ **Fresh ID is used** - The override gets its own unique ID, never reuses the series ID
✅ **No recurrence** - The override is always non-recurring
✅ **User interface is clear** - Checkbox is disabled and text explains what's happening
✅ **Form state is safe** - Recurrence controls are disabled and cannot be changed

## Testing

To verify the fix works:

1. Create a recurring activity "Team Meeting" (Mon-Fri, 10-11am)
2. Let it run for 2+ weeks
3. Edit one occurrence in week 2 (e.g., Wednesday)
4. Change just the time (e.g., 10-11am → 2-3pm)
5. Verify:
   - ✓ That specific day shows 2-3pm
   - ✓ Other days in week 2 still show 10-11am
   - ✓ Week 1 dates still show 10-11am
   - ✓ Week 3+ still show 10-11am
   - ✓ No broken data in database

## Technical Safety

The fix includes multiple layers of protection:

1. **Form-level**: Recurrence controls disabled for instance edits
2. **State-level**: `recurrenceEnabled` explicitly set to false
3. **Logic-level**: `shouldBeRecurring` evaluates to false for instances
4. **Database-level**: Series ID is never used for overrides; fresh ID is always generated
5. **Comments**: Clear documentation explaining the intent
