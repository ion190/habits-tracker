# ROOT CAUSE: Dragging/Resizing Pseudo-Instances Corrupted the Series

## The Real Issue

When you edited a recurring activity instance, past occurrences disappeared because:

1. **Pseudo-instances use the series ID**: When the calendar generates pseudo-instances for recurring activities on non-anchor dates, they use the original series' ID (spread with `...activity`)

2. **Dragging/resizing saved the wrong record**: If you accidentally dragged or resized the pseudo-instance (which looks like a regular activity), the code would save it back to the database with:
   - ID: series ID (from the pseudo-instance)
   - Date: selectedDate (not the anchor date)
   - This overwrote the original series record!

3. **Series corruption**: The series record in the database would get its date changed from the anchor date to the current viewing date, which broke the recurrence calculation for all other dates.

## Example of What Went Wrong

**Before editing:**
- Database: Series with `id: "ABC123"`, `date: "2026-05-20"`, `recurrence: {...}`
- May 20: Shows series instance ✓
- May 21: Shows series instance ✓
- May 22: Shows series instance ✓

**After accidentally dragging May 22's pseudo-instance:**
- Database: Series with `id: "ABC123"`, `date: "2026-05-22"`, `recurrence: {...}` (CORRUPTED!)
- May 20: No longer generated (before series start)
- May 21: No longer generated (before series start)
- May 22: Shows as direct activity ✗

## The Fixes Applied

### 1. **Prevent Dragging Pseudo-Instances**
```typescript
const startDrag = (e: React.MouseEvent, a: CalendarActivity) => {
  // Prevent dragging pseudo-instances
  if ((a as any).isRecurrenceInstance === true) {
    return  // Block the drag
  }
  // ... rest of drag logic
}
```

### 2. **Prevent Resizing Pseudo-Instances**
```typescript
const startResize = (e: React.MouseEvent, a: CalendarActivity) => {
  // Prevent resizing pseudo-instances
  if ((a as any).isRecurrenceInstance === true) {
    return  // Block the resize
  }
  // ... rest of resize logic
}
```

### 3. **Explicit Instance Recurrence Prevention**
```typescript
recurrence: scope === 'instance' ? undefined : (shouldBeRecurring ? {...} : undefined),
```

### 4. **Force Instance Scope for Instance Edits**
```typescript
const finalScope = isEditingInstance ? 'instance' : (...)
save(finalScope)
```

## What This Means

✅ **Pseudo-instances are now read-only for drag/resize**
- You can click to edit them (opens the form)
- You cannot drag them to move
- You cannot resize them
- The series anchor remains protected in the database

✅ **Series records are never corrupted**
- Series stays at its anchor date
- All future and past occurrences continue to work
- Recurrence calculation always works correctly

✅ **Instance editing is safe**
- Creates a standalone override activity
- Series remains completely untouched
- No data loss or corruption

## Testing

1. Create a recurring activity (e.g., "Meeting" Mon-Fri)
2. Navigate to a future occurrence (e.g., Thursday next week)
3. Try to drag it → should not move (cursor won't change)
4. Try to resize it → should not resize (bottom edge won't respond)
5. Click to edit it → opens form (this works)
6. Navigate to past dates → all instances still appear ✓

## Why Past Occurrences Appeared to Disappear

When the series record got corrupted with the current viewing date, the recurrence engine would generate instances from that "new" start date forward. So all dates before that would appear empty. This is why it looked like past occurrences were deleted - they actually just weren't being generated anymore!
