import React, { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../firebase'
import { Link } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'

function getErrorMessage(err) {
  const code = err?.code || ''
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
  }
  if (code.includes('invalid-email')) return 'البريد الإلكتروني غير صالح.'
  if (code.includes('too-many-requests')) return 'عدد محاولات كبير، حاول لاحقًا.'
  return err?.message || 'حدث خطأ أثناء تسجيل الدخول.'
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      setError(getErrorMessage(err))
    }
    setLoading(false)
  }

  return (
    <div className="h-screen w-full overflow-y-auto bg-black p-4 sm:p-6" dir="rtl">
      <div className="min-h-full w-full flex flex-col items-center justify-center">
        <div className="w-full max-w-md glass-strong rounded-3xl p-6 sm:p-8 page-enter border border-white/10 my-auto">
          <div className="flex flex-col items-center mb-8 sm:mb-10">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl overflow-hidden mb-4 sm:mb-5 shadow-2xl border border-white/10">
              <img src="/logo.png" alt="Gestion" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text mb-1">Gestion</h1>
            <p className="text-white/50 text-sm">مرحبًا بعودتك</p>
          </div>
          <form onSubmit={submit} className="space-y-3 sm:space-y-4">
            <div className="relative">
              <Mail size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="البريد الإلكتروني"
                className="w-full rounded-2xl px-4 py-3 pr-11"
                required
              />
            </div>
            <div className="relative">
              <Lock size={18} className="absolute right-11 top-1/2 -translate-y-1/2 text-white/40" />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition">
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="كلمة المرور"
                className="w-full rounded-2xl px-4 py-3 pr-24"
                required
              />
            </div>
            {error && <p className="text-white text-sm bg-white/10 rounded-xl p-3 border border-white/10">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full gradient-bg text-black font-bold py-3.5 rounded-2xl transition disabled:opacity-60"
            >
              {loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
            </button>
          </form>
          <div className="mt-5 text-center text-sm text-white/50">
            ليس لديك حساب؟{' '}
            <Link to="/signup" className="text-white font-medium hover:underline">أنشئ حسابًا</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
