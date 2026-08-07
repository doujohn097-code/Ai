import React from 'react'
import { Inbox, Check, X, Send } from 'lucide-react'
import DemoLayout from '../components/DemoLayout'

export default function DemoRequests() {
  return (
    <DemoLayout unreadCount={2} requestCount={1}>
      <div className="flex-1 overflow-y-auto px-4 sm:px-5 pb-28 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white/60 mb-2 flex items-center gap-2"><Inbox size={16} /> طلبات واردة</h3>
          <div className="space-y-3">
            <div className="glass rounded-2xl p-3 flex items-center gap-3 border border-transparent">
              <div className="w-12 h-12 rounded-full bg-[#111] border border-white/20 flex items-center justify-center font-bold text-lg">س</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">سارة خالد</h3>
                <p className="text-xs text-white/40 truncate">@sara_design</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button className="w-10 h-10 rounded-full gradient-bg text-black flex items-center justify-center"><Check size={18} /></button>
                <button className="w-10 h-10 rounded-full bg-[#111] hover:bg-white/10 border border-white/20 flex items-center justify-center"><X size={18} /></button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white/60 mb-2 flex items-center gap-2"><Send size={16} /> طلبات مرسلة</h3>
          <div className="space-y-3">
            <div className="glass rounded-2xl p-3 flex items-center gap-3 border border-transparent">
              <div className="w-12 h-12 rounded-full bg-[#111] border border-white/20 flex items-center justify-center font-bold text-lg">ل</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">ليلى محمود</h3>
                <p className="text-xs text-white/40 truncate">@laila_m</p>
              </div>
              <button className="w-10 h-10 rounded-full bg-[#111] hover:bg-white/10 border border-white/20 flex items-center justify-center shrink-0"><X size={18} /></button>
            </div>
          </div>
        </div>
      </div>
    </DemoLayout>
  )
}
