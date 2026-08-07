import React, { useEffect, useState, createContext, useContext } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from './firebase'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ChatList from './pages/ChatList'
import Chat from './pages/Chat'
import Profile from './pages/Profile'
import Users from './pages/Users'
import Requests from './pages/Requests'
import Demo from './pages/Demo'
import DemoChatList from './pages/DemoChatList'
import DemoProfile from './pages/DemoProfile'
import DemoUsers from './pages/DemoUsers'
import DemoRequests from './pages/DemoRequests'
import Splash from './components/Splash'
import { useMyPresence } from './hooks/usePresence'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

function AuthLoader({ children }) {
  const [user, setUser] = useState(undefined)
  const [profile, setProfile] = useState(undefined)
  const [lockSignup, setLockSignup] = useState(false)

  useEffect(() => {
    let unsubProfile
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u)
      if (u) {
        unsubProfile = onSnapshot(
          doc(db, 'users', u.uid),
          (snap) => setProfile(snap.exists() ? { uid: snap.id, ...snap.data() } : null),
          (err) => {
            console.warn('Profile load error', err)
            setProfile(null)
          }
        )
      } else {
        setProfile(null)
        if (unsubProfile) unsubProfile()
      }
    })
    return () => {
      unsubAuth()
      if (unsubProfile) unsubProfile()
    }
  }, [])

  useMyPresence(user)

  if (user === undefined || profile === undefined) {
    return (
      <div className="h-screen w-full flex items-center justify-center overflow-y-auto bg-black" dir="rtl">
        <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, profile, lockSignup, setLockSignup }}>
      {children}
    </AuthContext.Provider>
  )
}

function App() {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
  const isDemo = typeof window !== 'undefined' && window.location.hash === '#/demo'
  const needsSetup = !isDemo && (!apiKey || apiKey.includes('your_') || apiKey.includes('REPLACE'))

  if (needsSetup) {
    return (
      <div className="h-screen w-full flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black" dir="rtl">
        <div className="max-w-md glass-strong rounded-3xl p-8 text-center">
          <img src="/logo.png" alt="Gestion" className="w-20 h-20 mx-auto rounded-3xl mb-4" />
          <h1 className="text-2xl font-bold gradient-text mb-2">Gestion يحتاج إعدادًا</h1>
          <p className="text-white/60 text-sm mb-6">
            يرجى إعداد متغيرات مشروع Firebase في البيئة قبل تشغيل التطبيق.
          </p>
          <div className="text-right text-xs text-white/40 bg-black/20 rounded-xl p-4 text-left" dir="rtl">
            <p className="font-semibold text-white/70 mb-1">متغيرات Vercel المطلوبة:</p>
            <ul className="list-disc pr-4 space-y-1">
              <li>VITE_FIREBASE_API_KEY</li>
              <li>VITE_FIREBASE_AUTH_DOMAIN</li>
              <li>VITE_FIREBASE_PROJECT_ID</li>
              <li>VITE_FIREBASE_STORAGE_BUCKET</li>
              <li>VITE_FIREBASE_MESSAGING_SENDER_ID</li>
              <li>VITE_FIREBASE_APP_ID</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Splash />
      <AuthLoader>
        <HashRouter>
          <Routes>
            <Route path="/" element={<PrivateRoute><ChatList /></PrivateRoute>} />
            <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
            <Route path="/signup" element={<GuestRoute><Signup /></GuestRoute>} />
            <Route path="/chat/:groupId" element={<PrivateRoute><Chat /></PrivateRoute>} />
            <Route path="/profile/:uid" element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="/users" element={<PrivateRoute><Users /></PrivateRoute>} />
            <Route path="/requests" element={<PrivateRoute><Requests /></PrivateRoute>} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/demo/chatlist" element={<DemoChatList />} />
            <Route path="/demo/profile" element={<DemoProfile />} />
            <Route path="/demo/users" element={<DemoUsers />} />
            <Route path="/demo/requests" element={<DemoRequests />} />
          </Routes>
        </HashRouter>
      </AuthLoader>
    </>
  )
}

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" />
}

function GuestRoute({ children }) {
  const { user, lockSignup } = useAuth()
  return user && !lockSignup ? <Navigate to="/" /> : children
}

export default App
