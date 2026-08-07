import React, { useRef, useState } from 'react'

export default function PullToRefresh({ onRefresh, children, contentClassName = '' }) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [willRefresh, setWillRefresh] = useState(false)
  const containerRef = useRef(null)
  const startYRef = useRef(null)

  const onTouchStart = (e) => { startYRef.current = e.touches[0].clientY }
  const onTouchMove = (e) => {
    if (startYRef.current == null) return
    const y = e.touches[0].clientY
    const dy = y - startYRef.current
    const el = containerRef.current
    if (el && el.scrollTop <= 0 && dy > 0) {
      const distance = Math.min(dy * 0.4, 90)
      setPull(distance)
      setWillRefresh(distance > 60)
      if (e.cancelable && dy > 5) e.preventDefault()
    }
  }
  const onTouchEnd = async () => {
    if (willRefresh) {
      setRefreshing(true)
      setPull(60)
      startYRef.current = null
      try { await onRefresh() } catch {}
      setRefreshing(false)
      setPull(0)
      setWillRefresh(false)
    } else {
      setPull(0)
      setWillRefresh(false)
      startYRef.current = null
    }
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto overscroll-y-contain relative"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="absolute inset-x-0 top-0 h-16 flex justify-center items-end pointer-events-none transition-opacity"
        style={{ opacity: pull > 0 ? 1 : 0 }}
      >
        <div
          className={`w-7 h-7 rounded-full border-2 border-white/20 ${refreshing ? 'border-t-white animate-spin' : 'border-t-transparent'}`}
          style={{ transform: `rotate(${pull * 3}deg)`, borderTopColor: refreshing ? undefined : `rgba(255,255,255,${Math.min(1, pull / 60)})` }}
        />
      </div>
      <div className={contentClassName} style={{ transform: `translateY(${pull}px)`, transition: pull ? 'none' : 'transform 0.25s ease' }}>
        {children}
      </div>
    </div>
  )
}
