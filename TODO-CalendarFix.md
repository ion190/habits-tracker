# CalendarPage Fixed ✅

**Fixed:**
- TypeError: selectRef.current null → tempStartMin/tempEndMin state + guards
- Firestore sync error → Fixed docRef path format in sync.ts
- UI: snap selection preview, overlap stacking, responsive mobile, form duration

**Status:** Complete. Run `npm run dev`, test /calendar:
1. Drag-select (snaps 15min)
2. Drag/resize activities  
3. Mobile resize (<800px)
4. Add activity → sync (no Firestore errors)
