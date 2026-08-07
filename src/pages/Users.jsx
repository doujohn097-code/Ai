import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot, addDoc, getDocs, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../App'
import { Avatar } from '../components/Avatar'
import { usePresence } from '../hooks/usePresence'
import { formatActiveStatus } from '../utils/activeStatus'
import { Search, UserPlus, MessageCircle, Clock, Check, X } from 'lucide-react'
import Layout from '../components/Layout'

function UserRow({ u, rel, onProfile, onRequest, onAccept, onDecline, onChat, onChatIcon }) {
  const { online, lastSeen } = usePresence(u.uid)
  const active = formatActiveStatus({ online, lastSeen })

  return (
    <div className="glass rounded-2xl p-3 flex items-center gap-3 border border-transparent">
      <div className="cursor-pointer relative" onClick={() => onProfile(u.uid)}>
        <Avatar src={u.profilePic} name={u.fullName} size={52} online={online} />
      </div>
      <div className="flex-1 min-w-0" onClick={() => onProfile(u.uid)}>
        <div className="flex items-center gap-2">
          <h3 className="font-semibold truncate">{u.fullName || u.username}</h3>
          {active && <span className={`text-[11px] shrink-0 ${online ? 'text-green-400' : 'text-white/40'}`}>{active}</span>}
        </div>
        <p className="text-xs text-white/40 truncate">@{u.username || ''}</p>
      </div>
      <div className="shrink-0">
        {!rel && (
          <button onClick={(e) => { e.stopPropagation(); onRequest(u.uid) }} className="w-10 h-10 rounded-full bg-[#111] hover:bg-white/10 border border-white/20 flex items-center justify-center transition" title="إرسال طلب صداقة">
            <UserPlus size={18} />
          </button>
        )}
        {rel?.status === 'pending' && rel?.direction === 'out' && (
          <button onClick={(e) => { e.stopPropagation(); onDecline(rel.id) }} className="w-10 h-10 rounded-full bg-[#111] hover:bg-white/10 border border-white/20 flex items-center justify-center transition" title="إلغاء الطلب">
            <Clock size={18} />
          </button>
        )}
        {rel?.status === 'pending' && rel?.direction === 'in' && (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => onAccept(rel.id)} className="w-10 h-10 rounded-full gradient-bg text-black flex items-center justify-center" title="قبول">
              <Check size={18} />
            </button>
            <button onClick={() => onDecline(rel.id)} className="w-10 h-10 rounded-full bg-[#111] hover:bg-white/10 border border-white/20 flex items-center justify-center" title="رفض">
              <X size={18} />
            </button>
          </div>
        )}
        {rel?.status === 'accepted' && (
          <button onClick={(e) => { e.stopPropagation(); onChatIcon(u) }} className="w-10 h-10 rounded-full gradient-bg text-black flex items-center justify-center transition" title="مراسلة">
            <MessageCircle size={18} />
          </button>
        )}
      </div>
    </div>
  )
}

export default function Users() {
  const { user } = useAuth()
  const [users, setUsers] = useState([])
  const [relations, setRelations] = useState({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return

    const unsubUsers = onSnapshot(
      query(collection(db, 'users')),
      (snap) => {
        const list = snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.uid !== user.uid)
        setUsers(list)
        setLoading(false)
      },
      () => setLoading(false)
    )

    const buildRel = (list) => {
      setRelations(prev => {
        const next = { ...prev }
        list.forEach(r => {
          const other = r.from === user.uid ? r.to : r.from
          next[other] = { id: r.id, status: r.status, direction: r.from === user.uid ? 'out' : 'in' }
        })
        return next
      })
    }

    const q1 = query(collection(db, 'friendRequests'), where('from', '==', user.uid))
    const unsub1 = onSnapshot(q1, (snap) => buildRel(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

    const q2 = query(collection(db, 'friendRequests'), where('to', '==', user.uid))
    const unsub2 = onSnapshot(q2, (snap) => buildRel(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

    return () => { unsubUsers(); unsub1(); unsub2() }
  }, [user])

  const sendRequest = async (targetUid) => {
    try {
      await addDoc(collection(db, 'friendRequests'), {
        from: user.uid,
        to: targetUid,
        status: 'pending',
        createdAt: serverTimestamp(),
      })
    } catch (e) { console.error(e) }
  }

  const acceptRequest = async (reqId) => {
    try {
      await updateDoc(doc(db, 'friendRequests', reqId), { status: 'accepted' })
    } catch (e) { console.error(e) }
  }

  const declineRequest = async (reqId) => {
    try {
      await deleteDoc(doc(db, 'friendRequests', reqId))
    } catch (e) { console.error(e) }
  }

  const startChat = async (target) => {
    try {
      const q = query(collection(db, 'groups'), where('members', 'array-contains', user.uid))
      const snap = await getDocs(q)
      const existing = snap.docs.find(d => {
        const m = d.data().members || []
        return m.length === 2 && m.includes(target.uid)
      })
      if (existing) {
        navigate(`/chat/${existing.id}`)
        return
      }
      const ref = await addDoc(collection(db, 'groups'), {
        name: target.fullName || target.username,
        image: target.profilePic || '',
        members: [user.uid, target.uid].sort(),
        type: 'direct',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        lastMessage: null,
      })
      navigate(`/chat/${ref.id}`)
    } catch (e) { console.error(e) }
  }

  const filtered = users.filter(u =>
    (u.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.username || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout>
      <div className="px-4 sm:px-5 py-3">
        <div className="relative">
          <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="البحث عن مستخدم..."
            className="w-full rounded-2xl py-3 pr-11 pl-4"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-5 pb-28 space-y-3">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 rounded-full border-4 border-white/20 border-t-white animate-spin" />
          </div>
        )}

        {!loading && filtered.map(u => (
          <UserRow
            key={u.uid}
            u={u}
            rel={relations[u.uid]}
            onProfile={(uid) => navigate(`/profile/${uid}`)}
            onRequest={sendRequest}
            onAccept={acceptRequest}
            onDecline={declineRequest}
            onChat={startChat}
            onChatIcon={startChat}
          />
        ))}

        {!loading && filtered.length === 0 && (
          <div className="text-center text-white/40 py-12">
            <p>لا يوجد مستخدمون مطابقون.</p>
          </div>
        )}
      </div>
    </Layout>
  )
}
