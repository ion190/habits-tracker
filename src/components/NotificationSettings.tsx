// src/components/NotificationSettings.tsx - UI for notification permissions and settings

import { useEffect, useState } from 'react'
import { useNotifications } from './NotificationsContext'
import { registerDeviceToken, unregisterDeviceToken, getNotificationPreferences, updateNotificationPreferences } from '../db/notificationApi'
import { auth } from '../db/firebase'

export default function NotificationSettings() {
  const { isSupported, permission, isEnabled, token, requestPermission, disableNotifications } = useNotifications()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [notifTypes, setNotifTypes] = useState({
    tasks: true,
    habits: true,
    workouts: true,
  })

  // Load notification preferences on mount
  useEffect(() => {
    if (!auth.currentUser?.uid || !isEnabled) return

    setLoading(true)
    getNotificationPreferences(auth.currentUser.uid)
      .then(prefs => {
        setNotifTypes(prefs.notificationTypes)
      })
      .catch(err => console.error('Failed to load preferences:', err))
      .finally(() => setLoading(false))
  }, [isEnabled])

  const handleEnableNotifications = async () => {
    if (!isSupported) {
      setError('Notifications are not supported by your browser')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const granted = await requestPermission()

      if (granted && token) {
        const user = auth.currentUser
        if (!user) throw new Error('Not authenticated')

        // Register device token with backend
        const authToken = await user.getIdToken()
        await registerDeviceToken(user.uid, token, 'web', authToken)
        setSuccess('Push notifications enabled!')
      } else if (!granted) {
        setError('Notification permission was denied')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleDisableNotifications = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const user = auth.currentUser
      if (!user || !token) throw new Error('Cannot disable notifications')

      const authToken = await user.getIdToken()
      await unregisterDeviceToken(user.uid, token, authToken)

      disableNotifications()
      setSuccess('Push notifications disabled')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdatePreferences = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const user = auth.currentUser
      if (!user) throw new Error('Not authenticated')

      const authToken = await user.getIdToken()
      await updateNotificationPreferences(user.uid, { notificationTypes: notifTypes }, authToken)
      setSuccess('Notification preferences updated')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (!isSupported) {
    return (
      <div style={{ padding: '12px', background: '#fee2e2', borderRadius: '8px', border: '1px solid #fca5a5', color: '#991b1b' }}>
        <p>Notifications are not supported on this device or browser</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Status Section */}
      <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Push Notifications</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: '4px 0', fontSize: '13px' }}>
              Status: <strong>{isEnabled ? '✅ Enabled' : '⏸ Disabled'}</strong>
            </p>
            <p style={{ margin: '4px 0', fontSize: '12px', color: 'var(--text-dim)' }}>
              Permission: {permission === 'granted' ? '✓ Granted' : permission === 'denied' ? '✗ Denied' : 'Not requested'}
            </p>
          </div>
          <button
            onClick={isEnabled ? handleDisableNotifications : handleEnableNotifications}
            disabled={loading}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: isEnabled ? '#dc2626' : '#16a34a',
              color: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Processing...' : isEnabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      {/* Notification Types */}
      {isEnabled && (
        <div style={{ padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 600 }}>Notification Types</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { key: 'tasks', label: 'Task Reminders', emoji: '✓' },
              { key: 'habits', label: 'Habit Reminders', emoji: '🧘' },
              { key: 'workouts', label: 'Workout Reminders', emoji: '💪' },
            ].map(({ key, label, emoji }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={notifTypes[key as keyof typeof notifTypes]}
                  onChange={(e) => {
                    setNotifTypes(prev => ({ ...prev, [key]: e.target.checked }))
                  }}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
                <span>{emoji} {label}</span>
              </label>
            ))}
          </div>
          <button
            onClick={handleUpdatePreferences}
            disabled={loading}
            style={{
              marginTop: '12px',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg-primary)',
              color: 'var(--text)',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              opacity: loading ? 0.6 : 1,
            }}
          >
            Save Preferences
          </button>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div style={{ padding: '10px', background: '#fee2e2', borderRadius: '6px', border: '1px solid #fca5a5', color: '#991b1b', fontSize: '13px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '10px', background: '#dcfce7', borderRadius: '6px', border: '1px solid #86efac', color: '#166534', fontSize: '13px' }}>
          {success}
        </div>
      )}

      {/* Info */}
      <div style={{ fontSize: '12px', color: 'var(--text-dim)', padding: '8px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
        <p style={{ margin: 0 }}>
          💡 Push notifications work on desktop and when your app is installed on your home screen (mobile web app).
        </p>
      </div>
    </div>
  )
}
