// src/components/NotificationsContext.tsx - Context for managing push notifications

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import {
  requestNotificationPermission,
  getNotificationPermission,
  setupForegroundHandler,
  clearCachedToken,
  type NotificationPayload,
} from '../db/fcm'

interface NotificationsContextType {
  isSupported: boolean
  permission: NotificationPermission | null
  isEnabled: boolean
  token: string | null
  requestPermission: () => Promise<boolean>
  disableNotifications: () => void
  lastNotification: NotificationPayload | null
}

const NotificationsContext = createContext<NotificationsContextType | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [permission, setPermission] = useState<NotificationPermission | null>(null)
  const [isEnabled, setIsEnabled] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [lastNotification, setLastNotification] = useState<NotificationPayload | null>(null)

  const isSupported = 'Notification' in window && 'serviceWorker' in navigator

  // Initialize notifications on mount
  useEffect(() => {
    if (!isSupported) return

    const perm = getNotificationPermission()
    setPermission(perm)
    setIsEnabled(perm === 'granted')

    const cachedToken = localStorage.getItem('fcm_token')
    if (cachedToken && perm === 'granted') {
      setToken(cachedToken)
    }

    if (perm !== 'granted') return

    const unsubscribe = setupForegroundHandler(notification => {
      setLastNotification(notification)
    })

    return () => unsubscribe()
  }, [isSupported])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      return false
    }


    try {
      const deviceToken = await requestNotificationPermission()
      const newPerm = getNotificationPermission()
      setPermission(newPerm)

      if (deviceToken) {
        setToken(deviceToken)
        setIsEnabled(true)
        localStorage.setItem('notificationsEnabled', 'true')
        
        // Set up foreground handler
        setupForegroundHandler(notification => {
          setLastNotification(notification)
        })

        return true
      }

      return false
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      return false
    }
  }, [isSupported])

  const disableNotifications = useCallback(() => {
    setIsEnabled(false)
    setToken(null)
    clearCachedToken()
    localStorage.removeItem('notificationsEnabled')
    localStorage.removeItem('fcm_token')
  }, [])

  return (
    <NotificationsContext.Provider
      value={{
        isSupported,
        permission,
        isEnabled,
        token,
        requestPermission,
        disableNotifications,
        lastNotification,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications(): NotificationsContextType {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider')
  }
  return context
}
