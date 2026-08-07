import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { Avatar } from './Avatar'
import { MessageSquare, Users, Bell, LogOut, User } from 'lucide-react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { db } from '../firebase'
import { collection, query, where, onSnapshot } from 'firebase/firestore'

const nav = [
  { path: '/', label: 'المحادثات', icon: MessageSquare },
  { path: '/users', label: 'المستخدمون', icon: Users },
  { path: '/requests', label: 'الطلبات', icon: Bell },
]

export default function Layout({ children }) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const displayName = profile?.fullName || user?.displayName || 'Gestion'
  const avatar = profile?.profilePic || user?.photoURL || ''
  const username = profile?.username || ''

  const [unreadCount, setUnreadCount] = useState(0)
  const [requestCount, setRequestCount] = useState(0)

  useEffect(() => {
    if (!user?.uid) return
    const q = query(collection(db, 'groups'), where('members', 'array-contains', user.uid))
    const unsub = onSnapshot(q, (snap) => {
      let total = 0
      snap.docs.forEach(d => {
        const data = d.data()
        const lastMessage = data.lastMessage
        if (!lastMessage || lastMessage.senderId === user.uid) return
        const lastRead = data.lastReadAt?.[user.uid]
        const lastReadTs = lastRead?.seconds || 0
        const lastMsgTs = lastMessage.createdAt?.seconds || 0
        if (lastMsgTs > lastReadTs) total += 1
      })
      setUnreadCount(total)
    })
    return unsub
  }, [user])

  useEffect(() => {
    if (!user?.uid) return
    const q = query(collection(db, 'friendRequests'), where('to', '==', user.uid), where('status', '==', 'pending'))
    const unsub = onSnapshot(q, (snap) => setRequestCount(snap.size))
    return unsub
  }, [user])

  const logout = () => signOut(auth)

  return (
    <div className="h-screen w-full bg-black flex flex-col overflow-hidden" dir="rtl">
      <header className="glass-strong px-4 sm:px-5 py-3 flex items-center justify-between shrink-0 border-b border-white/10 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar src={avatar} name={displayName} size={44} />
          <div className="min-w-0">
            <h2 className="font-bold text-base leading-tight truncate">{displayName}</h2>
            {username && <p className="text-xs text-white/40">@{username}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => navigate(`/profile/${user.uid}`)} className="w-10 h-10 rounded-full bg-[#111] hover:bg-white/10 border border-white/20 flex items-center justify-center transition">
            <User size={20} className="text-white" />
          </button>
          <button onClick={logout} className="w-10 h-10 rounded-full bg-[#111] hover:bg-white/10 border border-white/20 flex items-center justify-center transition">
            <LogOut size={20} className="text-white" />
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
        {children}
      </main>

      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
        <div className="glass-strong rounded-full px-2 py-2 border border-white/10 flex items-center gap-1 shadow-2xl">
          {nav.map((item) => {
            const active = location.pathname === item.path
            const Icon = item.icon
            const badge = item.path === '/' ? unreadCount : item.path === '/requests' ? requestCount : 0
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-full transition font-medium text-sm ${
                  active ? 'gradient-bg text-black' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full shadow">
                    {badge > 99 ? '+99' : badge}
                  </span>
                )}
                <Icon size={18} />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
