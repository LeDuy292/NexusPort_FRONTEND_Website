import React, { createContext, useContext, useState } from 'react'

/**
 * MOCK GLOBAL STORE BẰNG REACT CONTEXT API
 * (Tránh lỗi biên dịch khi chưa chạy `npm install @reduxjs/toolkit react-redux`)
 * 
 * Khi muốn chuyển sang Redux Toolkit:
 * 1. Chạy lệnh: npm install @reduxjs/toolkit react-redux
 * 2. Cấu hình store bằng configureStore() của RTK tại đây.
 */

const StoreContext = createContext()

export function StoreProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user')) || null)
  const [notifications, setNotifications] = useState([])

  const login = (userData) => {
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <StoreContext.Provider value={{ user, login, logout, notifications, setNotifications }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  return useContext(StoreContext)
}
