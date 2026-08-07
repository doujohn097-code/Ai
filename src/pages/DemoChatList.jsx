import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { Plus, Search, Users } from 'lucide-react'
import DemoLayout from '../components/DemoLayout'
import PullToRefresh from '../components/PullToRefresh'

const groups = [
  { id: '1', name: 'فريق التصميم', image: '', lastMessage: { type: 'text', content: 'تمت المعاينة بنجاح.', createdAt: { seconds: Date.now()/1000 - 120 }, senderId: 'u1' }, lastSender: { fullName: 'أحمد' }, createdAt: { seconds: Date.now()/1000 - 3600 } },
  { id: '2', name: 'المطورين', image: '', lastMessage: { type: 'image', createdAt: { seconds: Date.now()/1000 - 600 }, senderId: 'u2' }, lastSender: { fullName: 'سارة' }, createdAt: { seconds: Date.now()/1000 - 7200 } },
  { id: '3', name: 'الإدارة', image: '', lastMessage: { type: 'audio', createdAt: { seconds: Date.now()/1000 - 1800 }, senderId: 'u3' }, lastSender: { fullName: 'خالد' }, createdAt: { seconds: Date.now()/1000 - 86400 } },
]

function formatTime(ts) {
  if (!ts?.seconds) return ''
  const d = new Date(ts.seconds * 1000)
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
}

export default function DemoChatList() {
  const navigate = useNavigate()
  const handleRefresh = async () => {
    await new Promise(resolve => setTimeout(resolve, 1200))
  }

  return (
    <DemoLayout unreadCount={2} requestCount={1}>
      <div className="px-4 sm:px-5 py-3">
        <div className="relative">
          <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40" />
          <input placeholder="البحث في المحادثات..." className="w-full rounded-2xl py-3 pr-11 pl-4" />
        </div>
      </div>

      <PullToRefresh onRefresh={handleRefresh} contentClassName="px-4 sm:px-5 pb-28 space-y-3">
        {groups.map(g => (
          <div key={g.id} onClick={() => navigate('/demo')}
            className="glass rounded-2xl p-3 flex items-center gap-3 cursor-pointer hover:bg-[#0a0a0a] hover:border-white/20 transition border border-transparent">
            <Avatar src={g.image} name={g.name} size={52} />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center gap-2">
                <h3 className="font-semibold truncate">{g.name}</h3>
                <span className="text-xs text-white/40 shrink-0">{formatTime(g.lastMessage?.createdAt)}</span>
              </div>
              <p className="text-sm text-white/50 truncate mt-0.5">
                <span className="text-white">{g.lastSender?.fullName}:</span>{' '}
                {g.lastMessage.type === 'text' ? g.lastMessage.content : g.lastMessage.type === 'image' ? 'صورة' : g.lastMessage.type === 'video' ? 'فيديو' : g.lastMessage.type === 'audio' ? 'رسالة صوتية' : 'ملف'}
              </p>
            </div>
          </div>
        ))}
      </PullToRefresh>

      <button onClick={() => {}} className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 w-14 h-14 rounded-full gradient-bg flex items-center justify-center shadow-lg hover:scale-105 transition z-30">
        <Plus size={28} />
      </button>
    </DemoLayout>
  )
}
