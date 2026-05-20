// public/sw.js - Service Worker for push notifications

const NOTIFICATION_CLICK_TAG = 'habits-tracker-notification';

// Handle push notifications
self.addEventListener('push', event => {
  if (!event.data) {
    console.log('[SW] Push received but no data');
    return;
  }

  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'New notification from Habits Tracker',
      icon: '/logo.png',
      badge: '/logo.png',
      tag: data.tag || NOTIFICATION_CLICK_TAG,
      data: data.data || {},
      vibrate: [200, 100, 200],
      requireInteraction: data.requireInteraction || false,
    };

    if (data.title) {
      event.waitUntil(self.registration.showNotification(data.title, options));
    }
  } catch (error) {
    console.error('[SW] Error handling push:', error);
    // Fallback for non-JSON payloads
    event.waitUntil(
      self.registration.showNotification('Habits Tracker', {
        body: event.data.text(),
        icon: '/logo.png',
        badge: '/logo.png',
      })
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      // Check if app is already open in a window
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not open, open new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', event => {
  console.log('[SW] Notification closed:', event.notification.tag);
});

// Background sync for offline scenarios
self.addEventListener('sync', event => {
  if (event.tag === 'sync-notifications') {
    event.waitUntil(
      fetch('/api/notifications/sync')
        .then(res => res.json())
        .then(data => {
          if (data.notifications && data.notifications.length > 0) {
            data.notifications.forEach((notif: any) => {
              self.registration.showNotification(notif.title, {
                body: notif.body,
                icon: '/logo.png',
                badge: '/logo.png',
                tag: notif.tag,
                data: notif.data,
              });
            });
          }
        })
        .catch(err => console.error('[SW] Sync failed:', err))
    );
  }
});

// Periodic background sync (for checking new tasks/habits)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'check-activities') {
    event.waitUntil(
      fetch('/api/activities/pending')
        .then(res => res.json())
        .then(data => {
          if (data.activities && data.activities.length > 0) {
            const title = `${data.activities.length} activity${data.activities.length > 1 ? 'ies' : ''} due`;
            self.registration.showNotification(title, {
              body: data.activities.map((a: any) => a.name).join(', '),
              icon: '/logo.png',
              badge: '/logo.png',
              tag: 'pending-activities',
              data: { url: '/dashboard' },
            });
          }
        })
        .catch(err => console.error('[SW] Activity check failed:', err))
    );
  }
});
