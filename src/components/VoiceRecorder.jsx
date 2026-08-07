import React, { useState, useRef, useEffect } from 'react'
import { Mic, Square, X, Send, Pause, Play } from 'lucide-react'

function formatAudioTime(s) {
  if (!isFinite(s) || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function RecordingWaveform() {
  return (
    <div className="flex items-center gap-0.5 h-5">
      {Array.from({ length: 12 }).map((_, i) => (
        <span
          key={i}
          className="w-1 rounded-full bg-red-400 animate-pulse"
          style={{ height: `${20 + Math.random() * 60}%`, animationDelay: `${i * 0.05}s` }}
        />
      ))}
    </div>
  )
}

export function VoiceRecorder({ onRecord, disabled, onStateChange }) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewFile, setPreviewFile] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const mediaRecorder = useRef(null)
  const chunks = useRef([])
  const timer = useRef(null)
  const audioRef = useRef(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current)
      if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
        mediaRecorder.current.stop()
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

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
  }, [previewUrl])

  useEffect(() => {
    if (onStateChange) {
      if (previewUrl) onStateChange('preview')
      else if (recording) onStateChange('recording')
      else onStateChange('idle')
    }
  }, [recording, previewUrl, onStateChange])

  const start = async () => {
    if (disabled) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      mediaRecorder.current = recorder
      chunks.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunks.current, { type: 'audio/webm' })
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' })
        setPreviewUrl(URL.createObjectURL(blob))
        setPreviewFile(file)
        setRecording(false)
        stream.getTracks().forEach(t => t.stop())
      }
      recorder.start(100)
      setRecording(true)
      setSeconds(0)
      timer.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } catch (e) {
      alert('تم رفض إذن الميكروفون أو هو غير مدعوم.')
    }
  }

  const stop = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop()
    }
    if (timer.current) clearInterval(timer.current)
  }

  const togglePreview = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play()
      setPlaying(true)
    }
  }

  const cancelPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewFile(null)
    setSeconds(0)
    setPlaying(false)
    setCurrent(0)
  }

  const sendPreview = () => {
    if (previewFile) {
      onRecord(previewFile)
      cancelPreview()
    }
  }

  if (previewUrl) {
    return (
      <div className="flex-1 flex items-center gap-2 min-w-0" dir="rtl">
        <button
          onClick={togglePreview}
          type="button"
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white hover:bg-white/10 transition"
          aria-label={playing ? 'إيقاف' : 'استماع'}
        >
          {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
        </button>
        <span className="text-xs font-medium text-white/80 tabular-nums w-10 text-center shrink-0">
          {playing ? formatAudioTime(current) : formatAudioTime(duration)}
        </span>
        <div className="flex-1 min-w-0 flex items-center justify-center">
          <span className="text-sm text-white/70 truncate">رسالة صوتية جاهزة للإرسال</span>
        </div>
        <button onClick={cancelPreview} type="button" className="w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white transition shrink-0" title="إلغاء">
          <X size={20} />
        </button>
        <button onClick={sendPreview} type="button" className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center transition shrink-0" title="إرسال">
          <Send size={20} className="scale-x-[-1]" />
        </button>
        <audio ref={audioRef} src={previewUrl} preload="metadata" />
      </div>
    )
  }

  if (!recording) {
    return (
      <button onClick={start} type="button" disabled={disabled} className="w-11 h-11 rounded-full bg-[#111] hover:bg-white/10 border border-white/20 flex items-center justify-center transition disabled:opacity-40" title="تسجيل صوتي">
        <Mic size={20} className="text-white" />
      </button>
    )
  }

  return (
    <button onClick={stop} type="button" className="flex-1 h-11 px-3 rounded-full bg-white/5 border border-white/10 flex items-center justify-between gap-2 text-white animate-pulse">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
        <span className="text-sm font-medium">تسجيل...</span>
      </div>
      <div className="flex items-center gap-2">
        <RecordingWaveform />
        <span className="text-xs tabular-nums">{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span>
        <Square size={16} fill="currentColor" className="text-red-400" />
      </div>
    </button>
  )
}
