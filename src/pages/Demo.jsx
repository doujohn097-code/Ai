import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { MessageBubble } from '../components/MessageBubble'
import { Send, Paperclip, ChevronRight, Mic } from 'lucide-react'

const me = { fullName: 'أنت', profilePic: '' }
const other = { fullName: 'أحمد', profilePic: '' }
const messages = [
  { id: 1, senderId: 'other', type: 'text', content: 'مرحبا! هل انتهيت من تصميم Gestion؟', createdAt: { seconds: Date.now() / 1000 - 120 } },
  { id: 2, senderId: 'me', type: 'text', content: 'نعم، لقد أرسلت صور المعاينة للتو.', createdAt: { seconds: Date.now() / 1000 - 60 } },
  { id: 3, senderId: 'other', type: 'image', mediaUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&q=80', createdAt: { seconds: Date.now() / 1000 - 30 } },
  { id: 4, senderId: 'me', type: 'text', content: 'رائع! التصميم أنيق ويليق بالشعار.', createdAt: { seconds: Date.now() / 1000 - 10 } },
]

export default function Demo() {
  const navigate = useNavigate()
  return (
    <div className="h-screen w-full bg-black flex flex-col overflow-hidden" dir="rtl">
      <header className="glass-strong px-4 py-3 flex items-center gap-3 shrink-0 border-b border-white/10">
        <button onClick={() => navigate('/login')} className="w-10 h-10 rounded-full bg-[#111] hover:bg-white/10 border border-white/20 flex items-center justify-center transition shrink-0">
          <ChevronRight size={22} className="text-white" />
        </button>
        <Avatar src="" name="فريق التصميم" size={46} />
        <div className="min-w-0">
          <h2 className="font-bold text-lg leading-tight truncate">فريق التصميم</h2>
          <p className="text-xs text-white/40">3 أعضاء</p>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-4" dir="rtl">
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} user={msg.senderId === 'me' ? me : other} isMe={msg.senderId === 'me'} />
        ))}
      </div>
      <form className="glass-strong p-3 flex items-center gap-2 shrink-0 border-t border-white/10" onSubmit={e => e.preventDefault()}>
        <button type="button" className="w-11 h-11 rounded-full bg-[#111] hover:bg-white/10 border border-white/20 flex items-center justify-center transition shrink-0">
          <Paperclip size={20} className="text-white" />
        </button>
        <button type="button" className="w-11 h-11 rounded-full bg-[#111] hover:bg-white/10 border border-white/20 flex items-center justify-center transition shrink-0">
          <Mic size={20} className="text-white" />
        </button>
        <input placeholder="رسالة..." className="flex-1 rounded-2xl px-4 py-3 min-w-0" />
        <button type="button" className="w-11 h-11 rounded-full gradient-bg flex items-center justify-center shrink-0">
          <Send size={20} />
        </button>
      </form>
    </div>
  )
}
