import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../App'
import { Avatar } from '../components/Avatar'
import { Check, X, Inbox, Send } from 'lucide-react'
import Layout from '../components/Layout'

export default function Requests() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])
  const [userCache, setUserCache] = useState({})

  useEffect(() => {
    if (!user) return
    const q1 = query(collection(db, 'friendRequests'), where('to', '==', user.uid), where('status', '==', 'pending'))
    const unsub1 = onSnapshot(q1, (snap) => setIncoming(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

    const q2 = query(collection(db, 'friendRequests'), where('from', '==', user.uid), where('status', '==', 'pending'))
    const unsub2 = onSnapshot(q2, (snap) => setOutgoing(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

    return () => { unsub1(); unsub2() }
  }, [user])

  useEffect(() => {
    const allUids = [...incoming.map(r => r.from), ...outgoing.map(r => r.to)]
    allUids.forEach(async uid => {
      if (userCache[uid]) return
      const snap = await getDoc(doc(db, 'users', uid))
      if (snap.exists()) setUserCache(prev => ({ ...prev, [uid]: snap.data() }))
    })
  }, [incoming, outgoing])

  const accept = async (reqId) => {
    try { await updateDoc(doc(db, 'friendRequests', reqId), { status: 'accepted' }) } catch (e) { console.error(e) }
  }

  const decline = async (reqId) => {
    try { await deleteDoc(doc(db, 'friendRequests', reqId)) } catch (e) { console.error(e) }
  }

  const RequestCard = ({ req, direction }) => {
    const otherUid = direction === 'in' ? req.from : req.to
    const u = userCache[otherUid] || {}
    return (
      <div className="glass rounded-2xl p-3 flex items-center gap-3 border border-transparent">
        <div onClick={() => navigate(`/profile/${otherUid}`)} className="cursor-pointer">
          <Avatar src={u.profilePic} name={u.fullName} size={52} />
        </div>
        <div className="flex-1 min-w-0" onClick={() => navigate(`/profile/${otherUid}`)}>
          <h3 className="font-semibold truncate">{u.fullName || u.username || 'مستخدم'}</h3>
          <p className="text-xs text-white/40 truncate">@{u.username || ''}</p>
        </div>
        {direction === 'in' ? (
          <div className="flex gap-2 shrink-0">
            <button onClick={() => accept(req.id)} className="w-10 h-10 rounded-full gradient-bg text-black flex items-center justify-center" title="قبول">
              <Check size={18} />
            </button>
            <button onClick={() => decline(req.id)} className="w-10 h-10 rounded-full bg-[#111] hover:bg-white/10 border border-white/20 flex items-center justify-center" title="رفض">
              <X size={18} />
            </button>
          </div>
        ) : (
          <button onClick={() => decline(req.id)} className="w-10 h-10 rounded-full bg-[#111] hover:bg-white/10 border border-white/20 flex items-center justify-center shrink-0" title="إلغاء">
            <X size={18} />
          </button>
        )}
      </div>
    )
  }

  return (
    <Layout>
      <div className="flex-1 overflow-y-auto px-4 sm:px-5 pb-28 space-y-4">
        {incoming.length === 0 && outgoing.length === 0 && (
          <div className="text-center text-white/40 py-12">
            <Inbox size={48} className="mx-auto mb-3 opacity-50" />
            <p>لا توجد طلبات صداقة.</p>
          </div>
        )}

        {incoming.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-white/60 mb-2 flex items-center gap-2"><Inbox size={16} /> طلبات واردة</h3>
            <div className="space-y-3">
              {incoming.map(req => <RequestCard key={req.id} req={req} direction="in" />)}
            </div>
          </div>
        )}

        {outgoing.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-white/60 mb-2 flex items-center gap-2"><Send size={16} /> طلبات مرسلة</h3>
            <div className="space-y-3">
              {outgoing.map(req => <RequestCard key={req.id} req={req} direction="out" />)}
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
