import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, MessageCircle, User, Mail, Calendar } from 'lucide-react'

export default function DemoProfile() {
  const navigate = useNavigate()
  const target = {
    fullName: 'أحمد بن علي',
    username: 'ahmed_dev',
    email: 'ahmed@example.com',
    profilePic: '',
    coverPic: '',
    createdAt: { seconds: 1704067200 },
  }

  return (
    <div className="h-screen w-full overflow-y-auto bg-black flex flex-col" dir="rtl">
      <div className="relative h-44 sm:h-48 w-full shrink-0">
        {target.coverPic ? (
          <img src={target.coverPic} alt="cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-[#111]" />
        )}
        <div className="absolute top-4 left-4">
          <button onClick={() => navigate('/demo/chatlist')} className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur border border-white/20 flex items-center justify-center transition">
            <ChevronRight size={22} className="text-white" />
          </button>
        </div>
      </div>
      <div className="relative px-5 sm:px-6 -mt-12 flex flex-col items-center text-center">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full ring-4 ring-black overflow-hidden border border-white/20 bg-[#111] flex items-center justify-center shadow-xl">
          {target.profilePic ? <img src={target.profilePic} alt="profile" className="w-full h-full object-cover" /> : <span className="text-white text-3xl font-bold">{target.fullName[0]}</span>}
        </div>
        <h1 className="mt-3 text-xl sm:text-2xl font-bold gradient-text">{target.fullName}</h1>
        <p className="text-white/50">@{target.username}</p>

        <button className="mt-4 flex items-center gap-2 px-6 sm:px-8 py-2.5 rounded-2xl gradient-bg text-black font-bold hover:scale-105 transition">
          <MessageCircle size={20} /> مراسلة
        </button>
      </div>

      <div className="flex-1 px-5 sm:px-6 py-6">
        <div className="glass-strong rounded-2xl p-4 sm:p-5 border border-white/10">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-white"><User size={18} /> نبذة</h3>
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#111] border border-white/10 flex items-center justify-center text-white/60"><User size={16} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-white/50 text-xs">الاسم الكامل</p>
                <p className="text-white font-medium truncate">{target.fullName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#111] border border-white/10 flex items-center justify-center text-white/60"><Mail size={16} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-white/50 text-xs">البريد الإلكتروني</p>
                <p className="text-white font-medium truncate">{target.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#111] border border-white/10 flex items-center justify-center text-white/60"><Calendar size={16} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-white/50 text-xs">تاريخ الانضمام</p>
                <p className="text-white font-medium">{new Date(target.createdAt.seconds * 1000).toLocaleDateString('ar-EG')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
