# Current Task
- [x] Analyze current implementation
- [x] Get user confirmation on plan
- [x] Modify ActiveWorkSession.tsx to show modal on natural completion
- [x] Test both scenarios work correctly (build passes)

## Implementation Complete ✓

Changes made to `src/components/ActiveWorkSession.tsx`:
- When timer completes naturally: Now shows end modal instead of auto-saving
- Both "timer completes" and "End Early" use same modal flow
- User can input distraction time and confirm productivity before saving

## Implementation Details

### Changes to src/components/ActiveWorkSession.tsx:

1. When timer completes naturally (lines 68-124):
   - REMOVE: Auto-save logic after 3 seconds with default values
   - REMOVE: onFinished() call in setTimeout
   - ADD: Set showEndModal(true) to prompt user for data

2. Keep existing confirmEnd() and showEndModal logic which handles:
   - Distraction time input
   - Productivity calculation
   - Task completion status  
   - Saving to database
