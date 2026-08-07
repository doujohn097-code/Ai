import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause } from 'lucide-react'

function formatAudioTime(s) {
  if (!isFinite(s) || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function seededRandom(seed) {
  let s = 0
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) % 1000003
  return function () {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

function WaveformBars({ url, pct, playing }) {
  const barCount = 42
  const bars = useMemo(() => {
    const rand = seededRandom(url || 'default')
    return Array.from({ length: barCount }, () => 0.2 + rand() * 0.8)
  }, [url])
  const active = Math.max(0, Math.min(barCount, Math.floor((pct / 100) * barCount)))

  return (
    <div className="waveform-instagram">
      {bars.map((h, i) => {
        const isActive = i < active
        const isPast = i < active - 1
        return (
          <span
            key={i}
            className={`waveform-bar-instagram ${isActive ? 'active' : ''} ${playing && !isPast ? 'animate' : ''}`}
            style={{
              height: `${Math.max(20, h * 100)}%`,
              animationDelay: `${i * 0.05}s`
            }}
          />
        )
      })}
    </div>
  )
}

export default function AudioPlayer({ url, className = '' }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setCurrent(audio.currentTime)
    const onMeta = () => setDuration(audio.duration || 0)
    const onEnd = () => setPlaying(false)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('ended', onEnd)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('ended', onEnd)
    }
  }, [url])

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play()
      setPlaying(true)
    }
  }

  const seek = (e) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    audio.currentTime = Math.max(0, Math.min(duration, duration * pct))
  }

  const pct = duration ? (current / duration) * 100 : 0

  return (
    <div className={`flex items-center gap-3 w-full max-w-full min-w-0 audio-player-instagram ${className}`} dir="ltr">
      <button
        onClick={toggle}
        type="button"
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-white/10 hover:bg-white/15 text-white transition-all duration-200"
        aria-label={playing ? 'إيقاف مؤقت' : 'تشغيل'}
      >
        {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0" onClick={seek}>
        <div className="h-10 cursor-pointer flex items-center px-1">
          <WaveformBars url={url} pct={pct} playing={playing} />
        </div>
      </div>
      <span className="w-11 text-center text-[11px] font-medium text-white/70 tabular-nums shrink-0">
        {playing ? formatAudioTime(current) : formatAudioTime(duration)}
      </span>
      <audio ref={audioRef} src={url} preload="metadata" />
    </div>
  )
}
