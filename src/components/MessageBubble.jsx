import React, { useRef, useState, useEffect, useMemo } from 'react'
import { Avatar } from './Avatar'
import { formatMessageTime } from '../utils/formatTime'
import { Play, FileText, Download, X, Reply, Heart, Trash2, Plus } from 'lucide-react'
import { loadEmojiCategories } from '../utils/emojis'
import AudioPlayer from './AudioPlayer'

function MediaLightbox({ url, type, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="media-lightbox" onClick={onClose}>
      <button onClick={onClose} className="media-lightbox-close"><X size={28} /></button>
      <div className="media-lightbox-content" onClick={(e) => e.stopPropagation()}>
        {type === 'image' ? (
          <img src={url} alt="preview" className="max-w-full max-h-[85vh] rounded-2xl" />
        ) : (
          <video src={url} controls autoPlay className="max-w-full max-h-[85vh] rounded-2xl" />
        )}
      </div>
    </div>
  )
}

function replyPreviewText(reply) {
  if (!reply) return ''
  if (reply.type === 'image') return 'صورة'
  if (reply.type === 'video') return 'فيديو'
  if (reply.type === 'audio') return 'رسالة صوتية'
  if (reply.type === 'file') return reply.fileName || 'ملف'
  return reply.content || ''
}

const quickEmojis = ['❤️', '👍', '😂', '😮', '😢', '😡', '🎉']

function EmojiPicker({ onReact, userReaction }) {
  const [categories, setCategories] = useState([])
  const [category, setCategory] = useState(null)
  const [recents, setRecents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('gestion-recent-emojis') || '[]')
      if (Array.isArray(stored)) setRecents(stored)
    } catch {}
    loadEmojiCategories().then((cats) => {
      setCategories(cats)
      setCategory((prev) => prev || cats[0]?.name)
      setLoading(false)
    })
  }, [])

  const allCategories = useMemo(() => {
    if (!recents.length) return categories
    return [{ name: 'recent', label: 'أخيرة', emojis: recents }, ...categories]
  }, [categories, recents])

  const active = allCategories.find(c => c.name === category) || allCategories[0]

  const handleSelect = (emoji) => {
    try {
      const next = [emoji, ...recents.filter(e => e !== emoji)].slice(0, 24)
      localStorage.setItem('gestion-recent-emojis', JSON.stringify(next))
    } catch {}
    onReact(emoji)
  }

  if (loading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center py-8">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex flex-wrap gap-2 pb-2 mb-2 max-h-24 overflow-y-auto">
        {allCategories.map((cat) => (
          <button
            key={cat.name}
            onClick={() => setCategory(cat.name)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              cat.name === category
                ? 'bg-white text-black'
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        <div className="grid grid-cols-7 sm:grid-cols-8 gap-1 emoji-font">
          {active?.emojis?.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleSelect(emoji)}
              className={`h-11 rounded-xl text-2xl flex items-center justify-center transition hover:scale-110 hover:bg-white/10 ${
                userReaction === emoji ? 'bg-white/15 ring-1 ring-white/30' : ''
              }`}
              aria-label="إضافة رد فعل"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function MessageMenu({ onClose, onReply, onReact, onDelete, userReaction }) {
  const [showPicker, setShowPicker] = useState(false)

  const handleReact = (emoji) => {
    onReact(emoji)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md mx-auto glass-strong rounded-t-3xl p-4 max-h-[75vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-white">{showPicker ? 'جميع الايموجيات' : 'ردود الفعل'}</h4>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
            <X size={18} />
          </button>
        </div>

        {userReaction && !showPicker && (
          <div className="flex items-center gap-3 mb-3 p-2 rounded-xl bg-white/5">
            <span className="text-2xl emoji-font">{userReaction}</span>
            <span className="text-sm text-white/70">رد فعلك الحالي</span>
            <button
              onClick={() => handleReact(userReaction)}
              className="mr-auto text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition"
            >
              إزالة
            </button>
          </div>
        )}

        {!showPicker ? (
          <>
            <div className="flex flex-wrap items-center justify-center gap-3 mb-4 px-2">
              {quickEmojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReact(emoji)}
                  className="w-11 h-11 rounded-full bg-white/5 hover:bg-white/10 text-2xl flex items-center justify-center transition active:scale-90 emoji-font"
                  aria-label="إضافة رد فعل"
                >
                  {emoji}
                </button>
              ))}
              <button
                onClick={() => setShowPicker(true)}
                className="w-11 h-11 rounded-full bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition active:scale-90"
                aria-label="عرض المزيد من الايموجيات"
              >
                <Plus size={22} />
              </button>
            </div>
            <div className="border-t border-white/10 pt-3 flex flex-col gap-2">
              <button onClick={onReply} className="message-menu-action"><Reply size={16} /> رد</button>
              {onDelete && <button onClick={onDelete} className="message-menu-action text-red-300"><Trash2 size={16} /> حذف</button>}
            </div>
          </>
        ) : (
          <>
            <EmojiPicker onReact={handleReact} userReaction={userReaction} />
            <button
              onClick={() => setShowPicker(false)}
              className="mt-3 text-center text-sm text-white/60 hover:text-white transition"
            >
              رجوع للتفاعلات السريعة
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export const MessageBubble = React.memo(function MessageBubble({ msg, user, isMe, readBy = [], currentUserId, onReply, onReact, onDelete, onProfileClick }) {
  const [loaded, setLoaded] = useState(false)
  const [err, setErr] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showHeart, setShowHeart] = useState(false)
  const [heartPos, setHeartPos] = useState({ x: 0, y: 0 })
  const [translateX, setTranslateX] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [swipeReady, setSwipeReady] = useState(false)

  const longPressRef = useRef(null)
  const touchStartRef = useRef(null)
  const longPressTriggered = useRef(false)
  const suppressClickRef = useRef(false)
  const clickCountRef = useRef(0)
  const clickTimerRef = useRef(null)
  const bubbleRef = useRef(null)
  const name = user?.fullName || 'مجهول'
  const time = formatMessageTime(msg.createdAt)

  const myReaction = useMemo(() => {
    const reactions = msg.reactions || {}
    return Object.entries(reactions).find(([_, users = {}]) => users[currentUserId])?.[0] || null
  }, [msg.reactions, currentUserId])

  const reactionList = useMemo(() => {
    const reactions = msg.reactions || {}
    return Object.entries(reactions)
      .map(([emoji, users = {}]) => ({ emoji, count: Object.keys(users).length, me: !!users[currentUserId] }))
      .filter(r => r.count > 0)
  }, [msg.reactions, currentUserId])

  const handleReaction = (emoji) => {
    if (onReact) onReact(msg, emoji)
    setMenuOpen(false)
  }
  const handleReply = () => {
    if (onReply) onReply(msg)
    setMenuOpen(false)
  }
  const handleDelete = () => {
    if (onDelete) onDelete(msg)
    setMenuOpen(false)
  }

  const showMenu = () => { longPressTriggered.current = true; setMenuOpen(true) }

  const getPoint = (e) => (e.touches && e.touches[0] ? e.touches[0] : e)

  const startTouch = (e) => {
    // Ignore anything but the primary mouse button; right-click uses onContextMenu.
    if (e.type === 'mousedown' && e.button !== 0) return
    const p = getPoint(e)
    if (!p) return
    longPressTriggered.current = false
    suppressClickRef.current = false
    touchStartRef.current = { x: p.clientX, y: p.clientY, time: Date.now() }
    setIsSwiping(false)
    setSwipeReady(false)

    // Long-press opens the menu on touch only; desktop uses right-click.
    if (e.type === 'touchstart') {
      longPressRef.current = setTimeout(() => {
        longPressRef.current = null
        showMenu()
      }, 500)
    }
  }

  const moveTouch = (e) => {
    if (!touchStartRef.current) return
    const p = getPoint(e)
    const dx = p.clientX - touchStartRef.current.x
    const dy = p.clientY - touchStartRef.current.y

    // Cancel long-press if finger moved more than a few pixels.
    if (Math.hypot(dx, dy) > 10 && longPressRef.current) {
      clearTimeout(longPressRef.current)
      longPressRef.current = null
    }

    if (!isSwiping) {
      if (Math.abs(dx) < Math.abs(dy) || Math.abs(dx) < 10) {
        return
      }
      // Horizontal swipe detected - start reply gesture.
      if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null }
      setIsSwiping(true)
      e.preventDefault?.()
    }

    // Constrain movement to the reply direction per message side for a stable, smooth feel.
    const maxOffset = 80
    const progress = dx * 0.4
    let tx
    if (isMe) {
      tx = Math.max(-maxOffset, Math.min(0, progress))
    } else {
      tx = Math.max(0, Math.min(maxOffset, progress))
    }
    setTranslateX(tx)
    setSwipeReady(Math.abs(tx) >= 55)
  }

  const endTouch = () => {
    if (isSwiping) {
      if (swipeReady) {
        setTranslateX(0)
        setIsSwiping(false)
        setSwipeReady(false)
        touchStartRef.current = null
        handleReply()
        return
      }
      suppressClickRef.current = Math.abs(translateX) > 10
      cancelTouch()
      return
    }
    cancelTouch()
  }

  const cancelTouch = () => {
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null }
    touchStartRef.current = null
    setIsSwiping(false)
    setSwipeReady(false)
    setTranslateX(0)
  }

  const onContextMenu = (e) => {
    e.preventDefault()
    showMenu()
  }

  const onBubbleClick = (e) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false
      clickCountRef.current = 0
      return
    }
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      clickCountRef.current = 0
      return
    }

    const p = e.touches?.[0] || e
    const x = p.clientX || 0
    const y = p.clientY || 0

    clickCountRef.current += 1
    if (clickCountRef.current === 1) {
      clickTimerRef.current = setTimeout(() => { clickCountRef.current = 0 }, 300)
    } else {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
      clickCountRef.current = 0
      setHeartPos({ x, y })
      setShowHeart(true)
      setTimeout(() => setShowHeart(false), 900)
      handleReaction('❤️')
    }
  }

  useEffect(() => {
    return () => { if (clickTimerRef.current) clearTimeout(clickTimerRef.current) }
  }, [])

  const renderContent = () => {
    if (msg.type === 'image') {
      return (
        <div className="rounded-xl overflow-hidden cursor-pointer group" onClick={(e) => { e.stopPropagation(); setLightbox(true) }}>
          {!loaded && !err && <div className="w-48 h-32 bg-white/10 animate-pulse rounded-xl" />}
          {err ? (
            <div className="w-48 h-32 flex items-center justify-center text-white/50 text-sm bg-white/5 rounded-xl">تعذر تحميل الصورة</div>
          ) : (
            <img
              src={msg.mediaUrl}
              alt="media"
              className={`max-w-full max-h-60 object-cover rounded-xl ${loaded ? 'block' : 'hidden'} group-hover:opacity-95 transition`}
              onLoad={() => setLoaded(true)}
              onError={() => { setLoaded(true); setErr(true) }}
            />
          )}
        </div>
      )
    }
    if (msg.type === 'video') {
      return (
        <div className="rounded-xl overflow-hidden cursor-pointer relative group" onClick={(e) => { e.stopPropagation(); setLightbox(true) }}>
          <video className="max-w-full max-h-60 rounded-xl" preload="metadata">
            <source src={msg.mediaUrl} />
          </video>
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition">
            <Play size={32} fill="currentColor" className="text-white drop-shadow-lg" />
          </div>
        </div>
      )
    }
    if (msg.type === 'audio') {
      return <AudioPlayer url={msg.mediaUrl} />
    }
    if (msg.type === 'file') {
      return (
        <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-current underline" dir="rtl" onClick={(e) => e.stopPropagation()}>
          <FileText size={18} />
          <span className="max-w-[140px] truncate">{msg.fileName || 'ملف'}</span>
          <Download size={16} />
        </a>
      )
    }
    return <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words" style={{ overflowWrap: 'anywhere' }}>{msg.content}</p>
  }

  const swipeIcon = (
    <div
      className={`absolute top-1/2 -translate-y-1/2 text-white/40 pointer-events-none transition-opacity ${
        isMe ? 'right-full mr-3' : 'left-full ml-3'
      }`}
      style={{ opacity: isSwiping && swipeReady ? 1 : 0 }}
    >
      <Reply size={24} />
    </div>
  )

  return (
    <>
      <div
        className={`w-full flex items-end gap-2 mb-3 page-enter ${isMe ? 'flex-row-reverse justify-start' : 'flex-row justify-start'}`}
        dir="ltr"
      >
        <div className="cursor-pointer" onClick={() => onProfileClick?.(msg.senderId)}>
          <Avatar src={user?.profilePic} name={name} size={30} />
        </div>
        <div className={`flex flex-col max-w-[82%] min-w-0 ${isMe ? 'items-end' : 'items-start'}`} dir="ltr">
          <span
            className="text-[11px] text-white/50 mb-0.5 px-1 cursor-pointer hover:text-white/80 transition"
            dir="rtl"
            onClick={() => onProfileClick?.(msg.senderId)}
          >
            {name}
          </span>
          <div className="relative">
            {swipeIcon}
            <div
              ref={bubbleRef}
              className={`message-bubble ${isMe ? 'sent' : 'received'} relative select-none`}
              style={{
                transform: `translateX(${translateX}px)`,
                transition: isSwiping ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)',
                willChange: 'transform',
                touchAction: 'pan-y',
              }}
              onTouchStart={startTouch}
              onTouchMove={moveTouch}
              onTouchEnd={endTouch}
              onMouseDown={startTouch}
              onMouseMove={moveTouch}
              onMouseUp={endTouch}
              onMouseLeave={cancelTouch}
              onContextMenu={onContextMenu}
              onClick={onBubbleClick}
            >
              {msg.replyTo && (
                <div className="reply-preview">
                  <Reply size={12} className="shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[11px] opacity-80 truncate">{msg.replyTo.senderName}</p>
                    <p className="text-[12px] opacity-70 truncate">{replyPreviewText(msg.replyTo)}</p>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-1" dir="rtl">
                {msg.content && msg.type !== 'text' && (
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words mb-1" style={{ overflowWrap: 'anywhere' }}>{msg.content}</p>
                )}
                {renderContent()}
                <div className={`flex items-center gap-1.5 mt-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`} dir="ltr">
                  <span className="text-[10px] opacity-60">{time}</span>
                  {reactionList.length > 0 && (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {reactionList.map((r) => (
                        <button
                          key={r.emoji}
                          onClick={() => handleReaction(r.emoji)}
                          className={`reaction-pill emoji-font ${r.me ? 'active' : ''}`}
                        >
                          <span>{r.emoji}</span>
                          {r.count > 1 && <span className="text-[10px]">{r.count}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {readBy.length > 0 && (
                    <div className="flex -space-x-1.5 rtl:space-x-reverse" dir="ltr">
                      {readBy.slice(0, 4).map((u, i) => (
                        <div key={i} className="w-[14px] h-[14px] rounded-full overflow-hidden border border-black ring-1 ring-white/20" title={u.fullName}>
                          <Avatar src={u.profilePic} name={u.fullName} size={14} />
                        </div>
                      ))}
                      {readBy.length > 4 && (
                        <span className="text-[10px] text-white/70 ml-1">+{readBy.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {showHeart && (
                <div className="heart-anim" style={{ left: heartPos.x, top: heartPos.y }}>
                  <Heart size={48} fill="#ff4d6d" color="#ff4d6d" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {lightbox && (msg.type === 'image' || msg.type === 'video') && (
        <MediaLightbox url={msg.mediaUrl} type={msg.type} onClose={() => setLightbox(false)} />
      )}
      {menuOpen && (
        <MessageMenu
          onClose={() => setMenuOpen(false)}
          onReply={handleReply}
          onReact={handleReaction}
          onDelete={isMe ? handleDelete : undefined}
          userReaction={myReaction}
        />
      )}
    </>
  )
})
