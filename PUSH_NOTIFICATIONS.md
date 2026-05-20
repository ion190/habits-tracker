# Push Notifications Implementation Guide

This document explains the push notification system for the Habits Tracker app, supporting both desktop web and mobile web app (PWA) installations.

## Architecture Overview

The notification system uses **Firebase Cloud Messaging (FCM)** to deliver push notifications across platforms. The implementation consists of:

1. **Frontend (React)** - Manages user permissions, service worker registration, and token management
2. **Service Worker** - Handles background push notifications
3. **Backend (Express)** - Manages device tokens and notification preferences
4. **Firebase Cloud Messaging** - Sends push notifications to registered devices

## Components

### Frontend Files

#### `src/db/fcm.ts` - Firebase Cloud Messaging Setup
- **`initFCM()`** - Initialize FCM messaging instance
- **`requestNotificationPermission()`** - Request user permission and get device token
- **`getDeviceToken()`** - Get or generate FCM device token
- **`setupForegroundHandler()`** - Listen for messages when app is in foreground
- **`getNotificationPermission()`** - Check current notification permission status

#### `src/components/NotificationsContext.tsx` - React Context
- Provides global notification state management
- Exports `useNotifications()` hook for accessing notification functionality
- Manages permission status, enabled state, and token caching
- Automatically sets up foreground message handling

#### `src/components/NotificationSettings.tsx` - UI Component
- User-facing settings for push notifications
- Enable/disable notifications
- Configure notification types (tasks, habits, workouts)
- Display device registration status

#### `src/db/notificationApi.ts` - API Client
- **`registerDeviceToken()`** - Register device token with backend
- **`unregisterDeviceToken()`** - Unregister device (opt-out)
- **`sendNotification()`** - Send test notifications (admin)
- **`getNotificationPreferences()`** - Fetch user preferences
- **`updateNotificationPreferences()`** - Update user preferences

### Service Worker

#### `public/sw.js` - Service Worker Script
Handles background operations:
- **Push notifications** - Receives and displays notifications even when app is closed
- **Notification clicks** - Routes user to relevant page when notification is clicked
- **Background sync** - Syncs pending notifications when connection is restored
- **Periodic sync** - Periodically checks for upcoming activities (tasks, habits)

### Backend Endpoints

All endpoints require JWT authentication (Bearer token in Authorization header).

#### Notification Endpoints

**POST `/api/notifications/register-token`**
- Register a device token for a user
- Body: `{ userId, token, platform, userAgent }`
- Returns: `{ success, message }`

**POST `/api/notifications/unregister-token`**
- Unregister a device token
- Body: `{ userId, token }`
- Returns: `{ success, message }`

**GET `/api/notifications/preferences/:userId`**
- Get user's notification preferences
- Returns: `{ userId, enabledNotifications, notificationTypes, quietHours... }`

**PUT `/api/notifications/preferences/:userId`**
- Update user's notification preferences
- Body: `{ enabledNotifications, notificationTypes, quietHours... }`
- Returns: `{ success, message, data }`

**POST `/api/notifications/send`**
- Send notification to user devices
- Body: `{ userId, type, title, body, data }`
- Returns: `{ success, messageId, deviceCount }`

**GET `/api/notifications/devices/:userId`**
- List user's registered devices
- Returns: `{ userId, deviceCount, devices: [...] }`

## Setup Instructions

### 1. Firebase Configuration

#### Enable Firebase Cloud Messaging in Firebase Console:
1. Go to Firebase Console → Your Project
2. Navigate to **Messaging** in the left menu
3. Click **Create Credentials** if needed
4. Go to **Project Settings** → **Cloud Messaging** tab
5. Copy the **Server API Key** (for backend to send notifications)
6. Copy the **Sender ID** (already in `VITE_FIREBASE_MESSAGING_SENDER_ID`)

#### Get Web Push Certificate:
1. In Cloud Messaging settings, click **Generate Key Pair** under "Web Credentials"
2. Copy the public key (VAPID key)
3. Add to `.env`:
   ```
   VITE_FIREBASE_VAPID_KEY=your_vapid_key_here
   ```

### 2. Environment Variables

Add to your `.env` file:

```env
# Firebase Config (existing)
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# FCM Web Push
VITE_FIREBASE_VAPID_KEY=your_vapid_key_here

# API endpoint
VITE_API_URL=http://localhost:3001
```

### 3. PWA Manifest

The `public/manifest.json` is already configured with:
- App name and icons
- Display mode (standalone - full screen)
- Theme colors
- Categories

### 4. Register NotificationsProvider

Already done in `src/App.tsx`:
```tsx
<BrowserRouter>
  <AuthProvider>
    <NotificationsProvider>
      <AppShell />
    </NotificationsProvider>
  </AuthProvider>
</BrowserRouter>
```

## Usage Examples

### In React Components

```tsx
import { useNotifications } from '@/components/NotificationsContext'

function MyComponent() {
  const { isEnabled, requestPermission, token } = useNotifications()

  const handleEnableNotifications = async () => {
    const granted = await requestPermission()
    if (granted) {
      console.log('Notifications enabled!')
    }
  }

  return (
    <button onClick={handleEnableNotifications}>
      {isEnabled ? 'Notifications ON' : 'Enable Notifications'}
    </button>
  )
}
```

### Sending Notifications from Backend

```typescript
import admin from 'firebase-admin'

// Initialize Firebase Admin SDK
admin.initializeApp()

async function sendNotification(deviceToken: string, title: string, body: string) {
  const message = {
    notification: {
      title,
      body,
    },
    webpush: {
      notification: {
        icon: '/logo.png',
        badge: '/logo.png',
        tag: 'habits-tracker',
      },
    },
    token: deviceToken,
  }

  const response = await admin.messaging().send(message)
  console.log('Sent notification:', response)
}
```

### Registering Device Token

```typescript
import { getOrRequestToken } from '@/db/fcm'
import { registerDeviceToken } from '@/db/notificationApi'

async function setupNotifications(userId: string, authToken: string) {
  const token = await getOrRequestToken()
  if (token) {
    await registerDeviceToken(userId, token, 'web', authToken)
  }
}
```

## Platform Support

### Desktop Web
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ⚠️ Safari (limited support)

### Mobile Web (PWA)
- ✅ Android Chrome
- ✅ Android Firefox
- ⚠️ iOS 16+ (limited - notification permission in Safari only, limited background capability)

## Testing Notifications

### 1. Using Firebase Console
1. Go to Firebase Console → Messaging
2. Click "Send your first message"
3. Select "Send to a topic" or "Send to users"
4. Enter notification details
5. Target by user ID or device token

### 2. Using Backend API
```bash
curl -X POST http://localhost:3001/api/notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "userId": "user_123",
    "type": "task",
    "title": "Task Reminder",
    "body": "Your task is due soon",
    "data": {"taskId": "task_456"}
  }'
```

### 3. Test in Development
1. Open the app in your browser
2. Go to Settings → Push Notifications
3. Click "Enable"
4. Grant notification permission when prompted
5. Use Firebase Console to send a test message

## Permission Handling

### User Flow

```
User opens app
    ↓
NotificationsProvider initializes
    ↓
Check if notifications supported (Notification API + Service Worker)
    ↓
Check permission status
    ↓
If "granted" → FCM initialized, token obtained
If "denied" → Show option to enable in settings
If "default" → Show "Enable" button in Settings
    ↓
User clicks "Enable Notifications"
    ↓
Service Worker registered
    ↓
Browser shows permission prompt
    ↓
User allows/denies
    ↓
If allowed → Device token registered with backend
If denied → Show info message
```

### Error Handling

The system gracefully handles:
- Unsupported browsers (no Notification API)
- Permission denied by user
- Service Worker registration failures
- FCM initialization errors
- Network errors during token registration

## Background Sync & Periodic Sync

The service worker supports:

**Background Sync** - Resync pending notifications after connection restored
```javascript
// Triggered by: offline → online
// Syncs tag: 'sync-notifications'
```

**Periodic Sync** - Check for due activities periodically
```javascript
// Triggered by: periodic check (every 12-24 hours, browser decides)
// Syncs tag: 'check-activities'
// Fetches: /api/activities/pending
```

## Notification Data Structure

When sending a notification:

```json
{
  "title": "Task Reminder",
  "body": "Complete your daily task",
  "type": "task",
  "tag": "task-123",
  "data": {
    "url": "/tasks/task-123",
    "itemId": "task-123",
    "itemType": "task"
  },
  "requireInteraction": false
}
```

### Data Fields
- **url** - Where to navigate when notification is clicked
- **itemId** - ID of the related item (task/habit/workout)
- **itemType** - Type of item (task/habit/workout)

## Troubleshooting

### Notifications not appearing
1. Check browser console for errors
2. Verify notification permission is "granted"
3. Verify service worker is registered: DevTools → Application → Service Workers
4. Check VAPID key is correct in `.env`

### Device token issues
1. Check backend logs for token registration errors
2. Verify JWT token is valid
3. Check network tab for failed API requests
4. Clear cached token: `localStorage.removeItem('fcm_token')`

### Service Worker issues
1. Check if browser supports Service Workers
2. Use HTTPS (required for production)
3. Check DevTools → Application → Service Workers
4. Look for registration errors in console

## Performance Considerations

- **Token caching** - Device tokens cached in localStorage
- **Lazy initialization** - FCM only initialized if notifications supported
- **No blocking** - Token registration doesn't block app initialization
- **Background processing** - Service worker handles notifications without main thread

## Security

- All endpoints require JWT authentication
- Device tokens are user-specific
- Tokens are invalidated on logout
- HTTPS required for production
- VAPID key protects from unauthorized senders

## Future Enhancements

- [ ] Quiet hours support (don't notify during certain times)
- [ ] Notification grouping by type
- [ ] Rich notifications with images/actions
- [ ] Badge counts on app icon
- [ ] Scheduled notifications
- [ ] Notification history/archive
- [ ] Unsubscribe from specific notification types
- [ ] Integration with Firestore Cloud Messaging for auto-send
