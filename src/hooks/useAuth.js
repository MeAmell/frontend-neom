import { useState } from 'react'

export function useAuth() {
  const [user, setUser] = useState(() => {
    try {
      const u = sessionStorage.getItem('neom_user')
      return u ? JSON.parse(u) : null
    } catch { return null }
  })

  const saveUser = (u) => {
    setUser(u)
    if (!u) {
      sessionStorage.removeItem('neom_token')
      sessionStorage.removeItem('neom_user')
    } else {
      sessionStorage.setItem('neom_user', JSON.stringify(u))
    }
  }

  const login = (userData) => saveUser(userData) // ✅ OPTIONAL (lebih clean)

  const logout = () => saveUser(null)

  return { 
    user, 
    login,      // ✅ WAJIB ADA
    logout, 
    isLoggedIn: !!user 
  }
}