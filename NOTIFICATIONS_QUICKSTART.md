# Implementation Checklist & Quick Start

## Quick Start (5 minutes)

### 1. Get Firebase Credentials
```bash
# From Firebase Console → Project Settings → Cloud Messaging
# Copy these values:
SENDER_ID=your_firebase_messaging_sender_id
VAPID_KEY=your_web_push_certificate_public_key
```

### 2. Update .env
```env
VITE_FIREBASE_VAPID_KEY=your_vapid_key_here
VITE_API_URL=http://localhost:3001
```

### 3. Test in Browser
1. `npm run dev` - Start app
2. Go to Settings → Push Notifications
3. Click "Enable"
4. Accept browser permission prompt
5. Check console for token registration success

### 4. Send Test Notification
Go to Firebase Console → Messaging → Send Your First Message
- Title: "Test Notification"
- Body: "If you see this, it works!"
- Send to topic or device token
- Check browser for notification

## Files Created/Modified

### New Files Created
```
public/sw.js                          # Service worker (push notifications)
public/manifest.json                  # PWA manifest (updated)
src/db/fcm.ts                        # Firebase Cloud Messaging setup
src/db/notificationApi.ts            # API client for notifications
src/components/NotificationsContext.tsx  # React context for notifications
src/components/NotificationSettings.tsx  # Settings UI component
PUSH_NOTIFICATIONS.md                # Full documentation
```

### Files Modified
```
index.html                           # Added manifest link
src/App.tsx                          # Added NotificationsProvider
src/pages/Settings.tsx               # Added notification settings section
src/db/firebase.ts                   # Exported app instance
backend/server.ts                    # Added notification endpoints
```

## Implementation Details

### 1. Service Worker (`public/sw.js`)
Handles background operations:
- `push` event - Display notifications
- `notificationclick` - Navigate to relevant page
- `sync` - Background sync for pending notifications
- `periodicsync` - Check for due activities

### 2. Frontend Initialization
```
NotificationsProvider (App.tsx)
    ├─ Check browser support
    ├─ Request permission (if needed)
    ├─ Register service worker
    ├─ Get FCM device token
    └─ Set up foreground message handler
```

### 3. Backend APIs
```
POST /api/notifications/register-token
POST /api/notifications/unregister-token
GET  /api/notifications/preferences/:userId
PUT  /api/notifications/preferences/:userId
POST /api/notifications/send
GET  /api/notifications/devices/:userId
```

### 4. Token Flow
```
User clicks "Enable"
    ↓
Browser requests permission
    ↓
Service Worker registered
    ↓
FCM device token obtained
    ↓
POST /api/notifications/register-token
    ↓
Backend stores token → sends notifications to it
```

## Notification Types

The system supports notifications for:
- **Tasks** - Task reminders and due dates
- **Habits** - Habit reminders and milestones
- **Workouts** - Workout reminders and session alerts
- **Custom** - Any custom notification from backend

## Testing Checklist

- [ ] Notifications work on desktop (Chrome/Firefox)
- [ ] Install app to home screen (Android)
- [ ] Notifications work when app is closed
- [ ] Clicking notification navigates to correct page
- [ ] Permission prompt appears on first request
- [ ] Can enable/disable in settings
- [ ] Can filter by notification type
- [ ] Foreground notifications display (even with app open)
- [ ] Service worker appears in DevTools
- [ ] No console errors

## Common Issues & Solutions

### Issue: "Notifications not supported"
**Solution:** 
- Check browser version (needs Chrome 50+, Firefox 48+)
- Verify HTTPS in production (localhost works in dev)

### Issue: Service worker not registering
**Solution:**
```javascript
// Check in DevTools → Application → Service Workers
// Common causes:
// 1. sw.js not in public/ folder
// 2. HTTPS not enabled in production
// 3. Browser doesn't support service workers
```

### Issue: Token not registering with backend
**Solution:**
1. Check browser console for errors
2. Check backend logs: `console.log('[Notifications]...')`
3. Verify JWT token is valid
4. Check CORS is enabled for `/api/notifications/` endpoints

### Issue: Firebase credentials invalid
**Solution:**
```
1. Firebase Console → Project Settings
2. Cloud Messaging tab
3. Copy correct SENDER_ID and VAPID_KEY
4. Check .env file has correct format
```

## Next Steps

### To Send Notifications from Tasks/Habits:

1. **When user marks task as due:**
```typescript
// In Tasks.tsx or backend
const tasksDue = tasks.filter(t => isTaskDueSoon(t))
for (const task of tasksDue) {
  await sendNotification({
    userId: user.uid,
    type: 'task',
    title: '📋 Task Due',
    body: task.title,
    data: { url: '/tasks', taskId: task.id }
  }, authToken)
}
```

2. **When user completes habit milestone:**
```typescript
// In Habits.tsx or backend
if (habit.currentStreak === 7) {
  await sendNotification({
    userId: user.uid,
    type: 'habit',
    title: '🔥 7-Day Streak!',
    body: `Great job on your ${habit.name} streak!`,
    data: { url: '/habits', habitId: habit.id }
  }, authToken)
}
```

3. **Scheduled notifications (backend cron):**
```typescript
// Backend cron job (using node-cron or similar)
schedule('0 8 * * *', async () => {
  // Get all tasks due today
  // Send notifications to each user
  for (const task of tasksDueToday) {
    await sendNotification(task, user.token)
  }
})
```

## Production Deployment

### Checklist
- [ ] HTTPS enabled
- [ ] VAPID key from Firebase
- [ ] .env variables set
- [ ] service-worker verified
- [ ] Firebase Admin SDK setup (for backend notification sending)
- [ ] CORS configured for notification endpoints
- [ ] Database to store device tokens (replace in-memory store)
- [ ] Rate limiting on notification endpoints
- [ ] Monitoring/logging for failed notifications

### Firebase Admin SDK Setup (Backend)
```typescript
import admin from 'firebase-admin'

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'your-project-id'
})

async function sendToDevice(deviceToken: string, notification: any) {
  return await admin.messaging().send({
    token: deviceToken,
    notification,
    webpush: {
      notification: {
        icon: '/logo.png',
        badge: '/logo.png',
      }
    }
  })
}
```

## Platform-Specific Notes

### Desktop Web
- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Limited support (macOS 16+)

### Mobile Web (PWA)
- Android Chrome: Full support (install to home screen)
- Android Firefox: Full support
- iOS Safari: Limited (16+, app must be installed, background limited)

## Documentation

Full documentation available in [PUSH_NOTIFICATIONS.md](./PUSH_NOTIFICATIONS.md)
