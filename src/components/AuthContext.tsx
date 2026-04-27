// src/components/AuthContext.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, auth, getUserProfile } from '../db/firebase'
import type { User } from 'firebase/auth'
import type { UserProfile } from '../db/firebase'

interface AuthState {
  user:    User | null
  profile: UserProfile | null
  loading: boolean
}

const AuthContext = createContext<AuthState>({ user: null, profile: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        const p = await getUserProfile(u.uid)
        setProfile(p)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}