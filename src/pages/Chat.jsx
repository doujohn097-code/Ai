import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, onSnapshot, collection, query, where, orderBy, addDoc, setDoc, serverTimestamp, updateDoc, arrayUnion, arrayRemove, getDoc, deleteDoc, Timestamp } from 'firebase/firestore'
import { getIdToken } from 'firebase/auth'
import { auth, db } from '../firebase'
import { useAuth } from '../App'
import { Avatar } from '../components/Avatar'
import { MessageBubble } from '../components/MessageBubble'
import { VoiceRecorder } from '../components/VoiceRecorder'
import { uploadFile, getFileType } from '../utils/uploadFile'
import { usePresence } from '../hooks/usePresence'
import { formatActiveStatus } from '../utils/activeStatus'
import { ChevronRight, Send, Paperclip, MoreVertical, UserPlus, Trash2, LogOut, X, Reply, Ban } from 'lucide-react'

export default function Chat() {
  const { groupId } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [group, setGroup] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [members, setMembers] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadErr, setUploadErr] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [friends, setFriends] = useState([])
  const [toast, setToast] = useState(null)
  const [pendingFile, setPendingFile] = useState(null)
  const [pendingType, setPendingType] = useState(null)
  const [pendingPreview, setPendingPreview] = useState('')
  const [voiceState, setVoiceState] = useState('idle')
  const [typingUsers, setTypingUsers] = useState([])
  const [replyTo, setReplyTo] = useState(null)
  const [blocked, setBlocked] = useState(false)
  const bottomRef = useRef(null)
  const fileRef = useRef()
  const typingTimerRef = useRef(null)
  const clearTypingTimerRef = useRef(null)
  const readMarkedRef = useRef(null)
  const fromReqsRef = useRef([])
  const toReqsRef = useRef([])

  const isDirect = group?.type === 'direct' || group?.isDirect
  const otherUser = isDirect ? Object.values(members).find(m => m?.uid !== user.uid) : null
  const { online, lastSeen } = usePresence(otherUser?.uid)

  useEffect(() => {
    if (!groupId || !user?.uid) return
    updateDoc(doc(db, 'groups', groupId), { [`lastReadAt.${user.uid}`]: Timestamp.now() }).catch(() => {})
  }, [groupId, user.uid])

  useEffect(() => {
    if (!groupId) return
    setError('')
    const unsubGroup = onSnapshot(
      doc(db, 'groups', groupId),
      (snap) => { setGroup(snap.exists() ? { id: snap.id, ...snap.data() } : null) },
      (err) => { console.error('Group load error', err); setError('تعذّر تحميل المحادثة، تحقق من الصلاحيات.') }
    )
    const q = query(collection(db, 'groups', groupId, 'messages'), orderBy('createdAt', 'asc'))
    const unsubMessages = onSnapshot(
      q,
      (snap) => { setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }))) },
      (err) => { console.error('Messages load error', err); setError('تعذّر تحميل الرسائل، تحقق من الصلاحيات.') }
    )
    const unsubTyping = onSnapshot(
      collection(db, 'groups', groupId, 'typing'),
      (snap) => {
        const now = Date.now() / 1000
        const list = snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(t => t.typing === true && t.updatedAt && (now - t.updatedAt.seconds) < 8 && t.uid !== user.uid)
        setTypingUsers(list)
      },
      (err) => { console.warn('Typing load error', err) }
    )

    return () => { unsubGroup(); unsubMessages(); unsubTyping() }
  }, [groupId, user.uid])

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
      if (clearTypingTimerRef.current) clearTimeout(clearTypingTimerRef.current)
      if (groupId && user.uid) {
        setDoc(doc(db, 'groups', groupId, 'typing', user.uid), { typing: false, updatedAt: Timestamp.now() })
      }
    }
  }, [groupId, user.uid])

  useEffect(() => {
    const fetchMembers = async () => {
      if (!group?.members) return
      const map = {}
      await Promise.all(group.members.map(async (uid) => {
        const snap = await getDoc(doc(db, 'users', uid))
        if (snap.exists()) map[uid] = { uid: snap.id, ...snap.data() }
      }))
      setMembers(map)
    }
    fetchMembers()
  }, [group])

  useEffect(() => {
    if (!user?.uid) return
    const loadFriends = async () => {
      const friendIds = new Set()
      ;[...fromReqsRef.current, ...toReqsRef.current].forEach(d => {
        const data = d.data ? d.data() : d
        const fid = data.from === user.uid ? data.to : data.from
        if (fid && fid !== user.uid) friendIds.add(fid)
      })
      const list = []
      await Promise.all([...friendIds].map(async fid => {
        const snap = await getDoc(doc(db, 'users', fid))
        if (snap.exists()) list.push({ uid: snap.id, ...snap.data() })
      }))
      setFriends(list)
    }
    const q1 = query(collection(db, 'friendRequests'), where('from', '==', user.uid), where('status', '==', 'accepted'))
    const q2 = query(collection(db, 'friendRequests'), where('to', '==', user.uid), where('status', '==', 'accepted'))
    const unsub1 = onSnapshot(q1, (snap) => { fromReqsRef.current = snap.docs; loadFriends() })
    const unsub2 = onSnapshot(q2, (snap) => { toReqsRef.current = snap.docs; loadFriends() })
    return () => { unsub1(); unsub2() }
  }, [user])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
  }, [messages, typingUsers])

  useEffect(() => {
    if (!groupId || !user.uid) return
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    if (clearTypingTimerRef.current) clearTimeout(clearTypingTimerRef.current)

    const updateTyping = async (isTyping) => {
      try {
        await setDoc(doc(db, 'groups', groupId, 'typing', user.uid), {
          typing: isTyping,
          uid: user.uid,
          name: profile?.fullName || '',
          profilePic: profile?.profilePic || '',
          updatedAt: Timestamp.now(),
        })
      } catch (e) { console.warn('Typing update failed', e) }
    }

    if (text.trim()) {
      updateTyping(true)
      clearTypingTimerRef.current = setTimeout(() => updateTyping(false), 2500)
    } else {
      updateTyping(false)
    }
  }, [text, groupId, user.uid, profile])

  useEffect(() => {
    if (!messages.length || !groupId || !user.uid) return
    const lastMsg = messages[messages.length - 1]
    if (lastMsg.id === readMarkedRef.current) return
    if (lastMsg.senderId === user.uid) return
    if (lastMsg.readBy?.includes(user.uid)) {
      readMarkedRef.current = lastMsg.id
      return
    }
    readMarkedRef.current = lastMsg.id
    updateDoc(doc(db, 'groups', groupId, 'messages', lastMsg.id), { readBy: arrayUnion(user.uid) })
      .catch(e => console.warn('Read receipt update failed', e))
    updateDoc(doc(db, 'groups', groupId), { [`lastReadAt.${user.uid}`]: Timestamp.now() })
      .catch(e => console.warn('Last read update failed', e))
  }, [messages, groupId, user.uid])

  useEffect(() => {
    if (!isDirect || !otherUser || !profile) return
    const myBlocked = profile.blockedUsers || []
    const theirBlocked = otherUser.blockedUsers || []
    setBlocked(myBlocked.includes(otherUser.uid) || theirBlocked.includes(user.uid))
  }, [isDirect, otherUser, profile, user.uid])

  const readReceipts = useMemo(() => {
    const receipts = messages.map(() => [])
    const latestReadByUser = {}
    messages.forEach((msg, idx) => {
      const readers = msg.readBy || []
      readers.forEach(uid => { latestReadByUser[uid] = idx })
    })
    Object.entries(latestReadByUser).forEach(([uid, idx]) => {
      const member = members[uid]
      if (member && receipts[idx]) receipts[idx].push(member)
    })
    return receipts
  }, [messages, members])

  const sendNotification = async (msgContent, msgType) => {
    try {
      const token = await getIdToken(auth.currentUser, true)
      const base = import.meta.env.VITE_API_BASE || ''
      await fetch(`${base}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ groupId, content: msgContent, type: msgType, senderName: profile?.fullName || 'Gestion' }),
      })
    } catch (e) { console.warn('Notification send failed', e) }
  }

  const clearPendingFile = () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview)
    setPendingFile(null)
    setPendingType(null)
    setPendingPreview('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const sendMessage = async (content, type = 'text', mediaUrl = '', fileName = '') => {
    const finalContent = content || ''
    const newMsg = {
      senderId: user.uid,
      type,
      content: finalContent,
      mediaUrl,
      fileName,
      replyTo: replyTo ? {
        id: replyTo.id,
        senderId: replyTo.senderId,
        senderName: members[replyTo.senderId]?.fullName || 'مجهول',
        type: replyTo.type,
        content: replyTo.content,
        mediaUrl: replyTo.mediaUrl,
        fileName: replyTo.fileName,
      } : null,
      createdAt: serverTimestamp(),
    }
    await addDoc(collection(db, 'groups', groupId, 'messages'), newMsg)
    await updateDoc(doc(db, 'groups', groupId), { lastMessage: { ...newMsg, createdAt: serverTimestamp() } })
    sendNotification(finalContent, type)
    setText('')
    setReplyTo(null)
    clearPendingFile()
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (loading || blocked) return
    if (pendingFile) {
      await uploadAndSend(pendingFile, pendingType, text.trim())
    } else if (text.trim()) {
      sendMessage(text.trim(), 'text')
    }
  }

  const uploadAndSend = async (file, type, caption = '') => {
    if (!file) return
    setLoading(true)
    setUploadErr('')
    try {
      const folder = type === 'audio' ? `groups/${groupId}/audio` : `groups/${groupId}/media`
      const url = await uploadFile(file, folder)
      await sendMessage(caption, type, url, file.name)
    } catch (e) {
      console.error(e)
      setUploadErr('فشل الرفع. تأكد من أن R2 عام وCORS مفعّل.')
    }
    setLoading(false)
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const type = getFileType(file)
    if (pendingPreview) URL.revokeObjectURL(pendingPreview)
    setPendingFile(file)
    setPendingType(type)
    if (type === 'image' || type === 'video') {
      setPendingPreview(URL.createObjectURL(file))
    } else {
      setPendingPreview('')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleVoice = (file) => uploadAndSend(file, 'audio')

  const handleReply = (msg) => setReplyTo(msg)

  const handleReact = async (msg, emoji) => {
    try {
      const current = msg.reactions || {}
      const userReactions = {}
      Object.entries(current).forEach(([e, users = {}]) => {
        if (users[user.uid]) userReactions[e] = true
      })

      const next = {}
      Object.entries(current).forEach(([e, users = {}]) => {
        const rest = Object.fromEntries(Object.entries(users).filter(([uid]) => uid !== user.uid))
        if (Object.keys(rest).length > 0) next[e] = rest
      })

      const hadThisEmoji = userReactions[emoji]
      if (!hadThisEmoji) {
        next[emoji] = { ...(current[emoji] || {}), [user.uid]: true }
      }

      await updateDoc(doc(db, 'groups', groupId, 'messages', msg.id), { reactions: next })

      // Reflect the latest activity (reaction) in the chat list preview.
      const isReactionNow = !hadThisEmoji
      if (isReactionNow) {
        await updateDoc(doc(db, 'groups', groupId), {
          lastMessage: {
            type: 'reaction',
            content: emoji,
            senderId: user.uid,
            senderName: profile?.fullName || '',
            messageId: msg.id,
            createdAt: serverTimestamp(),
          },
        })
      }
    } catch (e) { console.warn('Reaction failed', e) }
  }

  const handleDelete = async (msg) => {
    if (!confirm('هل تريد حذف هذه الرسالة؟')) return
    try { await deleteDoc(doc(db, 'groups', groupId, 'messages', msg.id)) } catch (e) { console.warn('Delete failed', e) }
  }

  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(null), 2500)
  }

  const addMember = async (friend) => {
    if (!group?.members || group.members.includes(friend.uid)) {
      showToast(`${friend.fullName} موجود في المجموعة بالفعل`)
      return
    }
    try {
      await updateDoc(doc(db, 'groups', groupId), { members: arrayUnion(friend.uid) })
      showToast(`تمت إضافة ${friend.fullName}`)
    } catch (e) {
      console.error(e)
      showToast('تعذّر إضافة العضو')
    }
  }

  const leaveGroup = async () => {
    if (!confirm('هل تريد مغادرة المحادثة؟')) return
    await updateDoc(doc(db, 'groups', groupId), { members: arrayRemove(user.uid) })
    navigate('/')
  }

  const deleteGroup = async () => {
    if (!confirm('هل تريد حذف المحادثة نهائيًا؟')) return
    await deleteDoc(doc(db, 'groups', groupId))
    navigate('/')
  }

  const toggleBlock = async () => {
    if (!isDirect || !otherUser) return
    const myRef = doc(db, 'users', user.uid)
    const myBlocked = profile.blockedUsers || []
    if (myBlocked.includes(otherUser.uid)) {
      await updateDoc(myRef, { blockedUsers: arrayRemove(otherUser.uid) })
      setBlocked(false)
    } else {
      await updateDoc(myRef, { blockedUsers: arrayUnion(otherUser.uid) })
      setBlocked(true)
    }
  }

  const goProfile = (uid) => navigate(`/profile/${uid}`)

  if (error) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center p-6 overflow-hidden bg-black" dir="rtl">
        <p className="text-white/70 text-center mb-4">{error}</p>
        <button onClick={() => navigate('/')} className="px-6 py-2 rounded-2xl gradient-bg text-black font-bold">العودة</button>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="h-screen w-full flex items-center justify-center overflow-hidden bg-black" dir="rtl">
        <div className="w-10 h-10 rounded-full border-4 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  const isAdmin = group.createdBy === user.uid
  const activeStatus = isDirect ? formatActiveStatus({ online, lastSeen }) : ''

  return (
    <div className="h-screen max-h-screen w-full bg-black flex flex-col overflow-hidden" dir="rtl">
      <header className="relative z-50 glass-strong px-4 py-3 flex items-center justify-between shrink-0 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/')} className="w-10 h-10 rounded-full bg-[#111] hover:bg-white/10 border border-white/20 flex items-center justify-center transition shrink-0">
            <ChevronRight size={22} className="text-white" />
          </button>
          {isDirect ? (
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => goProfile(otherUser?.uid)}>
              <Avatar src={otherUser?.profilePic} name={otherUser?.fullName} size={46} online={online} />
              <div className="min-w-0">
                <h2 className="font-bold text-lg leading-tight truncate">{otherUser?.fullName || 'مجهول'}</h2>
                <p className="text-xs text-green-400">{activeStatus}</p>
              </div>
            </div>
          ) : (
            <>
              <Avatar src={group.image} name={group.name} size={46} />
              <div className="min-w-0">
                <h2 className="font-bold text-lg leading-tight truncate">{group.name}</h2>
                <p className="text-xs text-white/40">{group.members?.length || 0} عضو</p>
              </div>
            </>
          )}
        </div>
        <div className="relative shrink-0">
          <button onClick={() => setMenuOpen(!menuOpen)} className="w-10 h-10 rounded-full bg-[#111] hover:bg-white/10 border border-white/20 flex items-center justify-center transition">
            <MoreVertical size={20} className="text-white" />
          </button>
          {menuOpen && (
            <div className="absolute left-0 top-full mt-2 w-48 glass-strong rounded-2xl overflow-hidden z-[60] text-sm border border-white/10 shadow-2xl" dir="rtl">
              {isDirect ? (
                <>
                  <button onClick={() => { toggleBlock(); setMenuOpen(false) }} className="w-full text-right px-4 py-3 hover:bg-[#0a0a0a] flex items-center gap-2 text-white">
                    <Ban size={16} /> {blocked ? 'إلغاء الحظر' : 'حظر المستخدم'}
                  </button>
                  <button onClick={() => { deleteGroup(); setMenuOpen(false) }} className="w-full text-right px-4 py-3 hover:bg-white/10 text-white flex items-center gap-2"><Trash2 size={16} /> حذف المحادثة</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setShowAdd(true); setMenuOpen(false) }} className="w-full text-right px-4 py-3 hover:bg-[#0a0a0a] flex items-center gap-2 text-white"><UserPlus size={16} /> إضافة عضو</button>
                  {isAdmin && <button onClick={() => { deleteGroup(); setMenuOpen(false) }} className="w-full text-right px-4 py-3 hover:bg-white/10 text-white flex items-center gap-2"><Trash2 size={16} /> حذف المجموعة</button>}
                  <button onClick={() => { leaveGroup(); setMenuOpen(false) }} className="w-full text-right px-4 py-3 hover:bg-[#0a0a0a] flex items-center gap-2 text-white/70"><LogOut size={16} /> مغادرة</button>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {showAdd && !isDirect && (
        <div className="px-4 py-3 bg-[#0a0a0a] border-b border-white/20">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-white">إضافة أصدقاء إلى المجموعة</h4>
            <button onClick={() => setShowAdd(false)} className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition"><X size={16} className="text-white" /></button>
          </div>
          <div className="max-h-52 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-2">
            {friends.length === 0 ? (
              <p className="text-white/40 text-sm col-span-full">لا يوجد أصدقاء لإضافتهم.</p>
            ) : (
              friends.map(f => (
                <div key={f.uid} className="glass rounded-xl p-2 flex flex-col items-center text-center">
                  <Avatar src={f.profilePic} name={f.fullName} size={44} />
                  <p className="mt-2 text-xs font-semibold truncate w-full">{f.fullName}</p>
                  <button
                    onClick={() => addMember(f)}
                    className="mt-2 w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium transition"
                  >
                    إضافة
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 pb-24 chat-bg" dir="rtl">
        {messages.map((msg, idx) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            user={members[msg.senderId]}
            isMe={msg.senderId === user.uid}
            currentUserId={user.uid}
            readBy={readReceipts[idx]}
            onReply={handleReply}
            onReact={handleReact}
            onDelete={handleDelete}
            onProfileClick={goProfile}
          />
        ))}
        {messages.length === 0 && !typingUsers.length && (
          <div className="h-full flex flex-col items-center justify-center text-white/40 text-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <Send size={28} className="opacity-50" />
            </div>
            <p className="text-sm">لا توجد رسائل بعد. ابدأ المحادثة الآن.</p>
          </div>
        )}
        {typingUsers.length > 0 && (
          <div className="flex items-end gap-2 mb-3" dir="ltr">
            <div className="flex -space-x-2 rtl:space-x-reverse">
              {typingUsers.slice(0, 3).map((u) => (
                <div key={u.uid} className="w-7 h-7 rounded-full overflow-hidden border-2 border-black">
                  <Avatar src={u.profilePic} name={u.name || 'مجهول'} size={28} />
                </div>
              ))}
            </div>
            <div className="glass rounded-2xl px-4 py-2.5 flex items-center gap-2">
              <span className="text-sm text-white/70">
                {typingUsers.length === 1 ? `${typingUsers[0].name || 'مجهول'} يكتب` : `${typingUsers.length} أشخاص يكتبون`}
              </span>
              <span className="flex gap-1 items-end h-4 pb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {uploadErr && (
        <div className="px-4 py-2 text-xs text-red-300 bg-red-900/20 border-t border-red-500/20" dir="rtl">{uploadErr}</div>
      )}

      {replyTo && (
        <div className="glass-strong px-4 py-2 border-t border-white/10 flex items-center justify-between" dir="rtl">
          <div className="flex items-center gap-2 min-w-0">
            <Reply size={16} className="text-white/50 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] text-white/50">رد على {members[replyTo.senderId]?.fullName || 'مجهول'}</p>
              <p className="text-xs text-white/70 truncate">{replyTo.content || (replyTo.type === 'image' ? 'صورة' : replyTo.type === 'video' ? 'فيديو' : replyTo.type === 'audio' ? 'رسالة صوتية' : 'ملف')}</p>
            </div>
          </div>
          <button onClick={() => setReplyTo(null)} className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 shrink-0"><X size={14} className="text-white" /></button>
        </div>
      )}

      {pendingFile && (
        <div className="glass-strong px-4 py-3 border-t border-white/10" dir="rtl">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/70 mb-2 truncate">{pendingFile.name}</p>
              {pendingType === 'image' && pendingPreview && (
                <img src={pendingPreview} alt="preview" className="max-h-36 max-w-full rounded-xl object-cover border border-white/10" />
              )}
              {pendingType === 'video' && pendingPreview && (
                <video src={pendingPreview} controls className="max-h-36 max-w-full rounded-xl border border-white/10" preload="metadata" />
              )}
              {pendingType === 'audio' && (
                <div className="flex items-center gap-2 text-white/60 text-sm bg-white/5 rounded-xl px-3 py-2">
                  <span className="w-2 h-2 rounded-full bg-white/60 animate-pulse" />
                  ملف صوتي — أضف تعليقًا أو أرسل
                </div>
              )}
            </div>
            <button type="button" onClick={clearPendingFile} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center shrink-0" title="إزالة">
              <X size={16} className="text-white" />
            </button>
          </div>
        </div>
      )}

      {blocked ? (
        <div className="blocked-banner p-4 text-center text-sm" dir="rtl">
          لا يمكنك إرسال رسائل إلى هذا المستخدم.
        </div>
      ) : (
        <form onSubmit={handleSend} className="glass-strong p-3 flex items-center gap-2 shrink-0 border-t border-white/10">
          <input
            type="file"
            ref={fileRef}
            accept="image/*,video/*,audio/*"
            onChange={handleFile}
            className="hidden"
          />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={loading || voiceState !== 'idle'} className={`w-11 h-11 rounded-full bg-[#111] hover:bg-white/10 border border-white/20 flex items-center justify-center transition shrink-0 disabled:opacity-40 ${voiceState !== 'idle' ? 'hidden' : ''}`} title="إرفاق صورة أو فيديو أو صوت">
            <Paperclip size={20} className="text-white" />
          </button>

          <div className={voiceState !== 'idle' ? 'flex-1 min-w-0' : 'shrink-0'}>
            <VoiceRecorder onRecord={handleVoice} onStateChange={setVoiceState} disabled={loading || pendingFile} />
          </div>

          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={loading ? 'جارٍ الإرسال...' : (pendingFile ? 'اضف تعليقًا (اختياري)...' : 'رسالة...')}
            disabled={loading || voiceState !== 'idle'}
            className={`flex-1 rounded-2xl px-4 py-3 min-w-0 disabled:opacity-60 ${voiceState !== 'idle' ? 'hidden' : ''}`}
          />

          <button
            type="submit"
            disabled={loading || (!text.trim() && !pendingFile) || voiceState !== 'idle'}
            className={`w-11 h-11 rounded-full gradient-bg disabled:opacity-40 transition flex items-center justify-center shrink-0 ${voiceState !== 'idle' ? 'hidden' : ''}`}
          >
            <Send size={20} />
          </button>
        </form>
      )}

      {toast && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl glass-strong border border-white/10 text-sm font-medium page-enter" dir="rtl">
          {toast}
        </div>
      )}
    </div>
  )
}
