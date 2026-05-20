// src/db/notificationApi.ts - API endpoints for device token management

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export interface DeviceTokenRequest {
  userId: string
  token: string
  platform: 'web' | 'mobile-web'
  userAgent?: string
}

export interface NotificationRequest {
  userId: string
  type: 'task' | 'habit' | 'workout' | 'custom'
  title: string
  body: string
  data?: Record<string, string>
  notifyAll?: boolean // Send to all devices
}

/**
 * Register a device token with the backend
 */
export async function registerDeviceToken(
  userId: string,
  token: string,
  platform: 'web' | 'mobile-web' = 'web',
  authToken?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/notifications/register-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      },
      body: JSON.stringify({
        userId,
        token,
        platform,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      } as DeviceTokenRequest),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('[NotificationAPI] Failed to register device token:', error)
    throw error
  }
}

/**
 * Unregister device token (opt out of notifications)
 */
export async function unregisterDeviceToken(
  userId: string,
  token: string,
  authToken?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/notifications/unregister-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      },
      body: JSON.stringify({
        userId,
        token,
        timestamp: new Date().toISOString(),
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('[NotificationAPI] Failed to unregister device token:', error)
    throw error
  }
}

/**
 * Send a notification to a user's devices
 */
export async function sendNotification(
  request: NotificationRequest,
  authToken?: string
): Promise<{ success: boolean; messageId?: string; message: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      },
      body: JSON.stringify({
        ...request,
        timestamp: new Date().toISOString(),
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('[NotificationAPI] Failed to send notification:', error)
    throw error
  }
}

/**
 * Get user's notification preferences
 */
export async function getNotificationPreferences(
  userId: string,
  authToken?: string
): Promise<{
  userId: string
  enabledNotifications: boolean
  notificationTypes: {
    tasks: boolean
    habits: boolean
    workouts: boolean
  }
  quietHoursStart?: string
  quietHoursEnd?: string
}> {
  try {
    const response = await fetch(`${API_BASE}/api/notifications/preferences/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('[NotificationAPI] Failed to get notification preferences:', error)
    throw error
  }
}

/**
 * Update user's notification preferences
 */
export async function updateNotificationPreferences(
  userId: string,
  preferences: {
    enabledNotifications?: boolean
    notificationTypes?: {
      tasks?: boolean
      habits?: boolean
      workouts?: boolean
    }
    quietHoursStart?: string
    quietHoursEnd?: string
  },
  authToken?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/notifications/preferences/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      },
      body: JSON.stringify({
        ...preferences,
        updatedAt: new Date().toISOString(),
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('[NotificationAPI] Failed to update notification preferences:', error)
    throw error
  }
}
