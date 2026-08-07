import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot, doc, getDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../App'
import { Avatar } from '../components/Avatar'
import { usePresence } from '../hooks/usePresence'
import { formatActiveStatus } from '../utils/activeStatus'
import { formatListTime } from '../utils/formatTime'
import { Plus, Search, Users } from 'lucide-react'
import { uploadFile } from '../utils/uploadFile'
import Layout from '../components/Layout'
import PullToRefresh from '../components/PullToRefresh'

function ChatItem({ group, user, onClick }) {
  const isDirect = group.type === 'direct' || group.isDirect
  const [member, setMember] = useState(null)

  useEffect(() => {
    const fetch = async () => {
      if (!isDirect) return
      const otherId = group.members?.find(id => id !== user.uid)
      if (!otherId) return
      const snap = await getDoc(doc(db, 'users', otherId))
      if (snap.exists()) setMember({ uid: snap.id, ...snap.data() })
    }
    fetch()
  }, [group, isDirect, user.uid])

  const otherUid = isDirect ? group.members?.find(id => id !== user.uid) : null
  const { online, lastSeen } = usePresence(otherUid)

  const title = isDirect ? (member?.fullName || 'مجهول') : (group.name || 'محادثة')
  const image = isDirect ? (member?.profilePic || '') : (group.image || '')
  const active = isDirect ? formatActiveStatus({ online, lastSeen }) : `${group.members?.length || 0} عضو`

  const lastRead = group.lastReadAt?.[user.uid]
  const lastMsgTs = group.lastMessage?.createdAt?.seconds || 0
  const lastReadTs = lastRead?.seconds || 0
  const isUnread = group.lastMessage && group.lastMessage.senderId !== user.uid && lastMsgTs > lastReadTs

  const formatLastMessage = () => {
    const msg = group.lastMessage
    if (!msg) return isDirect ? 'ابدأ المحادثة' : 'لا توجد رسائل بعد'
    const sender = group.lastSender?.fullName
    const isMe = msg.senderId === user.uid
    const name = isMe ? 'أنت' : (sender || 'مجهول')

    const contentForType = {
      text: msg.content || '',
      image: 'صورة',
      video: 'فيديو',
      audio: 'رسالة صوتية',
      file: msg.fileName || 'ملف',
      reaction: `تم التفاعل بـ ${msg.content || ''}`,
    }
    const body = contentForType[msg.type] || 'رسالة'

    if (msg.type === 'reaction') {
      return isDirect ? body : `${name} ${body}`
    }

    if (!isDirect && sender) return `${name}: ${body}`
    if (isMe) return `أنت: ${body}`
    return body
  }

  const subtitle = (
    <span className={`truncate ${isUnread ? 'text-white font-medium' : 'text-white/50'}`}>
      {formatLastMessage()}
    </span>
  )

  return (
    <div onClick={onClick} className={`rounded-2xl p-3 flex items-center gap-3 cursor-pointer transition border ${isUnread ? 'bg-green-500/[0.08] border-r-4 border-green-500/60 hover:bg-green-500/[0.12] shadow-[0_0_20px_rgba(34,197,94,0.08)]' : 'glass hover:bg-[#0a0a0a] hover:border-white/20 border-transparent'}`}>
      <Avatar src={image} name={title} size={52} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center gap-2">
          <h3 className={`truncate ${isUnread ? 'font-bold text-white' : 'font-semibold'}`}>{title}</h3>
          <span className={`text-xs shrink-0 ${isUnread ? 'text-green-400 font-medium' : 'text-white/40'}`}>{formatListTime(group.lastMessage?.createdAt)}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-sm truncate flex-1">{subtitle}</p>
          {isUnread && <span className="unread-dot shrink-0" />}
          {!isUnread && isDirect && active && <span className={`text-[11px] shrink-0 ${online ? 'text-green-400' : 'text-white/40'}`}>{active}</span>}
        </div>
      </div>
    </div>
  )
}

export default function ChatList() {
  const { user } = useAuth()
  const [groups, setGroups] = useState([])
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newImage, setNewImage] = useState(null)
  const [newPreview, setNewPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'groups'), where('members', 'array-contains', user.uid))
    const unsub = onSnapshot(
      q,
      async (snap) => {
        setError('')
        const list = await Promise.all(snap.docs.map(async (d) => {
          const data = { id: d.id, ...d.data() }
          if (data.lastMessage?.senderId) {
            try {
              const u = await getDoc(doc(db, 'users', data.lastMessage.senderId))
              data.lastSender = u.exists() ? u.data() : null
            } catch { data.lastSender = null }
          }
          return data
        }))
        list.sort((a, b) => {
          const ta = b.lastMessage?.createdAt?.seconds || b.createdAt?.seconds || 0
          const tb = a.lastMessage?.createdAt?.seconds || a.createdAt?.seconds || 0
          return ta - tb
        })
        setGroups(list)
      },
      (err) => {
        console.error('Groups load error', err)
        setError('تعذّر تحميل المحادثات، تحقق من صلاحيات Firestore.')
      }
    )
    return unsub
  }, [user, refreshKey])

  const handleRefresh = async () => {
    setRefreshKey(k => k + 1)
    await new Promise(resolve => setTimeout(resolve, 800))
  }

  const createGroup = async (e) => {
    e.preventDefault()
    if (!newName.trim() || !user) return
    setLoading(true)
    setError('')
    try {
      const ref = await addDoc(collection(db, 'groups'), {
        name: newName.trim(),
        image: '',
        type: 'group',
        members: [user.uid],
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        lastMessage: null,
      })
      let imageUrl = ''
      if (newImage) {
        try {
          imageUrl = await uploadFile(newImage, `groups/${ref.id}/image`)
          await updateDoc(ref, { image: imageUrl })
        } catch (e) {
          console.warn('Group image upload failed', e)
          setError('تم إنشاء المجموعة لكن فشل رفع صورتها.')
        }
      }
      setNewName('')
      setNewImage(null)
      setNewPreview('')
      setShowCreate(false)
      navigate(`/chat/${ref.id}`)
    } catch (e) {
      console.error(e)
      setError('تعذّر إنشاء المجموعة، تحقق من الاتصال والصلاحيات.')
    }
    setLoading(false)
  }

  const filtered = groups.filter(g => {
    const term = search.toLowerCase()
    if ((g.name || '').toLowerCase().includes(term)) return true
    return false
  })

  return (
    <Layout>
      <div className="px-4 sm:px-5 py-3">
        <div className="relative">
          <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="البحث في المحادثات..."
            className="w-full rounded-2xl py-3 pr-11 pl-4"
          />
        </div>
      </div>

      {error && <p className="mx-4 sm:mx-5 text-sm text-white bg-white/10 border border-white/10 rounded-xl p-3">{error}</p>}

      <PullToRefresh onRefresh={handleRefresh} contentClassName="px-4 sm:px-5 pb-28 space-y-3">
        {filtered.map(g => (
          <ChatItem key={g.id} group={g} user={user} onClick={() => navigate(`/chat/${g.id}`)} />
        ))}
        {filtered.length === 0 && !error && (
          <div className="text-center text-white/40 py-12 glass rounded-3xl mx-2">
            <Users size={48} className="mx-auto mb-3 opacity-50" />
            <p>لا توجد محادثات. أنشئ محادثتك الأولى.</p>
          </div>
        )}
      </PullToRefresh>

      <button onClick={() => setShowCreate(true)} className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 w-14 h-14 rounded-full gradient-bg flex items-center justify-center shadow-lg hover:scale-105 transition z-30">
        <Plus size={28} />
      </button>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4">
          <div className="glass-strong rounded-3xl w-full max-w-sm p-5 page-enter border border-white/10">
            <h3 className="font-bold text-xl mb-4 gradient-text">مجموعة جديدة</h3>
            <form onSubmit={createGroup} className="space-y-4">
              <div className="flex justify-center">
                <label className="w-20 h-20 rounded-full overflow-hidden bg-[#111] border border-white/20 flex items-center justify-center cursor-pointer">
                  {newPreview ? <img src={newPreview} className="w-full h-full object-cover" alt="group" /> : <Users size={28} className="text-white/60" />}
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const f = e.target.files[0]
                    if (f) { setNewImage(f); setNewPreview(URL.createObjectURL(f)) }
                  }} />
                </label>
              </div>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="اسم المجموعة" required
                className="w-full rounded-2xl px-4 py-3" />
              {error && <p className="text-sm text-white bg-white/10 rounded-xl p-3 border border-white/10">{error}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-3 rounded-2xl bg-[#111] hover:bg-white/10 border border-white/20 transition">إلغاء</button>
                <button type="submit" disabled={loading} className="flex-1 gradient-bg text-black font-bold py-3 rounded-2xl disabled:opacity-60">إنشاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
