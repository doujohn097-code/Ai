import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, UserPlus, MessageCircle, Clock, Check, X } from 'lucide-react'
import DemoLayout from '../components/DemoLayout'

const users = [
  { uid: 'u1', fullName: 'أحمد بن علي', username: 'ahmed_dev', state: 'accepted' },
  { uid: 'u2', fullName: 'سارة خالد', username: 'sara_design', state: 'pending_in' },
  { uid: 'u3', fullName: 'خالد العلي', username: 'khaled_m', state: 'none' },
  { uid: 'u4', fullName: 'ليلى محمود', username: 'laila_m', state: 'pending_out' },
]

export default function DemoUsers() {
  const navigate = useNavigate()
  return (
    <DemoLayout unreadCount={2} requestCount={1}>
      <div className="px-4 sm:px-5 py-3">
        <div className="relative">
          <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40" />
          <input placeholder="البحث عن مستخدم..." className="w-full rounded-2xl py-3 pr-11 pl-4" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-5 pb-28 space-y-3">
        {users.map(u => (
          <div key={u.uid} className="glass rounded-2xl p-3 flex items-center gap-3 border border-transparent">
            <div onClick={() => navigate('/demo/profile')} className="cursor-pointer w-12 h-12 rounded-full bg-[#111] border border-white/20 flex items-center justify-center font-bold text-lg">{u.fullName[0]}</div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{u.fullName}</h3>
              <p className="text-xs text-white/40 truncate">@{u.username}</p>
            </div>
            <div className="shrink-0">
              {u.state === 'none' && (
                <button className="w-10 h-10 rounded-full bg-[#111] hover:bg-white/10 border border-white/20 flex items-center justify-center" title="إرسال طلب صداقة"><UserPlus size={18} /></button>
              )}
              {u.state === 'pending_out' && (
                <button className="w-10 h-10 rounded-full bg-[#111] hover:bg-white/10 border border-white/20 flex items-center justify-center" title="طلب معلق"><Clock size={18} /></button>
              )}
              {u.state === 'pending_in' && (
                <div className="flex gap-2">
                  <button className="w-10 h-10 rounded-full gradient-bg text-black flex items-center justify-center" title="قبول"><Check size={18} /></button>
                  <button className="w-10 h-10 rounded-full bg-[#111] hover:bg-white/10 border border-white/20 flex items-center justify-center" title="رفض"><X size={18} /></button>
                </div>
              )}
              {u.state === 'accepted' && (
                <button className="w-10 h-10 rounded-full gradient-bg text-black flex items-center justify-center" title="مراسلة"><MessageCircle size={18} /></button>
              )}
            </div>
          </div>
        ))}
      </div>
    </DemoLayout>
  )
}
