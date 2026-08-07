import React, { useState, useRef } from 'react'
import { createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth'
import { doc, setDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../App.jsx'
import { uploadFile } from '../utils/uploadFile'
import { Camera, User, Eye, EyeOff } from 'lucide-react'

function getErrorMessage(err) {
  const code = err?.code || ''
  if (code.includes('email-already-in-use')) return 'هذا البريد الإلكتروني مستخدم بالفعل.'
  if (code.includes('invalid-email')) return 'البريد الإلكتروني غير صالح.'
  if (code.includes('weak-password')) return 'كلمة المرور ضعيفة (6 أحرف على الأقل).'
  if (code.includes('auth/configuration-not-found')) return 'تسجيل الدخول بالبريد غير مفعّل في Firebase.'
  if (code.includes('permission-denied')) return 'صلاحيات Firestore غير مفتوحة. ارفع firestore.rules في Firebase.'
  if (err?.message?.includes('R2 CORS not configured') || err?.message?.includes('CORS')) return 'CORS في R2 غير مفعّل. اضبطه يدويًا في لوحة Cloudflare أو أعطِ توكن بصلاحية R2 Edit.'
  if (err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')) return 'فشل الاتصال بخادم الرفع. تأكد من تفعيل CORS ومن أن R2 عام.'
  return err?.message || 'حدث خطأ أثناء إنشاء الحساب.'
}

export default function Signup() {
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [profilePic, setProfilePic] = useState(null)
  const [coverPic, setCoverPic] = useState(null)
  const [profilePreview, setProfilePreview] = useState('')
  const [coverPreview, setCoverPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const profileRef = useRef()
  const coverRef = useRef()
  const navigate = useNavigate()
  const { setLockSignup } = useAuth()

  const handleFile = (file, setter, previewSetter) => {
    if (!file) return
    setter(file)
    previewSetter(URL.createObjectURL(file))
  }

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setLockSignup(true)
    try {
      const cleanUser = username.trim().toLowerCase().replace(/\s+/g, '_')
      if (!/^[a-z0-9_]{3,20}$/.test(cleanUser)) {
        throw new Error('اسم المستخدم يجب أن يكون 3-20 حرفًا وأرقام/شرطة سفلية فقط.')
      }
      try {
        const q = query(collection(db, 'users'), where('username', '==', cleanUser))
        const existing = await getDocs(q)
        if (!existing.empty) throw new Error('اسم المستخدم مستخدم بالفعل.')
      } catch (err) {
        if (err.message === 'اسم المستخدم مستخدم بالفعل.') throw err
        console.warn('Username check failed (continuing)', err)
      }

      const cred = await createUserWithEmailAndPassword(auth, email, password)
      const uid = cred.user.uid

      const [profileUrl, coverUrl] = await Promise.all([
        profilePic ? uploadFile(profilePic, `users/${uid}/profile`) : Promise.resolve(''),
        coverPic ? uploadFile(coverPic, `users/${uid}/cover`) : Promise.resolve(''),
      ])

      await updateProfile(cred.user, { displayName: fullName, photoURL: profileUrl })

      await setDoc(doc(db, 'users', uid), {
        uid,
        fullName,
        username: cleanUser,
        email,
        profilePic: profileUrl,
        coverPic: coverUrl,
        createdAt: serverTimestamp(),
      })
      navigate('/')
    } catch (err) {
      console.error('Signup error', err)
      try { await signOut(auth) } catch {}
      setError(getErrorMessage(err))
    } finally {
      setLockSignup(false)
      setLoading(false)
    }
  }

  return (
    <div className="h-screen w-full overflow-y-auto bg-black p-4 sm:p-6" dir="rtl">
      <div className="min-h-full w-full flex flex-col items-center justify-center">
        <div className="w-full max-w-md glass-strong rounded-3xl p-5 sm:p-6 page-enter border border-white/10 my-auto">
          <div className="flex flex-col items-center mb-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl overflow-hidden mb-3 shadow-2xl border border-white/10">
              <img src="/logo.png" alt="Gestion" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-bold gradient-text">إنشاء حساب</h1>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div className="relative h-32 sm:h-40 rounded-2xl overflow-hidden bg-[#111] border border-white/10 cursor-pointer group"
                 onClick={() => coverRef.current.click()}>
              {coverPreview ? <img src={coverPreview} alt="cover" className="w-full h-full object-cover opacity-70" /> : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40">
                  <Camera size={28} />
                  <span className="text-xs mt-1">صورة الغلاف</span>
                </div>
              )}
              <input type="file" accept="image/*" ref={coverRef} onChange={e => handleFile(e.target.files[0], setCoverPic, setCoverPreview)} />
            </div>

            <div className="flex justify-center -mt-10 relative z-10">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden ring-4 ring-black cursor-pointer border border-white/20 bg-[#111111] flex items-center justify-center shadow-lg"
                   onClick={() => profileRef.current.click()}>
                {profilePreview ? <img src={profilePreview} alt="profile" className="w-full h-full object-cover" /> : (
                  <div className="w-full h-full flex items-center justify-center text-white/80">
                    <User size={32} />
                  </div>
                )}
              </div>
              <input type="file" accept="image/*" ref={profileRef} onChange={e => handleFile(e.target.files[0], setProfilePic, setProfilePreview)} />
            </div>

            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="الاسم الكامل" required
              className="w-full rounded-2xl px-4 py-3" />

            <input value={username} onChange={e => setUsername(e.target.value)} placeholder="اسم المستخدم" required
              className="w-full rounded-2xl px-4 py-3" />

            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="البريد الإلكتروني" required
              className="w-full rounded-2xl px-4 py-3" />

            <div className="relative">
              <button type="button" onClick={() => setShow(!show)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition">
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <input type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="كلمة المرور" required minLength={6}
                className="w-full rounded-2xl px-4 py-3 pr-12" />
            </div>

            {error && <p className="text-white text-sm bg-white/10 rounded-xl p-3 border border-white/10">{error}</p>}

            <button type="submit" disabled={loading} className="w-full gradient-bg text-black font-bold py-3.5 rounded-2xl transition disabled:opacity-60">
              {loading ? 'جارٍ الإنشاء...' : 'إنشاء الحساب'}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-white/50">
            لديك حساب بالفعل؟ <Link to="/login" className="text-white font-medium hover:underline">تسجيل الدخول</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
