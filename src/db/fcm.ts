// src/db/fcm.ts - Firebase Cloud Messaging setup for push notifications

import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging'
import { app } from './firebase'

export interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  data?: Record<string, string>
  requireInteraction?: boolean
}

let messaging: Messaging | null = null

// Initialize FCM
export function initFCM(): Messaging {
  if (!messaging) {
    messaging = getMessaging(app)
  }
  return messaging
}

// Request notification permission and get device token
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.warn('[FCM] Notifications not supported by browser');
      return null;
    }

    // Check if already have permission
    if (Notification.permission === 'granted') {
      return await getDeviceToken();
    }

    // Request permission
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        return await getDeviceToken();
      }
    }

    console.log('[FCM] Notification permission denied');
    return null;
  } catch (error) {
    console.error('[FCM] Error requesting notification permission:', error);
    return null;
  }
}

// Get or refresh the device token
export async function getDeviceToken(): Promise<string | null> {
  try {
    // Register service worker first
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });
        console.log('[FCM] Service worker registered:', registration);
      } catch (error) {
        console.error('[FCM] Service worker registration failed:', error);
      }
    }

    const msg = initFCM();
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

    if (!vapidKey) {
      console.warn('[FCM] VAPID key not configured');
      return null;
    }

    const token = await getToken(msg, {
      vapidKey,
      serviceWorkerRegistration: await navigator.serviceWorker.ready,
    });

    if (token) {
      console.log('[FCM] Device token obtained:', token.substring(0, 20) + '...');
      // Cache token locally
      localStorage.setItem('fcm_token', token);
      return token;
    }

    console.warn('[FCM] Failed to get device token');
    return null;
  } catch (error) {
    console.error('[FCM] Error getting device token:', error);
    return null;
  }
}

// Get cached token or request new one
export async function getOrRequestToken(): Promise<string | null> {
  const cached = localStorage.getItem('fcm_token');
  if (cached) return cached;

  const token = await getDeviceToken();
  if (token) {
    localStorage.setItem('fcm_token', token);
  }
  return token;
}

// Listen for messages when app is in foreground
export function setupForegroundHandler(
  onNotification: (payload: NotificationPayload) => void
): () => void {
  try {
    const msg = initFCM()

    const unsubscribe = onMessage(msg, (message: any) => {
      console.log('[FCM] Message received in foreground:', message)

      const notification: NotificationPayload = {
        title: message.notification?.title || 'Habits Tracker',
        body: message.notification?.body || 'New notification',
        icon: message.notification?.icon,
        badge: message.notification?.icon,
        tag: message.data?.tag,
        data: message.data,
      }

      // Show browser notification even in foreground
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.body,
          icon: notification.icon || '/logo.png',
          badge: notification.badge || '/logo.png',
          tag: notification.tag,
          data: notification.data,
        })
      }

      onNotification(notification)
    })

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  } catch (error) {
    console.error('[FCM] Error setting up foreground handler:', error)
    return () => {}
  }
}

// Check notification permission status
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

// Clear cached token
export function clearCachedToken(): void {
  localStorage.removeItem('fcm_token');
}
