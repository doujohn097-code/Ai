import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, addDoc, getDocs, onSnapshot, query, collection, serverTimestamp, where, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { updateEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { auth, db } from '../firebase'
import { useAuth } from '../App'
import { uploadFile } from '../utils/uploadFile'
import { ChevronRight, MessageCircle, User, Mail, UserPlus, Check, Send, Pencil, Camera, Lock, AtSign, FileText, Save, Ban, Users } from 'lucide-react'
import { Avatar } from '../components/Avatar'
import { usePresence } from '../hooks/usePresence'
import { formatActiveStatus } from '../utils/activeStatus'

export default function Profile() {
  const { uid } = useParams()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [target, setTarget] = useState(null)
  const [loading, setLoading] = useState(true)
  const [relation, setRelation] = useState(null)
  const [blocked, setBlocked] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    bio: '',
    profilePic: '',
    coverPic: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const [pendingPics, setPendingPics] = useState({ profilePic: '', coverPic: '' })
  const [friends, setFriends] = useState([])

  const profileRef = useRef()
  const coverRef = useRef()
  const fromReqs = useRef([])
  const toReqs = useRef([])

  useEffect(() => {
    const fetch = async () => {
      try {
        const ref = doc(db, 'users', uid)
        const snap = await getDoc(ref)
        if (snap.exists()) {
          const data = { uid: snap.id, ...snap.data() }
          setTarget(data)
          setForm({
            fullName: data.fullName || '',
            username: data.username || '',
            email: data.email || '',
            bio: data.bio || '',
            profilePic: data.profilePic || '',
            coverPic: data.coverPic || '',
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
          })
          setPendingPics({ profilePic: data.profilePic || '', coverPic: data.coverPic || '' })
        }
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    fetch()
  }, [uid])

  useEffect(() => {
    if (!user || uid === user.uid) return
    const q1 = query(collection(db, 'friendRequests'), where('from', '==', user.uid), where('to', '==', uid))
    const q2 = query(collection(db, 'friendRequests'), where('from', '==', uid), where('to', '==', user.uid))
    const findMatch = (snap) => {
      const match = snap.docs.find(d => {
        const data = d.data()
        return (data.from === user.uid && data.to === uid) || (data.from === uid && data.to === user.uid)
      })
      if (match) {
        setRelation({ id: match.id, status: match.data().status, direction: match.data().from === user.uid ? 'out' : 'in' })
      } else {
        setRelation(prev => prev)
      }
    }
    const unsub1 = onSnapshot(q1, findMatch)
    const unsub2 = onSnapshot(q2, findMatch)
    return () => { unsub1(); unsub2() }
  }, [user, uid])

  const sendRequest = async () => {
    try { await addDoc(collection(db, 'friendRequests'), { from: user.uid, to: uid, status: 'pending', createdAt: serverTimestamp() }) } catch (e) { console.error(e) }
  }

  const { online, lastSeen } = usePresence(uid)
  const activeStatus = formatActiveStatus({ online, lastSeen })

  useEffect(() => {
    const myBlocked = profile?.blockedUsers || []
    setBlocked(myBlocked.includes(uid))
  }, [profile, uid])

  useEffect(() => {
    if (!uid) return
    const loadFriends = async () => {
      const friendIds = new Set()
      ;[...fromReqs.current, ...toReqs.current].forEach(d => {
        const data = d.data ? d.data() : d
        const fid = data.from === uid ? data.to : data.from
        if (fid && fid !== uid) friendIds.add(fid)
      })
      const list = []
      await Promise.all([...friendIds].map(async fid => {
        const snap = await getDoc(doc(db, 'users', fid))
        if (snap.exists()) list.push({ uid: snap.id, ...snap.data() })
      }))
      setFriends(list)
    }
    const q1 = query(collection(db, 'friendRequests'), where('from', '==', uid), where('status', '==', 'accepted'))
    const q2 = query(collection(db, 'friendRequests'), where('to', '==', uid), where('status', '==', 'accepted'))
    const unsub1 = onSnapshot(q1, (snap) => { fromReqs.current = snap.docs; loadFriends() })
    const unsub2 = onSnapshot(q2, (snap) => { toReqs.current = snap.docs; loadFriends() })
    return () => { unsub1(); unsub2() }
  }, [uid])



  const toggleBlock = async () => {
    if (!user || uid === user.uid) return
    const myRef = doc(db, 'users', user.uid)
    if (blocked) {
      await updateDoc(myRef, { blockedUsers: arrayRemove(uid) })
      setBlocked(false)
    } else {
      await updateDoc(myRef, { blockedUsers: arrayUnion(uid) })
      setBlocked(true)
    }
  }

  const startChat = async () => {
    if (uid === user.uid) return
    try {
      const q = query(collection(db, 'groups'), where('members', 'array-contains', user.uid))
      const snap = await getDocs(q)
      const existing = snap.docs.find(d => {
        const m = d.data().members || []
        return m.length === 2 && m.includes(uid)
      })
      if (existing) { navigate(`/chat/${existing.id}`); return }
      const ref = await addDoc(collection(db, 'groups'), {
        name: target.fullName,
        image: target.profilePic || '',
        members: [user.uid, uid].sort(),
        type: 'direct',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        lastMessage: null,
      })
      navigate(`/chat/${ref.id}`)
    } catch (e) { console.error(e) }
  }

  const handleFile = async (type, e) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Only ever write into the signed-in user's own storage prefix.
    if (!user || uid !== user.uid) return
    if (!file.type.startsWith('image/')) {
      setErr('يرجى اختيار ملف صورة صالح.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr('حجم الصورة يجب أن يكون أقل من 5 ميغابايت.')
      return
    }
    try {
      const url = await uploadFile(file, `users/${user.uid}/${type}`)
      setPendingPics(prev => ({ ...prev, [type]: url }))
      setErr('')
    } catch {
      setErr('فشل رفع الصورة.')
    }
  }

  const validate = async () => {
    if (!form.fullName.trim()) return 'الاسم الكامل مطلوب.'
    if (!form.username.trim()) return 'اسم المستخدم مطلوب.'
    if (form.username.trim() !== target.username) {
      const q = query(collection(db, 'users'), where('username', '==', form.username.trim().toLowerCase()))
      const snap = await getDocs(q)
      const taken = snap.docs.find(d => d.id !== uid)
      if (taken) return 'اسم المستخدم مستخدم بالفعل.'
    }
    if (form.newPassword && form.newPassword.length < 6) return 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل.'
    if (form.newPassword && form.newPassword !== form.confirmPassword) return 'كلمتا المرور غير متطابقتين.'
    if ((form.newPassword || form.email !== target.email) && !form.currentPassword) return 'أدخل كلمة المرور الحالية لتغيير البريد أو كلمة المرور.'
    return ''
  }

  const save = async () => {
    setErr('')
    setMsg('')
    // Guard: never allow saving onto a profile that is not your own.
    if (!user || uid !== user.uid) {
      setErr('لا يمكنك تعديل بروفايل مستخدم آخر.')
      return
    }
    const error = await validate()
    if (error) { setErr(error); return }

    setSaving(true)
    try {
      let reauth = null
      if ((form.newPassword || form.email !== target.email) && form.currentPassword) {
        const credential = EmailAuthProvider.credential(user.email, form.currentPassword)
        reauth = await reauthenticateWithCredential(auth.currentUser, credential)
      }

      if (form.email !== target.email && reauth) {
        await updateEmail(auth.currentUser, form.email)
      }

      if (form.newPassword && reauth) {
        await updatePassword(auth.currentUser, form.newPassword)
      }

      const updates = {
        fullName: form.fullName.trim(),
        username: form.username.trim().toLowerCase(),
        email: form.email.trim(),
        bio: form.bio.trim(),
        profilePic: pendingPics.profilePic,
        coverPic: pendingPics.coverPic,
      }
      await updateDoc(doc(db, 'users', user.uid), updates)

      setTarget(prev => ({ ...prev, ...updates }))
      setMsg('تم حفظ التغييرات.')
      setEditMode(false)
      setForm(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }))
    } catch (e) {
      console.error(e)
      setErr(mapAuthError(e))
    }
    setSaving(false)
  }

  const mapAuthError = (e) => {
    const code = e.code || e.message
    if (code.includes('wrong-password')) return 'كلمة المرور الحالية غير صحيحة.'
    if (code.includes('invalid-email')) return 'البريد الإلكتروني غير صالح.'
    if (code.includes('email-already-in-use')) return 'البريد الإلكتروني مستخدم بالفعل.'
    if (code.includes('weak-password')) return 'كلمة المرور ضعيفة.'
    return 'حدث خطأ أثناء الحفظ.'
  }

  const cancel = () => {
    setEditMode(false)
    setErr('')
    setMsg('')
    setForm({
      fullName: target.fullName || '',
      username: target.username || '',
      email: target.email || '',
      bio: target.bio || '',
      profilePic: target.profilePic || '',
      coverPic: target.coverPic || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    })
    setPendingPics({ profilePic: target.profilePic || '', coverPic: target.coverPic || '' })
  }

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center overflow-y-auto bg-black" dir="rtl">
        <div className="w-10 h-10 rounded-full border-4 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  if (!target) {
    return (
      <div className="h-screen w-full flex items-center justify-center overflow-y-auto bg-black" dir="rtl">
        <p className="text-white/50">تعذر تحميل البيانات.</p>
      </div>
    )
  }

  const isMe = uid === user.uid

  const displayPic = editMode ? pendingPics.profilePic : target.profilePic
  const displayCover = editMode ? pendingPics.coverPic : target.coverPic

  return (
    <div className="h-screen w-full overflow-y-auto bg-black flex flex-col" dir="rtl">
      <div className="relative h-52 sm:h-60 w-full shrink-0">
        {displayCover ? (
          <img src={displayCover} alt="cover" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-white/10 to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute top-4 left-4">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur border border-white/20 flex items-center justify-center transition">
            <ChevronRight size={22} className="text-white" />
          </button>
        </div>
        {isMe && editMode && (
          <>
            <input type="file" accept="image/*" ref={coverRef} onChange={(e) => handleFile('coverPic', e)} className="hidden" />
            <button onClick={() => coverRef.current?.click()} className="absolute bottom-4 right-4 px-3 py-2 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur border border-white/20 text-white text-xs flex items-center gap-2 transition">
              <Camera size={14} /> تغيير الغلاف
            </button>
          </>
        )}
      </div>

      <div className="relative px-5 sm:px-6 -mt-16 flex flex-col items-center text-center">
        <div className="relative">
          <div className="rounded-full ring-4 ring-black border border-white/20 shadow-xl bg-[#111] p-1">
            <Avatar src={displayPic} name={target.fullName} size={128} online={online && !isMe} />
          </div>
          {isMe && editMode && (
            <>
              <input type="file" accept="image/*" ref={profileRef} onChange={(e) => handleFile('profilePic', e)} className="hidden" />
              <button onClick={() => profileRef.current?.click()} className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-white text-black border-2 border-black flex items-center justify-center hover:scale-105 transition">
                <Camera size={16} />
              </button>
            </>
          )}
        </div>

        {!editMode ? (
          <>
            <h1 className="mt-4 text-2xl sm:text-3xl font-bold gradient-text">{target.fullName}</h1>
            <p className="text-white/50">@{target.username}</p>
            {activeStatus && <p className={`text-xs mt-1 ${online ? 'text-green-400' : 'text-white/40'}`}>{activeStatus}</p>}
            {target.bio && <p className="mt-3 text-white/70 text-sm max-w-md leading-relaxed">{target.bio}</p>}

            {isMe && (
              <button onClick={() => setEditMode(true)} className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-2xl glass text-white font-medium hover:bg-white/10 transition">
                <Pencil size={16} /> تعديل البروفايل
              </button>
            )}
          </>
        ) : (
          <div className="w-full max-w-md mt-4 text-right space-y-3">
            {err && <div className="rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm px-4 py-2.5">{err}</div>}
            {msg && <div className="rounded-xl bg-green-500/10 border border-green-500/20 text-green-300 text-sm px-4 py-2.5">{msg}</div>}

            <div>
              <label className="text-white/60 text-xs mb-1 block">الاسم الكامل</label>
              <div className="flex items-center gap-2 glass rounded-xl px-3 py-2.5 border border-white/10">
                <User size={16} className="text-white/40" />
                <input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} className="flex-1 bg-transparent border-none outline-none text-sm" />
              </div>
            </div>

            <div>
              <label className="text-white/60 text-xs mb-1 block">اسم المستخدم</label>
              <div className="flex items-center gap-2 glass rounded-xl px-3 py-2.5 border border-white/10">
                <AtSign size={16} className="text-white/40" />
                <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="flex-1 bg-transparent border-none outline-none text-sm" dir="ltr" />
              </div>
            </div>

            <div>
              <label className="text-white/60 text-xs mb-1 block">نبذة</label>
              <div className="flex items-start gap-2 glass rounded-xl px-3 py-2.5 border border-white/10">
                <FileText size={16} className="text-white/40 mt-1" />
                <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={3} className="flex-1 bg-transparent border-none outline-none text-sm resize-none" placeholder="اكتب نبذة قصيرة عنك..." />
              </div>
            </div>

            <div className="glass-strong rounded-xl p-4 border border-white/10 space-y-3">
              <p className="text-white/70 text-sm font-medium flex items-center gap-2"><Lock size={16} /> تغيير البريد أو كلمة المرور</p>
              <div>
                <label className="text-white/60 text-xs mb-1 block">البريد الإلكتروني</label>
                <div className="flex items-center gap-2 glass rounded-xl px-3 py-2.5 border border-white/10">
                  <Mail size={16} className="text-white/40" />
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="flex-1 bg-transparent border-none outline-none text-sm" dir="ltr" />
                </div>
              </div>
              <div>
                <label className="text-white/60 text-xs mb-1 block">كلمة المرور الحالية</label>
                <div className="flex items-center gap-2 glass rounded-xl px-3 py-2.5 border border-white/10">
                  <Lock size={16} className="text-white/40" />
                  <input type="password" value={form.currentPassword} onChange={e => setForm({ ...form, currentPassword: e.target.value })} className="flex-1 bg-transparent border-none outline-none text-sm" placeholder="مطلوبة لتغيير البريد أو كلمة المرور" />
                </div>
              </div>
              <div>
                <label className="text-white/60 text-xs mb-1 block">كلمة المرور الجديدة</label>
                <div className="flex items-center gap-2 glass rounded-xl px-3 py-2.5 border border-white/10">
                  <Lock size={16} className="text-white/40" />
                  <input type="password" value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })} className="flex-1 bg-transparent border-none outline-none text-sm" placeholder="اتركها فارغة إذا لم ترغب في التغيير" />
                </div>
              </div>
              <div>
                <label className="text-white/60 text-xs mb-1 block">تأكيد كلمة المرور الجديدة</label>
                <div className="flex items-center gap-2 glass rounded-xl px-3 py-2.5 border border-white/10">
                  <Lock size={16} className="text-white/40" />
                  <input type="password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} className="flex-1 bg-transparent border-none outline-none text-sm" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={cancel} disabled={saving} className="flex-1 py-3 rounded-2xl glass text-white font-medium hover:bg-white/10 transition disabled:opacity-50">إلغاء</button>
              <button onClick={save} disabled={saving} className="flex-1 py-3 rounded-2xl gradient-bg text-black font-bold flex items-center justify-center gap-2 transition disabled:opacity-50">
                {saving ? <div className="w-5 h-5 rounded-full border-2 border-black/30 border-t-black animate-spin" /> : <><Save size={18} /> حفظ</>}
              </button>
            </div>
          </div>
        )}

        {!isMe && (
          <div className="mt-5 flex gap-2">
            {relation?.status === 'accepted' ? (
              <button onClick={startChat} className="flex items-center gap-2 px-6 sm:px-8 py-2.5 rounded-2xl gradient-bg text-black font-bold hover:scale-105 transition">
                <MessageCircle size={20} /> مراسلة
              </button>
            ) : relation?.status === 'pending' ? (
              <button disabled className="flex items-center gap-2 px-6 sm:px-8 py-2.5 rounded-2xl bg-[#111] border border-white/20 text-white/60">
                {relation.direction === 'out' ? <><Send size={18} /> تم الإرسال</> : <><Check size={18} /> طلب معلق</>}
              </button>
            ) : (
              <button onClick={sendRequest} className="flex items-center gap-2 px-6 sm:px-8 py-2.5 rounded-2xl gradient-bg text-black font-bold hover:scale-105 transition">
                <UserPlus size={20} /> إضافة صديق
              </button>
            )}
            <button onClick={toggleBlock} className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-2xl font-bold transition ${blocked ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-[#111] border border-white/20 text-white hover:bg-white/10'}`}>
              <Ban size={18} /> {blocked ? 'إلغاء الحظر' : 'حظر'}
            </button>
          </div>
        )}
      </div>

      {!editMode && (
        <div className="flex-1 px-5 sm:px-6 py-6 overflow-hidden">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-white"><Users size={18} /> الأصدقاء ({friends.length})</h3>
          {friends.length === 0 ? (
            <p className="text-white/40 text-sm">لا يوجد أصدقاء بعد.</p>
          ) : (
            <div className="flex overflow-x-auto gap-3 pb-2 snap-x">
              {friends.map(f => (
                <div
                  key={f.uid}
                  onClick={() => navigate(`/profile/${f.uid}`)}
                  className="snap-start shrink-0 w-56 glass rounded-2xl p-3 flex items-center gap-3 cursor-pointer hover:bg-white/10 transition"
                >
                  <Avatar src={f.profilePic} name={f.fullName} size={56} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{f.fullName}</p>
                    <p className="text-xs text-white/50 truncate">@{f.username}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
